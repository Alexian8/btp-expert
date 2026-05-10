// ═══════════════════════════════════════════════════════════════════════════
// Config — lit l'env, valide avec Zod, expose un objet typé
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import "dotenv/config";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET doit faire ≥ 32 caractères (recommandé : 64 bytes hex)")
    .refine((s) => !/^(secret|change.?me|password|test)/i.test(s), {
      message: "JWT_SECRET trop faible (mots interdits)",
    }),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // ─── Rate limiting ───────────────────────────────────────────────────
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW_MIN: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_API_WINDOW_MIN: z.coerce.number().int().positive().default(1),

  // ─── MySQL ─────────────────────────────────────────────────────────────
  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1, "MYSQL_USER requis"),
  MYSQL_PASSWORD: z.string(),
  MYSQL_DATABASE: z.string().min(1, "MYSQL_DATABASE requis"),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  // ─── Microsoft OAuth (Outlook / Graph API) ───────────────────────────
  // App Registration sur https://portal.azure.com
  MS_CLIENT_ID: z.string().default(""),
  MS_CLIENT_SECRET: z.string().default(""),
  MS_TENANT: z.string().default("common"),
  MS_REDIRECT_URI: z.string().default("https://intranet.jacobhabitat-dev.fr/api/auth/microsoft/callback"),
  MS_SCOPES: z
    .string()
    .default("offline_access User.Read Mail.Send Calendars.ReadWrite Files.ReadWrite.AppFolder"),

  // ─── SMTP (provisioning email + envois transactionnels) ──────────────
  // Si non configuré : sendMail() devient no-op (les credentials sont
  // affichés à l'admin dans la modal de création, pas envoyés par email).
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  /** URL publique de l'app, utilisée dans les emails (lien de connexion). */
  APP_URL: z.string().default("https://intranet.jacobhabitat-dev.fr"),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Config = z.infer<typeof Schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = Schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuration invalide :\n${issues}`);
  }
  return result.data;
}
