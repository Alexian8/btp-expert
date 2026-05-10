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
  JWT_SECRET: z.string().min(16, "JWT_SECRET doit faire ≥ 16 caractères"),
  JWT_EXPIRES_IN: z.string().default("7d"),

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
