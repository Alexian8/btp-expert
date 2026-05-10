"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// DB — pool MySQL (mysql2/promise) + migrations
//
// Schémas alignés sur l'app desktop (mêmes noms de tables/colonnes en
// camelCase, mêmes types de PK string UUID). Cela permet à apps/web de
// réutiliser le code desktop tel quel via le shim window.btpAPI.
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPool = createPool;
exports.pingPool = pingPool;
exports.runMigrations = runMigrations;
exports.resetDataTables = resetDataTables;
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
// CREATE TABLE IF NOT EXISTS — idempotent. Pour réécrire un schéma sans
// perdre les autres tables, utiliser apps/server/scripts/reset-tables.js.
async function runMigrations(db) {
    const statements = [
        // ─── Auth ──────────────────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(64) UNIQUE NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Settings (key/value) ──────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(128) PRIMARY KEY,
      value LONGTEXT NOT NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── OAuth tokens (Microsoft Graph) ────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS oauth_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      provider VARCHAR(32) NOT NULL,
      userId INT NOT NULL,
      accountEmail VARCHAR(255) DEFAULT '',
      accessToken TEXT NOT NULL,
      refreshToken TEXT,
      expiresAt DATETIME NULL,
      scope TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_provider_user (provider, userId),
      INDEX idx_oauth_user (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Clients (riche, aligné desktop) ───────────────────────────────────
        `CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(64) PRIMARY KEY,
      type VARCHAR(32) NOT NULL DEFAULT 'particulier',
      civility VARCHAR(16) DEFAULT '',
      firstName VARCHAR(128) DEFAULT '',
      lastName VARCHAR(128) DEFAULT '',
      companyName VARCHAR(255) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      phoneMobile VARCHAR(64) DEFAULT '',
      phoneFixed VARCHAR(64) DEFAULT '',
      addressLine1 VARCHAR(255) DEFAULT '',
      addressLine2 VARCHAR(255) DEFAULT '',
      postalCode VARCHAR(16) DEFAULT '',
      city VARCHAR(128) DEFAULT '',
      country VARCHAR(64) DEFAULT 'France',
      billingAddressSame TINYINT(1) DEFAULT 1,
      billingAddressLine1 VARCHAR(255) DEFAULT '',
      billingAddressLine2 VARCHAR(255) DEFAULT '',
      billingPostalCode VARCHAR(16) DEFAULT '',
      billingCity VARCHAR(128) DEFAULT '',
      billingCountry VARCHAR(64) DEFAULT 'France',
      siret VARCHAR(32) DEFAULT '',
      siren VARCHAR(32) DEFAULT '',
      tvaIntracom VARCHAR(32) DEFAULT '',
      legalForm VARCHAR(64) DEFAULT '',
      apeCode VARCHAR(16) DEFAULT '',
      apeLabel VARCHAR(255) DEFAULT '',
      tags JSON,
      source VARCHAR(64) DEFAULT '',
      notes TEXT,
      firstContactAt VARCHAR(32) DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_clients_name (lastName, firstName, companyName),
      INDEX idx_clients_city (city),
      INDEX idx_clients_type (type),
      INDEX idx_clients_email (email),
      INDEX idx_clients_siret (siret)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Suppliers (renommée de fournisseurs pour matcher desktop) ─────────
        `CREATE TABLE IF NOT EXISTS suppliers (
      id VARCHAR(64) PRIMARY KEY,
      companyName VARCHAR(255) DEFAULT '',
      contactFirstName VARCHAR(128) DEFAULT '',
      contactLastName VARCHAR(128) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      phoneMobile VARCHAR(64) DEFAULT '',
      phoneFixed VARCHAR(64) DEFAULT '',
      website VARCHAR(255) DEFAULT '',
      addressLine1 VARCHAR(255) DEFAULT '',
      addressLine2 VARCHAR(255) DEFAULT '',
      postalCode VARCHAR(16) DEFAULT '',
      city VARCHAR(128) DEFAULT '',
      country VARCHAR(64) DEFAULT 'France',
      siret VARCHAR(32) DEFAULT '',
      siren VARCHAR(32) DEFAULT '',
      tvaIntracom VARCHAR(32) DEFAULT '',
      legalForm VARCHAR(64) DEFAULT '',
      apeCode VARCHAR(16) DEFAULT '',
      apeLabel VARCHAR(255) DEFAULT '',
      category VARCHAR(64) DEFAULT 'Matériaux',
      iban VARCHAR(64) DEFAULT '',
      bic VARCHAR(32) DEFAULT '',
      paymentTermsDays INT DEFAULT 30,
      paymentMethod VARCHAR(32) DEFAULT 'Virement',
      tags JSON,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_suppliers_name (companyName),
      INDEX idx_suppliers_category (category),
      INDEX idx_suppliers_siret (siret)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Company profile (singleton) ───────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS company (
      id INT PRIMARY KEY DEFAULT 1,
      data JSON,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `INSERT IGNORE INTO company (id, data) VALUES (1, '{}')`,
        // ─── Chantiers (riche) ─────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS chantiers (
      id VARCHAR(64) PRIMARY KEY,
      reference VARCHAR(64) DEFAULT '',
      title VARCHAR(255) DEFAULT '',
      status VARCHAR(32) DEFAULT 'prospect',
      priority VARCHAR(32) DEFAULT 'normal',
      clientId VARCHAR(64) DEFAULT '',
      addressLine1 VARCHAR(255) DEFAULT '',
      addressLine2 VARCHAR(255) DEFAULT '',
      postalCode VARCHAR(16) DEFAULT '',
      city VARCHAR(128) DEFAULT '',
      country VARCHAR(64) DEFAULT 'France',
      nature VARCHAR(128) DEFAULT '',
      description TEXT,
      startDateEstimated VARCHAR(32) DEFAULT '',
      endDateEstimated VARCHAR(32) DEFAULT '',
      startDateActual VARCHAR(32) DEFAULT '',
      endDateActual VARCHAR(32) DEFAULT '',
      budgetEstimatedHT DECIMAL(15,2) DEFAULT 0,
      budgetEstimatedTTC DECIMAL(15,2) DEFAULT 0,
      photos JSON,
      tags JSON,
      categoryId VARCHAR(64) DEFAULT '',
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_chantiers_status (status),
      INDEX idx_chantiers_client (clientId),
      INDEX idx_chantiers_reference (reference)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Quotes (devis, aligné desktop) ────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS quotes (
      id VARCHAR(64) PRIMARY KEY,
      reference VARCHAR(64) DEFAULT '',
      status VARCHAR(32) DEFAULT 'brouillon',
      title VARCHAR(255) DEFAULT '',
      clientId VARCHAR(64) DEFAULT '',
      chantierId VARCHAR(64) DEFAULT '',
      issueDate VARCHAR(32) DEFAULT '',
      validUntilDate VARCHAR(32) DEFAULT '',
      acceptedAt VARCHAR(32) DEFAULT '',
      sentAt VARCHAR(32) DEFAULT '',
      items JSON,
      globalDiscountMode VARCHAR(16) DEFAULT 'none',
      globalDiscountPercent DECIMAL(5,2) DEFAULT 0,
      globalDiscountAmount DECIMAL(15,2) DEFAULT 0,
      introText TEXT,
      conditionsText TEXT,
      footerText TEXT,
      internalNotes TEXT,
      companySnapshot JSON,
      totalHT DECIMAL(15,2) DEFAULT 0,
      totalTTC DECIMAL(15,2) DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_quotes_status (status),
      INDEX idx_quotes_client (clientId),
      INDEX idx_quotes_chantier (chantierId),
      INDEX idx_quotes_reference (reference)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Invoices (factures) ───────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(64) PRIMARY KEY,
      reference VARCHAR(64) DEFAULT '',
      status VARCHAR(32) DEFAULT 'brouillon',
      type VARCHAR(32) DEFAULT 'standard',
      title VARCHAR(255) DEFAULT '',
      clientId VARCHAR(64) DEFAULT '',
      chantierId VARCHAR(64) DEFAULT '',
      fromQuoteId VARCHAR(64) DEFAULT '',
      issueDate VARCHAR(32) DEFAULT '',
      dueDate VARCHAR(32) DEFAULT '',
      paymentTermsDays INT DEFAULT 30,
      sentAt VARCHAR(32) DEFAULT '',
      paidAt VARCHAR(32) DEFAULT '',
      items JSON,
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
      lastReminderSentAt VARCHAR(32) DEFAULT '',
      remindersCount INT DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_invoices_status (status),
      INDEX idx_invoices_client (clientId),
      INDEX idx_invoices_chantier (chantierId),
      INDEX idx_invoices_fromQuote (fromQuoteId),
      INDEX idx_invoices_reference (reference)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS invoice_payments (
      id VARCHAR(64) PRIMARY KEY,
      invoiceId VARCHAR(64) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      \`date\` VARCHAR(32) NOT NULL,
      method VARCHAR(32) DEFAULT 'virement',
      reference VARCHAR(255) DEFAULT '',
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payments_invoice (invoiceId),
      CONSTRAINT fk_payments_invoice FOREIGN KEY (invoiceId)
        REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Dépenses ──────────────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(64) PRIMARY KEY,
      label VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      \`date\` VARCHAR(32) NOT NULL,
      category VARCHAR(64) DEFAULT '',
      supplierId VARCHAR(64) DEFAULT '',
      chantierId VARCHAR(64) DEFAULT '',
      paymentMethod VARCHAR(32) DEFAULT '',
      paidDate VARCHAR(32) DEFAULT '',
      isPaid TINYINT(1) DEFAULT 0,
      notes TEXT,
      attachmentPath VARCHAR(512) DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expenses_date (\`date\`),
      INDEX idx_expenses_supplier (supplierId),
      INDEX idx_expenses_chantier (chantierId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Notes de frais ────────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS expense_notes (
      id VARCHAR(64) PRIMARY KEY,
      label VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      \`date\` VARCHAR(32) NOT NULL,
      category VARCHAR(64) DEFAULT '',
      chantierId VARCHAR(64) DEFAULT '',
      isReimbursable TINYINT(1) DEFAULT 1,
      isReimbursed TINYINT(1) DEFAULT 0,
      reimbursedDate VARCHAR(32) DEFAULT '',
      isValidated TINYINT(1) DEFAULT 0,
      validatedAt VARCHAR(32) DEFAULT '',
      attachmentPath VARCHAR(512) DEFAULT '',
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expense_notes_date (\`date\`),
      INDEX idx_expense_notes_chantier (chantierId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Sous-traitants ────────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS subcontractors (
      id VARCHAR(64) PRIMARY KEY,
      companyName VARCHAR(255) NOT NULL,
      contactFirstName VARCHAR(128) DEFAULT '',
      contactLastName VARCHAR(128) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      phoneMobile VARCHAR(64) DEFAULT '',
      phoneFixed VARCHAR(64) DEFAULT '',
      siret VARCHAR(32) DEFAULT '',
      siren VARCHAR(32) DEFAULT '',
      tvaIntracom VARCHAR(32) DEFAULT '',
      addressLine1 VARCHAR(255) DEFAULT '',
      addressLine2 VARCHAR(255) DEFAULT '',
      postalCode VARCHAR(16) DEFAULT '',
      city VARCHAR(128) DEFAULT '',
      country VARCHAR(64) DEFAULT 'France',
      activity VARCHAR(255) DEFAULT '',
      retentionRate DECIMAL(5,2) DEFAULT 0,
      vatRate DECIMAL(5,2) DEFAULT 20,
      isVatExempt TINYINT(1) DEFAULT 0,
      iban VARCHAR(64) DEFAULT '',
      bic VARCHAR(32) DEFAULT '',
      paymentTermsDays INT DEFAULT 30,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_subcontractors_siret (siret)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Agenda events ─────────────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS agenda_events (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(32) DEFAULT 'meeting',
      \`startDate\` VARCHAR(32) NOT NULL,
      \`endDate\` VARCHAR(32) DEFAULT '',
      isAllDay TINYINT(1) DEFAULT 0,
      location VARCHAR(255) DEFAULT '',
      clientId VARCHAR(64) DEFAULT '',
      chantierId VARCHAR(64) DEFAULT '',
      reminderMinutes INT NULL,
      outlookEventId VARCHAR(255) DEFAULT '',
      lastSyncedAt VARCHAR(32) DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_agenda_start (\`startDate\`),
      INDEX idx_agenda_client (clientId),
      INDEX idx_agenda_chantier (chantierId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];
    for (const sql of statements) {
        await db.query(sql);
    }
}
// ─── Reset des tables (DESTRUCTIF) ────────────────────────────────────────
// Drop puis recrée toutes les tables sauf users/settings/oauth_tokens.
// À utiliser quand le schéma a changé. À NE JAMAIS appeler en prod sans backup.
async function resetDataTables(db) {
    const drops = [
        "invoice_payments",
        "invoices",
        "quotes",
        "expenses",
        "expense_notes",
        "subcontractors",
        "agenda_events",
        "chantiers",
        "clients",
        "suppliers",
        "fournisseurs", // ancien nom (avant rename)
        "company",
    ];
    await db.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of drops) {
        await db.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
    await db.query("SET FOREIGN_KEY_CHECKS = 1");
    await runMigrations(db);
}
//# sourceMappingURL=db.js.map