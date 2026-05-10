// ═══════════════════════════════════════════════════════════════════════════
// sync-from-desktop.ts — Synchronisation initiale desktop SQLite → serveur MySQL
//
// Usage (depuis ton poste local) :
//   npm run sync:desktop -- "/chemin/vers/btp-v16.db"
//
// Variables d'env requises (.env) :
//   MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
//
// Stratégie : on lit la DB SQLite locale et on importe les données dans MySQL
// avec une politique UPSERT (INSERT … ON DUPLICATE KEY UPDATE) pour pouvoir
// relancer plusieurs fois sans erreur.
//
// IMPORTANT : seules les colonnes communes aux deux schémas sont migrées.
// Les colonnes desktop-only (firstName, lastName, billingAddress, photos…)
// seront ajoutées au fur et à mesure côté MySQL au fil des sessions.
// ═══════════════════════════════════════════════════════════════════════════

import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import { loadConfig } from "../src/config";

const sqlitePath = process.argv[2];
if (!sqlitePath) {
  console.error("Usage: tsx scripts/sync-from-desktop.ts <path-to-btp-v16.db>");
  console.error('  Exemple: npm run sync:desktop -- "%APPDATA%/@btp/desktop/btp-v16.db"');
  process.exit(1);
}
if (!fs.existsSync(sqlitePath)) {
  console.error("✗ Fichier SQLite introuvable :", sqlitePath);
  process.exit(1);
}

interface ColumnMap {
  sqlite: string;
  mysql: string;
  /** transform optionnel de la valeur (date string, JSON, etc.) */
  transform?: (v: unknown) => unknown;
}

interface TableSync {
  /** nom table SQLite ET MySQL (mêmes noms par convention) */
  table: string;
  /** colonne(s) à utiliser pour la clause ON DUPLICATE KEY UPDATE */
  pkColumn: string;
  /** mapping colonne par colonne */
  columns: ColumnMap[];
}

// Helper : convertit une date string SQLite → DATETIME MySQL
const toDateTime = (v: unknown): unknown => {
  if (!v) return null;
  if (typeof v !== "string") return v;
  // SQLite stocke souvent "2026-04-21 01:18:01" ou ISO 8601
  return v.replace("T", " ").replace(/\.\d+Z?$/, "");
};

const toDate = (v: unknown): unknown => {
  if (!v) return null;
  if (typeof v !== "string") return v;
  // Garde uniquement la partie YYYY-MM-DD
  return v.slice(0, 10);
};

