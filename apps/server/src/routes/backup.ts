// ═══════════════════════════════════════════════════════════════════════════
// Routes Backup — gestion des sauvegardes serveur
//
//   GET  /api/backup/list        → liste tous les backups dispo (nom, taille, date)
//   POST /api/backup/run         → déclenche une sauvegarde manuelle
//   GET  /api/backup/download/:name → download d'un backup (gzip)
//   POST /api/backup/restore/:name → restaure un backup
//   DELETE /api/backup/:name     → supprime un backup
//
// Stockage : ~/backups/btp/ (HORS public_html — non accessible directement par Apache)
// Format : SQL gzippé (sortie compatible mysqldump, mais on utilise un export
// JS pur pour ne pas dépendre du binaire mysqldump qui peut ne pas être dispo).
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import type { DB, RowDataPacket } from "../db";
import type { Config } from "../config";

// ─── Localisation des backups ────────────────────────────────────────────
function backupDir(): string {
  // ~/backups/btp/ — HORS du doc root (donc inaccessible par Apache)
  const dir = path.join(os.homedir(), "backups", "btp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

// ─── Export SQL (sans dépendance externe) ────────────────────────────────
// Tables connues du schéma. Au fil du temps, on en ajoute ici.
const EXPORTABLE_TABLES = [
  "users",
  "clients",
  "fournisseurs",
  "chantiers",
  "invoices",
  "invoice_payments",
  "settings",
] as const;

async function exportToSqlGz(db: DB, outFile: string): Promise<{ bytes: number; tables: number; rows: number }> {
  const out = fs.createWriteStream(outFile);
  const gzip = zlib.createGzip();
  gzip.pipe(out);

  let totalRows = 0;
  let totalTables = 0;

  gzip.write(`-- BatiDesk backup\n-- generated ${new Date().toISOString()}\n\n`);
  gzip.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);

  for (const table of EXPORTABLE_TABLES) {
    try {
      const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM \`${table}\``);
      gzip.write(`-- Table: ${table} (${rows.length} rows)\n`);
      gzip.write(`TRUNCATE TABLE \`${table}\`;\n`);
      if (rows.length === 0) {
        gzip.write(`\n`);
        totalTables++;
        continue;
      }
      const columns = Object.keys(rows[0]);
      const colsStr = columns.map((c) => `\`${c}\``).join(", ");
      for (const row of rows) {
        const valuesStr = columns
          .map((c) => {
            const v = (row as Record<string, unknown>)[c];
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "number") return String(v);
            if (typeof v === "boolean") return v ? "1" : "0";
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
            const s = typeof v === "string" ? v : JSON.stringify(v);
            return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
          })
          .join(", ");
        gzip.write(`INSERT INTO \`${table}\` (${colsStr}) VALUES (${valuesStr});\n`);
      }
      gzip.write(`\n`);
      totalRows += rows.length;
      totalTables++;
    } catch (e) {
      gzip.write(`-- ERROR exporting ${table}: ${(e as Error).message}\n\n`);
    }
  }

  gzip.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  gzip.end();
  await new Promise<void>((resolve) => out.on("finish", () => resolve()));

  const stat = fs.statSync(outFile);
  return { bytes: stat.size, tables: totalTables, rows: totalRows };
}

// ─── Restauration SQL ────────────────────────────────────────────────────
async function restoreFromSqlGz(db: DB, inFile: string): Promise<{ statements: number }> {
  const tmpSql = inFile + ".tmp.sql";
  await pipeline(fs.createReadStream(inFile), zlib.createGunzip(), fs.createWriteStream(tmpSql));

  const content = fs.readFileSync(tmpSql, "utf-8");
  fs.unlinkSync(tmpSql);

  // Découpe naïve par `;\n` (suffisant pour notre format d'export)
  const statements = content
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  let executed = 0;
  for (const stmt of statements) {
    try {
      await db.query(stmt);
      executed++;
    } catch (e) {
      console.warn(`[backup] restore: skipped statement (${(e as Error).message.slice(0, 80)})`);
    }
  }
  return { statements: executed };
}

// ─── Routes ──────────────────────────────────────────────────────────────
export function buildBackupRouter(db: DB, _cfg: Config): Router {
  const router = Router();

  router.get("/list", (_req, res) => {
    const dir = backupDir();
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql.gz"))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return {
          name: f,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ count: files.length, totalBytes: files.reduce((s, f) => s + f.size, 0), files });
  });

  router.post(
    "/run",
    wrap(async (_req, res) => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `btp-backup-${stamp}.sql.gz`;
      const outFile = path.join(backupDir(), fileName);
      const stats = await exportToSqlGz(db, outFile);
      res.status(201).json({ name: fileName, ...stats });
    })
  );

  router.get(
    "/download/:name",
    wrap(async (req, res) => {
      const name = path.basename(String(req.params.name));
      if (!name.endsWith(".sql.gz")) {
        res.status(400).json({ message: "Nom de fichier invalide" });
        return;
      }
      const file = path.join(backupDir(), name);
      if (!fs.existsSync(file)) {
        res.status(404).json({ message: "Backup introuvable" });
        return;
      }
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      fs.createReadStream(file).pipe(res);
    })
  );

  router.post(
    "/restore/:name",
    wrap(async (req, res) => {
      const name = path.basename(String(req.params.name));
      const file = path.join(backupDir(), name);
      if (!fs.existsSync(file)) {
        res.status(404).json({ message: "Backup introuvable" });
        return;
      }
      const result = await restoreFromSqlGz(db, file);
      res.json({ name, ...result });
    })
  );

  router.delete(
    "/:name",
    wrap(async (req, res) => {
      const name = path.basename(String(req.params.name));
      const file = path.join(backupDir(), name);
      if (!fs.existsSync(file)) {
        res.status(404).json({ message: "Backup introuvable" });
        return;
      }
      fs.unlinkSync(file);
      res.status(204).end();
    })
  );

  return router;
}
