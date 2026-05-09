// Diagnostic d'une DB SQLite arbitraire — lecture seule
const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("Usage: node diagnose-db.js <chemin-vers-fichier.db>");
  process.exit(1);
}

console.log(`\n═══ Diagnostic de : ${dbPath}\n`);

const candidates = [dbPath, dbPath + "-wal", dbPath + "-shm"];
console.log("─── Fichiers présents ────────────────────────────────");
for (const f of candidates) {
  if (fs.existsSync(f)) {
    const s = fs.statSync(f);
    console.log(`  ${path.basename(f).padEnd(28)} ${String(s.size).padStart(10)} bytes  ${s.mtime.toISOString()}`);
  } else {
    console.log(`  ${path.basename(f).padEnd(28)} (absent)`);
  }
}

let db;
try {
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
  console.log("\n  ✓ Ouverture OK");
} catch (e) {
  console.log("\n  ✗ Échec ouverture :", e.message);
  process.exit(1);
}

try {
  const rows = db.pragma("integrity_check");
  console.log("\n─── integrity_check ──────────────────────────────────");
  for (const r of rows) console.log("  ", r.integrity_check);
} catch (e) {
  console.log("  ✗", e.message);
}

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log("\n─── Tables ───────────────────────────────────────────");
  console.log("  Total :", tables.length);
  console.log("  ", tables.map(t => t.name).join(", "));
} catch (e) {
  console.log("  ✗", e.message);
}

try {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  console.log("\n─── Table users ──────────────────────────────────────");
  if (cols.length === 0) {
    console.log("  (table absente)");
  } else {
    console.log("  Colonnes :", cols.map(c => `${c.name}:${c.type}`).join(", "));
    const count = db.prepare("SELECT COUNT(*) as n FROM users").get();
    console.log("  Nombre d'utilisateurs :", count.n);
    const users = db.prepare("SELECT * FROM users").all();
    for (const u of users) {
      const safeUser = { ...u };
      if (safeUser.passwordHash) safeUser.passwordHash = `[hash ${String(safeUser.passwordHash).length} chars]`;
      console.log("   ", JSON.stringify(safeUser));
    }
  }
} catch (e) {
  console.log("  ✗", e.message);
}

console.log("\n─── Compteurs ────────────────────────────────────────");
for (const t of ["clients", "chantiers", "quotes", "invoices", "subcontractors", "fournisseurs", "suppliers", "settings"]) {
  try {
    const c = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get();
    console.log(`  ${t.padEnd(18)} ${c.n}`);
  } catch (e) {
    // table absente
  }
}

db.close();
console.log("\n✓ Diagnostic terminé\n");
