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
    JWT_SECRET: zod_1.z
        .string()
        .min(32, "JWT_SECRET doit faire ≥ 32 caractères (recommandé : 64 bytes hex)")
        .refine((s) => !/^(secret|change.?me|password|test)/i.test(s), {
        message: "JWT_SECRET trop faible (mots interdits)",
    }),
    JWT_EXPIRES_IN: zod_1.z.string().default("7d"),
    // ─── Rate limiting ───────────────────────────────────────────────────
    RATE_LIMIT_LOGIN_MAX: zod_1.z.coerce.number().int().positive().default(5),
    RATE_LIMIT_LOGIN_WINDOW_MIN: zod_1.z.coerce.number().int().positive().default(15),
    RATE_LIMIT_API_MAX: zod_1.z.coerce.number().int().positive().default(300),
    RATE_LIMIT_API_WINDOW_MIN: zod_1.z.coerce.number().int().positive().default(1),
    // ─── MySQL ─────────────────────────────────────────────────────────────
    MYSQL_HOST: zod_1.z.string().default("localhost"),
    MYSQL_PORT: zod_1.z.coerce.number().int().positive().default(3306),
    MYSQL_USER: zod_1.z.string().min(1, "MYSQL_USER requis"),
    MYSQL_PASSWORD: zod_1.z.string(),
    MYSQL_DATABASE: zod_1.z.string().min(1, "MYSQL_DATABASE requis"),
    MYSQL_CONNECTION_LIMIT: zod_1.z.coerce.number().int().positive().default(10),
    // ─── Microsoft OAuth (Outlook / Graph API) ───────────────────────────
    // App Registration sur https://portal.azure.com
    MS_CLIENT_ID: zod_1.z.string().default(""),
    MS_CLIENT_SECRET: zod_1.z.string().default(""),
    MS_TENANT: zod_1.z.string().default("common"),
    MS_REDIRECT_URI: zod_1.z.string().default("https://intranet.jacobhabitat-dev.fr/api/auth/microsoft/callback"),
    MS_SCOPES: zod_1.z
        .string()
        .default("offline_access User.Read Mail.Send Calendars.ReadWrite Files.ReadWrite.AppFolder"),
    // ─── SMTP (provisioning email + envois transactionnels) ──────────────
    // Si non configuré : sendMail() devient no-op (les credentials sont
    // affichés à l'admin dans la modal de création, pas envoyés par email).
    SMTP_HOST: zod_1.z.string().default(""),
    SMTP_PORT: zod_1.z.coerce.number().int().positive().default(587),
    SMTP_USER: zod_1.z.string().default(""),
    SMTP_PASS: zod_1.z.string().default(""),
    SMTP_FROM: zod_1.z.string().default(""),
    /** URL publique de l'app, utilisée dans les emails (lien de connexion). */
    APP_URL: zod_1.z.string().default("https://intranet.jacobhabitat-dev.fr"),
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