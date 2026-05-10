// ═══════════════════════════════════════════════════════════════════════════
// App — assemblage Express. Séparé de index.ts pour pouvoir être importé
// par les tests (supertest) sans démarrer un serveur HTTP réel.
// ═══════════════════════════════════════════════════════════════════════════

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
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
import { requireAuth } from "./auth";
import { buildLoginRateLimiter, buildApiRateLimiter } from "./rate-limit";

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

  // Rate-limit STRICT sur le login (anti brute-force)
  app.use("/api/auth/login", buildLoginRateLimiter(cfg));
  app.use("/api/auth", buildAuthRouter(pool, cfg));

  // ─── Admin : gestion utilisateurs (admin only) ─────────────────────────
  app.use("/api/admin/users", buildAdminUsersRouter(pool, cfg));

  const auth = requireAuth(cfg);

  // ─── Clients ───────────────────────────────────────────────────────────
  const clients = new MysqlRepository(pool, "clients", {
    primaryKey: "client",
    filterableColumns: ["type", "city", "siret", "email", "createdBy"],
    sortableColumns: ["createdAt", "lastName", "companyName"],
    writableColumns: CLIENT_COLS,
    jsonColumns: ["tags"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
  });
  app.use("/api/clients", auth, buildCrudRouter(clients));

  // ─── Suppliers ─────────────────────────────────────────────────────────
  const suppliers = new MysqlRepository(pool, "suppliers", {
    primaryKey: "client",
    filterableColumns: ["category", "city", "siret", "createdBy"],
    sortableColumns: ["createdAt", "companyName"],
    writableColumns: SUPPLIER_COLS,
    jsonColumns: ["tags"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
  });
  app.use("/api/suppliers", auth, buildCrudRouter(suppliers));
  // Alias rétro-compatible
  app.use("/api/fournisseurs", auth, buildCrudRouter(suppliers));

  // ─── Chantiers ─────────────────────────────────────────────────────────
  const chantiers = new MysqlRepository(pool, "chantiers", {
    primaryKey: "client",
    filterableColumns: ["status", "priority", "clientId", "city", "categoryId", "createdBy"],
    sortableColumns: ["createdAt", "reference", "title", "startDateEstimated"],
    writableColumns: CHANTIER_COLS,
    jsonColumns: ["photos", "tags"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
  });
  app.use("/api/chantiers", auth, buildCrudRouter(chantiers));

  // ─── Quotes ────────────────────────────────────────────────────────────
  const quotes = new MysqlRepository(pool, "quotes", {
    primaryKey: "client",
    filterableColumns: ["status", "clientId", "chantierId", "reference", "createdBy"],
    sortableColumns: ["createdAt", "issueDate", "reference", "totalTTC"],
    writableColumns: QUOTE_COLS,
    jsonColumns: ["items", "companySnapshot"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
  });
  app.use("/api/quotes", auth, buildCrudRouter(quotes));

  // ─── Invoices ──────────────────────────────────────────────────────────
  const invoices = new MysqlRepository(pool, "invoices", {
    primaryKey: "client",
    filterableColumns: ["status", "type", "clientId", "chantierId", "fromQuoteId", "reference", "createdBy"],
    sortableColumns: ["createdAt", "issueDate", "dueDate", "reference", "totalTTC"],
    writableColumns: INVOICE_COLS,
    jsonColumns: ["items", "companySnapshot"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
  });
  app.use("/api/invoices", auth, buildCrudRouter(invoices));

  // ─── Invoice payments ──────────────────────────────────────────────────
  const invoicePayments = new MysqlRepository(pool, "invoice_payments", {
    primaryKey: "client",
    filterableColumns: ["invoiceId", "method", "createdBy"],
    sortableColumns: ["createdAt", "date", "amount"],
    writableColumns: ["invoiceId", "amount", "date", "method", "reference", "notes"],
    hasAuditColumns: true,
  });
  app.use("/api/invoice-payments", auth, buildCrudRouter(invoicePayments));

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
  });
  app.use("/api/expenses", auth, buildCrudRouter(expenses));

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
  });
  app.use("/api/expense-notes", auth, buildCrudRouter(expenseNotes));

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
  });
  app.use("/api/subcontractors", auth, buildCrudRouter(subcontractors));

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
  });
  app.use("/api/agenda-events", auth, buildCrudRouter(agendaEvents));

  // ─── Public route : liste compacte des users (id+nom+role) ────────────
  // Pour afficher "Créé par X" dans les listes Devis/Factures sans donner
  // accès à toute la table users (réservée aux admins via /api/admin/users).
  app.get(
    "/api/users/public",
    auth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, username, firstName, lastName, avatarUrl, role
         FROM users WHERE disabled = 0 ORDER BY firstName, lastName, username`
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

  // ─── Company profile (singleton) ───────────────────────────────────────
  app.get(
    "/api/company",
    auth,
    asyncHandler(async (_req, res) => {
      const [rows] = (await pool.query("SELECT data FROM company WHERE id = 1")) as unknown as [
        Array<{ data: string | object }>,
      ];
      const r = (rows as Array<{ data: string | object }>)[0];
      if (!r) {
        res.json({});
        return;
      }
      const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
      res.json(data);
    })
  );

  app.patch(
    "/api/company",
    auth,
    asyncHandler(async (req, res) => {
      const [rows] = (await pool.query("SELECT data FROM company WHERE id = 1")) as unknown as [
        Array<{ data: string | object }>,
      ];
      const existing = (rows as Array<{ data: string | object }>)[0];
      const current =
        existing && typeof existing.data === "string"
          ? JSON.parse(existing.data)
          : existing?.data ?? {};
      const merged = { ...current, ...(req.body ?? {}) };
      await pool.execute("UPDATE company SET data = ? WHERE id = 1", [JSON.stringify(merged)]);
      res.json(merged);
    })
  );

  // ─── Microsoft + email ─────────────────────────────────────────────────
  app.use("/api/auth/microsoft", buildMicrosoftRouter(pool, cfg));
  app.use("/api/email", auth, buildEmailRouter(pool, cfg));

  // ─── Backup serveur ────────────────────────────────────────────────────
  app.use("/api/backup", auth, buildBackupRouter(pool, cfg));

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
