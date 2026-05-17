// ═══════════════════════════════════════════════════════════════════════════
// App — assemblage Express. Séparé de index.ts pour pouvoir être importé
// par les tests (supertest) sans démarrer un serveur HTTP réel.
// ═══════════════════════════════════════════════════════════════════════════

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { setupExpressErrorHandler as setupSentryErrorHandler } from "./instrument";
import path from "node:path";
import fs from "node:fs";
import type { Config } from "./config";
import { type DB, type RowDataPacket, createPool, runMigrations } from "./db";
import { MysqlRepository } from "./repository";
import { buildCrudRouter } from "./routes/crud";
import { buildAuthRouter } from "./routes/auth";
import { buildBackupRouter } from "./routes/backup";
import { buildMicrosoftRouter, buildEmailRouter } from "./routes/microsoft";
import { buildAdminUsersRouter } from "./routes/admin-users";
import { buildAdminLogsRouter } from "./routes/admin-logs";
import { buildSuperAdminRouter } from "./routes/super-admin";
import { buildVaultRouter } from "./routes/vault";
import { requireAuth } from "./auth";
import { requireRole } from "./rbac";
import { buildLoginRateLimiter, buildApiRateLimiter } from "./rate-limit";
import { startRevokedTokensPurgeJob } from "./token-revocation";

export interface AppContext {
  db: DB;
  config: Config;
}

// ─── Listes de colonnes ──────────────────────────────────────────────────
const CLIENT_COLS = [
  "type",
  "civility",
  "firstName",
  "lastName",
  "companyName",
  "email",
  "phoneMobile",
  "phoneFixed",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "city",
  "country",
  "billingAddressSame",
  "billingAddressLine1",
  "billingAddressLine2",
  "billingPostalCode",
  "billingCity",
  "billingCountry",
  "siret",
  "siren",
  "tvaIntracom",
  "legalForm",
  "apeCode",
  "apeLabel",
  "tags",
  "source",
  "notes",
  "firstContactAt",
];

const SUPPLIER_COLS = [
  "companyName",
  "contactFirstName",
  "contactLastName",
  "email",
  "phoneMobile",
  "phoneFixed",
  "website",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "city",
  "country",
  "siret",
  "siren",
  "tvaIntracom",
  "legalForm",
  "apeCode",
  "apeLabel",
  "category",
  "iban",
  "bic",
  "paymentTermsDays",
  "paymentMethod",
  "tags",
  "notes",
];

const CHANTIER_COLS = [
  "reference",
  "title",
  "status",
  "priority",
  "clientId",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "city",
  "country",
  "nature",
  "description",
  "startDateEstimated",
  "endDateEstimated",
  "startDateActual",
  "endDateActual",
  "budgetEstimatedHT",
  "budgetEstimatedTTC",
  "photos",
  "tags",
  "categoryId",
  "notes",
];

const QUOTE_COLS = [
  "reference",
  "status",
  "title",
  "clientId",
  "chantierId",
  "issueDate",
  "validUntilDate",
  "acceptedAt",
  "sentAt",
  "items",
  "globalDiscountMode",
  "globalDiscountPercent",
  "globalDiscountAmount",
  "introText",
  "conditionsText",
  "footerText",
  "internalNotes",
  "companySnapshot",
  "totalHT",
  "totalTTC",
];

const INVOICE_COLS = [
  "reference",
  "status",
  "type",
  "title",
  "clientId",
  "chantierId",
  "fromQuoteId",
  "issueDate",
  "dueDate",
  "paymentTermsDays",
  "sentAt",
  "paidAt",
  "items",
  "globalDiscountMode",
  "globalDiscountPercent",
  "globalDiscountAmount",
  "acompteBasedOnQuoteId",
  "acomptePercent",
  "avoirReferenceInvoiceId",
  "introText",
  "conditionsText",
  "footerText",
  "internalNotes",
  "companySnapshot",
  "totalHT",
  "totalTTC",
  "totalPaid",
  "lastReminderSentAt",
  "remindersCount",
];

