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
import { type DB, createPool, runMigrations } from "./db";
import { MysqlRepository } from "./repository";
import { buildCrudRouter } from "./routes/crud";
import { buildAuthRouter } from "./routes/auth";
import { buildBackupRouter } from "./routes/backup";
import { buildMicrosoftRouter, buildEmailRouter } from "./routes/microsoft";
import { requireAuth } from "./auth";

export interface AppContext {
  db: DB;
  config: Config;
}

export async function createApp(cfg: Config, db?: DB): Promise<{ app: Express; ctx: AppContext }> {
  const pool = db ?? createPool(cfg);
  await runMigrations(pool);

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: cfg.CORS_ORIGINS,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, version: "0.1.0", time: new Date().toISOString() });
  });

  app.use("/api/auth", buildAuthRouter(pool, cfg));

  const auth = requireAuth(cfg);

  const clients = new MysqlRepository(pool, "clients", {
    filterableColumns: ["nom", "email", "siret"],
    sortableColumns: ["id", "nom", "createdAt"],
    writableColumns: ["nom", "email", "telephone", "adresse", "siret", "notes"],
    hasUpdatedAt: true,
  });
  app.use("/api/clients", auth, buildCrudRouter(clients));

  const fournisseurs = new MysqlRepository(pool, "fournisseurs", {
    filterableColumns: ["nom", "email", "siret"],
    sortableColumns: ["id", "nom", "createdAt"],
    writableColumns: ["nom", "email", "telephone", "adresse", "siret", "notes"],
    hasUpdatedAt: true,
  });
  app.use("/api/fournisseurs", auth, buildCrudRouter(fournisseurs));

  const chantiers = new MysqlRepository(pool, "chantiers", {
    filterableColumns: ["clientId", "statut", "priorite"],
    sortableColumns: ["id", "nom", "dateDebut", "createdAt"],
    writableColumns: [
      "nom",
      "clientId",
      "adresse",
      "statut",
      "priorite",
      "dateDebut",
      "dateFin",
      "notes",
    ],
    hasUpdatedAt: true,
  });
  app.use("/api/chantiers", auth, buildCrudRouter(chantiers));

  // ─── Factures (PK string UUID, items JSON) ─────────────────────────────
  const invoices = new MysqlRepository(pool, "invoices", {
    primaryKey: "client",
    filterableColumns: [
      "status",
      "type",
      "clientId",
      "chantierId",
      "fromQuoteId",
      "reference",
    ],
    sortableColumns: ["createdAt", "issueDate", "dueDate", "reference", "totalTTC"],
    writableColumns: [
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
    ],
    jsonColumns: ["items", "companySnapshot"],
    hasUpdatedAt: true,
  });
  app.use("/api/invoices", auth, buildCrudRouter(invoices));

  // ─── Paiements (sub-resource des factures) ─────────────────────────────
  const invoicePayments = new MysqlRepository(pool, "invoice_payments", {
    primaryKey: "client",
    filterableColumns: ["invoiceId", "method"],
    sortableColumns: ["createdAt", "date", "amount"],
    writableColumns: ["invoiceId", "amount", "date", "method", "reference", "notes"],
  });
  app.use("/api/invoice-payments", auth, buildCrudRouter(invoicePayments));

  // ─── Devis ─────────────────────────────────────────────────────────────
  const quotes = new MysqlRepository(pool, "quotes", {
    primaryKey: "client",
    filterableColumns: ["status", "clientId", "chantierId", "reference"],
    sortableColumns: ["createdAt", "issueDate", "reference", "totalTTC"],
    writableColumns: [
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
    ],
    jsonColumns: ["items", "companySnapshot"],
    hasUpdatedAt: true,
  });
  app.use("/api/quotes", auth, buildCrudRouter(quotes));

  // ─── Dépenses ──────────────────────────────────────────────────────────
  const expenses = new MysqlRepository(pool, "expenses", {
    filterableColumns: ["category", "supplierId", "chantierId", "isPaid"],
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
  });
  app.use("/api/expenses", auth, buildCrudRouter(expenses));

  // ─── Notes de frais ────────────────────────────────────────────────────
  const expenseNotes = new MysqlRepository(pool, "expense_notes", {
    filterableColumns: ["category", "chantierId", "isReimbursed", "isValidated"],
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
  });
  app.use("/api/expense-notes", auth, buildCrudRouter(expenseNotes));

  // ─── Sous-traitants ────────────────────────────────────────────────────
  const subcontractors = new MysqlRepository(pool, "subcontractors", {
    filterableColumns: ["activity", "siret"],
    sortableColumns: ["nom", "createdAt"],
    writableColumns: [
      "nom",
      "siret",
      "email",
      "telephone",
      "adresse",
      "contactPerson",
      "activity",
      "retentionRate",
      "vatRate",
      "isVatExempt",
      "notes",
    ],
    hasUpdatedAt: true,
  });
  app.use("/api/subcontractors", auth, buildCrudRouter(subcontractors));

  // ─── Agenda events ─────────────────────────────────────────────────────
  const agendaEvents = new MysqlRepository(pool, "agenda_events", {
    filterableColumns: ["type", "clientId", "chantierId"],
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
  });
  app.use("/api/agenda-events", auth, buildCrudRouter(agendaEvents));

  // ─── Microsoft OAuth (Outlook + Graph) ─────────────────────────────────
  // Les routes /login et /callback sont publiques (le user JWT est passé
  // en query parce que les redirects ne portent pas l'header Authorization).
  app.use("/api/auth/microsoft", buildMicrosoftRouter(pool, cfg));

  // ─── Email via Graph API (nécessite que le user soit connecté) ─────────
  app.use("/api/email", auth, buildEmailRouter(pool, cfg));

  // ─── Backup serveur ────────────────────────────────────────────────────
  app.use("/api/backup", auth, buildBackupRouter(pool, cfg));

  // ─── Settings (key/value JSON) ─────────────────────────────────────────
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

  // ─── Static SPA (web app buildée) ──────────────────────────────────────
  // Le doc root contient un dossier `public/` créé par le déploiement web
  // (cp apps/web/dist/* public/). On le sert pour toute requête non-/api.
  const publicDir = path.resolve(process.cwd(), "public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { maxAge: "1y", index: false }));
    // SPA fallback : toute route inconnue (sauf /api/*) → index.html
    app.get(/^(?!\/api).*/, (_req, res, next) => {
      const indexPath = path.join(publicDir, "index.html");
      if (fs.existsSync(indexPath)) {
        // index.html sans cache pour pousser les nouveaux builds rapidement
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  // 404 handler (uniquement /api/* qui n'a pas matché — SPA déjà géré au-dessus)
  app.use((_req, res) => {
    res.status(404).json({ message: "Route inconnue" });
  });

  // Error handler global
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[express] error:", err);
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : "Erreur interne" });
  });

  return { app, ctx: { db: pool, config: cfg } };
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => handler(req, res).catch(next);
}
