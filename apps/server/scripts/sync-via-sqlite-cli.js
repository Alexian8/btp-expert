#!/usr/bin/env node
/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// sync-via-sqlite-cli.js — Sync SQLite → MySQL SANS better-sqlite3
//
// Utilise le binaire `sqlite3` CLI (présent sur o2switch en /bin/sqlite3)
// pour exporter en JSON, puis pousse en MySQL via mysql2 (pure JS, pas de
// dépendance glibc moderne).
//
// Usage (cPanel Terminal, dans ~/intranet.jacobhabitat-dev.fr/) :
//   node ~/repositories/btp-expert/apps/server/scripts/sync-via-sqlite-cli.js \
//        ~/btp-v16.db
// ═══════════════════════════════════════════════════════════════════════════

const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const dotenv = require("dotenv");

const sqlitePath = process.argv[2];
if (!sqlitePath) {
  console.error("Usage: node sync-via-sqlite-cli.js <path-to-btp-v16.db>");
  process.exit(1);
}
if (!fs.existsSync(sqlitePath)) {
  console.error("✗ Fichier SQLite introuvable :", sqlitePath);
  process.exit(1);
}

// Charge le .env depuis cwd, ou depuis le doc root du sous-domaine si défini
const envCandidates = [
  process.env.HOME && path.join(process.env.HOME, "intranet.jacobhabitat-dev.fr/.env"),
  ".env",
];
for (const env of envCandidates) {
  if (env && fs.existsSync(env)) {
    dotenv.config({ path: env });
    console.log("[env] loaded from", env);
    break;
  }
}

const SQLITE = "/bin/sqlite3";