export async function createApp(cfg: Config, db?: DB): Promise<{ app: Express; ctx: AppContext }> {
  const pool = db ?? createPool(cfg);
  await runMigrations(pool);

  // Purge périodique des tokens révoqués expirés (idempotent, sans effet
  // si la table est vide). Démarre seulement si on n'est pas en test.
  if (cfg.NODE_ENV !== "test") {
    startRevokedTokensPurgeJob(pool);
  }

  const app = express();
  app.disable("x-powered-by");

  // Trust proxy : Passenger/cPanel met l'IP réelle dans X-Forwarded-For.
  // Sans ça, req.ip serait 127.0.0.1 et le rate-limit serait inutile.
  app.set("trust proxy", 1);

  // Helmet : headers de sécurité (HSTS, X-Frame-Options, X-Content-Type-Options…)
  // CSP : on garde le préréglage permissif car le SPA charge ses assets locaux
  // + des ressources Microsoft pour OAuth. À durcir si besoin.
  app.use(
    helmet({
      contentSecurityPolicy: false, // SPA + OAuth flow → CSP custom à étudier
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: cfg.CORS_ORIGINS,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));

  // Rate-limit global API (anti scraper/bot)
  app.use(buildApiRateLimiter(cfg));

  app.get("/api/health", (_req, res) => {
    // Volontairement minimal : pas de version exposée publiquement (info leak)
    res.json({ ok: true });
  });

  // ─── Debug : déclenche une erreur volontaire pour tester Sentry ─────────
  // Admin only. L'exception remonte jusqu'au handler d'erreur Express où
  // Sentry la capture (si SENTRY_DSN est configuré). Réponse attendue : 500.
  // Sert UNIQUEMENT à vérifier que le monitoring fonctionne — aucun effet
  // de bord, aucune donnée touchée.
  app.get(
    "/api/debug/sentry-test",
    requireAuth(cfg, pool),
    requireRole("admin"),
    (_req: Request, _res: Response) => {
      throw new Error(
        `Sentry server test — ${new Date().toISOString()} (déclenché volontairement via /api/debug/sentry-test)`
      );
    }
  );

  // Rate-limit STRICT sur le login (anti brute-force)
  app.use("/api/auth/login", buildLoginRateLimiter(cfg));
  app.use("/api/auth", buildAuthRouter(pool, cfg));

  // ─── Admin : gestion utilisateurs (admin only) ─────────────────────────
  app.use("/api/admin/users", buildAdminUsersRouter(pool, cfg));

  // ─── Admin : audit logs (admin only) ────────────────────────────────────
  app.use("/api/admin/logs", buildAdminLogsRouter(pool, cfg));

  // ─── Super-admin : gestion des entreprises clientes (super_admin only) ──
  app.use("/api/super-admin", buildSuperAdminRouter(pool, cfg));

  const auth = requireAuth(cfg, pool);

  // ─── Clients ───────────────────────────────────────────────────────────
  const clients = new MysqlRepository(pool, "clients", {
    primaryKey: "client",
    filterableColumns: ["type", "city", "siret", "email", "createdBy"],
    sortableColumns: ["createdAt", "lastName", "companyName"],
    writableColumns: CLIENT_COLS,
    jsonColumns: ["tags"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/clients", auth, buildCrudRouter(clients, { db: pool, resourceName: "clients" }));

  // ─── Suppliers ─────────────────────────────────────────────────────────
  const suppliers = new MysqlRepository(pool, "suppliers", {
    primaryKey: "client",
    filterableColumns: ["category", "city", "siret", "createdBy"],
    sortableColumns: ["createdAt", "companyName"],
    writableColumns: SUPPLIER_COLS,
    jsonColumns: ["tags"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/suppliers", auth, buildCrudRouter(suppliers, { db: pool, resourceName: "suppliers" }));
  // Alias rétro-compatible
  app.use("/api/fournisseurs", auth, buildCrudRouter(suppliers, { db: pool, resourceName: "suppliers" }));

  // ─── Chantiers ─────────────────────────────────────────────────────────
  const chantiers = new MysqlRepository(pool, "chantiers", {
    primaryKey: "client",
    filterableColumns: ["status", "priority", "clientId", "city", "categoryId", "createdBy"],
    sortableColumns: ["createdAt", "reference", "title", "startDateEstimated"],
    writableColumns: CHANTIER_COLS,
    jsonColumns: ["photos", "tags"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/chantiers", auth, buildCrudRouter(chantiers, { db: pool, resourceName: "chantiers" }));

  // ─── Quotes ────────────────────────────────────────────────────────────
  const quotes = new MysqlRepository(pool, "quotes", {
    primaryKey: "client",
    filterableColumns: ["status", "clientId", "chantierId", "reference", "createdBy"],
    sortableColumns: ["createdAt", "issueDate", "reference", "totalTTC"],
    writableColumns: QUOTE_COLS,
    jsonColumns: ["items", "companySnapshot"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/quotes", auth, buildCrudRouter(quotes, { db: pool, resourceName: "quotes" }));

  // ─── Invoices ──────────────────────────────────────────────────────────
  const invoices = new MysqlRepository(pool, "invoices", {
    primaryKey: "client",
    filterableColumns: ["status", "type", "clientId", "chantierId", "fromQuoteId", "reference", "createdBy"],
    sortableColumns: ["createdAt", "issueDate", "dueDate", "reference", "totalTTC"],
    writableColumns: INVOICE_COLS,
    jsonColumns: ["items", "companySnapshot"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/invoices", auth, buildCrudRouter(invoices, { db: pool, resourceName: "invoices" }));

  // ─── Invoice payments ──────────────────────────────────────────────────
  const invoicePayments = new MysqlRepository(pool, "invoice_payments", {
    primaryKey: "client",
    filterableColumns: ["invoiceId", "method", "createdBy"],
    sortableColumns: ["createdAt", "date", "amount"],
    writableColumns: ["invoiceId", "amount", "date", "method", "reference", "notes"],
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/invoice-payments", auth, buildCrudRouter(invoicePayments, { db: pool, resourceName: "invoice_payments" }));

  // ─── Expenses ──────────────────────────────────────────────────────────
  const expenses = new MysqlRepository(pool, "expenses", {
    primaryKey: "client",
    filterableColumns: ["category", "supplierId", "chantierId", "isPaid", "createdBy"],
    sortableColumns: ["date", "amount", "createdAt"],
    writableColumns: [
      "label",
      "amount",
      "date",
      "category",
      "supplierId",
      "chantierId",
      "paymentMethod",
      "paidDate",
      "isPaid",
      "notes",
      "attachmentPath",
    ],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/expenses", auth, buildCrudRouter(expenses, { db: pool, resourceName: "expenses" }));

  // ─── Expense notes ─────────────────────────────────────────────────────
  const expenseNotes = new MysqlRepository(pool, "expense_notes", {
    primaryKey: "client",
    filterableColumns: ["category", "chantierId", "isReimbursed", "isValidated", "createdBy"],
    sortableColumns: ["date", "amount", "createdAt"],
    writableColumns: [
      "label",
      "amount",
      "date",
      "category",
      "chantierId",
      "isReimbursable",
      "isReimbursed",
      "reimbursedDate",
      "isValidated",
      "validatedAt",
      "attachmentPath",
      "notes",
    ],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/expense-notes", auth, buildCrudRouter(expenseNotes, { db: pool, resourceName: "expense_notes" }));

  // ─── Subcontractors ────────────────────────────────────────────────────
  const subcontractors = new MysqlRepository(pool, "subcontractors", {
    primaryKey: "client",
    filterableColumns: ["activity", "siret", "city", "createdBy"],
    sortableColumns: ["companyName", "createdAt"],
    writableColumns: [
      "companyName",
      "contactFirstName",
      "contactLastName",
      "email",
      "phoneMobile",
      "phoneFixed",
      "siret",
      "siren",
      "tvaIntracom",
      "addressLine1",
      "addressLine2",
      "postalCode",
      "city",
      "country",
      "activity",
      "retentionRate",
      "vatRate",
      "isVatExempt",
      "iban",
      "bic",
      "paymentTermsDays",
      "notes",
    ],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/subcontractors", auth, buildCrudRouter(subcontractors, { db: pool, resourceName: "subcontractors" }));

  // ─── Agenda events ─────────────────────────────────────────────────────
  const agendaEvents = new MysqlRepository(pool, "agenda_events", {
    primaryKey: "client",
    filterableColumns: ["type", "clientId", "chantierId", "createdBy"],
    sortableColumns: ["startDate", "createdAt"],
    writableColumns: [
      "title",
      "description",
      "type",
      "startDate",
      "endDate",
      "isAllDay",
      "location",
      "clientId",
      "chantierId",
      "reminderMinutes",
      "outlookEventId",
      "lastSyncedAt",
    ],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use("/api/agenda-events", auth, buildCrudRouter(agendaEvents, { db: pool, resourceName: "agenda_events" }));

  // ─── Public route : liste compacte des users (id+nom+role) ────────────
  // Pour afficher "Créé par X" dans les listes Devis/Factures sans donner
  // accès à toute la table users (réservée aux admins via /api/admin/users).
  app.get(
    "/api/users/public",
    auth,
    asyncHandler(async (req, res) => {
      // Multi-tenant : on ne montre que les users de la même company
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, username, firstName, lastName, avatarUrl, role
         FROM users
         WHERE disabled = 0 AND companyId = ?
         ORDER BY firstName, lastName, username`,
        [tenantId]
      );
      res.json(rows);
    })
  );

  // ─── Settings ──────────────────────────────────────────────────────────
  app.get(
    "/api/settings",
    auth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.query("SELECT `key`, value FROM settings");
      const obj: Record<string, unknown> = {};
      for (const r of rows as Array<{ key: string; value: string }>) {
        try {
          obj[r.key] = JSON.parse(r.value);
        } catch {
          obj[r.key] = r.value;
        }
      }
      res.json(obj);
    })
  );

  app.patch(
    "/api/settings",
    auth,
    asyncHandler(async (req, res) => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const [k, v] of Object.entries(req.body ?? {})) {
          await conn.execute(
            "INSERT INTO settings (`key`, value) VALUES (?, ?) " +
              "ON DUPLICATE KEY UPDATE value = VALUES(value)",
            [k, JSON.stringify(v)]
          );
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      const [rows] = await pool.query("SELECT `key`, value FROM settings");
      const obj: Record<string, unknown> = {};
      for (const r of rows as Array<{ key: string; value: string }>) {
        try {
          obj[r.key] = JSON.parse(r.value);
        } catch {
          obj[r.key] = r.value;
        }
      }
      res.json(obj);
    })
  );

  // ─── Company profile (multi-tenant) ────────────────────────────────────
  // GET : tous les users authentifiés peuvent lire leur propre company
  // PATCH : admin only (les employés ne peuvent PAS modifier les infos d'entreprise)
  // POST /complete-setup : marque l'onboarding comme terminé (admin only)
  app.get(
    "/api/company",
    auth,
    asyncHandler(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT data, name, isSetupComplete FROM company WHERE id = ? LIMIT 1",
        [tenantId]
      );
      const r = (rows as Array<{
        data: string | object;
        name: string;
        isSetupComplete: number;
      }>)[0];
      if (!r) {
        res.json({});
        return;
      }
      const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data ?? {};
      // On expose name + isSetupComplete au top niveau (à côté du blob `data`)
      res.json({
        ...data,
        _meta: {
          companyId: tenantId,
          name: r.name ?? "",
          isSetupComplete: Boolean(r.isSetupComplete),
        },
      });
    })
  );

  app.patch(
    "/api/company",
    auth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT data FROM company WHERE id = ? LIMIT 1",
        [tenantId]
      );
      const existing = (rows as Array<{ data: string | object }>)[0];
      const current =
        existing && typeof existing.data === "string"
          ? JSON.parse(existing.data)
          : existing?.data ?? {};
      // Si companyName est modifié, on met aussi à jour la colonne name
      // dénormalisée (pour les jointures et l'affichage rapide)
      const incoming = req.body ?? {};
      const merged = { ...current, ...incoming };
      const newName = (incoming as { companyName?: string }).companyName;
      if (typeof newName === "string") {
        await pool.execute(
          "UPDATE company SET data = ?, name = ? WHERE id = ?",
          [JSON.stringify(merged), newName, tenantId]
        );
      } else {
        await pool.execute(
          "UPDATE company SET data = ? WHERE id = ?",
          [JSON.stringify(merged), tenantId]
        );
      }
      res.json(merged);
    })
  );

  // Marque le setup comme terminé (sortie du tutoriel d'onboarding)
  app.post(
    "/api/company/complete-setup",
    auth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      await pool.execute(
        "UPDATE company SET isSetupComplete = 1 WHERE id = ?",
        [tenantId]
      );
      res.json({ ok: true, isSetupComplete: true });
    })
  );

  // ─── Microsoft + email ─────────────────────────────────────────────────
  app.use("/api/auth/microsoft", buildMicrosoftRouter(pool, cfg));
  app.use("/api/email", auth, buildEmailRouter(pool, cfg));

  // ─── Backup serveur ────────────────────────────────────────────────────
  app.use("/api/backup", auth, buildBackupRouter(pool, cfg));

  // ─── Vault (coffre-fort documents) ─────────────────────────────────────
  app.use("/api/vault", buildVaultRouter(pool, cfg));

  // ─── Static SPA ────────────────────────────────────────────────────────
  const publicDir = path.resolve(process.cwd(), "public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { maxAge: "1y", index: false }));
    app.get(/^(?!\/api).*/, (_req, res, next) => {
      const indexPath = path.join(publicDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  // 404
  app.use((_req, res) => {
    res.status(404).json({ message: "Route inconnue" });
  });

  // Sentry catches errors that propagate to here (no-op if DSN unset
  // or if @sentry/node isn't installed on the host).
  setupSentryErrorHandler(app);

  // Error handler — en prod : pas de leak de stack trace
  const isProd = cfg.NODE_ENV === "production";
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[express] error on ${req.method} ${req.path}:`, err);
    res.status(500).json({
      message: isProd
        ? "Erreur interne du serveur"
        : err instanceof Error
          ? err.message
          : "Erreur interne",
    });
  });

  return { app, ctx: { db: pool, config: cfg } };
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => handler(req, res).catch(next);
}
