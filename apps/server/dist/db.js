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
        // ─── Invoices (factures) ──────────────────────────────────────────────
        // PK est un UUID string (compat schéma desktop), pas un AUTO_INCREMENT.
        `CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(64) PRIMARY KEY,
      reference VARCHAR(64) DEFAULT '',
      status VARCHAR(32) DEFAULT 'brouillon',
      type VARCHAR(32) DEFAULT 'standard',
      title VARCHAR(255) DEFAULT '',
      clientId VARCHAR(64) DEFAULT '',
      chantierId VARCHAR(64) DEFAULT '',
      fromQuoteId VARCHAR(64) DEFAULT '',
      issueDate DATE NULL,
      dueDate DATE NULL,
      paymentTermsDays INT DEFAULT 30,
      sentAt DATETIME NULL,
      paidAt DATETIME NULL,
      items JSON NOT NULL,
      globalDiscountMode VARCHAR(16) DEFAULT 'none',
      globalDiscountPercent DECIMAL(5,2) DEFAULT 0,
      globalDiscountAmount DECIMAL(15,2) DEFAULT 0,
      acompteBasedOnQuoteId VARCHAR(64) DEFAULT '',
      acomptePercent DECIMAL(5,2) DEFAULT 0,
      avoirReferenceInvoiceId VARCHAR(64) DEFAULT '',
      introText TEXT,
      conditionsText TEXT,
      footerText TEXT,
      internalNotes TEXT,
      companySnapshot JSON,
      totalHT DECIMAL(15,2) DEFAULT 0,
      totalTTC DECIMAL(15,2) DEFAULT 0,
      totalPaid DECIMAL(15,2) DEFAULT 0,
      lastReminderSentAt DATETIME NULL,
      remindersCount INT DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_invoices_status (status),
      INDEX idx_invoices_client (clientId),
      INDEX idx_invoices_chantier (chantierId),
      INDEX idx_invoices_fromQuote (fromQuoteId),
      INDEX idx_invoices_reference (reference),
      INDEX idx_invoices_dueDate (dueDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Paiements (table jointe avec FK cascade) ─────────────────────────
        `CREATE TABLE IF NOT EXISTS invoice_payments (
      id VARCHAR(64) PRIMARY KEY,
      invoiceId VARCHAR(64) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      \`date\` DATE NOT NULL,
      method VARCHAR(32) DEFAULT 'virement',
      reference VARCHAR(255) DEFAULT '',
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payments_invoice (invoiceId),
      CONSTRAINT fk_payments_invoice FOREIGN KEY (invoiceId)
        REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];
    for (const sql of statements) {
        await db.query(sql);
    }
}
//# sourceMappingURL=db.js.map