"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// DB — pool MySQL (mysql2/promise) + migrations
//
// Le schéma est minimal et reproduit fidèlement celui de l'app desktop
// (mêmes noms de tables et colonnes en camelCase) pour faciliter la migration.
//
// Le pool est partagé entre toutes les routes — pas de connexion par requête.
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPool = createPool;
exports.pingPool = pingPool;
exports.runMigrations = runMigrations;
const promise_1 = __importDefault(require("mysql2/promise"));
function createPool(cfg) {
    const opts = {
        host: cfg.MYSQL_HOST,
        port: cfg.MYSQL_PORT,
        user: cfg.MYSQL_USER,
        password: cfg.MYSQL_PASSWORD,
        database: cfg.MYSQL_DATABASE,
        connectionLimit: cfg.MYSQL_CONNECTION_LIMIT,
        waitForConnections: true,
        namedPlaceholders: false,
        decimalNumbers: true,
        timezone: "Z",
        charset: "utf8mb4",
    };
    return promise_1.default.createPool(opts);
}
async function pingPool(db) {
    const conn = await db.getConnection();
    try {
        await conn.ping();
    }
    finally {
        conn.release();
    }
}
// ─── Migrations ──────────────────────────────────────────────────────────
// CREATE TABLE IF NOT EXISTS — idempotent. Les schémas sont volontairement
// proches de la version SQLite desktop pour permettre une migration facile.
async function runMigrations(db) {
    const statements = [
        `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(64) UNIQUE NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS clients (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nom VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      telephone VARCHAR(64),
      adresse TEXT,
      siret VARCHAR(32),
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NULL DEFAULT NULL,
      INDEX idx_clients_email (email),
      INDEX idx_clients_siret (siret)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS fournisseurs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nom VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      telephone VARCHAR(64),
      adresse TEXT,
      siret VARCHAR(32),
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NULL DEFAULT NULL,
      INDEX idx_fournisseurs_siret (siret)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS chantiers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nom VARCHAR(255) NOT NULL,
      clientId INT NULL,
      adresse TEXT,
      statut VARCHAR(64),
      priorite VARCHAR(32),
      dateDebut DATE,
      dateFin DATE,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NULL DEFAULT NULL,
      INDEX idx_chantiers_client (clientId),
      INDEX idx_chantiers_statut (statut),
      CONSTRAINT fk_chantiers_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(128) PRIMARY KEY,
      value LONGTEXT NOT NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];
    for (const sql of statements) {
        await db.query(sql);
    }
}
//# sourceMappingURL=db.js.map