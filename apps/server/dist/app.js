"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// App — assemblage Express. Séparé de index.ts pour pouvoir être importé
// par les tests (supertest) sans démarrer un serveur HTTP réel.
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const db_1 = require("./db");
const repository_1 = require("./repository");
const crud_1 = require("./routes/crud");
const auth_1 = require("./routes/auth");
const backup_1 = require("./routes/backup");
const microsoft_1 = require("./routes/microsoft");
const auth_2 = require("./auth");
async function createApp(cfg, db) {
    const pool = db ?? (0, db_1.createPool)(cfg);
    await (0, db_1.runMigrations)(pool);
    const app = (0, express_1.default)();
    app.disable("x-powered-by");
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: cfg.CORS_ORIGINS,
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: "10mb" }));
    app.get("/api/health", (_req, res) => {
        res.json({ ok: true, version: "0.1.0", time: new Date().toISOString() });
    });
    app.use("/api/auth", (0, auth_1.buildAuthRouter)(pool, cfg));
    const auth = (0, auth_2.requireAuth)(cfg);
    const clients = new repository_1.MysqlRepository(pool, "clients", {
        filterableColumns: ["nom", "email", "siret"],
        sortableColumns: ["id", "nom", "createdAt"],
        writableColumns: ["nom", "email", "telephone", "adresse", "siret", "notes"],
        hasUpdatedAt: true,
    });
    app.use("/api/clients", auth, (0, crud_1.buildCrudRouter)(clients));
    const fournisseurs = new repository_1.MysqlRepository(pool, "fournisseurs", {
        filterableColumns: ["nom", "email", "siret"],
        sortableColumns: ["id", "nom", "createdAt"],
        writableColumns: ["nom", "email", "telephone", "adresse", "siret", "notes"],
        hasUpdatedAt: true,
    });
    app.use("/api/fournisseurs", auth, (0, crud_1.buildCrudRouter)(fournisseurs));
    const chantiers = new repository_1.MysqlRepository(pool, "chantiers", {
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
    app.use("/api/chantiers", auth, (0, crud_1.buildCrudRouter)(chantiers));
    // ─── Factures (PK string UUID, items JSON) ─────────────────────────────
    const invoices = new repository_1.MysqlRepository(pool, "invoices", {
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
    app.use("/api/invoices", auth, (0, crud_1.buildCrudRouter)(invoices));
    // ─── Paiements (sub-resource des factures) ─────────────────────────────
    const invoicePayments = new repository_1.MysqlRepository(pool, "invoice_payments", {
        primaryKey: "client",
        filterableColumns: ["invoiceId", "method"],
        sortableColumns: ["createdAt", "date", "amount"],
        writableColumns: ["invoiceId", "amount", "date", "method", "reference", "notes"],
    });
    app.use("/api/invoice-payments", auth, (0, crud_1.buildCrudRouter)(invoicePayments));
    // ─── Devis ─────────────────────────────────────────────────────────────
    const quotes = new repository_1.MysqlRepository(pool, "quotes", {
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
    app.use("/api/quotes", auth, (0, crud_1.buildCrudRouter)(quotes));
    // ─── Dépenses ──────────────────────────────────────────────────────────
    const expenses = new repository_1.MysqlRepository(pool, "expenses", {
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
    app.use("/api/expenses", auth, (0, crud_1.buildCrudRouter)(expenses));
    // ─── Notes de frais ────────────────────────────────────────────────────
    const expenseNotes = new repository_1.MysqlRepository(pool, "expense_notes", {
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
    app.use("/api/expense-notes", auth, (0, crud_1.buildCrudRouter)(expenseNotes));
    // ─── Sous-traitants ────────────────────────────────────────────────────
    const subcontractors = new repository_1.MysqlRepository(pool, "subcontractors", {
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
    app.use("/api/subcontractors", auth, (0, crud_1.buildCrudRouter)(subcontractors));
    // ─── Agenda events ─────────────────────────────────────────────────────
    const agendaEvents = new repository_1.MysqlRepository(pool, "agenda_events", {
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
    app.use("/api/agenda-events", auth, (0, crud_1.buildCrudRouter)(agendaEvents));
    // ─── Microsoft OAuth (Outlook + Graph) ─────────────────────────────────
    // Les routes /login et /callback sont publiques (le user JWT est passé
    // en query parce que les redirects ne portent pas l'header Authorization).
    app.use("/api/auth/microsoft", (0, microsoft_1.buildMicrosoftRouter)(pool, cfg));
    // ─── Email via Graph API (nécessite que le user soit connecté) ─────────
    app.use("/api/email", auth, (0, microsoft_1.buildEmailRouter)(pool, cfg));
    // ─── Backup serveur ────────────────────────────────────────────────────
    app.use("/api/backup", auth, (0, backup_1.buildBackupRouter)(pool, cfg));
    // ─── Settings (key/value JSON) ─────────────────────────────────────────
    app.get("/api/settings", auth, asyncHandler(async (_req, res) => {
        const [rows] = await pool.query("SELECT `key`, value FROM settings");
        const obj = {};
        for (const r of rows) {
            try {
                obj[r.key] = JSON.parse(r.value);
            }
            catch {
                obj[r.key] = r.value;
            }
        }
        res.json(obj);
    }));
    app.patch("/api/settings", auth, asyncHandler(async (req, res) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const [k, v] of Object.entries(req.body ?? {})) {
                await conn.execute("INSERT INTO settings (`key`, value) VALUES (?, ?) " +
                    "ON DUPLICATE KEY UPDATE value = VALUES(value)", [k, JSON.stringify(v)]);
            }
            await conn.commit();
        }
        catch (e) {
            await conn.rollback();
            throw e;
        }
        finally {
            conn.release();
        }
        const [rows] = await pool.query("SELECT `key`, value FROM settings");
        const obj = {};
        for (const r of rows) {
            try {
                obj[r.key] = JSON.parse(r.value);
            }
            catch {
                obj[r.key] = r.value;
            }
        }
        res.json(obj);
    }));
    // ─── Static SPA (web app buildée) ──────────────────────────────────────
    // Le doc root contient un dossier `public/` créé par le déploiement web
    // (cp apps/web/dist/* public/). On le sert pour toute requête non-/api.
    const publicDir = node_path_1.default.resolve(process.cwd(), "public");
    if (node_fs_1.default.existsSync(publicDir)) {
        app.use(express_1.default.static(publicDir, { maxAge: "1y", index: false }));
        // SPA fallback : toute route inconnue (sauf /api/*) → index.html
        app.get(/^(?!\/api).*/, (_req, res, next) => {
            const indexPath = node_path_1.default.join(publicDir, "index.html");
            if (node_fs_1.default.existsSync(indexPath)) {
                // index.html sans cache pour pousser les nouveaux builds rapidement
                res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                res.sendFile(indexPath);
            }
            else {
                next();
            }
        });
    }
    // 404 handler (uniquement /api/* qui n'a pas matché — SPA déjà géré au-dessus)
    app.use((_req, res) => {
        res.status(404).json({ message: "Route inconnue" });
    });
    // Error handler global
    app.use((err, _req, res, _next) => {
        console.error("[express] error:", err);
        res
            .status(500)
            .json({ message: err instanceof Error ? err.message : "Erreur interne" });
    });
    return { app, ctx: { db: pool, config: cfg } };
}
function asyncHandler(handler) {
    return (req, res, next) => handler(req, res).catch(next);
}
//# sourceMappingURL=app.js.map