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
import { buildAdminDocsRouter } from "./routes/admin-docs";
import { buildAccountingRouter, accountingHooks } from "./routes/accounting";
import { makeReferenceHook } from "./accounting/references";
import { buildQontoRouter } from "./routes/qonto";
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

  // Defense-in-depth : refuse toute requête sur un .map (au cas où un build
  // génèrerait des sourcemaps qui se retrouveraient dans public/). Doit être
  // déclaré avant express.static — sinon le static handler répond en premier.
  app.use((req, res, next) => {
    if (req.path.endsWith(".map")) {
      res.status(404).end();
      return;
    }
    next();
  });

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
  app.use(
    "/api/quotes",
    auth,
    buildCrudRouter(quotes, {
      db: pool,
      resourceName: "quotes",
      hooks: {
        beforeCreate: makeReferenceHook({
          db: pool,
          idPrefix: "quo",
          table: "quotes",
          referencePrefix: "DEVIS",
        }),
      },
    })
  );

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
  app.use(
    "/api/invoices",
    auth,
    buildCrudRouter(invoices, {
      db: pool,
      resourceName: "invoices",
      hooks: {
        beforeCreate: makeReferenceHook({
          db: pool,
          idPrefix: "inv",
          table: "invoices",
          referencePrefix: "FACT",
        }),
        afterCreate: (id) => accountingHooks.generateInvoiceEntry(pool, id),
        afterUpdate: (id) => accountingHooks.generateInvoiceEntry(pool, id),
        afterDelete: (id) => accountingHooks.deleteEntriesForSource(pool, "invoice", id),
      },
    })
  );

  // ─── Conversion devis → facture ────────────────────────────────────────
  // POST /api/invoices/convert-from-quote
  // Body : { quoteId: string, options: { type?: "standard"|"acompte"|"avoir", acomptePercent?: number } }
  app.post(
    "/api/invoices/convert-from-quote",
    auth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { quoteId, options = {} } = req.body || {};
        if (!quoteId || typeof quoteId !== "string") {
          res.status(400).json({ success: false, error: "quoteId requis" });
          return;
        }
        const [qRows] = await pool.query<RowDataPacket[]>(
          "SELECT * FROM quotes WHERE id = ?",
          [quoteId]
        );
        const quote = qRows[0] as
          | {
              id: string;
              reference: string;
              title: string;
              clientId: string;
              chantierId: string;
              items: unknown;
              globalDiscountMode: string;
              globalDiscountPercent: number;
              globalDiscountAmount: number;
              companySnapshot: unknown;
              totalHT: number;
              totalTTC: number;
            }
          | undefined;
        if (!quote) {
          res.status(404).json({ success: false, error: "Devis introuvable" });
          return;
        }

        const type: "standard" | "acompte" | "avoir" = options.type || "standard";
        const acomptePercent =
          type === "acompte" ? Number(options.acomptePercent) || 30 : 0;

        // Récupère paymentTermsDays depuis settings (singleton id=1, JSON data)
        let paymentTermsDays = 30;
        try {
          const [sRows] = await pool.query<RowDataPacket[]>(
            "SELECT data FROM settings WHERE id = 1"
          );
          const raw = (sRows[0] as { data?: string })?.data;
          const parsed = raw
            ? typeof raw === "string"
              ? JSON.parse(raw)
              : raw
            : {};
          if (parsed?.invoicePaymentTermsDays) {
            paymentTermsDays = Number(parsed.invoicePaymentTermsDays);
          }
        } catch {}

        const issueDate = new Date().toISOString().slice(0, 10);
        const dueDate = (() => {
          const d = new Date(issueDate);
          d.setDate(d.getDate() + paymentTermsDays);
          return d.toISOString().slice(0, 10);
        })();

        // Items / totaux selon le type
        let items: unknown[] = (() => {
          const raw = quote.items;
          if (typeof raw === "string") {
            try {
              return JSON.parse(raw);
            } catch {
              return [];
            }
          }
          return Array.isArray(raw) ? (raw as unknown[]) : [];
        })();
        let totalHT = Number(quote.totalHT);
        let totalTTC = Number(quote.totalTTC);

        if (type === "acompte") {
          // Facture d'acompte : on REPREND toutes les lignes du devis et on
          // applique le % d'acompte sur chaque PU + sur les remises montant.
          // Le total final est cohérent avec totalHT * acomptePercent / 100.
          const ratio = acomptePercent / 100;
          items = (items as Array<{
            kind?: string;
            unitPriceHT?: number;
            discountMode?: string;
            discountAmount?: number;
          }>).map((it) => {
            if (it.kind !== "line") return it;
            const newUnitPriceHT = Number(((Number(it.unitPriceHT) || 0) * ratio).toFixed(2));
            const newDiscountAmount = it.discountMode === "amount"
              ? Number(((Number(it.discountAmount) || 0) * ratio).toFixed(2))
              : Number(it.discountAmount) || 0;
            return {
              ...it,
              unitPriceHT: newUnitPriceHT,
              discountAmount: newDiscountAmount,
            };
          });
          totalHT = Number((totalHT * ratio).toFixed(2));
          totalTTC = Number((totalTTC * ratio).toFixed(2));
        } else if (type === "avoir") {
          items = (items as Array<{ kind?: string; unitPriceHT?: number }>).map((it) => ({
            ...it,
            unitPriceHT:
              it.kind === "line" ? -Math.abs(Number(it.unitPriceHT) || 0) : it.unitPriceHT,
          }));
          totalHT = -Math.abs(totalHT);
          totalTTC = -Math.abs(totalTTC);
        }

        // Génère id + reference via le helper de références
        const refHook = makeReferenceHook({
          db: pool,
          idPrefix: "inv",
          table: "invoices",
          referencePrefix: "FACT",
        });
        const baseBody = await refHook({});
        const id = String(baseBody.id);
        const reference = String(baseBody.reference);

        const title =
          type === "acompte"
            ? `Acompte ${acomptePercent}% - ${quote.title}`
            : type === "avoir"
              ? `Avoir - ${quote.title}`
              : quote.title;

        const companySnapshotStr =
          typeof quote.companySnapshot === "string"
            ? quote.companySnapshot
            : JSON.stringify(quote.companySnapshot ?? {});

        const introText =
          type === "acompte"
            ? `Facture d'acompte de ${acomptePercent} % sur le devis ${quote.reference || ""}. Le solde sera facturé en fin de travaux.`
            : "";

        // Pour l'acompte on garde la même remise globale en % mais on
        // applique le ratio sur la remise globale en montant fixe.
        const ratio = acomptePercent / 100;
        const newGlobalDiscountAmount =
          type === "acompte"
            ? Number((Number(quote.globalDiscountAmount || 0) * ratio).toFixed(2))
            : Number(quote.globalDiscountAmount || 0);

        await pool.query(
          `INSERT INTO invoices (
            id, reference, status, type, title, clientId, chantierId, fromQuoteId,
            issueDate, dueDate, paymentTermsDays, sentAt, paidAt,
            items, globalDiscountMode, globalDiscountPercent, globalDiscountAmount,
            acompteBasedOnQuoteId, acomptePercent, avoirReferenceInvoiceId,
            introText, conditionsText, footerText, internalNotes, companySnapshot,
            totalHT, totalTTC, totalPaid,
            lastReminderSentAt, remindersCount
          ) VALUES (
            ?, ?, 'brouillon', ?, ?, ?, ?, ?,
            ?, ?, ?, '', '',
            ?, ?, ?, ?,
            ?, ?, '',
            ?, '', '', '', ?,
            ?, ?, 0,
            '', 0
          )`,
          [
            id,
            reference,
            type,
            title,
            quote.clientId,
            quote.chantierId,
            type === "acompte" ? "" : quoteId,
            issueDate,
            dueDate,
            paymentTermsDays,
            JSON.stringify(items),
            quote.globalDiscountMode || "none",
            Number(quote.globalDiscountPercent),
            newGlobalDiscountAmount,
            type === "acompte" ? quoteId : "",
            acomptePercent,
            introText,
            companySnapshotStr,
            totalHT,
            totalTTC,
          ]
        );

        // Génère l'écriture comptable
        try {
          await accountingHooks.generateInvoiceEntry(pool, id);
        } catch (err) {
          console.warn(
            "[convert-from-quote accounting hook]",
            (err as Error).message
          );
        }

        const [createdRows] = await pool.query<RowDataPacket[]>(
          "SELECT * FROM invoices WHERE id = ?",
          [id]
        );
        res.json({ success: true, invoice: createdRows[0] });
      } catch (e) {
        console.error("[invoices:convertFromQuote]", e);
        res.status(500).json({ success: false, error: (e as Error).message });
      }
    }
  );

  // ─── Invoice payments ──────────────────────────────────────────────────
  const invoicePayments = new MysqlRepository(pool, "invoice_payments", {
    primaryKey: "client",
    filterableColumns: ["invoiceId", "method", "createdBy"],
    sortableColumns: ["createdAt", "date", "amount"],
    writableColumns: ["invoiceId", "amount", "date", "method", "reference", "notes"],
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use(
    "/api/invoice-payments",
    auth,
    buildCrudRouter(invoicePayments, {
      db: pool,
      resourceName: "invoice_payments",
      hooks: {
        afterCreate: async (id, body) => {
          await accountingHooks.generateInvoicePaymentEntry(pool, id);
          const invId = (body as { invoiceId?: string } | null)?.invoiceId;
          if (invId) await accountingHooks.generateInvoiceEntry(pool, invId);
        },
        afterUpdate: (id) => accountingHooks.generateInvoicePaymentEntry(pool, id),
        afterDelete: (id) =>
          accountingHooks.deleteEntriesForSource(pool, "invoice_payment", id),
      },
    })
  );

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
      // Session 30 — colonnes ajoutées pour la compta partie double
      "reference",
      "supplierName",
      "amountHt",
      "amountVat",
      "amountTtc",
      "vatRate",
      "description",
      "expenseDate",
      "dueDate",
      "status",
      "receiptVaultDocumentId",
    ],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });
  app.use(
    "/api/expenses",
    auth,
    buildCrudRouter(expenses, {
      db: pool,
      resourceName: "expenses",
      hooks: {
        beforeCreate: makeReferenceHook({
          db: pool,
          idPrefix: "dep",
          table: "expenses",
          referencePrefix: "DEP",
        }),
        afterCreate: async (id) => {
          await accountingHooks.generateExpenseEntry(pool, id);
          await accountingHooks.generateExpensePaymentEntry(pool, id);
        },
        afterUpdate: async (id) => {
          await accountingHooks.generateExpenseEntry(pool, id);
          await accountingHooks.generateExpensePaymentEntry(pool, id);
        },
        afterDelete: async (id) => {
          await accountingHooks.deleteEntriesForSource(pool, "expense", id);
          await accountingHooks.deleteEntriesForSource(pool, "expense_payment", id);
        },
      },
    })
  );

  // ─── Accounting (compta partie double) ────────────────────────────────
  app.use("/api/accounting", auth, buildAccountingRouter(pool));

  // ─── Qonto (intégration bancaire — socle lecture seule) ───────────────
  app.use("/api/qonto", auth, buildQontoRouter(pool, cfg));

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
  app.use(
    "/api/expense-notes",
    auth,
    buildCrudRouter(expenseNotes, {
      db: pool,
      resourceName: "expense_notes",
      hooks: {
        beforeCreate: makeReferenceHook({
          db: pool,
          idPrefix: "ndf",
          table: "expense_notes",
          referencePrefix: "NDF",
        }),
        afterCreate: async (id) => {
          await accountingHooks.generateExpenseNoteEntry(pool, id);
          await accountingHooks.generateExpenseNoteRefundEntry(pool, id);
        },
        afterUpdate: async (id) => {
          await accountingHooks.generateExpenseNoteEntry(pool, id);
          await accountingHooks.generateExpenseNoteRefundEntry(pool, id);
        },
        afterDelete: async (id) => {
          await accountingHooks.deleteEntriesForSource(pool, "expense_note", id);
          await accountingHooks.deleteEntriesForSource(pool, "expense_note_refund", id);
        },
      },
    })
  );

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

  // Whitelist des clés acceptées dans /api/settings. On utilise une regex
  // permissive plutôt qu'une liste exacte parce que les sections UI ajoutent
  // régulièrement de nouvelles clés (pdfXxx, emailXxx, etc.). Mais on bloque
  // les clés "magiques" et la pollution de prototype.
  const ALLOWED_SETTING_PREFIXES = [
    "pdf",
    "invoice",
    "quote",
    "email",
    "company",
    "rge",
    "cgv",
    "theme",
    "appearance",
  ];
  const SETTING_KEY_RE = /^[a-z][a-zA-Z0-9_]{0,127}$/;
  const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const MAX_SETTINGS_PER_REQUEST = 200;
  const MAX_SETTING_VALUE_BYTES = 256 * 1024; // 256 KB par valeur

  function isAllowedSettingKey(k: string): boolean {
    if (!SETTING_KEY_RE.test(k)) return false;
    if (FORBIDDEN_KEYS.has(k)) return false;
    return ALLOWED_SETTING_PREFIXES.some((p) => k.startsWith(p));
  }

  app.patch(
    "/api/settings",
    auth,
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const entries = Object.entries(body);

      if (entries.length > MAX_SETTINGS_PER_REQUEST) {
        res
          .status(400)
          .json({ message: `Trop de clés (max ${MAX_SETTINGS_PER_REQUEST})` });
        return;
      }

      // Pré-valide toutes les clés/valeurs avant d'ouvrir la transaction.
      // Si une seule clé est invalide, on rejette tout — pas de partial write.
      const validated: Array<[string, string]> = [];
      for (const [k, v] of entries) {
        if (!isAllowedSettingKey(k)) {
          res.status(400).json({ message: `Clé non autorisée : ${k}` });
          return;
        }
        const serialized = JSON.stringify(v ?? null);
        if (Buffer.byteLength(serialized, "utf8") > MAX_SETTING_VALUE_BYTES) {
          res.status(400).json({ message: `Valeur trop grosse pour ${k}` });
          return;
        }
        validated.push([k, serialized]);
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const [k, serialized] of validated) {
          await conn.execute(
            "INSERT INTO settings (`key`, value) VALUES (?, ?) " +
              "ON DUPLICATE KEY UPDATE value = VALUES(value)",
            [k, serialized]
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

  // ─── Documents administratifs (PV, TVA, DC4, RGE) ──────────────────────
  app.use("/api/admin-docs", buildAdminDocsRouter(pool, cfg));

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
