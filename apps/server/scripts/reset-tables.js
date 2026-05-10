#!/usr/bin/env node
/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// reset-tables.js — DROP + CREATE des tables data (DESTRUCTIF)
//
// Usage (cPanel Terminal, depuis ~/intranet.jacobhabitat-dev.fr/) :
//   node ~/repositories/btp-expert/apps/server/scripts/reset-tables.js
//
// Préserve : users, settings, oauth_tokens (donc admin + login Microsoft OK)
// Drop : clients, suppliers, fournisseurs, chantiers, quotes, invoices,
//        invoice_payments, expenses, expense_notes, subcontractors,
//        agenda_events, company
//
// Recrée tout avec le schéma à jour de db.ts.
// ═══════════════════════════════════════════════════════════════════════════

const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

// Charge .env depuis le doc root
const envCandidates = [
  process.env.HOME && path.join(process.env.HOME, "intranet.jacobhabitat-dev.fr/.env"),
  ".env",
];
for (const env of envCandidates) {
  if (env && fs.existsSync(env)) {
    dotenv.config({ path: env });
    break;
  }
}

async function main() {
  const mysql = require("mysql2/promise");
  const cfg = {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  };
  console.log(`Connexion à ${cfg.host}:${cfg.port}/${cfg.database}…`);

  const pool = mysql.createPool({ ...cfg, connectionLimit: 1 });

  // Charge la version compilée de runMigrations
  const { runMigrations, resetDataTables } = require(
    path.join(__dirname, "..", "dist", "db.js")
  );

  try {
    console.log("→ DROP des tables data…");
    await resetDataTables(pool);
    console.log("→ CREATE avec schéma à jour…");
    await runMigrations(pool);
    console.log("✓ Reset terminé.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
