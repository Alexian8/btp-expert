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
const admin_users_1 = require("./routes/admin-users");
const auth_2 = require("./auth");
const rate_limit_1 = require("./rate-limit");
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
async function createApp(cfg, db) {
    const pool = db ?? (0, db_1.createPool)(cfg);
    await (0, db_1.runMigrations)(pool);
    const app = (0, express_1.default)();
    app.disable("x-powered-by");
    // Trust proxy : Passenger/cPanel met l'IP réelle dans X-Forwarded-For.
    // Sans ça, req.ip serait 127.0.0.1 et le rate-limit serait inutile.
    app.set("trust proxy", 1);
    // Helmet : headers de sécurité (HSTS, X-Frame-Options, X-Content-Type-Options…)
    // CSP : on garde le préréglage permissif car le SPA charge ses assets locaux
    // + des ressources Microsoft pour OAuth. À durcir si besoin.
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false, // SPA + OAuth flow → CSP custom à étudier
        crossOriginEmbedderPolicy: false,
    }));
    app.use((0, cors_1.default)({
        origin: cfg.CORS_ORIGINS,
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: "10mb" }));
    // Rate-limit global API (anti scraper/bot)
    app.use((0, rate_limit_1.buildApiRateLimiter)(cfg));
    app.get("/api/health", (_req, res) => {
        // Volontairement minimal : pas de version exposée publiquement (info leak)
        res.json({ ok: true });
    });
    // Rate-limit STRICT sur le login (anti brute-force)
    app.use("/api/auth/login", (0, rate_limit_1.buildLoginRateLimiter)(cfg));
    app.use("/api/auth", (0, auth_1.buildAuthRouter)(pool, cfg));
    // ─── Admin : gestion utilisateurs (admin only) ─────────────────────────
    app.use("/api/admin/users", (0, admin_users_1.buildAdminUsersRouter)(pool, cfg));
    const auth = (0, auth_2.requireAuth)(cfg);
    // ─── Clients ───────────────────────────────────────────────────────────
    const clients = new repository_1.MysqlRepository(pool, "clients", {
        primaryKey: "client",
        filterableColumns: ["type", "city", "siret", "email", "createdBy"],
        sortableColumns: ["createdAt", "lastName", "companyName"],
        writableColumns: CLIENT_COLS,
        jsonColumns: ["tags"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
    });
    app.use("/api/clients", auth, (0, crud_1.buildCrudRouter)(clients));
    // ─── Suppliers ─────────────────────────────────────────────────────────
    const suppliers = new repository_1.MysqlRepository(pool, "suppliers", {
        primaryKey: "client",
        filterableColumns: ["category", "city", "siret", "createdBy"],
        sortableColumns: ["createdAt", "companyName"],
        writableColumns: SUPPLIER_COLS,
        jsonColumns: ["tags"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
    });
    app.use("/api/suppliers", auth, (0, crud_1.buildCrudRouter)(suppliers));
    // Alias rétro-compatible
    app.use("/api/fournisseurs", auth, (0, crud_1.buildCrudRouter)(suppliers));
    // ─── Chantiers ─────────────────────────────────────────────────────────
    const chantiers = new repository_1.MysqlRepository(pool, "chantiers", {
        primaryKey: "client",
        filterableColumns: ["status", "priority", "clientId", "city", "categoryId", "createdBy"],
        sortableColumns: ["createdAt", "reference", "title", "startDateEstimated"],
        writableColumns: CHANTIER_COLS,
        jsonColumns: ["photos", "tags"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
    });
    app.use("/api/chantiers", auth, (0, crud_1.buildCrudRouter)(chantiers));
    // ─── Quotes ────────────────────────────────────────────────────────────
    const quotes = new repository_1.MysqlRepository(pool, "quotes", {
        primaryKey: "client",
        filterableColumns: ["status", "clientId", "chantierId", "reference", "createdBy"],
        sortableColumns: ["createdAt", "issueDate", "reference", "totalTTC"],
        writableColumns: QUOTE_COLS,
        jsonColumns: ["items", "companySnapshot"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
    });
    app.use("/api/quotes", auth, (0, crud_1.buildCrudRouter)(quotes));
    // ─── Invoices ──────────────────────────────────────────────────────────
    const invoices = new repository_1.MysqlRepository(pool, "invoices", {
        primaryKey: "client",
        filterableColumns: ["status", "type", "clientId", "chantierId", "fromQuoteId", "reference", "createdBy"],
        sortableColumns: ["createdAt", "issueDate", "dueDate", "reference", "totalTTC"],
        writableColumns: INVOICE_COLS,
        jsonColumns: ["items", "companySnapshot"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
    });
    app.use("/api/invoices", auth, (0, crud_1.buildCrudRouter)(invoices));
    // ─── Invoice payments ──────────────────────────────────────────────────
    const invoicePayments = new repository_1.MysqlRepository(pool, "invoice_payments", {
        primaryKey: "client",
        filterableColumns: ["invoiceId", "method", "createdBy"],
        sortableColumns: ["createdAt", "date", "amount"],
        writableColumns: ["invoiceId", "amount", "date", "method", "reference", "notes"],
        hasAuditColumns: true,
    });
    app.use("/api/invoice-payments", auth, (0, crud_1.buildCrudRouter)(invoicePayments));
    // ─── Expenses ──────────────────────────────────────────────────────────
    const expenses = new repository_1.MysqlRepository(pool, "expenses", {
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
    app.use("/api/expenses", auth, (0, crud_1.buildCrudRouter)(expenses));
    // ─── Expense notes ─────────────────────────────────────────────────────
    const expenseNotes = new repository_1.MysqlRepository(pool, "expense_notes", {
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
    app.use("/api/expense-notes", auth, (0, crud_1.buildCrudRouter)(expenseNotes));
    // ─── Subcontractors ────────────────────────────────────────────────────
    const subcontractors = new repository_1.MysqlRepository(pool, "subcontractors", {
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
    app.use("/api/subcontractors", auth, (0, crud_1.buildCrudRouter)(subcontractors));
    // ─── Agenda events ─────────────────────────────────────────────────────
    const agendaEvents = new repository_1.MysqlRepository(pool, "agenda_events", {
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
    app.use("/api/agenda-events", auth, (0, crud_1.buildCrudRouter)(agendaEvents));
    // ─── Public route : liste compacte des users (id+nom+role) ────────────
    // Pour afficher "Créé par X" dans les listes Devis/Factures sans donner
    // accès à toute la table users (réservée aux admins via /api/admin/users).
    app.get("/api/users/public", auth, asyncHandler(async (_req, res) => {
        const [rows] = await pool.query(`SELECT id, username, firstName, lastName, avatarUrl, role
         FROM users WHERE disabled = 0 ORDER BY firstName, lastName, username`);
        res.json(rows);
    }));
    // ─── Settings ──────────────────────────────────────────────────────────
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
    // ─── Company profile (singleton) ───────────────────────────────────────
    app.get("/api/company", auth, asyncHandler(async (_req, res) => {
        const [rows] = (await pool.query("SELECT data FROM company WHERE id = 1"));
        const r = rows[0];
        if (!r) {
            res.json({});
            return;
        }
        const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        res.json(data);
    }));
    app.patch("/api/company", auth, asyncHandler(async (req, res) => {
        const [rows] = (await pool.query("SELECT data FROM company WHERE id = 1"));
        const existing = rows[0];
        const current = existing && typeof existing.data === "string"
            ? JSON.parse(existing.data)
            : existing?.data ?? {};
        const merged = { ...current, ...(req.body ?? {}) };
        await pool.execute("UPDATE company SET data = ? WHERE id = 1", [JSON.stringify(merged)]);
        res.json(merged);
    }));
    // ─── Microsoft + email ─────────────────────────────────────────────────
    app.use("/api/auth/microsoft", (0, microsoft_1.buildMicrosoftRouter)(pool, cfg));
    app.use("/api/email", auth, (0, microsoft_1.buildEmailRouter)(pool, cfg));
    // ─── Backup serveur ────────────────────────────────────────────────────
    app.use("/api/backup", auth, (0, backup_1.buildBackupRouter)(pool, cfg));
    // ─── Static SPA ────────────────────────────────────────────────────────
    const publicDir = node_path_1.default.resolve(process.cwd(), "public");
    if (node_fs_1.default.existsSync(publicDir)) {
        app.use(express_1.default.static(publicDir, { maxAge: "1y", index: false }));
        app.get(/^(?!\/api).*/, (_req, res, next) => {
            const indexPath = node_path_1.default.join(publicDir, "index.html");
            if (node_fs_1.default.existsSync(indexPath)) {
                res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                res.sendFile(indexPath);
            }
            else {
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
    app.use((err, req, res, _next) => {
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
function asyncHandler(handler) {
    return (req, res, next) => handler(req, res).catch(next);
}
//# sourceMappingURL=app.js.map