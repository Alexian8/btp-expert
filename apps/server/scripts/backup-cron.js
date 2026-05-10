#!/usr/bin/env node
/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// backup-cron.js — Backup quotidien automatique de la DB MySQL
//
// À configurer dans cPanel → Tâches Cron, en CommonJS pur (pas de TS).
//
// Commande cron (à coller dans cPanel) — quotidienne à 3h du matin :
//   0 3 * * * /home/mime9297/nodevenv/intranet.jacobhabitat-dev.fr/22/bin/node \
//             /home/mime9297/intranet.jacobhabitat-dev.fr/apps/server/scripts/backup-cron.js \
//             >> /home/mime9297/backups/btp/cron.log 2>&1
//
// Garde les N derniers backups (rétention par défaut = 14 jours).
// Le chemin Node peut différer selon ta version (/22/ → /20/, etc.)
// ═══════════════════════════════════════════════════════════════════════════

const path = require("node:path");
const fs = require("node:fs");
const zlib = require("node:zlib");
const os = require("node:os");
const dotenv = require("dotenv");

// Charge le .env du doc root
const envPath = path.resolve(__dirname, "..", "..", "..", ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config(); // fallback cwd

const RETENTION_COUNT = Number(process.env.BACKUP_RETENTION_COUNT || 14);

const BACKUP_DIR = path.join(os.homedir(), "backups", "btp");
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const TABLES = [
  "users",
  "clients",
  "fournisseurs",
  "chantiers",
  "invoices",
  "invoice_payments",
  "settings",
];

async function main() {
  const startedAt = new Date();
  console.log(`[cron] backup started at ${startedAt.toISOString()}`);

  const mysql = require("mysql2/promise");
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: 1,
  });

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `btp-backup-${stamp}.sql.gz`;
  const outFile = path.join(BACKUP_DIR, fileName);

  const out = fs.createWriteStream(outFile);
  const gzip = zlib.createGzip();
  gzip.pipe(out);

  let totalRows = 0;
  let totalTables = 0;

  gzip.write(`-- BatiDesk auto backup\n-- generated ${startedAt.toISOString()}\n\n`);
  gzip.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);

  try {
    for (const table of TABLES) {
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
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
              const v = row[c];
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
        gzip.write(`-- ERROR exporting ${table}: ${e.message}\n\n`);
      }
    }
    gzip.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
    gzip.end();
    await new Promise((resolve) => out.on("finish", resolve));
  } finally {
    await pool.end();
  }

  const stat = fs.statSync(outFile);
  const elapsed = Date.now() - startedAt.getTime();
  console.log(
    `[cron] ✓ backup ${fileName} (${stat.size} bytes, ${totalTables} tables, ${totalRows} rows, ${elapsed}ms)`
  );

  // ─── Rétention : ne garde que les N derniers ────────────────────────────
  const allBackups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("btp-backup-") && f.endsWith(".sql.gz"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  const toDelete = allBackups.slice(RETENTION_COUNT);
  for (const old of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.name));
    console.log(`[cron] 🗑 deleted old: ${old.name}`);
  }
  console.log(`[cron] retained ${Math.min(allBackups.length, RETENTION_COUNT)} backup(s)`);
}

main().catch((e) => {
  console.error("[cron] ✗ backup failed:", e);
  process.exit(1);
});
