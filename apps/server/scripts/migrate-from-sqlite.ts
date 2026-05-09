// ═══════════════════════════════════════════════════════════════════════════
// migrate-from-sqlite.ts
//
// Migre les données d'un fichier btp-v16.db SQLite vers la DB MySQL cible.
//
// Usage :
//   tsx apps/server/scripts/migrate-from-sqlite.ts /chemin/vers/btp-v16.db
//
// Variables d'env requises (cf apps/server/.env) : MYSQL_HOST, MYSQL_USER,
// MYSQL_PASSWORD, MYSQL_DATABASE.
//
// Note : ne migre que les tables actuellement créées par runMigrations()
// côté serveur (users, clients, fournisseurs, chantiers, settings).
// Les autres tables (vault, invoices, quotes, …) seront migrées au fil
// de l'ajout des routes correspondantes.
// ═══════════════════════════════════════════════════════════════════════════

import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import { loadConfig } from "../src/config";

const sqlitePath = process.argv[2];
if (!sqlitePath) {
  console.error("Usage: tsx scripts/migrate-from-sqlite.ts <path-to-btp-v16.db>");
  process.exit(1);
}
if (!fs.existsSync(sqlitePath)) {
  console.error("Fichier SQLite introuvable :", sqlitePath);
  process.exit(1);
}

interface Tx {
  /** nom table SQLite */
  from: string;
  /** nom table MySQL */
  to: string;
  /** mapping colonnes SQLite → MySQL (si différent). Sinon, on garde le même nom. */
  columns: Record<string, string>;
  /** transformation optionnelle des valeurs avant insert */
  transform?: (row: Record<string, unknown>) => Record<string, unknown>;
}

const transfers: Tx[] = [
  {
    from: "users",
    to: "users",
    columns: {
      id: "id",
      username: "username",
      passwordHash: "passwordHash",
      role: "role",
      createdAt: "createdAt",
    },
  },
  // Le schéma SQLite desktop n'utilise pas exactement les mêmes colonnes pour
  // clients/chantiers que le schéma serveur (le desktop a beaucoup plus de
  // colonnes). On migre uniquement les colonnes qui ont une correspondance.
  // Pour l'instant on saute ces tables — elles seront migrées quand on aura
  // unifié le schéma.
];

async function main() {
  console.log("───  Migration SQLite → MySQL ───────────────────────");
  console.log("  source :", path.resolve(sqlitePath));
  const cfg = loadConfig();
  console.log(`  cible  : ${cfg.MYSQL_HOST}:${cfg.MYSQL_PORT}/${cfg.MYSQL_DATABASE}`);

  const sqlite = new Database(sqlitePath, { readonly: true });
  const pool = mysql.createPool({
    host: cfg.MYSQL_HOST,
    port: cfg.MYSQL_PORT,
    user: cfg.MYSQL_USER,
    password: cfg.MYSQL_PASSWORD,
    database: cfg.MYSQL_DATABASE,
    connectionLimit: cfg.MYSQL_CONNECTION_LIMIT,
  });

  try {
    for (const tx of transfers) {
      const rows = sqlite.prepare(`SELECT * FROM ${tx.from}`).all() as Record<string, unknown>[];
      console.log(`\n  ${tx.from} → ${tx.to} : ${rows.length} ligne(s)`);
      if (rows.length === 0) continue;

      const targetCols = Object.values(tx.columns);
      const placeholders = targetCols.map(() => "?").join(", ");

      // Conflit potentiel sur les ids : on désactive temporairement les FK
      await pool.query("SET FOREIGN_KEY_CHECKS = 0");
      const insertSql = `INSERT INTO \`${tx.to}\` (${targetCols.map(c => `\`${c}\``).join(", ")}) VALUES (${placeholders})`;

      let inserted = 0;
      let skipped = 0;
      for (const row of rows) {
        const transformed = tx.transform ? tx.transform(row) : row;
        const values = Object.keys(tx.columns).map((src) => transformed[src] ?? null);
        try {
          await pool.execute(insertSql, values);
          inserted++;
        } catch (e) {
          // Probablement un duplicate id — on ignore et on reporte
          if ((e as { code?: string }).code === "ER_DUP_ENTRY") {
            skipped++;
          } else {
            console.error(`    ✗ ligne id=${row.id}:`, (e as Error).message);
            throw e;
          }
        }
      }
      await pool.query("SET FOREIGN_KEY_CHECKS = 1");
      console.log(`     ✓ inséré=${inserted}, skipped(duplicates)=${skipped}`);
    }
    console.log("\n✓ Migration terminée.");
  } finally {
    sqlite.close();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
