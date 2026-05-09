// ═══════════════════════════════════════════════════════════════════════════
// App — assemblage Express. Séparé de index.ts pour pouvoir être importé
// par les tests (supertest) sans démarrer un serveur HTTP réel.
// ═══════════════════════════════════════════════════════════════════════════

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import type { Config } from "./config";
import { type DB, createPool, runMigrations } from "./db";
import { MysqlRepository } from "./repository";
import { buildCrudRouter } from "./routes/crud";
import { buildAuthRouter } from "./routes/auth";
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

  // 404 handler
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
