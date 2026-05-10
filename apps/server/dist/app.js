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
const db_1 = require("./db");
const repository_1 = require("./repository");
const crud_1 = require("./routes/crud");
const auth_1 = require("./routes/auth");
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
    // 404 handler
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