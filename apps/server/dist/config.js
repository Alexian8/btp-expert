"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Config — lit l'env, valide avec Zod, expose un objet typé
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const zod_1 = require("zod");
require("dotenv/config");
const Schema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(3001),
    CORS_ORIGINS: zod_1.z
        .string()
        .default("http://localhost:5173")
        .transform((s) => s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)),
    JWT_SECRET: zod_1.z.string().min(16, "JWT_SECRET doit faire ≥ 16 caractères"),
    JWT_EXPIRES_IN: zod_1.z.string().default("7d"),
    // ─── MySQL ─────────────────────────────────────────────────────────────
    MYSQL_HOST: zod_1.z.string().default("localhost"),
    MYSQL_PORT: zod_1.z.coerce.number().int().positive().default(3306),
    MYSQL_USER: zod_1.z.string().min(1, "MYSQL_USER requis"),
    MYSQL_PASSWORD: zod_1.z.string(),
    MYSQL_DATABASE: zod_1.z.string().min(1, "MYSQL_DATABASE requis"),
    MYSQL_CONNECTION_LIMIT: zod_1.z.coerce.number().int().positive().default(10),
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
});
function loadConfig(env = process.env) {
    const result = Schema.safeParse(env);
    if (!result.success) {
        const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
        throw new Error(`Configuration invalide :\n${issues}`);
    }
    return result.data;
}
//# sourceMappingURL=config.js.map