function runSqlite(query) {
  // .mode json + .once stdout → on récupère via execFileSync
  const args = [sqlitePath, "-json", query];
  const stdout = execFileSync(SQLITE, args, { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
  if (!stdout.trim()) return [];
  return JSON.parse(stdout);
}

function tableExists(table) {
  try {
    const rows = runSqlite(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Mapping des tables à synchroniser ───────────────────────────────────
const TABLES = [
  {
    table: "users",
    pkColumn: "username",
    columns: [
      { from: "username", to: "username" },
      { from: "passwordHash", to: "passwordHash" },
      { from: "role", to: "role" },
      { from: "createdAt", to: "createdAt", t: "datetime" },
    ],
  },
  {
    table: "clients",
    pkColumn: "id",
    columns: [
      { from: "id", to: "id" },
      {
        from: "_computed",
        to: "nom",
        compute: (r) =>
          r.nom ||
          r.companyName ||
          `${r.firstName || ""} ${r.lastName || ""}`.trim() ||
          "(sans nom)",
      },
      { from: "email", to: "email" },
      {
        from: "_computed",
        to: "telephone",
        compute: (r) => r.telephone || r.phoneMobile || r.phoneFixed || null,
      },
      {
        from: "_computed",
        to: "adresse",
        compute: (r) => {
          if (r.adresse) return r.adresse;
          const parts = [
            r.addressLine1,
            r.addressLine2,
            [r.postalCode, r.city].filter(Boolean).join(" "),
          ].filter(Boolean);
          return parts.length ? parts.join(", ") : null;
        },
      },
      { from: "siret", to: "siret" },
      { from: "notes", to: "notes" },
    ],
  },
  {
    table: "chantiers",
    pkColumn: "id",
    columns: [
      { from: "id", to: "id" },
      { from: "nom", to: "nom" },
      { from: "clientId", to: "clientId" },
      { from: "adresse", to: "adresse" },
      { from: "status", to: "statut" },
      { from: "priorite", to: "priorite" },
      { from: "dateDebut", to: "dateDebut", t: "date" },
      { from: "dateFin", to: "dateFin", t: "date" },
      { from: "notes", to: "notes" },
    ],
  },
  {
    table: "invoices",
    pkColumn: "id",
    columns: [
      { from: "id", to: "id" },
      { from: "reference", to: "reference" },
      { from: "status", to: "status" },
      { from: "type", to: "type" },
      { from: "title", to: "title" },
      { from: "clientId", to: "clientId" },
      { from: "chantierId", to: "chantierId" },
      { from: "fromQuoteId", to: "fromQuoteId" },
      { from: "issueDate", to: "issueDate", t: "date" },
      { from: "dueDate", to: "dueDate", t: "date" },
      { from: "paymentTermsDays", to: "paymentTermsDays" },
      { from: "sentAt", to: "sentAt", t: "datetime" },
      { from: "paidAt", to: "paidAt", t: "datetime" },
      { from: "items", to: "items" },
      { from: "globalDiscountMode", to: "globalDiscountMode" },
      { from: "globalDiscountPercent", to: "globalDiscountPercent" },
      { from: "globalDiscountAmount", to: "globalDiscountAmount" },
      { from: "acompteBasedOnQuoteId", to: "acompteBasedOnQuoteId" },
      { from: "acomptePercent", to: "acomptePercent" },
      { from: "avoirReferenceInvoiceId", to: "avoirReferenceInvoiceId" },
      { from: "introText", to: "introText" },
      { from: "conditionsText", to: "conditionsText" },
      { from: "footerText", to: "footerText" },
      { from: "internalNotes", to: "internalNotes" },
      { from: "companySnapshot", to: "companySnapshot" },
      { from: "totalHT", to: "totalHT" },
      { from: "totalTTC", to: "totalTTC" },
      { from: "totalPaid", to: "totalPaid" },
      { from: "lastReminderSentAt", to: "lastReminderSentAt", t: "datetime" },
      { from: "remindersCount", to: "remindersCount" },
      { from: "createdAt", to: "createdAt", t: "datetime" },
      { from: "updatedAt", to: "updatedAt", t: "datetime" },
    ],
  },
  {
    table: "invoice_payments",
    pkColumn: "id",
    columns: [
      { from: "id", to: "id" },
      { from: "invoiceId", to: "invoiceId" },
      { from: "amount", to: "amount" },
      { from: "date", to: "date", t: "date" },
      { from: "method", to: "method" },
      { from: "reference", to: "reference" },
      { from: "notes", to: "notes" },
      { from: "createdAt", to: "createdAt", t: "datetime" },
    ],
  },
];

function transformValue(raw, t) {
  if (raw === null || raw === undefined) return null;
  if (t === "date" && typeof raw === "string") return raw.slice(0, 10);
  if (t === "datetime" && typeof raw === "string")
    return raw.replace("T", " ").replace(/\.\d+Z?$/, "");
  return raw;
}

async function main() {
  const mysql = require("mysql2/promise");
  console.log("\n═══ Sync via sqlite3 CLI → MySQL ═══════════════════════\n");
  console.log("  source:", path.resolve(sqlitePath));
  const cfg = {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  };
  console.log(`  cible: ${cfg.host}:${cfg.port}/${cfg.database} (user=${cfg.user})`);

  if (!cfg.user || !cfg.database) {
    console.error("✗ MYSQL_USER ou MYSQL_DATABASE non défini. Vérifie le .env.");
    process.exit(1);
  }

  const pool = mysql.createPool({ ...cfg, connectionLimit: 1 });
  let totalInserted = 0;
  let totalUpdated = 0;

  try {
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const tx of TABLES) {
      if (!tableExists(tx.table)) {
        console.log(`  ${tx.table.padEnd(20)} ⚠ table SQLite absente, skip`);
        continue;
      }
      const rows = runSqlite(`SELECT * FROM ${tx.table}`);
      if (rows.length === 0) {
        console.log(`  ${tx.table.padEnd(20)} (vide)`);
        continue;
      }

      const targetCols = tx.columns.map((c) => c.to);
      const placeholders = targetCols.map(() => "?").join(", ");
      const updateClause = targetCols
        .filter((c) => c !== tx.pkColumn)
        .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
        .join(", ");
      const sql = `INSERT INTO \`${tx.table}\` (${targetCols
        .map((c) => `\`${c}\``)
        .join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;

      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const row of rows) {
        try {
          const values = tx.columns.map((c) => {
            if (c.compute) return c.compute(row);
            return transformValue(row[c.from] ?? null, c.t);
          });
          const [result] = await pool.execute(sql, values);
          if (result.affectedRows === 1) inserted++;
          else if (result.affectedRows === 2) updated++;
        } catch (e) {
          errors++;
          if (errors <= 3) {
            console.error(`     ✗ ligne ${tx.table}.${row[tx.pkColumn]}:`, e.message);
          }
        }
      }

      console.log(
        `  ${tx.table.padEnd(20)} ${rows.length} → inséré=${inserted}, mis à jour=${updated}${
          errors ? `, erreurs=${errors}` : ""
        }`
      );
      totalInserted += inserted;
      totalUpdated += updated;
    }

    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await pool.end();
  }

  console.log(
    `\n✓ Sync terminée. ${totalInserted} insertions + ${totalUpdated} mises à jour.\n`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
