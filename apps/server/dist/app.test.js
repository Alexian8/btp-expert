"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Tests d'intégration — nécessitent un MySQL accessible.
//
// Pour les exécuter en local :
//   docker run --rm -d --name btp-test-mysql -p 3307:3306 \
//     -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=btp_test \
//     mysql:8.0
//
// Puis :
//   MYSQL_TEST_HOST=localhost MYSQL_TEST_PORT=3307 \
//   MYSQL_TEST_USER=root MYSQL_TEST_PASSWORD=root \
//   MYSQL_TEST_DATABASE=btp_test \
//   npm test -w @btp/server
//
// Si ces variables ne sont pas définies, les tests sont skippés (pas en échec).
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const promise_1 = __importDefault(require("mysql2/promise"));
const app_1 = require("./app");
const HOST = process.env.MYSQL_TEST_HOST;
const PORT = Number(process.env.MYSQL_TEST_PORT ?? 3306);
const USER = process.env.MYSQL_TEST_USER;
const PASSWORD = process.env.MYSQL_TEST_PASSWORD ?? "";
const DATABASE = process.env.MYSQL_TEST_DATABASE;
const hasMysql = Boolean(HOST && USER && DATABASE);
const cfg = {
    PORT: 0,
    CORS_ORIGINS: ["http://localhost:5173"],
    JWT_SECRET: "test-secret-at-least-32-chars-long-for-zod-min",
    JWT_EXPIRES_IN: "1h",
    RATE_LIMIT_LOGIN_MAX: 1000, // désactivé en test
    RATE_LIMIT_LOGIN_WINDOW_MIN: 15,
    RATE_LIMIT_API_MAX: 10000,
    RATE_LIMIT_API_WINDOW_MIN: 1,
    SMTP_HOST: "",
    SMTP_PORT: 587,
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "",
    APP_URL: "http://localhost:5173",
    CPANEL_HOST: "",
    CPANEL_USERNAME: "",
    CPANEL_API_TOKEN: "",
    CPANEL_EMAIL_DOMAIN: "",
    CPANEL_EMAIL_QUOTA_MB: 250,
    MYSQL_HOST: HOST ?? "localhost",
    MYSQL_PORT: PORT,
    MYSQL_USER: USER ?? "root",
    MYSQL_PASSWORD: PASSWORD,
    MYSQL_DATABASE: DATABASE ?? "btp_test",
    MYSQL_CONNECTION_LIMIT: 5,
    MS_CLIENT_ID: "",
    MS_CLIENT_SECRET: "",
    MS_TENANT: "common",
    MS_REDIRECT_URI: "http://localhost/api/auth/microsoft/callback",
    MS_SCOPES: "offline_access User.Read",
    NODE_ENV: "test",
};
let handle = null;
const describeIfMysql = hasMysql ? vitest_1.describe : vitest_1.describe.skip;
describeIfMysql("Server (MySQL integration)", () => {
    (0, vitest_1.beforeAll)(async () => {
        const pool = promise_1.default.createPool({
            host: cfg.MYSQL_HOST,
            port: cfg.MYSQL_PORT,
            user: cfg.MYSQL_USER,
            password: cfg.MYSQL_PASSWORD,
            database: cfg.MYSQL_DATABASE,
            connectionLimit: cfg.MYSQL_CONNECTION_LIMIT,
        });
        const { app } = await (0, app_1.createApp)(cfg, pool);
        handle = { app, pool };
    });
    (0, vitest_1.afterAll)(async () => {
        if (handle)
            await handle.pool.end();
        handle = null;
    });
    (0, vitest_1.beforeEach)(async () => {
        if (!handle)
            return;
        // Wipe data in dependency order to satisfy FK
        await handle.pool.query("SET FOREIGN_KEY_CHECKS = 0");
        for (const t of ["users", "clients", "fournisseurs", "chantiers", "settings"]) {
            await handle.pool.query(`TRUNCATE TABLE \`${t}\``);
        }
        await handle.pool.query("SET FOREIGN_KEY_CHECKS = 1");
    });
    async function bootstrapAndLogin() {
        if (!handle)
            throw new Error("no handle");
        await (0, supertest_1.default)(handle.app)
            .post("/api/auth/bootstrap")
            .send({ username: "admin", password: "secret123" });
        const res = await (0, supertest_1.default)(handle.app)
            .post("/api/auth/login")
            .send({ username: "admin", password: "secret123" });
        return res.body.token;
    }
    (0, vitest_1.describe)("health", () => {
        (0, vitest_1.it)("GET /api/health → ok=true", async () => {
            const res = await (0, supertest_1.default)(handle.app).get("/api/health");
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.ok).toBe(true);
        });
    });
    (0, vitest_1.describe)("auth", () => {
        (0, vitest_1.it)("bootstrap → login → token JWT valide", async () => {
            const bootstrap = await (0, supertest_1.default)(handle.app)
                .post("/api/auth/bootstrap")
                .send({ username: "admin", password: "secret123" });
            (0, vitest_1.expect)(bootstrap.status).toBe(201);
            const login = await (0, supertest_1.default)(handle.app)
                .post("/api/auth/login")
                .send({ username: "admin", password: "secret123" });
            (0, vitest_1.expect)(login.status).toBe(200);
            (0, vitest_1.expect)(typeof login.body.token).toBe("string");
        });
        (0, vitest_1.it)("bootstrap refusé en 409 si déjà fait", async () => {
            await (0, supertest_1.default)(handle.app)
                .post("/api/auth/bootstrap")
                .send({ username: "a", password: "12345678" });
            const res = await (0, supertest_1.default)(handle.app)
                .post("/api/auth/bootstrap")
                .send({ username: "b", password: "12345678" });
            (0, vitest_1.expect)(res.status).toBe(409);
        });
        (0, vitest_1.it)("login mauvais mot de passe → 401", async () => {
            await (0, supertest_1.default)(handle.app)
                .post("/api/auth/bootstrap")
                .send({ username: "a", password: "good-pass" });
            const res = await (0, supertest_1.default)(handle.app)
                .post("/api/auth/login")
                .send({ username: "a", password: "wrong-pass" });
            (0, vitest_1.expect)(res.status).toBe(401);
        });
        (0, vitest_1.it)("/me sans token → 401", async () => {
            const res = await (0, supertest_1.default)(handle.app).get("/api/auth/me");
            (0, vitest_1.expect)(res.status).toBe(401);
        });
        (0, vitest_1.it)("/me avec token valide retourne le user", async () => {
            const token = await bootstrapAndLogin();
            const res = await (0, supertest_1.default)(handle.app)
                .get("/api/auth/me")
                .set("Authorization", `Bearer ${token}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.username).toBe("admin");
        });
    });
    (0, vitest_1.describe)("CRUD clients", () => {
        (0, vitest_1.it)("rejette les requêtes non authentifiées", async () => {
            const res = await (0, supertest_1.default)(handle.app).get("/api/clients");
            (0, vitest_1.expect)(res.status).toBe(401);
        });
        (0, vitest_1.it)("flow complet : create → list → findById → update → delete", async () => {
            const token = await bootstrapAndLogin();
            const auth = `Bearer ${token}`;
            const created = await (0, supertest_1.default)(handle.app)
                .post("/api/clients")
                .set("Authorization", auth)
                .send({ nom: "Acme SARL", email: "contact@acme.fr" });
            (0, vitest_1.expect)(created.status).toBe(201);
            (0, vitest_1.expect)(created.body.id).toBeGreaterThan(0);
            const list = await (0, supertest_1.default)(handle.app).get("/api/clients").set("Authorization", auth);
            (0, vitest_1.expect)(list.status).toBe(200);
            (0, vitest_1.expect)(list.body).toHaveLength(1);
            const updated = await (0, supertest_1.default)(handle.app)
                .patch(`/api/clients/${created.body.id}`)
                .set("Authorization", auth)
                .send({ nom: "Acme SAS" });
            (0, vitest_1.expect)(updated.body.nom).toBe("Acme SAS");
            const count = await (0, supertest_1.default)(handle.app).get("/api/clients/count").set("Authorization", auth);
            (0, vitest_1.expect)(count.body.count).toBe(1);
            const del = await (0, supertest_1.default)(handle.app)
                .delete(`/api/clients/${created.body.id}`)
                .set("Authorization", auth);
            (0, vitest_1.expect)(del.status).toBe(204);
        });
        (0, vitest_1.it)("findById renvoie 404 si inconnu", async () => {
            const token = await bootstrapAndLogin();
            const res = await (0, supertest_1.default)(handle.app)
                .get("/api/clients/99999")
                .set("Authorization", `Bearer ${token}`);
            (0, vitest_1.expect)(res.status).toBe(404);
        });
        (0, vitest_1.it)("colonne non whitelisted en filter est ignorée (anti-injection)", async () => {
            const token = await bootstrapAndLogin();
            const auth = `Bearer ${token}`;
            await (0, supertest_1.default)(handle.app).post("/api/clients").set("Authorization", auth).send({ nom: "A" });
            const res = await (0, supertest_1.default)(handle.app)
                .get("/api/clients?passwordHash=anything")
                .set("Authorization", auth);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body).toHaveLength(1);
        });
    });
    (0, vitest_1.describe)("settings", () => {
        (0, vitest_1.it)("PATCH puis GET round-trip avec types JSON préservés", async () => {
            const token = await bootstrapAndLogin();
            const auth = `Bearer ${token}`;
            await (0, supertest_1.default)(handle.app)
                .patch("/api/settings")
                .set("Authorization", auth)
                .send({ theme: "dark", maxItems: 42, notif: { email: true } });
            const res = await (0, supertest_1.default)(handle.app).get("/api/settings").set("Authorization", auth);
            (0, vitest_1.expect)(res.body).toEqual({ theme: "dark", maxItems: 42, notif: { email: true } });
        });
    });
});
// ─── Test fallback si MySQL absent : signale juste le skip ──────────────
if (!hasMysql) {
    (0, vitest_1.describe)("Server (MySQL integration)", () => {
        vitest_1.it.skip("tests skippés (MYSQL_TEST_* non défini)", () => { });
    });
}
//# sourceMappingURL=app.test.js.map