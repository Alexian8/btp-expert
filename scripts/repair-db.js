// ═══════════════════════════════════════════════════════════════════════════
// repair-db.js — Force un checkpoint WAL et libère la DB
//
// Pourquoi : un crash avec un fichier .db-wal volumineux peut empêcher
// l'app installée de rouvrir la DB (mismatch de version sqlite, etc.).
// On utilise notre better-sqlite3 qui sait lire la DB pour forcer la fusion.
//
// Garantit :
//   1. Un backup horodaté est créé AVANT toute modification
//   2. La DB est ouverte, checkpoint forcé (TRUNCATE), puis fermée
//   3. Les fichiers .db-wal et .db-shm résiduels sont supprimés
// ═══════════════════════════════════════════════════════════════════════════

const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

const dbPath = path.join(process.env.APPDATA, "@btp", "desktop", "btp-v16.db");
const walPath = dbPath + "-wal";
const shmPath = dbPath + "-shm";

if (!fs.existsSync(dbPath)) {
  console.error("✗ DB introuvable :", dbPath);
  process.exit(1);
}

// ─── Backup pré-fix ──────────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(path.dirname(dbPath), `_pre_repair_${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
for (const f of [dbPath, walPath, shmPath]) {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join(backupDir, path.basename(f)));
  }
}
console.log("✓ Backup avant réparation :", backupDir);

// ─── Vérifier intégrité avant ────────────────────────────────────────────
console.log("\n─── État avant ───────────────────────────────────────");
{
  const db = new Database(dbPath, { readonly: true });
  const integ = db.pragma("integrity_check", { simple: true });
  console.log("  integrity_check =", integ);
  const users = db.prepare("SELECT COUNT(*) as n FROM users").get();
  console.log("  users count     =", users.n);
  if (fs.existsSync(walPath)) {
    console.log("  wal size        =", fs.statSync(walPath).size, "bytes");
  }
  db.close();
}

// ─── Open en read-write + checkpoint TRUNCATE ────────────────────────────
console.log("\n─── Réparation ───────────────────────────────────────");
{
  const db = new Database(dbPath);
  // S'assurer qu'on est bien en mode WAL
  const mode = db.pragma("journal_mode = WAL", { simple: true });
  console.log("  journal_mode    =", mode);

  // Checkpoint TRUNCATE : applique le WAL au .db principal et vide le WAL
  const result = db.pragma("wal_checkpoint(TRUNCATE)");
  console.log("  wal_checkpoint  =", JSON.stringify(result));

  // Repasser en DELETE puis WAL pour forcer la suppression du -wal/-shm
  db.pragma("journal_mode = DELETE");
  db.pragma("journal_mode = WAL");

  db.close();
  console.log("  ✓ DB checkpointée et fermée");
}

// ─── Nettoyer fichiers WAL/SHM résiduels ─────────────────────────────────
for (const f of [walPath, shmPath]) {
  if (fs.existsSync(f)) {
    const size = fs.statSync(f).size;
    if (size === 0) {
      fs.unlinkSync(f);
      console.log("  ✓ Supprimé (vide) :", path.basename(f));
    } else {
      console.log(`  ⚠ Reste ${size} bytes dans ${path.basename(f)} (laissé en place)`);
    }
  }
}

// ─── Vérifier intégrité après ────────────────────────────────────────────
console.log("\n─── État après ───────────────────────────────────────");
{
  const db = new Database(dbPath, { readonly: true });
  const integ = db.pragma("integrity_check", { simple: true });
  console.log("  integrity_check =", integ);
  const users = db.prepare("SELECT username, role, createdAt FROM users").all();
  console.log("  users           =", JSON.stringify(users));
  db.close();
}

console.log("\n✓ Réparation terminée. Tu peux relancer BatiDesk.");
