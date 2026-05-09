// Compare l'état des copies de DB candidates pour la récupération
const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

const APPDATA = process.env.APPDATA;
const candidates = [
  path.join(APPDATA, "@btp", "desktop", "btp-v16.db"),
  path.join(APPDATA, "@btp", "desktop", "btp-v16.corrompu.db"),
  path.join(APPDATA, "@btp", "desktop", "btp-v16.corrompu2.db"),
  path.join(APPDATA, "btp-expert", "database.db"),
  path.join(APPDATA, "btp-expert", "data", "database.db"),
];

for (const dbPath of candidates) {
  console.log("\n═══", dbPath);
  if (!fs.existsSync(dbPath)) {
    console.log("  (absent)");
    continue;
  }
  const stat = fs.statSync(dbPath);
  console.log(`  taille=${stat.size}, mtime=${stat.mtime.toISOString()}`);

  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (e) {
    console.log("  ✗ ouverture impossible :", e.message);
    continue;
  }

  // Integrity check complet
  try {
    const rows = db.pragma("integrity_check");
    const messages = rows.map(r => r.integrity_check);
    if (messages.length === 1 && messages[0] === "ok") {
      console.log("  ✓ integrity_check = ok");
    } else {
      console.log(`  ✗ integrity_check = ${messages.length} problèmes`);
      for (const m of messages.slice(0, 5)) console.log("     ·", m);
      if (messages.length > 5) console.log(`     · ... +${messages.length - 5} autres`);
    }
  } catch (e) {
    console.log("  ✗ integrity_check planté :", e.message);
  }

  // Stats
  try {
    const tables = ["users", "clients", "chantiers", "quotes", "invoices", "suppliers"];
    const counts = {};
    for (const t of tables) {
      try {
        counts[t] = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n;
      } catch {}
    }
    console.log("  compteurs :", JSON.stringify(counts));

    const users = db.prepare("SELECT id, username, role, createdAt FROM users").all();
    console.log("  users :", JSON.stringify(users));
  } catch (e) {
    console.log("  ✗ lecture stats :", e.message);
  }

  db.close();
}