// ─── Mapping des tables synchronisables ──────────────────────────────────
const TABLES: TableSync[] = [
  // USERS — mêmes colonnes
  {
    table: "users",
    pkColumn: "username",
    columns: [
      { sqlite: "username", mysql: "username" },
      { sqlite: "passwordHash", mysql: "passwordHash" },
      { sqlite: "role", mysql: "role" },
      { sqlite: "createdAt", mysql: "createdAt", transform: toDateTime },
    ],
  },

  // CLIENTS — schéma serveur simple : nom, email, telephone, adresse, siret, notes
  // Côté desktop, le nom peut être dans nom OU companyName OU firstName+lastName.
  {
    table: "clients",
    pkColumn: "id",
    columns: [
      { sqlite: "id", mysql: "id" },
      {
        sqlite: "_computed_nom",
        mysql: "nom",
        transform: (row: unknown) => {
          const r = row as {
            companyName?: string;
            firstName?: string;
            lastName?: string;
            nom?: string;
          };
          return (
            r.nom ||
            r.companyName ||
            `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() ||
            "(sans nom)"
          );
        },
      },
      { sqlite: "email", mysql: "email" },
      {
        sqlite: "_computed_telephone",
        mysql: "telephone",
        transform: (row: unknown) => {
          const r = row as { telephone?: string; phoneMobile?: string; phoneFixed?: string };
          return r.telephone || r.phoneMobile || r.phoneFixed || null;
        },
      },
      {
        sqlite: "_computed_adresse",
        mysql: "adresse",
        transform: (row: unknown) => {
          const r = row as {
            adresse?: string;
            addressLine1?: string;
            addressLine2?: string;
            postalCode?: string;
            city?: string;
          };
          if (r.adresse) return r.adresse;
          const parts = [
            r.addressLine1,
            r.addressLine2,
            [r.postalCode, r.city].filter(Boolean).join(" "),
          ].filter(Boolean);
          return parts.length ? parts.join(", ") : null;
        },
      },
      { sqlite: "siret", mysql: "siret" },
      { sqlite: "notes", mysql: "notes" },
    ],
  },

  // CHANTIERS
  {
    table: "chantiers",
    pkColumn: "id",
    columns: [
      { sqlite: "id", mysql: "id" },
      { sqlite: "nom", mysql: "nom" },
      { sqlite: "clientId", mysql: "clientId" },
      { sqlite: "adresse", mysql: "adresse" },
      { sqlite: "status", mysql: "statut" },
      { sqlite: "priorite", mysql: "priorite" },
      { sqlite: "dateDebut", mysql: "dateDebut", transform: toDate },
      { sqlite: "dateFin", mysql: "dateFin", transform: toDate },
      { sqlite: "notes", mysql: "notes" },
    ],
  },

  // INVOICES (factures) — mêmes noms de colonnes côté SQLite et MySQL
  {
    table: "invoices",
    pkColumn: "id",
    columns: [
      { sqlite: "id", mysql: "id" },
      { sqlite: "reference", mysql: "reference" },
      { sqlite: "status", mysql: "status" },
      { sqlite: "type", mysql: "type" },
      { sqlite: "title", mysql: "title" },
      { sqlite: "clientId", mysql: "clientId" },
      { sqlite: "chantierId", mysql: "chantierId" },
      { sqlite: "fromQuoteId", mysql: "fromQuoteId" },
      { sqlite: "issueDate", mysql: "issueDate", transform: toDate },
      { sqlite: "dueDate", mysql: "dueDate", transform: toDate },
      { sqlite: "paymentTermsDays", mysql: "paymentTermsDays" },
      { sqlite: "sentAt", mysql: "sentAt", transform: toDateTime },
      { sqlite: "paidAt", mysql: "paidAt", transform: toDateTime },
      { sqlite: "items", mysql: "items" }, // stocké en JSON string des deux côtés
      { sqlite: "globalDiscountMode", mysql: "globalDiscountMode" },
      { sqlite: "globalDiscountPercent", mysql: "globalDiscountPercent" },
      { sqlite: "globalDiscountAmount", mysql: "globalDiscountAmount" },
      { sqlite: "acompteBasedOnQuoteId", mysql: "acompteBasedOnQuoteId" },
      { sqlite: "acomptePercent", mysql: "acomptePercent" },
      { sqlite: "avoirReferenceInvoiceId", mysql: "avoirReferenceInvoiceId" },
      { sqlite: "introText", mysql: "introText" },
      { sqlite: "conditionsText", mysql: "conditionsText" },
      { sqlite: "footerText", mysql: "footerText" },
      { sqlite: "internalNotes", mysql: "internalNotes" },
      { sqlite: "companySnapshot", mysql: "companySnapshot" },
      { sqlite: "totalHT", mysql: "totalHT" },
      { sqlite: "totalTTC", mysql: "totalTTC" },
      { sqlite: "totalPaid", mysql: "totalPaid" },
      { sqlite: "lastReminderSentAt", mysql: "lastReminderSentAt", transform: toDateTime },
      { sqlite: "remindersCount", mysql: "remindersCount" },
      { sqlite: "createdAt", mysql: "createdAt", transform: toDateTime },
      { sqlite: "updatedAt", mysql: "updatedAt", transform: toDateTime },
    ],
  },

  // INVOICE PAYMENTS
  {
    table: "invoice_payments",
    pkColumn: "id",
    columns: [
      { sqlite: "id", mysql: "id" },
      { sqlite: "invoiceId", mysql: "invoiceId" },
      { sqlite: "amount", mysql: "amount" },
      { sqlite: "date", mysql: "date", transform: toDate },
      { sqlite: "method", mysql: "method" },
      { sqlite: "reference", mysql: "reference" },
      { sqlite: "notes", mysql: "notes" },
      { sqlite: "createdAt", mysql: "createdAt", transform: toDateTime },
    ],
  },
];

async function main() {
  console.log("\n═══ Synchronisation desktop → MySQL ═══════════════════\n");
  console.log("  source SQLite :", path.resolve(sqlitePath));

  const cfg = loadConfig();
  console.log(`  cible MySQL   : ${cfg.MYSQL_HOST}:${cfg.MYSQL_PORT}/${cfg.MYSQL_DATABASE}`);

  const sqlite = new Database(sqlitePath, { readonly: true });
  const pool = mysql.createPool({
    host: cfg.MYSQL_HOST,
    port: cfg.MYSQL_PORT,
    user: cfg.MYSQL_USER,
    password: cfg.MYSQL_PASSWORD,
    database: cfg.MYSQL_DATABASE,
    connectionLimit: 1,
  });

  let totalInserted = 0;
  let totalUpdated = 0;

  try {
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const tx of TABLES) {
      let rows: Record<string, unknown>[] = [];
      try {
        rows = sqlite.prepare(`SELECT * FROM ${tx.table}`).all() as Record<string, unknown>[];
      } catch (e) {
        console.log(`  ${tx.table.padEnd(20)} ⚠ table SQLite absente, skip`);
        continue;
      }
      if (rows.length === 0) {
        console.log(`  ${tx.table.padEnd(20)} (vide)`);
        continue;
      }

      const mysqlCols = tx.columns.map((c) => c.mysql);
      const placeholders = mysqlCols.map(() => "?").join(", ");
      const updateClause = mysqlCols
        .filter((c) => c !== tx.pkColumn)
        .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
        .join(", ");

      const sql = `INSERT INTO \`${tx.table}\` (${mysqlCols.map((c) => `\`${c}\``).join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;

      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const row of rows) {
        try {
          const values = tx.columns.map((c) => {
            const raw = c.sqlite.startsWith("_computed_") ? row : row[c.sqlite];
            return c.transform ? c.transform(raw) : raw ?? null;
          });
          const [result] = (await pool.execute(sql, values)) as unknown as [
            { affectedRows: number; insertId: number },
          ];
          // ON DUPLICATE: affectedRows = 1 si insert, 2 si update
          if (result.affectedRows === 1) inserted++;
          else if (result.affectedRows === 2) updated++;
        } catch (e) {
          errors++;
          if (errors <= 3) {
            console.error(`     ✗ ligne ${tx.table}.${row[tx.pkColumn]}:`, (e as Error).message);
          }
        }
      }

      const summary = `inséré=${inserted}, mis à jour=${updated}${errors ? `, erreurs=${errors}` : ""}`;
      console.log(`  ${tx.table.padEnd(20)} ${rows.length} lignes → ${summary}`);
      totalInserted += inserted;
      totalUpdated += updated;
    }

    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    sqlite.close();
    await pool.end();
  }

  console.log(`\n✓ Synchronisation terminée. Total : ${totalInserted} insertions + ${totalUpdated} mises à jour.\n`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
