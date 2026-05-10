#!/usr/bin/env node
/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════════════
// create-super-admin.js — Crée le 1er super_admin BatiDesk (éditeur SaaS)
//
// Usage (cPanel Terminal, depuis n'importe où) :
//
//   node ~/repositories/btp-expert/apps/server/scripts/create-super-admin.js \
//     --username superadmin \
//     --password "TonMotDePasseSolide!"
//
// Le super_admin n'est lié à aucune company (companyId = NULL). Il accède
// uniquement à /super-admin/companies pour gérer les entreprises clientes.
//
// ⚠️  CE SCRIPT EST IDEMPOTENT-SAFE : si un user avec ce username existe
// déjà, il propose de mettre à jour son rôle vers super_admin OU sort
// proprement.
// ═══════════════════════════════════════════════════════════════════════════

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const dotenv = require("dotenv");

// Charge .env depuis le doc root
const envCandidates = [
  process.env.HOME && path.join(process.env.HOME, "intranet.jacobhabitat-dev.fr/.env"),
  path.resolve(__dirname, "..", "..", "..", ".env"),
  ".env",
];
for (const env of envCandidates) {
  if (env && fs.existsSync(env)) {
    dotenv.config({ path: env });
    break;
  }
}

// Parse args
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv);

if (!args.username || !args.password) {
  console.error(`
❌ Usage incorrect.

Exemple :
  node ${path.basename(__filename)} \\
    --username superadmin \\
    --password "TonMdpSolide!"
`);
  process.exit(1);
}

const SALT_LEN = 16;
const KEY_LEN = 64;
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
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
  if (!cfg.user || !cfg.database) {
    console.error("❌ MYSQL_USER ou MYSQL_DATABASE manquants dans le .env");
    process.exit(1);
  }
  console.log(`Connexion à ${cfg.host}:${cfg.port}/${cfg.database}…`);
  const conn = await mysql.createConnection(cfg);

  try {
    // 1. Check si le username existe déjà
    const [existing] = await conn.query(
      "SELECT id, role FROM users WHERE username = ? LIMIT 1",
      [args.username]
    );
    if (existing.length > 0) {
      const u = existing[0];
      if (u.role === "super_admin") {
        console.log(`ℹ️  Un super_admin "${args.username}" existe déjà (id=${u.id}). Mise à jour du mot de passe.`);
        await conn.execute(
          "UPDATE users SET passwordHash = ?, mustChangePassword = 0, disabled = 0 WHERE id = ?",
          [hashPassword(args.password), u.id]
        );
        console.log(`✅ Mot de passe du super_admin "${args.username}" mis à jour.`);
        return;
      } else {
        console.error(`❌ Un user "${args.username}" existe déjà avec un autre rôle (${u.role}). Choisis un autre username.`);
        process.exit(1);
      }
    }

    // 2. Crée le super_admin (companyId = NULL → pas rattaché à un tenant)
    const passwordHash = hashPassword(args.password);
    const [result] = await conn.execute(
      `INSERT INTO users
         (username, passwordHash, role, companyId, email, firstName, lastName,
          mustChangePassword, disabled)
       VALUES (?, ?, 'super_admin', NULL, ?, ?, ?, 0, 0)`,
      [
        args.username,
        passwordHash,
        args.email || "",
        args.firstName || "Super",
        args.lastName || "Admin",
      ]
    );
    console.log(`✅ Super-admin créé avec succès`);
    console.log(`   ID       : ${result.insertId}`);
    console.log(`   Username : ${args.username}`);
    console.log(`   Rôle     : super_admin`);
    console.log(`   Login    : https://intranet.jacobhabitat-dev.fr/`);
    console.log("");
    console.log(`⚠️  Garde ce mot de passe en sécurité (gestionnaire de mots de passe).`);
    console.log(`   Une fois loggé, va sur /super-admin/companies pour créer des entreprises clientes.`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("❌ Erreur :", e.message || e);
  process.exit(1);
});
