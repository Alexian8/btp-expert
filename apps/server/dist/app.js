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
const instrument_1 = require("./instrument");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const db_1 = require("./db");
const repository_1 = require("./repository");
const crud_1 = require("./routes/crud");
const auth_1 = require("./routes/auth");
const backup_1 = require("./routes/backup");
const microsoft_1 = require("./routes/microsoft");
const admin_users_1 = require("./routes/admin-users");
const admin_logs_1 = require("./routes/admin-logs");
const super_admin_1 = require("./routes/super-admin");
const vault_1 = require("./routes/vault");
const admin_docs_1 = require("./routes/admin-docs");
const accounting_1 = require("./routes/accounting");
const references_1 = require("./accounting/references");
const auth_2 = require("./auth");
const rbac_1 = require("./rbac");
const rate_limit_1 = require("./rate-limit");
const token_revocation_1 = require("./token-revocation");
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
    // Purge périodique des tokens révoqués expirés (idempotent, sans effet
    // si la table est vide). Démarre seulement si on n'est pas en test.
    if (cfg.NODE_ENV !== "test") {
        (0, token_revocation_1.startRevokedTokensPurgeJob)(pool);
    }
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
    app.use((0, rate_limit_1.buildApiRateLimiter)(cfg));
    app.get("/api/health", (_req, res) => {
        // Volontairement minimal : pas de version exposée publiquement (info leak)
        res.json({ ok: true });
    });
    // ─── Debug : déclenche une erreur volontaire pour tester Sentry ─────────
    // Admin only. L'exception remonte jusqu'au handler d'erreur Express où
    // Sentry la capture (si SENTRY_DSN est configuré). Réponse attendue : 500.
    // Sert UNIQUEMENT à vérifier que le monitoring fonctionne — aucun effet
    // de bord, aucune donnée touchée.
    app.get("/api/debug/sentry-test", (0, auth_2.requireAuth)(cfg, pool), (0, rbac_1.requireRole)("admin"), (_req, _res) => {
        throw new Error(`Sentry server test — ${new Date().toISOString()} (déclenché volontairement via /api/debug/sentry-test)`);
    });
    // Rate-limit STRICT sur le login (anti brute-force)
    app.use("/api/auth/login", (0, rate_limit_1.buildLoginRateLimiter)(cfg));
    app.use("/api/auth", (0, auth_1.buildAuthRouter)(pool, cfg));
    // ─── Admin : gestion utilisateurs (admin only) ─────────────────────────
    app.use("/api/admin/users", (0, admin_users_1.buildAdminUsersRouter)(pool, cfg));
    // ─── Admin : audit logs (admin only) ────────────────────────────────────
    app.use("/api/admin/logs", (0, admin_logs_1.buildAdminLogsRouter)(pool, cfg));
    // ─── Super-admin : gestion des entreprises clientes (super_admin only) ──
    app.use("/api/super-admin", (0, super_admin_1.buildSuperAdminRouter)(pool, cfg));
    const auth = (0, auth_2.requireAuth)(cfg, pool);
    // ─── Clients ───────────────────────────────────────────────────────────
    const clients = new repository_1.MysqlRepository(pool, "clients", {
        primaryKey: "client",
        filterableColumns: ["type", "city", "siret", "email", "createdBy"],
        sortableColumns: ["createdAt", "lastName", "companyName"],
        writableColumns: CLIENT_COLS,
        jsonColumns: ["tags"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    app.use("/api/clients", auth, (0, crud_1.buildCrudRouter)(clients, { db: pool, resourceName: "clients" }));
    // ─── Suppliers ─────────────────────────────────────────────────────────
    const suppliers = new repository_1.MysqlRepository(pool, "suppliers", {
        primaryKey: "client",
        filterableColumns: ["category", "city", "siret", "createdBy"],
        sortableColumns: ["createdAt", "companyName"],
        writableColumns: SUPPLIER_COLS,
        jsonColumns: ["tags"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    app.use("/api/suppliers", auth, (0, crud_1.buildCrudRouter)(suppliers, { db: pool, resourceName: "suppliers" }));
    // Alias rétro-compatible
    app.use("/api/fournisseurs", auth, (0, crud_1.buildCrudRouter)(suppliers, { db: pool, resourceName: "suppliers" }));
    // ─── Chantiers ─────────────────────────────────────────────────────────
    const chantiers = new repository_1.MysqlRepository(pool, "chantiers", {
        primaryKey: "client",
        filterableColumns: ["status", "priority", "clientId", "city", "categoryId", "createdBy"],
        sortableColumns: ["createdAt", "reference", "title", "startDateEstimated"],
        writableColumns: CHANTIER_COLS,
        jsonColumns: ["photos", "tags"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    app.use("/api/chantiers", auth, (0, crud_1.buildCrudRouter)(chantiers, { db: pool, resourceName: "chantiers" }));
    // ─── Quotes ────────────────────────────────────────────────────────────
    const quotes = new repository_1.MysqlRepository(pool, "quotes", {
        primaryKey: "client",
        filterableColumns: ["status", "clientId", "chantierId", "reference", "createdBy"],
        sortableColumns: ["createdAt", "issueDate", "reference", "totalTTC"],
        writableColumns: QUOTE_COLS,
        jsonColumns: ["items", "companySnapshot"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    app.use("/api/quotes", auth, (0, crud_1.buildCrudRouter)(quotes, {
        db: pool,
        resourceName: "quotes",
        hooks: {
            beforeCreate: (0, references_1.makeReferenceHook)({
                db: pool,
                idPrefix: "quo",
                table: "quotes",
                referencePrefix: "DEVIS",
            }),
        },
    }));
    // ─── Invoices ──────────────────────────────────────────────────────────
    const invoices = new repository_1.MysqlRepository(pool, "invoices", {
        primaryKey: "client",
        filterableColumns: ["status", "type", "clientId", "chantierId", "fromQuoteId", "reference", "createdBy"],
        sortableColumns: ["createdAt", "issueDate", "dueDate", "reference", "totalTTC"],
        writableColumns: INVOICE_COLS,
        jsonColumns: ["items", "companySnapshot"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    app.use("/api/invoices", auth, (0, crud_1.buildCrudRouter)(invoices, {
        db: pool,
        resourceName: "invoices",
        hooks: {
            beforeCreate: (0, references_1.makeReferenceHook)({
                db: pool,
                idPrefix: "inv",
                table: "invoices",
                referencePrefix: "FACT",
            }),
            afterCreate: (id) => accounting_1.accountingHooks.generateInvoiceEntry(pool, id),
            afterUpdate: (id) => accounting_1.accountingHooks.generateInvoiceEntry(pool, id),
            afterDelete: (id) => accounting_1.accountingHooks.deleteEntriesForSource(pool, "invoice", id),
        },
    }));
    // ─── Conversion devis → facture ────────────────────────────────────────
    // POST /api/invoices/convert-from-quote
    // Body : { quoteId: string, options: { type?: "standard"|"acompte"|"avoir", acomptePercent?: number } }
    app.post("/api/invoices/convert-from-quote", auth, async (req, res) => {
        try {
            const { quoteId, options = {} } = req.body || {};
            if (!quoteId || typeof quoteId !== "string") {
                res.status(400).json({ success: false, error: "quoteId requis" });
                return;
            }
            const [qRows] = await pool.query("SELECT * FROM quotes WHERE id = ?", [quoteId]);
            const quote = qRows[0];
            if (!quote) {
                res.status(404).json({ success: false, error: "Devis introuvable" });
                return;
            }
            const type = options.type || "standard";
            const acomptePercent = type === "acompte" ? Number(options.acomptePercent) || 30 : 0;
            // Récupère paymentTermsDays depuis settings (singleton id=1, JSON data)
            let paymentTermsDays = 30;
            try {
                const [sRows] = await pool.query("SELECT data FROM settings WHERE id = 1");
                const raw = sRows[0]?.data;
                const parsed = raw
                    ? typeof raw === "string"
                        ? JSON.parse(raw)
                        : raw
                    : {};
                if (parsed?.invoicePaymentTermsDays) {
                    paymentTermsDays = Number(parsed.invoicePaymentTermsDays);
                }
            }
            catch { }
            const issueDate = new Date().toISOString().slice(0, 10);
            const dueDate = (() => {
                const d = new Date(issueDate);
                d.setDate(d.getDate() + paymentTermsDays);
                return d.toISOString().slice(0, 10);
            })();
            // Items / totaux selon le type
            let items = (() => {
                const raw = quote.items;
                if (typeof raw === "string") {
                    try {
                        return JSON.parse(raw);
                    }
                    catch {
                        return [];
                    }
                }
                return Array.isArray(raw) ? raw : [];
            })();
            let totalHT = Number(quote.totalHT);
            let totalTTC = Number(quote.totalTTC);
            if (type === "acompte") {
                // Facture d'acompte : on REPREND toutes les lignes du devis et on
                // applique le % d'acompte sur chaque PU + sur les remises montant.
                // Le total final est cohérent avec totalHT * acomptePercent / 100.
                const ratio = acomptePercent / 100;
                items = items.map((it) => {
                    if (it.kind !== "line")
                        return it;
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
            }
            else if (type === "avoir") {
                items = items.map((it) => ({
                    ...it,
                    unitPriceHT: it.kind === "line" ? -Math.abs(Number(it.unitPriceHT) || 0) : it.unitPriceHT,
                }));
                totalHT = -Math.abs(totalHT);
                totalTTC = -Math.abs(totalTTC);
            }
            // Génère id + reference via le helper de références
            const refHook = (0, references_1.makeReferenceHook)({
                db: pool,
                idPrefix: "inv",
                table: "invoices",
                referencePrefix: "FACT",
            });
            const baseBody = await refHook({});
            const id = String(baseBody.id);
            const reference = String(baseBody.reference);
            const title = type === "acompte"
                ? `Acompte ${acomptePercent}% - ${quote.title}`
                : type === "avoir"
                    ? `Avoir - ${quote.title}`
                    : quote.title;
            const companySnapshotStr = typeof quote.companySnapshot === "string"
                ? quote.companySnapshot
                : JSON.stringify(quote.companySnapshot ?? {});
            const introText = type === "acompte"
                ? `Facture d'acompte de ${acomptePercent} % sur le devis ${quote.reference || ""}. Le solde sera facturé en fin de travaux.`
                : "";
            // Pour l'acompte on garde la même remise globale en % mais on
            // applique le ratio sur la remise globale en montant fixe.
            const ratio = acomptePercent / 100;
            const newGlobalDiscountAmount = type === "acompte"
                ? Number((Number(quote.globalDiscountAmount || 0) * ratio).toFixed(2))
                : Number(quote.globalDiscountAmount || 0);
            await pool.query(`INSERT INTO invoices (
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
          )`, [
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
            ]);
            // Génère l'écriture comptable
            try {
                await accounting_1.accountingHooks.generateInvoiceEntry(pool, id);
            }
            catch (err) {
                console.warn("[convert-from-quote accounting hook]", err.message);
            }
            const [createdRows] = await pool.query("SELECT * FROM invoices WHERE id = ?", [id]);
            res.json({ success: true, invoice: createdRows[0] });
        }
        catch (e) {
            console.error("[invoices:convertFromQuote]", e);
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // ─── Invoice payments ──────────────────────────────────────────────────
    const invoicePayments = new repository_1.MysqlRepository(pool, "invoice_payments", {
        primaryKey: "client",
        filterableColumns: ["invoiceId", "method", "createdBy"],
        sortableColumns: ["createdAt", "date", "amount"],
        writableColumns: ["invoiceId", "amount", "date", "method", "reference", "notes"],
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    app.use("/api/invoice-payments", auth, (0, crud_1.buildCrudRouter)(invoicePayments, {
        db: pool,
        resourceName: "invoice_payments",
        hooks: {
            afterCreate: async (id, body) => {
                await accounting_1.accountingHooks.generateInvoicePaymentEntry(pool, id);
                const invId = body?.invoiceId;
                if (invId)
                    await accounting_1.accountingHooks.generateInvoiceEntry(pool, invId);
            },
            afterUpdate: (id) => accounting_1.accountingHooks.generateInvoicePaymentEntry(pool, id),
            afterDelete: (id) => accounting_1.accountingHooks.deleteEntriesForSource(pool, "invoice_payment", id),
        },
    }));
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
    app.use("/api/expenses", auth, (0, crud_1.buildCrudRouter)(expenses, {
        db: pool,
        resourceName: "expenses",
        hooks: {
            beforeCreate: (0, references_1.makeReferenceHook)({
                db: pool,
                idPrefix: "dep",
                table: "expenses",
                referencePrefix: "DEP",
            }),
            afterCreate: async (id) => {
                await accounting_1.accountingHooks.generateExpenseEntry(pool, id);
                await accounting_1.accountingHooks.generateExpensePaymentEntry(pool, id);
            },
            afterUpdate: async (id) => {
                await accounting_1.accountingHooks.generateExpenseEntry(pool, id);
                await accounting_1.accountingHooks.generateExpensePaymentEntry(pool, id);
            },
            afterDelete: async (id) => {
                await accounting_1.accountingHooks.deleteEntriesForSource(pool, "expense", id);
                await accounting_1.accountingHooks.deleteEntriesForSource(pool, "expense_payment", id);
            },
        },
    }));
    // ─── Accounting (compta partie double) ────────────────────────────────
    app.use("/api/accounting", auth, (0, accounting_1.buildAccountingRouter)(pool));
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
        tenantColumn: "companyId",
    });
    app.use("/api/expense-notes", auth, (0, crud_1.buildCrudRouter)(expenseNotes, {
        db: pool,
        resourceName: "expense_notes",
        hooks: {
            beforeCreate: (0, references_1.makeReferenceHook)({
                db: pool,
                idPrefix: "ndf",
                table: "expense_notes",
                referencePrefix: "NDF",
            }),
        },
    }));
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
        tenantColumn: "companyId",
    });
    app.use("/api/subcontractors", auth, (0, crud_1.buildCrudRouter)(subcontractors, { db: pool, resourceName: "subcontractors" }));
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
        tenantColumn: "companyId",
    });
    app.use("/api/agenda-events", auth, (0, crud_1.buildCrudRouter)(agendaEvents, { db: pool, resourceName: "agenda_events" }));
    // ─── Public route : liste compacte des users (id+nom+role) ────────────
    // Pour afficher "Créé par X" dans les listes Devis/Factures sans donner
    // accès à toute la table users (réservée aux admins via /api/admin/users).
    app.get("/api/users/public", auth, asyncHandler(async (req, res) => {
        // Multi-tenant : on ne montre que les users de la même company
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await pool.query(`SELECT id, username, firstName, lastName, avatarUrl, role
         FROM users
         WHERE disabled = 0 AND companyId = ?
         ORDER BY firstName, lastName, username`, [tenantId]);
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
    function isAllowedSettingKey(k) {
        if (!SETTING_KEY_RE.test(k))
            return false;
        if (FORBIDDEN_KEYS.has(k))
            return false;
        return ALLOWED_SETTING_PREFIXES.some((p) => k.startsWith(p));
    }
    app.patch("/api/settings", auth, asyncHandler(async (req, res) => {
        const body = (req.body ?? {});
        const entries = Object.entries(body);
        if (entries.length > MAX_SETTINGS_PER_REQUEST) {
            res
                .status(400)
                .json({ message: `Trop de clés (max ${MAX_SETTINGS_PER_REQUEST})` });
            return;
        }
        // Pré-valide toutes les clés/valeurs avant d'ouvrir la transaction.
        // Si une seule clé est invalide, on rejette tout — pas de partial write.
        const validated = [];
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
                await conn.execute("INSERT INTO settings (`key`, value) VALUES (?, ?) " +
                    "ON DUPLICATE KEY UPDATE value = VALUES(value)", [k, serialized]);
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
    // ─── Company profile (multi-tenant) ────────────────────────────────────
    // GET : tous les users authentifiés peuvent lire leur propre company
    // PATCH : admin only (les employés ne peuvent PAS modifier les infos d'entreprise)
    // POST /complete-setup : marque l'onboarding comme terminé (admin only)
    app.get("/api/company", auth, asyncHandler(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await pool.query("SELECT data, name, isSetupComplete FROM company WHERE id = ? LIMIT 1", [tenantId]);
        const r = rows[0];
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
    }));
    app.patch("/api/company", auth, (0, rbac_1.requireRole)("admin"), asyncHandler(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await pool.query("SELECT data FROM company WHERE id = ? LIMIT 1", [tenantId]);
        const existing = rows[0];
        const current = existing && typeof existing.data === "string"
            ? JSON.parse(existing.data)
            : existing?.data ?? {};
        // Si companyName est modifié, on met aussi à jour la colonne name
        // dénormalisée (pour les jointures et l'affichage rapide)
        const incoming = req.body ?? {};
        const merged = { ...current, ...incoming };
        const newName = incoming.companyName;
        if (typeof newName === "string") {
            await pool.execute("UPDATE company SET data = ?, name = ? WHERE id = ?", [JSON.stringify(merged), newName, tenantId]);
        }
        else {
            await pool.execute("UPDATE company SET data = ? WHERE id = ?", [JSON.stringify(merged), tenantId]);
        }
        res.json(merged);
    }));
    // Marque le setup comme terminé (sortie du tutoriel d'onboarding)
    app.post("/api/company/complete-setup", auth, (0, rbac_1.requireRole)("admin"), asyncHandler(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        await pool.execute("UPDATE company SET isSetupComplete = 1 WHERE id = ?", [tenantId]);
        res.json({ ok: true, isSetupComplete: true });
    }));
    // ─── Microsoft + email ─────────────────────────────────────────────────
    app.use("/api/auth/microsoft", (0, microsoft_1.buildMicrosoftRouter)(pool, cfg));
    app.use("/api/email", auth, (0, microsoft_1.buildEmailRouter)(pool, cfg));
    // ─── Backup serveur ────────────────────────────────────────────────────
    app.use("/api/backup", auth, (0, backup_1.buildBackupRouter)(pool, cfg));
    // ─── Vault (coffre-fort documents) ─────────────────────────────────────
    app.use("/api/vault", (0, vault_1.buildVaultRouter)(pool, cfg));
    // ─── Documents administratifs (PV, TVA, DC4, RGE) ──────────────────────
    app.use("/api/admin-docs", (0, admin_docs_1.buildAdminDocsRouter)(pool, cfg));
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
    // Sentry catches errors that propagate to here (no-op if DSN unset
    // or if @sentry/node isn't installed on the host).
    (0, instrument_1.setupExpressErrorHandler)(app);
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
