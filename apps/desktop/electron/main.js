const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");

// ═══════════════════════════════════════════════════════════════════════════
// BatiDesk v16 — Electron Main Process
// ═══════════════════════════════════════════════════════════════════════════

// ─── Sentry (errors only, no-op if SENTRY_DSN is empty) ──────────────────
const SENTRY_DSN = process.env.SENTRY_DSN || "";
if (SENTRY_DSN) {
  try {
    const Sentry = require("@sentry/electron/main");
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: app.isPackaged ? "production" : "development",
      release: app.getVersion(),
      sendDefaultPii: false,
      // No performance tracing by default (errors only).
      tracesSampleRate: 0,
      beforeSend(event) {
        // Strip Authorization headers and obvious credential fields.
        if (event.request?.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
  } catch (e) {
    console.warn("[sentry] init failed:", e?.message || e);
  }
}

const isDev = !app.isPackaged;
let mainWindow = null;

// Chemin vers l'icône selon le contexte (dev vs prod)
function getAppIcon() {
  const iconCandidates = [
    path.join(__dirname, "..", "build-resources", "icon.ico"),
    path.join(__dirname, "..", "build-resources", "icon.png"),
    path.join(process.resourcesPath || "", "build-resources", "icon.ico"),
    path.join(process.resourcesPath || "", "build-resources", "icon.png"),
  ];
  for (const p of iconCandidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow() {
  const iconPath = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0a0b0f",
    title: "BatiDesk",
    ...(iconPath ? { icon: iconPath } : {}),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Capture erreurs renderer dans un log fichier (utile en prod)
  try {
    const logPath = path.join(app.getPath("userData"), "renderer-errors.log");
    mainWindow.webContents.on("render-process-gone", (_e, details) => {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] RENDERER_GONE: ${JSON.stringify(details)}\n`);
    });
    mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
      if (level >= 2) {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] CONSOLE_${level}: ${message} (${sourceId}:${line})\n`);
      }
    });
  } catch {}

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU NATIF (Mac + Windows)
// ═══════════════════════════════════════════════════════════════════════════
function createMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Fichier",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Édition",
      submenu: [
        { role: "undo", label: "Annuler" },
        { role: "redo", label: "Rétablir" },
        { type: "separator" },
        { role: "cut", label: "Couper" },
        { role: "copy", label: "Copier" },
        { role: "paste", label: "Coller" },
        { role: "selectAll", label: "Tout sélectionner" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "toggleDevTools", label: "Outils de développement" },
        { type: "separator" },
        { role: "resetZoom", label: "Taille normale" },
        { role: "zoomIn", label: "Zoomer" },
        { role: "zoomOut", label: "Dézoomer" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
      ],
    },
    {
      label: "Fenêtre",
      submenu: [{ role: "minimize", label: "Réduire" }, { role: "close", label: "Fermer" }],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Documentation",
          click: async () => {
            await shell.openExternal("https://github.com/jacob-habitat/btp-expert");
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLERS — Base de données SQLite
// ═══════════════════════════════════════════════════════════════════════════
// NOTE v16 : On laisse intentionnellement les handlers SQLite ici en simple
// pour qu'on puisse itérer au fur et à mesure qu'on migre les features
// depuis v15.11. L'interface IDataService côté React reste stable.

let db = null;
let dbInitError = null; // erreur d'init exposée via IPC pour debug

async function initDB() {
  try {
    const Database = require("better-sqlite3");
    const dbPath = path.join(app.getPath("userData"), "btp-v16.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Table settings (key-value)
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT DEFAULT '{}'
      );
      INSERT OR IGNORE INTO settings (id, data) VALUES (1, '{}');
    `);

    // Table users (pour auth)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ─── Session 4 : Clients ───────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'particulier',
        civility TEXT DEFAULT '',
        firstName TEXT DEFAULT '',
        lastName TEXT DEFAULT '',
        companyName TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phoneMobile TEXT DEFAULT '',
        phoneFixed TEXT DEFAULT '',
        addressLine1 TEXT DEFAULT '',
        addressLine2 TEXT DEFAULT '',
        postalCode TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT 'France',
        billingAddressSame INTEGER DEFAULT 1,
        billingAddressLine1 TEXT DEFAULT '',
        billingAddressLine2 TEXT DEFAULT '',
        billingPostalCode TEXT DEFAULT '',
        billingCity TEXT DEFAULT '',
        billingCountry TEXT DEFAULT 'France',
        siret TEXT DEFAULT '',
        siren TEXT DEFAULT '',
        tvaIntracom TEXT DEFAULT '',
        legalForm TEXT DEFAULT '',
        apeCode TEXT DEFAULT '',
        apeLabel TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        source TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        firstContactAt TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(lastName, firstName, companyName);
      CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);
      CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);
    `);

    // ─── Session 4 : Suppliers (Fournisseurs) ──────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        companyName TEXT DEFAULT '',
        contactFirstName TEXT DEFAULT '',
        contactLastName TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phoneMobile TEXT DEFAULT '',
        phoneFixed TEXT DEFAULT '',
        website TEXT DEFAULT '',
        addressLine1 TEXT DEFAULT '',
        addressLine2 TEXT DEFAULT '',
        postalCode TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT 'France',
        siret TEXT DEFAULT '',
        siren TEXT DEFAULT '',
        tvaIntracom TEXT DEFAULT '',
        legalForm TEXT DEFAULT '',
        apeCode TEXT DEFAULT '',
        apeLabel TEXT DEFAULT '',
        category TEXT DEFAULT 'Matériaux',
        iban TEXT DEFAULT '',
        bic TEXT DEFAULT '',
        paymentTermsDays INTEGER DEFAULT 30,
        paymentMethod TEXT DEFAULT 'Virement',
        tags TEXT DEFAULT '[]',
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(companyName);
      CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);
    `);

    // ─── Session 4 : Company profile (singleton) ───────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS company (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT DEFAULT '{}',
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO company (id, data) VALUES (1, '{}');
    `);

    // ─── Session 6 : Chantiers ─────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS chantiers (
        id TEXT PRIMARY KEY,
        reference TEXT DEFAULT '',
        title TEXT DEFAULT '',
        status TEXT DEFAULT 'prospect',
        priority TEXT DEFAULT 'normal',
        clientId TEXT DEFAULT '',
        addressLine1 TEXT DEFAULT '',
        addressLine2 TEXT DEFAULT '',
        postalCode TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT 'France',
        nature TEXT DEFAULT '',
        description TEXT DEFAULT '',
        startDateEstimated TEXT DEFAULT '',
        endDateEstimated TEXT DEFAULT '',
        startDateActual TEXT DEFAULT '',
        endDateActual TEXT DEFAULT '',
        budgetEstimatedHT REAL DEFAULT 0,
        budgetEstimatedTTC REAL DEFAULT 0,
        photos TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        categoryId TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chantiers_status ON chantiers(status);
      CREATE INDEX IF NOT EXISTS idx_chantiers_client ON chantiers(clientId);
      CREATE INDEX IF NOT EXISTS idx_chantiers_reference ON chantiers(reference);
    `);

    // ─── Session 7 : Événements, Documents, Signatures ─────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS chantier_events (
        id TEXT PRIMARY KEY,
        chantierId TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT DEFAULT '',
        description TEXT DEFAULT '',
        meta TEXT DEFAULT '{}',
        createdAt TEXT NOT NULL,
        createdBy TEXT DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_events_chantier ON chantier_events(chantierId);
      CREATE INDEX IF NOT EXISTS idx_events_created ON chantier_events(createdAt DESC);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS chantier_documents (
        id TEXT PRIMARY KEY,
        chantierId TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        mimeType TEXT DEFAULT '',
        category TEXT DEFAULT 'Autre',
        notes TEXT DEFAULT '',
        vaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_docs_chantier ON chantier_documents(chantierId);
    `);

    // Migration : ajouter vaultDocumentId si la colonne n'existe pas (Session 21)
    try {
      const cols = db.prepare("PRAGMA table_info(chantier_documents)").all();
      if (!cols.some((c) => c.name === "vaultDocumentId")) {
        db.exec("ALTER TABLE chantier_documents ADD COLUMN vaultDocumentId TEXT DEFAULT ''");
        console.log("[migration] chantier_documents.vaultDocumentId ajouté");
      }
    } catch (e) {
      console.warn("[migration chantier_documents]", e.message);
    }

    // ─── Session 21 : Catégories de documents chantier personnalisables ─
    db.exec(`
      CREATE TABLE IF NOT EXISTS chantier_doc_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        iconKey TEXT DEFAULT 'file',
        colorKey TEXT DEFAULT 'slate',
        sortOrder INTEGER DEFAULT 0,
        isSystem INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_doc_cat_order ON chantier_doc_categories(sortOrder);
    `);

    // Seed des catégories par défaut si vide
    try {
      const count = db.prepare("SELECT COUNT(*) as n FROM chantier_doc_categories").get().n;
      if (count === 0) {
        const seed = db.prepare(`
          INSERT INTO chantier_doc_categories (id, name, iconKey, colorKey, sortOrder, isSystem, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = new Date().toISOString();
        const defaults = [
          { name: "Devis",       icon: "receipt",     color: "violet",  order: 1 },
          { name: "Facture",     icon: "credit-card", color: "emerald", order: 2 },
          { name: "Plan",        icon: "map",         color: "blue",    order: 3 },
          { name: "Photo",       icon: "camera",      color: "rose",    order: 4 },
          { name: "Contrat",     icon: "file-signature", color: "amber", order: 5 },
          { name: "Attestation", icon: "shield-check", color: "indigo", order: 6 },
          { name: "Permis",      icon: "stamp",        color: "orange", order: 7 },
          { name: "Autre",       icon: "file",         color: "slate",   order: 99 },
        ];
        for (const d of defaults) {
          const id = `cat_${d.name.toLowerCase().replace(/\s+/g, "_")}`;
          seed.run(id, d.name, d.icon, d.color, d.order, 1, now, now);
        }
        console.log("[seed] 8 catégories de documents chantier insérées");
      }
    } catch (e) {
      console.warn("[seed chantier_doc_categories]", e.message);
    }

    // ─── Session 22 : Catégories chantier (corps d'état / postes) ──────
    db.exec(`
      CREATE TABLE IF NOT EXISTS chantier_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        iconKey TEXT DEFAULT 'hammer',
        colorKey TEXT DEFAULT 'slate',
        sortOrder INTEGER DEFAULT 0,
        isSystem INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chantier_cat_order ON chantier_categories(sortOrder);
    `);

    // Migration : ajouter categoryId si la colonne n'existe pas
    try {
      const cols = db.prepare("PRAGMA table_info(chantiers)").all();
      if (!cols.some((c) => c.name === "categoryId")) {
        db.exec("ALTER TABLE chantiers ADD COLUMN categoryId TEXT DEFAULT ''");
        console.log("[migration] chantiers.categoryId ajouté");
      }
    } catch (e) {
      console.warn("[migration chantiers]", e.message);
    }

    // Seed des 10 catégories chantier par défaut
    try {
      const count = db.prepare("SELECT COUNT(*) as n FROM chantier_categories").get().n;
      if (count === 0) {
        const seed = db.prepare(`
          INSERT INTO chantier_categories (id, name, iconKey, colorKey, sortOrder, isSystem, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = new Date().toISOString();
        const defaults = [
          { name: "Maçonnerie",      icon: "hammer",       color: "amber",   order: 1 },
          { name: "Gros œuvre",      icon: "building",     color: "stone",   order: 2 },
          { name: "Charpente",       icon: "package",      color: "orange",  order: 3 },
          { name: "Couverture",      icon: "home",         color: "rose",    order: 4 },
          { name: "Plomberie",       icon: "droplets",     color: "blue",    order: 5 },
          { name: "Électricité",     icon: "zap",          color: "yellow",  order: 6 },
          { name: "Isolation",       icon: "shield",       color: "teal",    order: 7 },
          { name: "Menuiserie",      icon: "wrench",       color: "indigo",  order: 8 },
          { name: "Carrelage",       icon: "grid",         color: "violet",  order: 9 },
          { name: "Peinture",        icon: "palette",      color: "pink",    order: 10 },
        ];
        for (const d of defaults) {
          const id = `chcat_${d.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
          seed.run(id, d.name, d.icon, d.color, d.order, 1, now, now);
        }
        console.log("[seed] 10 catégories chantier insérées");
      }
    } catch (e) {
      console.warn("[seed chantier_categories]", e.message);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS chantier_signatures (
        id TEXT PRIMARY KEY,
        chantierId TEXT NOT NULL,
        kind TEXT NOT NULL,
        signerName TEXT DEFAULT '',
        signerRole TEXT DEFAULT '',
        signatureDataUrl TEXT NOT NULL,
        notes TEXT DEFAULT '',
        signedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sigs_chantier ON chantier_signatures(chantierId);
    `);

    // ─── Session 8 : Devis + Bibliothèque ──────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        reference TEXT DEFAULT '',
        status TEXT DEFAULT 'brouillon',
        title TEXT DEFAULT '',
        clientId TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        issueDate TEXT DEFAULT '',
        validUntil TEXT DEFAULT '',
        acceptedAt TEXT DEFAULT '',
        sentAt TEXT DEFAULT '',
        items TEXT DEFAULT '[]',
        globalDiscountMode TEXT DEFAULT 'none',
        globalDiscountPercent REAL DEFAULT 0,
        globalDiscountAmount REAL DEFAULT 0,
        introText TEXT DEFAULT '',
        conditionsText TEXT DEFAULT '',
        footerText TEXT DEFAULT '',
        internalNotes TEXT DEFAULT '',
        companySnapshot TEXT DEFAULT '{}',
        totalHT REAL DEFAULT 0,
        totalTTC REAL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
      CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(clientId);
      CREATE INDEX IF NOT EXISTS idx_quotes_chantier ON quotes(chantierId);
      CREATE INDEX IF NOT EXISTS idx_quotes_reference ON quotes(reference);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS library_items (
        id TEXT PRIMARY KEY,
        category TEXT DEFAULT '',
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        unit TEXT DEFAULT 'u',
        unitPriceHT REAL DEFAULT 0,
        vatRate REAL DEFAULT 20,
        usageCount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_library_category ON library_items(category);
      CREATE INDEX IF NOT EXISTS idx_library_title ON library_items(title);
    `);

    // ─── Session 10 : Factures + Paiements ──────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        reference TEXT DEFAULT '',
        status TEXT DEFAULT 'brouillon',
        type TEXT DEFAULT 'standard',
        title TEXT DEFAULT '',
        clientId TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        fromQuoteId TEXT DEFAULT '',
        issueDate TEXT DEFAULT '',
        dueDate TEXT DEFAULT '',
        paymentTermsDays INTEGER DEFAULT 30,
        sentAt TEXT DEFAULT '',
        paidAt TEXT DEFAULT '',
        items TEXT DEFAULT '[]',
        globalDiscountMode TEXT DEFAULT 'none',
        globalDiscountPercent REAL DEFAULT 0,
        globalDiscountAmount REAL DEFAULT 0,
        acompteBasedOnQuoteId TEXT DEFAULT '',
        acomptePercent REAL DEFAULT 0,
        avoirReferenceInvoiceId TEXT DEFAULT '',
        introText TEXT DEFAULT '',
        conditionsText TEXT DEFAULT '',
        footerText TEXT DEFAULT '',
        internalNotes TEXT DEFAULT '',
        companySnapshot TEXT DEFAULT '{}',
        totalHT REAL DEFAULT 0,
        totalTTC REAL DEFAULT 0,
        totalPaid REAL DEFAULT 0,
        lastReminderSentAt TEXT DEFAULT '',
        remindersCount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(clientId);
      CREATE INDEX IF NOT EXISTS idx_invoices_chantier ON invoices(chantierId);
      CREATE INDEX IF NOT EXISTS idx_invoices_fromQuote ON invoices(fromQuoteId);
      CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference);

      CREATE TABLE IF NOT EXISTS invoice_payments (
        id TEXT PRIMARY KEY,
        invoiceId TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        method TEXT DEFAULT 'virement',
        reference TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_payments_invoice ON invoice_payments(invoiceId);
    `);

    // ─── Session 11 : Coffre-fort ─────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS vault_folders (
        id TEXT PRIMARY KEY,
        parentId TEXT DEFAULT '',
        name TEXT NOT NULL,
        iconKey TEXT DEFAULT 'folder',
        colorKey TEXT DEFAULT 'default',
        clientId TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        description TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vault_folders_parent ON vault_folders(parentId);
      CREATE INDEX IF NOT EXISTS idx_vault_folders_client ON vault_folders(clientId);
      CREATE INDEX IF NOT EXISTS idx_vault_folders_chantier ON vault_folders(chantierId);

      CREATE TABLE IF NOT EXISTS vault_documents (
        id TEXT PRIMARY KEY,
        folderId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        originalFileName TEXT NOT NULL,
        storagePath TEXT NOT NULL,
        isEncrypted INTEGER DEFAULT 1,
        iv TEXT DEFAULT '',
        fileSize INTEGER DEFAULT 0,
        mimeType TEXT DEFAULT '',
        fileHash TEXT DEFAULT '',
        extractedText TEXT DEFAULT '',
        description TEXT DEFAULT '',
        expirationDate TEXT DEFAULT '',
        deletedAt TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (folderId) REFERENCES vault_folders(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_vault_documents_folder ON vault_documents(folderId);
      CREATE INDEX IF NOT EXISTS idx_vault_documents_deleted ON vault_documents(deletedAt);

      CREATE TABLE IF NOT EXISTS vault_tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        colorKey TEXT DEFAULT 'default',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vault_document_tags (
        documentId TEXT NOT NULL,
        tagId TEXT NOT NULL,
        PRIMARY KEY (documentId, tagId),
        FOREIGN KEY (documentId) REFERENCES vault_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (tagId) REFERENCES vault_tags(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_vault_doctags_doc ON vault_document_tags(documentId);
      CREATE INDEX IF NOT EXISTS idx_vault_doctags_tag ON vault_document_tags(tagId);

      -- FTS5 pour recherche plein texte
      CREATE VIRTUAL TABLE IF NOT EXISTS vault_search USING fts5(
        documentId UNINDEXED,
        fileName,
        description,
        extractedText,
        tags,
        tokenize = 'unicode61 remove_diacritics 1'
      );
    `);

    // ─── Session 12 : Agenda ──────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS agenda_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        description TEXT DEFAULT '',
        type TEXT DEFAULT 'rdv',
        startAt TEXT NOT NULL,
        endAt TEXT NOT NULL,
        allDay INTEGER DEFAULT 0,
        clientId TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        quoteId TEXT DEFAULT '',
        invoiceId TEXT DEFAULT '',
        location TEXT DEFAULT '',
        colorOverride TEXT DEFAULT '',
        syncToOutlook INTEGER DEFAULT 0,
        outlookEventId TEXT DEFAULT '',
        outlookLastSyncAt TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agenda_start ON agenda_events(startAt);
      CREATE INDEX IF NOT EXISTS idx_agenda_client ON agenda_events(clientId);
      CREATE INDEX IF NOT EXISTS idx_agenda_chantier ON agenda_events(chantierId);
      CREATE INDEX IF NOT EXISTS idx_agenda_quote ON agenda_events(quoteId);
      CREATE INDEX IF NOT EXISTS idx_agenda_type ON agenda_events(type);
    `);

    // ─── Session 13 : Comptabilité (dépenses) ─────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        supplierId TEXT DEFAULT '',
        supplierName TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        amountHt REAL DEFAULT 0,
        amountVat REAL DEFAULT 0,
        amountTtc REAL DEFAULT 0,
        vatRate REAL DEFAULT 20,
        category TEXT DEFAULT 'autre',
        description TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        expenseDate TEXT DEFAULT '',
        dueDate TEXT DEFAULT '',
        paidDate TEXT DEFAULT '',
        status TEXT DEFAULT 'a_payer',
        paymentMethod TEXT DEFAULT 'cb',
        receiptVaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expenseDate);
      CREATE INDEX IF NOT EXISTS idx_expenses_supplier ON expenses(supplierId);
      CREATE INDEX IF NOT EXISTS idx_expenses_chantier ON expenses(chantierId);
      CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(reference);
    `);

    // ─── Session 14 : Notes de frais ──────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS expense_notes (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        payerType TEXT DEFAULT 'dirigeant',
        payerName TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        amountTtc REAL DEFAULT 0,
        amountHt REAL DEFAULT 0,
        vatRate REAL DEFAULT 20,
        amountVat REAL DEFAULT 0,
        category TEXT DEFAULT 'autre',
        description TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        expenseDate TEXT DEFAULT '',
        refacturable INTEGER DEFAULT 0,
        refacturationMargePct REAL DEFAULT 0,
        status TEXT DEFAULT 'brouillon',
        reimbursedDate TEXT DEFAULT '',
        refacturedInvoiceId TEXT DEFAULT '',
        receiptVaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_date ON expense_notes(expenseDate);
      CREATE INDEX IF NOT EXISTS idx_notes_chantier ON expense_notes(chantierId);
      CREATE INDEX IF NOT EXISTS idx_notes_status ON expense_notes(status);
      CREATE INDEX IF NOT EXISTS idx_notes_category ON expense_notes(category);
      CREATE INDEX IF NOT EXISTS idx_notes_refacturable ON expense_notes(refacturable);
      CREATE INDEX IF NOT EXISTS idx_notes_reference ON expense_notes(reference);
    `);

    // ─── Session 15 : Sous-traitants ──────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS subcontractors (
        id TEXT PRIMARY KEY,
        companyName TEXT NOT NULL DEFAULT '',
        contactFirstName TEXT DEFAULT '',
        contactLastName TEXT DEFAULT '',
        contactRole TEXT DEFAULT '',
        activity TEXT DEFAULT 'autre',
        activityNotes TEXT DEFAULT '',
        siret TEXT DEFAULT '',
        rcs TEXT DEFAULT '',
        legalForm TEXT DEFAULT '',
        capital TEXT DEFAULT '',
        tvaNumber TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        mobile TEXT DEFAULT '',
        website TEXT DEFAULT '',
        addressLine1 TEXT DEFAULT '',
        addressLine2 TEXT DEFAULT '',
        postalCode TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT 'France',
        iban TEXT DEFAULT '',
        bic TEXT DEFAULT '',
        bankName TEXT DEFAULT '',
        isActive INTEGER DEFAULT 1,
        rating REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        defaultVatRate REAL DEFAULT 20,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_st_company ON subcontractors(companyName);
      CREATE INDEX IF NOT EXISTS idx_st_activity ON subcontractors(activity);
      CREATE INDEX IF NOT EXISTS idx_st_active ON subcontractors(isActive);

      CREATE TABLE IF NOT EXISTS st_attestations (
        id TEXT PRIMARY KEY,
        subcontractorId TEXT NOT NULL,
        type TEXT DEFAULT 'autre',
        customLabel TEXT DEFAULT '',
        reference TEXT DEFAULT '',
        issuedDate TEXT DEFAULT '',
        expirationDate TEXT DEFAULT '',
        vaultDocumentId TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_att_st ON st_attestations(subcontractorId);
      CREATE INDEX IF NOT EXISTS idx_att_exp ON st_attestations(expirationDate);
      CREATE INDEX IF NOT EXISTS idx_att_type ON st_attestations(type);

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        subcontractorId TEXT NOT NULL,
        subcontractorName TEXT DEFAULT '',
        chantierId TEXT NOT NULL,
        poDate TEXT DEFAULT '',
        startDate TEXT DEFAULT '',
        endDate TEXT DEFAULT '',
        signedDate TEXT DEFAULT '',
        title TEXT DEFAULT '',
        description TEXT DEFAULT '',
        totalHt REAL DEFAULT 0,
        totalVat REAL DEFAULT 0,
        totalTtc REAL DEFAULT 0,
        retentionEnabled INTEGER DEFAULT 0,
        retentionPct REAL DEFAULT 5,
        retentionAmount REAL DEFAULT 0,
        retentionReleaseDate TEXT DEFAULT '',
        retentionReleased INTEGER DEFAULT 0,
        hasSituations INTEGER DEFAULT 0,
        paymentDelay INTEGER DEFAULT 30,
        cautionRequired INTEGER DEFAULT 0,
        cautionReceived INTEGER DEFAULT 0,
        cautionVaultDocumentId TEXT DEFAULT '',
        vaultDocumentId TEXT DEFAULT '',
        status TEXT DEFAULT 'brouillon',
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_po_st ON purchase_orders(subcontractorId);
      CREATE INDEX IF NOT EXISTS idx_po_chantier ON purchase_orders(chantierId);
      CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
      CREATE INDEX IF NOT EXISTS idx_po_reference ON purchase_orders(reference);
      CREATE INDEX IF NOT EXISTS idx_po_retention ON purchase_orders(retentionReleased);

      CREATE TABLE IF NOT EXISTS po_lines (
        id TEXT PRIMARY KEY,
        purchaseOrderId TEXT NOT NULL,
        designation TEXT DEFAULT '',
        quantity REAL DEFAULT 0,
        unit TEXT DEFAULT '',
        unitPriceHt REAL DEFAULT 0,
        totalHt REAL DEFAULT 0,
        vatRate REAL DEFAULT 20,
        notes TEXT DEFAULT '',
        sortOrder INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_pol_po ON po_lines(purchaseOrderId);

      CREATE TABLE IF NOT EXISTS situations (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        number INTEGER DEFAULT 1,
        purchaseOrderId TEXT NOT NULL,
        subcontractorId TEXT DEFAULT '',
        subcontractorName TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        poReference TEXT DEFAULT '',
        situationDate TEXT DEFAULT '',
        paidDate TEXT DEFAULT '',
        totalHt REAL DEFAULT 0,
        totalVat REAL DEFAULT 0,
        totalTtc REAL DEFAULT 0,
        retentionAmount REAL DEFAULT 0,
        netToPay REAL DEFAULT 0,
        globalAdvancementPct REAL DEFAULT 0,
        status TEXT DEFAULT 'brouillon',
        notes TEXT DEFAULT '',
        vaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sit_po ON situations(purchaseOrderId);
      CREATE INDEX IF NOT EXISTS idx_sit_st ON situations(subcontractorId);
      CREATE INDEX IF NOT EXISTS idx_sit_chantier ON situations(chantierId);
      CREATE INDEX IF NOT EXISTS idx_sit_status ON situations(status);
      CREATE INDEX IF NOT EXISTS idx_sit_reference ON situations(reference);

      CREATE TABLE IF NOT EXISTS situation_lines (
        id TEXT PRIMARY KEY,
        situationId TEXT NOT NULL,
        poLineId TEXT NOT NULL,
        designation TEXT DEFAULT '',
        totalHt REAL DEFAULT 0,
        cumulPctPrevious REAL DEFAULT 0,
        cumulPctNow REAL DEFAULT 0,
        newPct REAL DEFAULT 0,
        newAmountHt REAL DEFAULT 0,
        vatRate REAL DEFAULT 20,
        sortOrder INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sl_sit ON situation_lines(situationId);
      CREATE INDEX IF NOT EXISTS idx_sl_pol ON situation_lines(poLineId);
    `);

    // ─── Session 17 : Documents administratifs ────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS reception_reports (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        chantierId TEXT NOT NULL,
        clientId TEXT DEFAULT '',
        clientName TEXT DEFAULT '',
        receptionType TEXT DEFAULT 'sans_reserves',
        receptionDate TEXT DEFAULT '',
        guaranteeStartDate TEXT DEFAULT '',
        location TEXT DEFAULT '',
        ownerPresent TEXT DEFAULT '',
        contractorPresent TEXT DEFAULT '',
        worksDescription TEXT DEFAULT '',
        observations TEXT DEFAULT '',
        retentionAmount REAL DEFAULT 0,
        retentionReleaseDate TEXT DEFAULT '',
        ownerSigned INTEGER DEFAULT 0,
        ownerSignedDate TEXT DEFAULT '',
        contractorSigned INTEGER DEFAULT 0,
        contractorSignedDate TEXT DEFAULT '',
        status TEXT DEFAULT 'brouillon',
        vaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rcp_chantier ON reception_reports(chantierId);
      CREATE INDEX IF NOT EXISTS idx_rcp_status ON reception_reports(status);
      CREATE INDEX IF NOT EXISTS idx_rcp_reference ON reception_reports(reference);

      CREATE TABLE IF NOT EXISTS reception_reserves (
        id TEXT PRIMARY KEY,
        reportId TEXT NOT NULL,
        description TEXT DEFAULT '',
        location TEXT DEFAULT '',
        category TEXT DEFAULT '',
        toBeFixedBefore TEXT DEFAULT '',
        fixed INTEGER DEFAULT 0,
        fixedDate TEXT DEFAULT '',
        sortOrder INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_res_report ON reception_reserves(reportId);

      CREATE TABLE IF NOT EXISTS tva_attestations (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        attestationType TEXT DEFAULT 'simplifiee',
        tvaRate REAL DEFAULT 10,
        chantierId TEXT DEFAULT '',
        clientId TEXT DEFAULT '',
        clientName TEXT DEFAULT '',
        logementType TEXT DEFAULT 'residence_principale',
        logementBuiltOver2Years INTEGER DEFAULT 1,
        logementYearOfConstruction TEXT DEFAULT '',
        logementAddress TEXT DEFAULT '',
        ownerCivilite TEXT DEFAULT '',
        ownerLastName TEXT DEFAULT '',
        ownerFirstName TEXT DEFAULT '',
        ownerEmail TEXT DEFAULT '',
        ownerPhone TEXT DEFAULT '',
        category TEXT DEFAULT 'amelioration_qualite',
        worksDescription TEXT DEFAULT '',
        worksStartDate TEXT DEFAULT '',
        worksEndDate TEXT DEFAULT '',
        totalAmountHt REAL DEFAULT 0,
        invoiceReference TEXT DEFAULT '',
        clientCommitments TEXT DEFAULT '[]',
        signedDate TEXT DEFAULT '',
        signedLocation TEXT DEFAULT '',
        status TEXT DEFAULT 'brouillon',
        vaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tva_chantier ON tva_attestations(chantierId);
      CREATE INDEX IF NOT EXISTS idx_tva_client ON tva_attestations(clientId);
      CREATE INDEX IF NOT EXISTS idx_tva_status ON tva_attestations(status);
      CREATE INDEX IF NOT EXISTS idx_tva_reference ON tva_attestations(reference);
      CREATE INDEX IF NOT EXISTS idx_tva_signed_date ON tva_attestations(signedDate);

      CREATE TABLE IF NOT EXISTS dc4_declarations (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        purchaseOrderId TEXT DEFAULT '',
        subcontractorId TEXT DEFAULT '',
        subcontractorName TEXT DEFAULT '',
        chantierId TEXT DEFAULT '',
        publicMarketReference TEXT DEFAULT '',
        publicMarketObject TEXT DEFAULT '',
        publicAuthorityName TEXT DEFAULT '',
        publicAuthorityAddress TEXT DEFAULT '',
        subcontractedWorksDescription TEXT DEFAULT '',
        subcontractedAmountHt REAL DEFAULT 0,
        subcontractedAmountTtc REAL DEFAULT 0,
        subcontractedDuration TEXT DEFAULT '',
        paymentMethod TEXT DEFAULT '',
        paymentDelay INTEGER DEFAULT 30,
        cautionType TEXT DEFAULT '',
        cautionRequired INTEGER DEFAULT 0,
        cautionReceived INTEGER DEFAULT 0,
        signedDate TEXT DEFAULT '',
        signedLocation TEXT DEFAULT '',
        status TEXT DEFAULT 'brouillon',
        vaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dc4_st ON dc4_declarations(subcontractorId);
      CREATE INDEX IF NOT EXISTS idx_dc4_po ON dc4_declarations(purchaseOrderId);
      CREATE INDEX IF NOT EXISTS idx_dc4_status ON dc4_declarations(status);
      CREATE INDEX IF NOT EXISTS idx_dc4_reference ON dc4_declarations(reference);

      CREATE TABLE IF NOT EXISTS rge_documents (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL DEFAULT '',
        type TEXT DEFAULT 'devis_rge',
        chantierId TEXT DEFAULT '',
        clientId TEXT DEFAULT '',
        clientName TEXT DEFAULT '',
        rgeQualification TEXT DEFAULT '',
        rgeQualificationNumber TEXT DEFAULT '',
        worksDescription TEXT DEFAULT '',
        totalAmountTtc REAL DEFAULT 0,
        primeRenovExpected REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        vaultDocumentId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rge_chantier ON rge_documents(chantierId);
      CREATE INDEX IF NOT EXISTS idx_rge_type ON rge_documents(type);
    `);

    // Sanity check : la table users doit être lisible. Si non, c'est qu'on
    // a un mismatch ABI (NODE_MODULE_VERSION) ou une corruption DB.
    db.prepare("SELECT COUNT(*) FROM users").get();

    console.log("[v16 DB] Base initialisée :", dbPath);
    dbInitError = null;
  } catch (e) {
    db = null;
    dbInitError = { message: e.message, code: e.code, stack: e.stack };
    console.error("[v16 DB] ✗ Erreur init :", e.message);
    console.error("[v16 DB]   code =", e.code);
    console.error("[v16 DB]   stack =", e.stack);
  }
}

// Handlers IPC
ipcMain.handle("db:getSettings", () => {
  try {
    const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    return JSON.parse(row?.data || "{}");
  } catch {
    return {};
  }
});

ipcMain.handle("db:updateSettings", (_e, patch) => {
  try {
    const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    const current = JSON.parse(row?.data || "{}");
    const merged = { ...current, ...patch };
    db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(merged));
    return merged;
  } catch (e) {
    return { error: e.message };
  }
});

// Diagnostic : permet au renderer de récupérer la cause exacte d'un init raté
ipcMain.handle("db:getInitError", () => dbInitError);

ipcMain.handle("db:countUsers", () => {
  if (!db) {
    console.warn("[db:countUsers] db est null (init a échoué) — voir db:getInitError");
    return 0;
  }
  try {
    return db.prepare("SELECT COUNT(*) as n FROM users").get().n;
  } catch (e) {
    console.error("[db:countUsers] erreur :", e.message);
    return 0;
  }
});

// Session S28 — Hotfix safety : stats DB locale pour comparaison cloud
ipcMain.handle("db:getStats", () => {
  const stats = { clients: 0, chantiers: 0, devis: 0, factures: 0, sousTraitants: 0 };
  try {
    stats.clients = db.prepare("SELECT COUNT(*) as n FROM clients").get().n;
    stats.chantiers = db.prepare("SELECT COUNT(*) as n FROM chantiers").get().n;
    stats.devis = db.prepare("SELECT COUNT(*) as n FROM quotes").get().n;
    stats.factures = db.prepare("SELECT COUNT(*) as n FROM invoices").get().n;
    stats.sousTraitants = db.prepare("SELECT COUNT(*) as n FROM subcontractors").get().n;
  } catch (e) {
    console.warn("[db:getStats]", e.message);
  }
  return stats;
});

ipcMain.handle("db:createFirstUser", (_e, { username, passwordHash }) => {
  try {
    const info = db
      .prepare("INSERT INTO users (username, passwordHash, role) VALUES (?, ?, 'admin')")
      .run(username, passwordHash);
    return { success: true, id: info.lastInsertRowid };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:findUser", (_e, username) => {
  try {
    const u = db.prepare("SELECT id, username, passwordHash, role FROM users WHERE username = ?").get(username);
    return u || null;
  } catch {
    return null;
  }
});

// ─── Account management (v16 Session 3) ──────────────────────────────────
ipcMain.handle("db:updateUsername", (_e, { currentUsername, newUsername, passwordHash }) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND passwordHash = ?")
      .get(currentUsername, passwordHash);
    if (!user) return { success: false, error: "Mot de passe actuel incorrect" };
    const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(newUsername);
    if (exists && newUsername !== currentUsername) {
      return { success: false, error: "Cet identifiant est déjà utilisé" };
    }
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername, user.id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:updatePassword", (_e, { username, oldPasswordHash, newPasswordHash }) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND passwordHash = ?")
      .get(username, oldPasswordHash);
    if (!user) return { success: false, error: "Mot de passe actuel incorrect" };
    db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(newPasswordHash, user.id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKUP SYSTEM (v16 Session 3)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Détection des clouds locaux installés ───────────────────────────────
ipcMain.handle("cloud:detect", () => {
  const homeDir = os.homedir();
  const candidates = [
    // OneDrive (Personal et Business)
    { kind: "onedrive-local", label: "OneDrive", paths: [
      path.join(homeDir, "OneDrive"),
      path.join(homeDir, "OneDrive - Personal"),
      process.env.OneDrive,
      process.env.OneDriveConsumer,
    ]},
    { kind: "onedrive-business", label: "OneDrive Business", paths: [
      process.env.OneDriveCommercial,
    ]},
    // iCloud Drive (Windows via iCloud pour Windows, Mac natif)
    { kind: "icloud-local", label: "iCloud Drive", paths: [
      path.join(homeDir, "iCloudDrive"),
      path.join(homeDir, "iCloud Drive"),
      path.join(homeDir, "Library", "Mobile Documents", "com~apple~CloudDocs"),
    ]},
    // Dropbox
    { kind: "dropbox-local", label: "Dropbox", paths: [
      path.join(homeDir, "Dropbox"),
    ]},
    // Google Drive
    { kind: "gdrive-local", label: "Google Drive", paths: [
      path.join(homeDir, "Google Drive"),
      path.join(homeDir, "GoogleDrive"),
      "G:\\Mon Drive",
      "G:\\My Drive",
    ]},
  ];

  const detected = [];
  for (const c of candidates) {
    for (const p of c.paths) {
      if (!p) continue;
      try {
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
          detected.push({ kind: c.kind, label: c.label, path: p, available: true });
          break; // un chemin valide par type suffit
        }
      } catch {}
    }
  }
  return detected;
});

// ─── Dialog : choisir un dossier ─────────────────────────────────────────
ipcMain.handle("dialog:chooseFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Choisir un dossier de sauvegarde",
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("dialog:chooseBackupFile", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Sauvegarde BatiDesk", extensions: ["btpbackup", "db", "zip"] },
      { name: "Tous les fichiers", extensions: ["*"] },
    ],
    title: "Choisir un fichier de sauvegarde",
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

// ─── Créer un backup (Session 23 — format ZIP unique .btpbackup) ─────────
//
// Le backup est désormais un seul fichier .btpbackup (zip) contenant :
//   • database.db                  — copie de la DB SQLite
//   • manifest.json                — métadonnées (version, date, stats)
//   • sha256.txt                   — hash du database.db pour vérification
//   • settings.json    (optionnel) — paramètres app exportés depuis le store
//   • vault/...        (optionnel) — fichiers chiffrés du coffre-fort
//   • logs/...         (optionnel) — fichiers de log Electron récents
//
// Rétrocompatibilité : les anciens backups .db restent listables et restaurables.
// ─────────────────────────────────────────────────────────────────────────
ipcMain.handle("backup:create", async (_e, { destinationPath, includeVault, includeSettings, includeLogs, settingsJson, type = "manual" }) => {
  try {
    if (!destinationPath) throw new Error("Destination non configurée");
    if (!fs.existsSync(destinationPath)) {
      fs.mkdirSync(destinationPath, { recursive: true });
    }

    const userDataDir = app.getPath("userData");
    const dbSrc = path.join(userDataDir, "btp-v16.db");
    const vaultSrc = path.join(userDataDir, "vault");
    const logsSrc = path.join(userDataDir, "logs");

    if (!fs.existsSync(dbSrc)) throw new Error("Base de données introuvable");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const version = app.getVersion();
    const baseName = `btp-v16_${timestamp}_${type}`;
    const zipPath = path.join(destinationPath, `${baseName}.btpbackup`);

    // SQLite WAL checkpoint avant copie pour s'assurer que le .db est complet
    try {
      if (db) {
        db.pragma("wal_checkpoint(TRUNCATE)");
      }
    } catch (e) {
      console.warn("[backup] wal_checkpoint", e.message);
    }

    // Calcul du hash SHA-256 de la DB
    const dbBuffer = fs.readFileSync(dbSrc);
    const dbHash = crypto.createHash("sha256").update(dbBuffer).digest("hex");
    const dbSize = dbBuffer.length;

    // Stats DB pour le manifest
    let dbStats = { clients: 0, chantiers: 0, devis: 0, factures: 0, sousTraitants: 0 };
    try {
      dbStats.clients      = db.prepare("SELECT COUNT(*) as n FROM clients").get().n;
      dbStats.chantiers    = db.prepare("SELECT COUNT(*) as n FROM chantiers").get().n;
      dbStats.devis        = db.prepare("SELECT COUNT(*) as n FROM quotes").get().n;
      dbStats.factures     = db.prepare("SELECT COUNT(*) as n FROM invoices").get().n;
      dbStats.sousTraitants = db.prepare("SELECT COUNT(*) as n FROM subcontractors").get().n;
    } catch (e) {
      console.warn("[backup] stats DB", e.message);
    }

    // Construire le ZIP
    const AdmZip = require("adm-zip");
    const zip = new AdmZip();

    // 1. Database
    zip.addLocalFile(dbSrc, "", "database.db");

    // 2. SHA-256 (pour intégrité)
    zip.addFile("sha256.txt", Buffer.from(dbHash, "utf8"));

    // 3. Settings JSON (exporté depuis le store via le client)
    let settingsIncluded = false;
    if (includeSettings && settingsJson) {
      zip.addFile("settings.json", Buffer.from(settingsJson, "utf8"));
      settingsIncluded = true;
    }

    // 4. Vault (chiffré, on copie tel quel)
    let vaultIncluded = false;
    let vaultFileCount = 0;
    let vaultSize = 0;
    if (includeVault && fs.existsSync(vaultSrc)) {
      // Ajouter récursivement
      const addFolderToZip = (folderPath, zipPathPrefix) => {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(folderPath, entry.name);
          const inZip = `${zipPathPrefix}/${entry.name}`;
          if (entry.isDirectory()) {
            addFolderToZip(full, inZip);
          } else {
            const buf = fs.readFileSync(full);
            zip.addFile(inZip, buf);
            vaultFileCount++;
            vaultSize += buf.length;
          }
        }
      };
      addFolderToZip(vaultSrc, "vault");
      vaultIncluded = true;
    }

    // 5. Logs (les 10 derniers fichiers .log les plus récents)
    let logsIncluded = false;
    let logsCount = 0;
    if (includeLogs && fs.existsSync(logsSrc)) {
      try {
        const logFiles = fs.readdirSync(logsSrc)
          .filter(f => f.endsWith(".log"))
          .map(f => ({ name: f, path: path.join(logsSrc, f), mtime: fs.statSync(path.join(logsSrc, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 10);
        for (const lf of logFiles) {
          zip.addLocalFile(lf.path, "logs", lf.name);
          logsCount++;
        }
        logsIncluded = logsCount > 0;
      } catch (e) {
        console.warn("[backup] logs", e.message);
      }
    }

    // 6. Manifest JSON (en dernier pour avoir toutes les infos)
    const manifest = {
      formatVersion: 1,
      appVersion: version,
      backupId: baseName,
      type,
      createdAt: new Date().toISOString(),
      platform: process.platform,
      database: {
        size: dbSize,
        sha256: dbHash,
        stats: dbStats,
      },
      vault: {
        included: vaultIncluded,
        fileCount: vaultFileCount,
        size: vaultSize,
      },
      settings: {
        included: settingsIncluded,
      },
      logs: {
        included: logsIncluded,
        fileCount: logsCount,
      },
    };
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

    // Écrire le ZIP sur disque
    zip.writeZip(zipPath);

    const finalSize = fs.statSync(zipPath).size;

    return {
      success: true,
      backup: {
        id: baseName,
        path: zipPath,
        size: finalSize,
        createdAt: manifest.createdAt,
        type,
        version,
        manifest,
      },
    };
  } catch (e) {
    console.error("[backup:create]", e);
    return { success: false, error: e.message };
  }
});

// ─── Helper : copie récursive de dossier ────────────────────────────────
function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── Lister les backups dans un dossier ──────────────────────────────────
// Session 23 : liste à la fois les nouveaux .btpbackup ET les anciens .db
//              (rétrocompatibilité avec les backups existants)
ipcMain.handle("backup:list", (_e, { destinationPath }) => {
  try {
    if (!destinationPath || !fs.existsSync(destinationPath)) return [];

    const result = [];

    // Nouveaux backups .btpbackup (ZIP)
    const zipFiles = fs.readdirSync(destinationPath)
      .filter(f => f.startsWith("btp-v16_") && f.endsWith(".btpbackup"));
    for (const f of zipFiles) {
      const fullPath = path.join(destinationPath, f);
      const stats = fs.statSync(fullPath);
      let manifest = null;
      try {
        const AdmZip = require("adm-zip");
        const zip = new AdmZip(fullPath);
        const entry = zip.getEntry("manifest.json");
        if (entry) {
          manifest = JSON.parse(entry.getData().toString("utf8"));
        }
      } catch (e) {
        // ZIP corrompu : on liste quand même mais sans manifest
        console.warn(`[backup:list] manifest illisible pour ${f}`, e.message);
      }
      result.push({
        id: f.replace(".btpbackup", ""),
        path: fullPath,
        size: stats.size,
        createdAt: manifest?.createdAt || stats.mtime.toISOString(),
        type: manifest?.type || (f.includes("_manual") ? "manual" : f.includes("_on-close") ? "on-close" : "auto"),
        version: manifest?.appVersion || "",
        format: "btpbackup",
        manifest,
      });
    }

    // Anciens backups .db (rétrocompatibilité)
    const dbFiles = fs.readdirSync(destinationPath)
      .filter(f => f.startsWith("btp-v16_") && f.endsWith(".db"));
    for (const f of dbFiles) {
      const fullPath = path.join(destinationPath, f);
      const stats = fs.statSync(fullPath);
      result.push({
        id: f.replace(".db", ""),
        path: fullPath,
        size: stats.size,
        createdAt: stats.mtime.toISOString(),
        type: f.includes("_manual") ? "manual" : f.includes("_on-close") ? "on-close" : "auto",
        version: "",
        format: "legacy-db",
        manifest: null,
      });
    }

    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (e) {
    console.error("[backup:list]", e);
    return [];
  }
});

// ─── Supprimer un backup (gère .btpbackup et legacy .db) ─────────────────
ipcMain.handle("backup:delete", (_e, backupPath) => {
  try {
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: "Fichier introuvable" };
    }
    fs.unlinkSync(backupPath);
    // Pour les anciens backups : tenter de supprimer le dossier _vault associé
    if (backupPath.endsWith(".db")) {
      const vaultPath = backupPath.replace(/\.db$/, "_vault");
      if (fs.existsSync(vaultPath)) {
        fs.rmSync(vaultPath, { recursive: true, force: true });
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Appliquer la rétention (garder les N derniers, gère 2 formats) ──────
ipcMain.handle("backup:applyRetention", (_e, { destinationPath, keepCount }) => {
  try {
    if (!destinationPath || !fs.existsSync(destinationPath)) return { deleted: 0 };
    const files = fs.readdirSync(destinationPath)
      .filter(f => f.startsWith("btp-v16_") && (f.endsWith(".btpbackup") || f.endsWith(".db")))
      .map(f => ({
        name: f,
        path: path.join(destinationPath, f),
        mtime: fs.statSync(path.join(destinationPath, f)).mtime,
        isLegacy: f.endsWith(".db"),
      }))
      .sort((a, b) => b.mtime - a.mtime);
    const toDelete = files.slice(keepCount);
    let deleted = 0;
    for (const f of toDelete) {
      try {
        fs.unlinkSync(f.path);
        if (f.isLegacy) {
          const vaultPath = f.path.replace(/\.db$/, "_vault");
          if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true, force: true });
        }
        deleted++;
      } catch {}
    }
    return { deleted };
  } catch (e) {
    return { deleted: 0, error: e.message };
  }
});

// ─── Inspecter un backup avant restauration (Session 23) ─────────────────
// Retourne le manifest sans modifier l'app. Permet à l'UI de demander
// une confirmation explicite avec les stats du backup.
ipcMain.handle("backup:inspect", (_e, { backupPath }) => {
  try {
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: "Fichier de backup introuvable" };
    }

    // Format ancien .db : pas de manifest disponible
    if (backupPath.endsWith(".db")) {
      const stats = fs.statSync(backupPath);
      return {
        success: true,
        format: "legacy-db",
        manifest: null,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        warnings: ["Backup au format ancien (sans manifest ni vérification d'intégrité)."],
      };
    }

    // Format ZIP .btpbackup
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(backupPath);
    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) {
      return { success: false, error: "Backup invalide : manifest.json manquant" };
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));

    // Vérifier l'intégrité du database.db avec le SHA-256 stocké
    const dbEntry = zip.getEntry("database.db");
    if (!dbEntry) {
      return { success: false, error: "Backup invalide : database.db manquant" };
    }
    const dbBuffer = dbEntry.getData();
    const computedHash = crypto.createHash("sha256").update(dbBuffer).digest("hex");
    const storedHash = manifest.database?.sha256 || "";
    const integrityOk = computedHash === storedHash;

    const warnings = [];
    if (!integrityOk) {
      warnings.push(`Hash SHA-256 ne correspond pas (corruption probable). Stocké: ${storedHash.slice(0, 16)}... Calculé: ${computedHash.slice(0, 16)}...`);
    }
    if (manifest.appVersion && manifest.appVersion !== app.getVersion()) {
      warnings.push(`Backup créé avec la version ${manifest.appVersion}, vous utilisez ${app.getVersion()}.`);
    }

    return {
      success: true,
      format: "btpbackup",
      manifest,
      integrityOk,
      computedHash,
      warnings,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Restaurer un backup (Session 23 — gère ZIP + legacy .db) ────────────
ipcMain.handle("backup:restore", async (_e, { backupPath, skipIntegrityCheck }) => {
  try {
    if (!fs.existsSync(backupPath)) throw new Error("Fichier de backup introuvable");
    const userDataDir = app.getPath("userData");
    const dbDest = path.join(userDataDir, "btp-v16.db");
    const vaultDest = path.join(userDataDir, "vault");

    // Backup de sécurité de la DB actuelle avant restauration
    if (fs.existsSync(dbDest)) {
      const safeBackup = path.join(userDataDir, `btp-v16.before-restore-${Date.now()}.db`);
      fs.copyFileSync(dbDest, safeBackup);
    }

    // ─── ANCIEN FORMAT .db ────────────────────────────────────────────
    if (backupPath.endsWith(".db")) {
      // Fermer la connexion DB
      if (db) {
        try { db.close(); } catch {}
        db = null;
      }
      fs.copyFileSync(backupPath, dbDest);

      // Restaurer vault (dossier _vault à côté)
      const vaultBackup = backupPath.replace(/\.db$/, "_vault");
      if (fs.existsSync(vaultBackup)) {
        if (fs.existsSync(vaultDest)) fs.rmSync(vaultDest, { recursive: true, force: true });
        copyFolderRecursive(vaultBackup, vaultDest);
      }

      app.relaunch();
      app.exit();
      return { success: true };
    }

    // ─── NOUVEAU FORMAT .btpbackup (ZIP) ──────────────────────────────
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(backupPath);

    // Vérifier le manifest
    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) {
      throw new Error("Backup invalide : manifest.json manquant");
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));

    // Vérifier la database.db
    const dbEntry = zip.getEntry("database.db");
    if (!dbEntry) {
      throw new Error("Backup invalide : database.db manquant");
    }
    const dbBuffer = dbEntry.getData();

    // Vérification du hash SHA-256 (sauf si l'utilisateur a explicitement bypass)
    if (!skipIntegrityCheck) {
      const computedHash = crypto.createHash("sha256").update(dbBuffer).digest("hex");
      const storedHash = manifest.database?.sha256 || "";
      if (storedHash && computedHash !== storedHash) {
        throw new Error(
          `Backup corrompu : le hash SHA-256 du fichier ne correspond pas au manifest. ` +
          `Restauration annulée pour éviter la perte de données. ` +
          `Si vous voulez forcer (à vos risques), appelez à nouveau avec skipIntegrityCheck=true.`
        );
      }
    }

    // Fermer la DB
    if (db) {
      try { db.close(); } catch {}
      db = null;
    }

    // Écrire la DB
    fs.writeFileSync(dbDest, dbBuffer);

    // Restaurer le vault
    const vaultEntries = zip.getEntries().filter(e => e.entryName.startsWith("vault/"));
    if (vaultEntries.length > 0) {
      if (fs.existsSync(vaultDest)) {
        fs.rmSync(vaultDest, { recursive: true, force: true });
      }
      fs.mkdirSync(vaultDest, { recursive: true });
      for (const entry of vaultEntries) {
        if (entry.isDirectory) continue;
        const relPath = entry.entryName.slice("vault/".length);
        const fullDest = path.join(vaultDest, relPath);
        const destDir = path.dirname(fullDest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(fullDest, entry.getData());
      }
    }

    // Settings : on les écrit dans un fichier que l'app peut lire au démarrage
    const settingsEntry = zip.getEntry("settings.json");
    if (settingsEntry) {
      const settingsRestoreFile = path.join(userDataDir, "settings-to-restore.json");
      fs.writeFileSync(settingsRestoreFile, settingsEntry.getData());
      // L'UI verra ce fichier au prochain démarrage et proposera d'appliquer
    }

    // Relancer l'app
    app.relaunch();
    app.exit();

    return { success: true };
  } catch (e) {
    // Rouvrir la DB en cas d'échec
    if (!db) {
      try { await initDB(); } catch {}
    }
    console.error("[backup:restore]", e);
    return { success: false, error: e.message };
  }
});

// ─── Path de la DB actuelle (pour UI) ────────────────────────────────────
ipcMain.handle("system:getPaths", () => ({
  userData: app.getPath("userData"),
  documents: app.getPath("documents"),
  home: os.homedir(),
  platform: process.platform,
}));

// ─── Backup on-close (déclenché quand l'app se ferme) ────────────────────
let backupOnCloseConfig = null;
ipcMain.handle("backup:setOnCloseConfig", (_e, config) => {
  backupOnCloseConfig = config;
  return { success: true };
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD — Clients (Session 4)
// ═══════════════════════════════════════════════════════════════════════════

function rowToClient(row) {
  if (!row) return null;
  return {
    ...row,
    billingAddressSame: !!row.billingAddressSame,
    tags: (() => { try { return JSON.parse(row.tags || "[]"); } catch { return []; } })(),
  };
}

ipcMain.handle("clients:list", () => {
  try {
    const rows = db.prepare("SELECT * FROM clients ORDER BY COALESCE(NULLIF(companyName, ''), lastName) ASC").all();
    return rows.map(rowToClient);
  } catch (e) {
    console.error("[clients:list]", e);
    return [];
  }
});

ipcMain.handle("clients:get", (_e, id) => {
  try {
    const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    return rowToClient(row);
  } catch {
    return null;
  }
});

ipcMain.handle("clients:create", (_e, data) => {
  try {
    const id = data.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const row = {
      ...data,
      id,
      billingAddressSame: data.billingAddressSame ? 1 : 0,
      tags: JSON.stringify(data.tags || []),
      createdAt: now,
      updatedAt: now,
    };
    const columns = [
      "id","type","civility","firstName","lastName","companyName","email","phoneMobile","phoneFixed",
      "addressLine1","addressLine2","postalCode","city","country",
      "billingAddressSame","billingAddressLine1","billingAddressLine2","billingPostalCode","billingCity","billingCountry",
      "siret","siren","tvaIntracom","legalForm","apeCode","apeLabel",
      "tags","source","notes","firstContactAt","createdAt","updatedAt"
    ];
    const placeholders = columns.map(() => "?").join(",");
    const values = columns.map(c => row[c] ?? (typeof row[c] === "number" ? 0 : ""));
    db.prepare(`INSERT INTO clients (${columns.join(",")}) VALUES (${placeholders})`).run(...values);
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("clients:update", (_e, { id, data }) => {
  try {
    const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    if (!existing) return { success: false, error: "Client introuvable" };
    const now = new Date().toISOString();
    const patched = {
      ...existing,
      ...data,
      billingAddressSame: data.billingAddressSame !== undefined ? (data.billingAddressSame ? 1 : 0) : existing.billingAddressSame,
      tags: data.tags ? JSON.stringify(data.tags) : existing.tags,
      updatedAt: now,
    };
    const cols = [
      "type","civility","firstName","lastName","companyName","email","phoneMobile","phoneFixed",
      "addressLine1","addressLine2","postalCode","city","country",
      "billingAddressSame","billingAddressLine1","billingAddressLine2","billingPostalCode","billingCity","billingCountry",
      "siret","siren","tvaIntracom","legalForm","apeCode","apeLabel",
      "tags","source","notes","firstContactAt","updatedAt"
    ];
    const set = cols.map(c => `${c} = ?`).join(", ");
    const values = cols.map(c => patched[c] ?? "");
    db.prepare(`UPDATE clients SET ${set} WHERE id = ?`).run(...values, id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("clients:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM clients WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("clients:count", () => {
  try {
    return db.prepare("SELECT COUNT(*) as n FROM clients").get().n;
  } catch {
    return 0;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD — Suppliers (Session 4)
// ═══════════════════════════════════════════════════════════════════════════

function rowToSupplier(row) {
  if (!row) return null;
  return {
    ...row,
    tags: (() => { try { return JSON.parse(row.tags || "[]"); } catch { return []; } })(),
  };
}

ipcMain.handle("suppliers:list", () => {
  try {
    const rows = db.prepare("SELECT * FROM suppliers ORDER BY companyName ASC").all();
    return rows.map(rowToSupplier);
  } catch {
    return [];
  }
});

ipcMain.handle("suppliers:get", (_e, id) => {
  try {
    const row = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
    return rowToSupplier(row);
  } catch {
    return null;
  }
});

ipcMain.handle("suppliers:create", (_e, data) => {
  try {
    const id = data.id || `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const row = {
      ...data,
      id,
      tags: JSON.stringify(data.tags || []),
      paymentTermsDays: Number(data.paymentTermsDays || 30),
      createdAt: now,
      updatedAt: now,
    };
    const columns = [
      "id","companyName","contactFirstName","contactLastName","email","phoneMobile","phoneFixed","website",
      "addressLine1","addressLine2","postalCode","city","country",
      "siret","siren","tvaIntracom","legalForm","apeCode","apeLabel",
      "category","iban","bic","paymentTermsDays","paymentMethod",
      "tags","notes","createdAt","updatedAt"
    ];
    const placeholders = columns.map(() => "?").join(",");
    const values = columns.map(c => row[c] ?? (typeof row[c] === "number" ? 0 : ""));
    db.prepare(`INSERT INTO suppliers (${columns.join(",")}) VALUES (${placeholders})`).run(...values);
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("suppliers:update", (_e, { id, data }) => {
  try {
    const existing = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
    if (!existing) return { success: false, error: "Fournisseur introuvable" };
    const now = new Date().toISOString();
    const patched = {
      ...existing,
      ...data,
      tags: data.tags ? JSON.stringify(data.tags) : existing.tags,
      paymentTermsDays: data.paymentTermsDays !== undefined ? Number(data.paymentTermsDays) : existing.paymentTermsDays,
      updatedAt: now,
    };
    const cols = [
      "companyName","contactFirstName","contactLastName","email","phoneMobile","phoneFixed","website",
      "addressLine1","addressLine2","postalCode","city","country",
      "siret","siren","tvaIntracom","legalForm","apeCode","apeLabel",
      "category","iban","bic","paymentTermsDays","paymentMethod",
      "tags","notes","updatedAt"
    ];
    const set = cols.map(c => `${c} = ?`).join(", ");
    const values = cols.map(c => patched[c] ?? "");
    db.prepare(`UPDATE suppliers SET ${set} WHERE id = ?`).run(...values, id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("suppliers:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("suppliers:count", () => {
  try {
    return db.prepare("SELECT COUNT(*) as n FROM suppliers").get().n;
  } catch {
    return 0;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Company profile (Session 4)
// ═══════════════════════════════════════════════════════════════════════════

ipcMain.handle("company:get", () => {
  try {
    const row = db.prepare("SELECT data FROM company WHERE id = 1").get();
    const data = JSON.parse(row?.data || "{}");
    return data;
  } catch {
    return {};
  }
});

ipcMain.handle("company:update", (_e, patch) => {
  try {
    const row = db.prepare("SELECT data FROM company WHERE id = 1").get();
    const current = JSON.parse(row?.data || "{}");
    const merged = { ...current, ...patch, updatedAt: new Date().toISOString() };
    if (!merged.createdAt) merged.createdAt = new Date().toISOString();
    db.prepare("UPDATE company SET data = ?, updatedAt = ? WHERE id = 1").run(JSON.stringify(merged), merged.updatedAt);
    return merged;
  } catch (e) {
    return { error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD — Chantiers (Session 6)
// ═══════════════════════════════════════════════════════════════════════════

function rowToChantier(row) {
  if (!row) return null;
  return {
    ...row,
    photos: (() => { try { return JSON.parse(row.photos || "[]"); } catch { return []; } })(),
    tags:   (() => { try { return JSON.parse(row.tags   || "[]"); } catch { return []; } })(),
    budgetEstimatedHT:  Number(row.budgetEstimatedHT  || 0),
    budgetEstimatedTTC: Number(row.budgetEstimatedTTC || 0),
  };
}

// ─── Génération de la prochaine référence : CHT-YYYY-NNN ──────────────
function nextChantierReference() {
  const year = new Date().getFullYear();
  const prefix = `CHT-${year}-`;
  try {
    const rows = db.prepare("SELECT reference FROM chantiers WHERE reference LIKE ?").all(`${prefix}%`);
    let maxNum = 0;
    for (const r of rows) {
      const match = /CHT-\d{4}-(\d+)/.exec(r.reference || "");
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const next = String(maxNum + 1).padStart(3, "0");
    return `${prefix}${next}`;
  } catch {
    return `${prefix}001`;
  }
}

ipcMain.handle("chantiers:list", () => {
  try {
    const rows = db.prepare("SELECT * FROM chantiers ORDER BY createdAt DESC").all();
    return rows.map(rowToChantier);
  } catch (e) {
    console.error("[chantiers:list]", e);
    return [];
  }
});

ipcMain.handle("chantiers:get", (_e, id) => {
  try {
    const row = db.prepare("SELECT * FROM chantiers WHERE id = ?").get(id);
    return rowToChantier(row);
  } catch {
    return null;
  }
});

ipcMain.handle("chantiers:listByClient", (_e, clientId) => {
  try {
    const rows = db.prepare("SELECT * FROM chantiers WHERE clientId = ? ORDER BY createdAt DESC").all(clientId);
    return rows.map(rowToChantier);
  } catch {
    return [];
  }
});

ipcMain.handle("chantiers:create", (_e, data) => {
  try {
    const id = data.id || `cha_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const reference = data.reference || nextChantierReference();

    const row = {
      ...data,
      id,
      reference,
      photos: JSON.stringify(data.photos || []),
      tags:   JSON.stringify(data.tags   || []),
      budgetEstimatedHT:  Number(data.budgetEstimatedHT  || 0),
      budgetEstimatedTTC: Number(data.budgetEstimatedTTC || 0),
      createdAt: now,
      updatedAt: now,
    };
    const columns = [
      "id","reference","title","status","priority","clientId",
      "addressLine1","addressLine2","postalCode","city","country",
      "nature","description",
      "startDateEstimated","endDateEstimated","startDateActual","endDateActual",
      "budgetEstimatedHT","budgetEstimatedTTC",
      "photos","tags","categoryId","notes","createdAt","updatedAt"
    ];
    const placeholders = columns.map(() => "?").join(",");
    const values = columns.map(c => row[c] ?? (typeof row[c] === "number" ? 0 : ""));
    db.prepare(`INSERT INTO chantiers (${columns.join(",")}) VALUES (${placeholders})`).run(...values);

    // ─── Session 7 : event auto "created"
    insertEvent(id, "created", "Chantier créé", `Référence ${reference}`);

    return { success: true, id, reference };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantiers:update", (_e, { id, data }) => {
  try {
    const existing = db.prepare("SELECT * FROM chantiers WHERE id = ?").get(id);
    if (!existing) return { success: false, error: "Chantier introuvable" };
    const now = new Date().toISOString();
    const patched = {
      ...existing,
      ...data,
      photos: data.photos ? JSON.stringify(data.photos) : existing.photos,
      tags:   data.tags   ? JSON.stringify(data.tags)   : existing.tags,
      budgetEstimatedHT:  data.budgetEstimatedHT  !== undefined ? Number(data.budgetEstimatedHT)  : existing.budgetEstimatedHT,
      budgetEstimatedTTC: data.budgetEstimatedTTC !== undefined ? Number(data.budgetEstimatedTTC) : existing.budgetEstimatedTTC,
      updatedAt: now,
    };
    const cols = [
      "title","status","priority","clientId",
      "addressLine1","addressLine2","postalCode","city","country",
      "nature","description",
      "startDateEstimated","endDateEstimated","startDateActual","endDateActual",
      "budgetEstimatedHT","budgetEstimatedTTC",
      "photos","tags","categoryId","notes","updatedAt"
    ];
    const set = cols.map(c => `${c} = ?`).join(", ");
    const values = cols.map(c => patched[c] ?? "");
    db.prepare(`UPDATE chantiers SET ${set} WHERE id = ?`).run(...values, id);

    // ─── Session 7 : event auto si status changé
    if (data.status && data.status !== existing.status) {
      insertEvent(id, "status-changed", "Statut modifié", "",
        { from: existing.status, to: data.status });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantiers:updateStatus", (_e, { id, status }) => {
  try {
    const existing = db.prepare("SELECT status FROM chantiers WHERE id = ?").get(id);
    db.prepare("UPDATE chantiers SET status = ?, updatedAt = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);

    // ─── Session 7 : event auto
    if (existing && existing.status !== status) {
      insertEvent(id, "status-changed", "Statut modifié", "",
        { from: existing.status, to: status });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantiers:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM chantiers WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantiers:count", () => {
  try {
    return db.prepare("SELECT COUNT(*) as n FROM chantiers").get().n;
  } catch {
    return 0;
  }
});

ipcMain.handle("chantiers:countByStatus", () => {
  try {
    const rows = db.prepare("SELECT status, COUNT(*) as n FROM chantiers GROUP BY status").all();
    const result = { prospect: 0, "en-cours": 0, termine: 0, annule: 0 };
    for (const r of rows) result[r.status] = r.n;
    return result;
  } catch {
    return { prospect: 0, "en-cours": 0, termine: 0, annule: 0 };
  }
});

// ─── Upload de photo chantier ────────────────────────────────────────────
ipcMain.handle("chantiers:uploadPhoto", async (_e, { chantierId, fileName }) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }],
      title: "Choisir une photo",
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const srcPath = result.filePaths[0];
    const userDataDir = app.getPath("userData");
    const photosDir = path.join(userDataDir, "chantier-photos", chantierId);
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

    const ext = path.extname(srcPath);
    const destName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const destPath = path.join(photosDir, destName);
    fs.copyFileSync(srcPath, destPath);

    return {
      id: destName.replace(ext, ""),
      path: destPath,
      caption: path.basename(srcPath, ext),
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("[chantier photo]", e);
    return null;
  }
});

ipcMain.handle("chantiers:deletePhoto", (_e, { photoPath }) => {
  try {
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Pour afficher l'image dans le renderer : on convertit le path en data URL
ipcMain.handle("chantiers:readPhoto", (_e, photoPath) => {
  try {
    if (!fs.existsSync(photoPath)) return null;
    const buffer = fs.readFileSync(photoPath);
    const ext = path.extname(photoPath).slice(1).toLowerCase();
    const mime = ext === "jpg" ? "jpeg" : ext;
    return `data:image/${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD — Events / Documents / Signatures (Session 7)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Helper interne : ajouter un événement ───────────────────────────
function insertEvent(chantierId, kind, title, description = "", meta = {}) {
  try {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`INSERT INTO chantier_events (id, chantierId, kind, title, description, meta, createdAt, createdBy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, chantierId, kind, title, description, JSON.stringify(meta),
           new Date().toISOString(), "");
    return id;
  } catch (e) {
    console.error("[insertEvent]", e);
    return null;
  }
}

// ─── Events ───────────────────────────────────────────────────────────
ipcMain.handle("chantierEvents:listByChantier", (_e, chantierId) => {
  try {
    const rows = db.prepare("SELECT * FROM chantier_events WHERE chantierId = ? ORDER BY createdAt DESC").all(chantierId);
    return rows.map(r => ({
      ...r,
      meta: (() => { try { return JSON.parse(r.meta || "{}"); } catch { return {}; } })(),
    }));
  } catch {
    return [];
  }
});

ipcMain.handle("chantierEvents:addNote", (_e, { chantierId, note, title }) => {
  try {
    const eventTitle = (title && String(title).trim()) || "Note ajoutée";
    const id = insertEvent(chantierId, "note", eventTitle, note);
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierEvents:updateNote", (_e, { id, title, description }) => {
  try {
    const newTitle = (title && String(title).trim()) || "Note ajoutée";
    const newDesc = description !== undefined ? String(description) : "";
    const r = db.prepare(`
      UPDATE chantier_events
      SET title = ?, description = ?
      WHERE id = ? AND kind = 'note'
    `).run(newTitle, newDesc, id);
    if (r.changes === 0) {
      return { success: false, error: "Note introuvable ou non modifiable" };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierEvents:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM chantier_events WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Documents ────────────────────────────────────────────────────────

// Session 21 — Catégories de documents chantier personnalisables
ipcMain.handle("chantierDocCategories:list", () => {
  try {
    return db.prepare(`
      SELECT * FROM chantier_doc_categories
      ORDER BY sortOrder ASC, name ASC
    `).all().map((r) => ({ ...r, isSystem: !!r.isSystem }));
  } catch {
    return [];
  }
});

ipcMain.handle("chantierDocCategories:create", (_e, { name, iconKey, colorKey }) => {
  try {
    const trimmed = String(name || "").trim();
    if (!trimmed) return { success: false, error: "Nom requis" };
    // Vérifier unicité
    const exists = db.prepare("SELECT id FROM chantier_doc_categories WHERE name = ?").get(trimmed);
    if (exists) return { success: false, error: "Une catégorie avec ce nom existe déjà" };

    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    // Place en fin de liste (max sortOrder + 1)
    const max = db.prepare("SELECT COALESCE(MAX(sortOrder), 0) as m FROM chantier_doc_categories").get().m;
    db.prepare(`
      INSERT INTO chantier_doc_categories (id, name, iconKey, colorKey, sortOrder, isSystem, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, trimmed, iconKey || "file", colorKey || "slate", max + 1, now, now);
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierDocCategories:update", (_e, { id, name, iconKey, colorKey }) => {
  try {
    const cat = db.prepare("SELECT * FROM chantier_doc_categories WHERE id = ?").get(id);
    if (!cat) return { success: false, error: "Catégorie introuvable" };

    const newName = name !== undefined ? String(name).trim() : cat.name;
    if (!newName) return { success: false, error: "Nom requis" };

    // Vérifier unicité (sauf soi-même)
    if (newName !== cat.name) {
      const dup = db.prepare("SELECT id FROM chantier_doc_categories WHERE name = ? AND id <> ?").get(newName, id);
      if (dup) return { success: false, error: "Une catégorie avec ce nom existe déjà" };
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE chantier_doc_categories
      SET name = ?, iconKey = ?, colorKey = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      newName,
      iconKey !== undefined ? iconKey : cat.iconKey,
      colorKey !== undefined ? colorKey : cat.colorKey,
      now, id
    );

    // Si le nom a changé, propager dans tous les documents existants
    if (newName !== cat.name) {
      db.prepare("UPDATE chantier_documents SET category = ? WHERE category = ?").run(newName, cat.name);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierDocCategories:delete", (_e, id) => {
  try {
    const cat = db.prepare("SELECT * FROM chantier_doc_categories WHERE id = ?").get(id);
    if (!cat) return { success: false, error: "Catégorie introuvable" };

    // Catégories système : on accepte la suppression mais on rebascule les docs vers "Autre"
    // Compter les docs liés
    const linkedCount = db.prepare("SELECT COUNT(*) as n FROM chantier_documents WHERE category = ?").get(cat.name).n;

    // Réassigner les docs liés à "Autre" si la catégorie n'est pas elle-même "Autre"
    if (cat.name !== "Autre") {
      db.prepare("UPDATE chantier_documents SET category = 'Autre' WHERE category = ?").run(cat.name);
    } else if (linkedCount > 0) {
      return { success: false, error: "Impossible de supprimer 'Autre' tant qu'elle contient des documents" };
    }

    db.prepare("DELETE FROM chantier_doc_categories WHERE id = ?").run(id);
    return { success: true, reassigned: linkedCount };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierDocCategories:reorder", (_e, ids) => {
  try {
    if (!Array.isArray(ids)) return { success: false, error: "ids requis" };
    const upd = db.prepare("UPDATE chantier_doc_categories SET sortOrder = ? WHERE id = ?");
    const now = new Date().toISOString();
    const tx = db.transaction((arr) => {
      arr.forEach((id, idx) => upd.run(idx, id));
    });
    tx(ids);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Session 22 : Catégories chantier (corps d'état / postes) ──────────────
ipcMain.handle("chantierCategories:list", () => {
  try {
    return db.prepare(`
      SELECT * FROM chantier_categories
      ORDER BY sortOrder ASC, name ASC
    `).all().map((r) => ({ ...r, isSystem: !!r.isSystem }));
  } catch {
    return [];
  }
});

ipcMain.handle("chantierCategories:create", (_e, { name, iconKey, colorKey }) => {
  try {
    const trimmed = String(name || "").trim();
    if (!trimmed) return { success: false, error: "Nom requis" };
    const exists = db.prepare("SELECT id FROM chantier_categories WHERE name = ?").get(trimmed);
    if (exists) return { success: false, error: "Une catégorie avec ce nom existe déjà" };

    const id = `chcat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const max = db.prepare("SELECT COALESCE(MAX(sortOrder), 0) as m FROM chantier_categories").get().m;
    db.prepare(`
      INSERT INTO chantier_categories (id, name, iconKey, colorKey, sortOrder, isSystem, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, trimmed, iconKey || "hammer", colorKey || "slate", max + 1, now, now);
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierCategories:update", (_e, { id, name, iconKey, colorKey }) => {
  try {
    const cat = db.prepare("SELECT * FROM chantier_categories WHERE id = ?").get(id);
    if (!cat) return { success: false, error: "Catégorie introuvable" };

    const newName = name !== undefined ? String(name).trim() : cat.name;
    if (!newName) return { success: false, error: "Nom requis" };

    if (newName !== cat.name) {
      const dup = db.prepare("SELECT id FROM chantier_categories WHERE name = ? AND id <> ?").get(newName, id);
      if (dup) return { success: false, error: "Une catégorie avec ce nom existe déjà" };
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE chantier_categories
      SET name = ?, iconKey = ?, colorKey = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      newName,
      iconKey !== undefined ? iconKey : cat.iconKey,
      colorKey !== undefined ? colorKey : cat.colorKey,
      now, id
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierCategories:delete", (_e, id) => {
  try {
    const cat = db.prepare("SELECT * FROM chantier_categories WHERE id = ?").get(id);
    if (!cat) return { success: false, error: "Catégorie introuvable" };

    // Compte les chantiers liés pour info
    const chantiersCount = db.prepare("SELECT COUNT(*) as n FROM chantiers WHERE categoryId = ?").get(id).n;

    // Détache les chantiers (set à vide)
    if (chantiersCount > 0) {
      db.prepare("UPDATE chantiers SET categoryId = '' WHERE categoryId = ?").run(id);
    }

    db.prepare("DELETE FROM chantier_categories WHERE id = ?").run(id);
    return { success: true, detached: chantiersCount };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierCategories:reorder", (_e, ids) => {
  try {
    if (!Array.isArray(ids)) return { success: false, error: "ids requis" };
    const upd = db.prepare("UPDATE chantier_categories SET sortOrder = ? WHERE id = ?");
    const tx = db.transaction((arr) => {
      arr.forEach((id, idx) => upd.run(idx, id));
    });
    tx(ids);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierDocs:listByChantier", (_e, chantierId) => {
  try {
    return db.prepare("SELECT * FROM chantier_documents WHERE chantierId = ? ORDER BY createdAt DESC").all(chantierId);
  } catch {
    return [];
  }
});

ipcMain.handle("chantierDocs:add", async (_e, { chantierId, sourcePath, originalName, mimeType, category = "Autre" }) => {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "Fichier source introuvable" };
    }
    const userDataDir = app.getPath("userData");
    const docsDir = path.join(userDataDir, "chantier-docs", chantierId);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = path.extname(originalName);
    const safeName = `${id}${ext}`;
    const destPath = path.join(docsDir, safeName);

    fs.copyFileSync(sourcePath, destPath);
    const stats = fs.statSync(destPath);
    const now = new Date().toISOString();

    // Auto-store dans le coffre-fort (Session 21)
    let vaultDocumentId = "";
    try {
      const vaultResult = await autoStoreInVault({
        pdfPath: destPath,
        fileName: originalName,
        clientId: null,
        chantierId,
        originType: "chantier-doc",
        originId: id,
        description: `Document chantier — ${category}`,
        tagName: category,
      });
      if (vaultResult && vaultResult.documentId) {
        vaultDocumentId = vaultResult.documentId;
      }
    } catch (e) {
      console.warn("[chantierDocs:add] Erreur stockage coffre-fort", e.message);
    }

    db.prepare(`INSERT INTO chantier_documents (id, chantierId, name, path, size, mimeType, category, notes, vaultDocumentId, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, chantierId, originalName, destPath, stats.size, mimeType || "", category, "", vaultDocumentId, now);

    insertEvent(chantierId, "document-added", "Document ajouté", originalName);

    return {
      success: true,
      document: {
        id, chantierId, name: originalName, path: destPath,
        size: stats.size, mimeType: mimeType || "", category, notes: "",
        vaultDocumentId, createdAt: now,
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Upload via dialog (bouton "Choisir un fichier")
ipcMain.handle("chantierDocs:uploadViaDialog", async (_e, { chantierId, category = "Autre" }) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      title: "Choisir un ou plusieurs documents",
    });
    if (result.canceled || !result.filePaths.length) return { success: false };

    const uploaded = [];
    const userDataDir = app.getPath("userData");
    const docsDir = path.join(userDataDir, "chantier-docs", chantierId);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    for (const srcPath of result.filePaths) {
      const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const ext = path.extname(srcPath);
      const originalName = path.basename(srcPath);
      const destPath = path.join(docsDir, `${id}${ext}`);
      fs.copyFileSync(srcPath, destPath);
      const stats = fs.statSync(destPath);
      const now = new Date().toISOString();
      const mimeType = getMimeFromExt(ext);

      // Auto-store dans le coffre-fort (Session 21)
      let vaultDocumentId = "";
      try {
        const vaultResult = await autoStoreInVault({
          pdfPath: destPath,
          fileName: originalName,
          clientId: null,
          chantierId,
          originType: "chantier-doc",
          originId: id,
          description: `Document chantier — ${category}`,
          tagName: category,
        });
        if (vaultResult && vaultResult.documentId) {
          vaultDocumentId = vaultResult.documentId;
        }
      } catch (e) {
        console.warn("[chantierDocs:uploadViaDialog] Vault error", e.message);
      }

      db.prepare(`INSERT INTO chantier_documents (id, chantierId, name, path, size, mimeType, category, notes, vaultDocumentId, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, chantierId, originalName, destPath, stats.size, mimeType, category, "", vaultDocumentId, now);

      insertEvent(chantierId, "document-added", "Document ajouté", originalName);
      uploaded.push({
        id, chantierId, name: originalName, path: destPath,
        size: stats.size, mimeType, category, notes: "",
        vaultDocumentId, createdAt: now,
      });
    }
    return { success: true, documents: uploaded };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

function getMimeFromExt(ext) {
  const map = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
    ".txt": "text/plain",
  };
  return map[(ext || "").toLowerCase()] || "application/octet-stream";
}

ipcMain.handle("chantierDocs:delete", (_e, id) => {
  try {
    const doc = db.prepare("SELECT * FROM chantier_documents WHERE id = ?").get(id);
    if (doc) {
      try { if (fs.existsSync(doc.path)) fs.unlinkSync(doc.path); } catch {}
      db.prepare("DELETE FROM chantier_documents WHERE id = ?").run(id);
      insertEvent(doc.chantierId, "document-removed", "Document supprimé", doc.name);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Ouvrir le document avec l'app système par défaut
ipcMain.handle("chantierDocs:openExternal", (_e, docPath) => {
  try {
    shell.openPath(docPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Révéler le fichier dans l'explorateur
ipcMain.handle("chantierDocs:showInFolder", (_e, docPath) => {
  try {
    shell.showItemInFolder(docPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Signatures ───────────────────────────────────────────────────────
ipcMain.handle("chantierSignatures:listByChantier", (_e, chantierId) => {
  try {
    return db.prepare("SELECT * FROM chantier_signatures WHERE chantierId = ? ORDER BY signedAt DESC").all(chantierId);
  } catch {
    return [];
  }
});

ipcMain.handle("chantierSignatures:create", (_e, data) => {
  try {
    const id = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO chantier_signatures (id, chantierId, kind, signerName, signerRole, signatureDataUrl, notes, signedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.chantierId, data.kind, data.signerName || "", data.signerRole || "",
           data.signatureDataUrl, data.notes || "", now);

    insertEvent(data.chantierId,
      data.kind === "start" ? "signed-start" : "signed-end",
      data.kind === "start" ? "PV d'ouverture signé" : "PV de réception signé",
      data.signerName ? `par ${data.signerName}` : ""
    );

    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("chantierSignatures:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM chantier_signatures WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD — Devis (Session 8)
// ═══════════════════════════════════════════════════════════════════════════

function rowToQuote(row) {
  if (!row) return null;
  return {
    ...row,
    items: (() => { try { return JSON.parse(row.items || "[]"); } catch { return []; } })(),
    companySnapshot: (() => { try { return JSON.parse(row.companySnapshot || "{}"); } catch { return {}; } })(),
    globalDiscountPercent: Number(row.globalDiscountPercent || 0),
    globalDiscountAmount: Number(row.globalDiscountAmount || 0),
    totalHT: Number(row.totalHT || 0),
    totalTTC: Number(row.totalTTC || 0),
  };
}

// ─── Génération de la prochaine référence : DEVIS-YYYY-NNNN ───────────
function nextQuoteReference(prefix = "DEVIS") {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;
  try {
    const rows = db.prepare("SELECT reference FROM quotes WHERE reference LIKE ?").all(`${base}%`);
    let maxNum = 0;
    // Échapper le prefix pour la regex (au cas où il contient des caractères spéciaux)
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escapedPrefix}-\\d{4}-(\\d+)`);
    for (const r of rows) {
      const match = re.exec(r.reference || "");
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const next = String(maxNum + 1).padStart(4, "0");
    return `${base}${next}`;
  } catch {
    return `${base}0001`;
  }
}

ipcMain.handle("quotes:list", () => {
  try {
    const rows = db.prepare("SELECT * FROM quotes ORDER BY createdAt DESC").all();
    return rows.map(rowToQuote);
  } catch (e) {
    console.error("[quotes:list]", e);
    return [];
  }
});

ipcMain.handle("quotes:get", (_e, id) => {
  try {
    const row = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id);
    return rowToQuote(row);
  } catch {
    return null;
  }
});

ipcMain.handle("quotes:listByClient", (_e, clientId) => {
  try {
    const rows = db.prepare("SELECT * FROM quotes WHERE clientId = ? ORDER BY createdAt DESC").all(clientId);
    return rows.map(rowToQuote);
  } catch {
    return [];
  }
});

ipcMain.handle("quotes:listByChantier", (_e, chantierId) => {
  try {
    const rows = db.prepare("SELECT * FROM quotes WHERE chantierId = ? ORDER BY createdAt DESC").all(chantierId);
    return rows.map(rowToQuote);
  } catch {
    return [];
  }
});

ipcMain.handle("quotes:create", (_e, data) => {
  try {
    const id = data.id || `quo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    // Session S26 — récupère le préfixe configuré (par défaut "DEVIS" pour rétro-compat)
    const quotePrefix = getSetting("quotePrefix", "DEVIS");
    const reference = data.reference || nextQuoteReference(quotePrefix);

    const row = {
      ...data,
      id,
      reference,
      items: JSON.stringify(data.items || []),
      companySnapshot: JSON.stringify(data.companySnapshot || {}),
      globalDiscountPercent: Number(data.globalDiscountPercent || 0),
      globalDiscountAmount: Number(data.globalDiscountAmount || 0),
      totalHT: Number(data.totalHT || 0),
      totalTTC: Number(data.totalTTC || 0),
      createdAt: now,
      updatedAt: now,
    };
    const columns = [
      "id","reference","status","title","clientId","chantierId",
      "issueDate","validUntil","acceptedAt","sentAt",
      "items",
      "globalDiscountMode","globalDiscountPercent","globalDiscountAmount",
      "introText","conditionsText","footerText","internalNotes",
      "companySnapshot","totalHT","totalTTC","createdAt","updatedAt",
    ];
    const placeholders = columns.map(() => "?").join(",");
    const values = columns.map(c => row[c] ?? (typeof row[c] === "number" ? 0 : ""));
    db.prepare(`INSERT INTO quotes (${columns.join(",")}) VALUES (${placeholders})`).run(...values);
    return { success: true, id, reference };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("quotes:update", (_e, { id, data }) => {
  try {
    const existing = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id);
    if (!existing) return { success: false, error: "Devis introuvable" };
    const now = new Date().toISOString();
    const patched = {
      ...existing,
      ...data,
      items: data.items !== undefined ? JSON.stringify(data.items) : existing.items,
      companySnapshot: data.companySnapshot !== undefined
        ? JSON.stringify(data.companySnapshot) : existing.companySnapshot,
      globalDiscountPercent: data.globalDiscountPercent !== undefined ? Number(data.globalDiscountPercent) : existing.globalDiscountPercent,
      globalDiscountAmount: data.globalDiscountAmount !== undefined ? Number(data.globalDiscountAmount) : existing.globalDiscountAmount,
      totalHT: data.totalHT !== undefined ? Number(data.totalHT) : existing.totalHT,
      totalTTC: data.totalTTC !== undefined ? Number(data.totalTTC) : existing.totalTTC,
      updatedAt: now,
    };
    const cols = [
      "status","title","clientId","chantierId",
      "issueDate","validUntil","acceptedAt","sentAt",
      "items",
      "globalDiscountMode","globalDiscountPercent","globalDiscountAmount",
      "introText","conditionsText","footerText","internalNotes",
      "companySnapshot","totalHT","totalTTC","updatedAt",
    ];
    const set = cols.map(c => `${c} = ?`).join(", ");
    const values = cols.map(c => patched[c] ?? "");
    db.prepare(`UPDATE quotes SET ${set} WHERE id = ?`).run(...values, id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("quotes:updateStatus", (_e, { id, status }) => {
  try {
    const now = new Date().toISOString();
    const updates = { status, updatedAt: now };
    if (status === "envoye") updates.sentAt = now;
    if (status === "accepte") updates.acceptedAt = now;

    const cols = Object.keys(updates);
    const set = cols.map(c => `${c} = ?`).join(", ");
    const values = cols.map(c => updates[c]);
    db.prepare(`UPDATE quotes SET ${set} WHERE id = ?`).run(...values, id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("quotes:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM quotes WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Duplication d'un devis (Session 20) ──────────────────────────────────
ipcMain.handle("quotes:duplicate", (_e, sourceId) => {
  try {
    const source = db.prepare("SELECT * FROM quotes WHERE id = ?").get(sourceId);
    if (!source) return { success: false, error: "Devis introuvable" };

    const id = `quo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Session S26 — récupère le préfixe configuré
    const quotePrefix = getSetting("quotePrefix", "DEVIS");
    const reference = nextQuoteReference(quotePrefix);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO quotes (
        id, reference, status, title, clientId, chantierId,
        issueDate, validUntil, acceptedAt, sentAt,
        items, globalDiscountMode, globalDiscountPercent, globalDiscountAmount,
        introText, conditionsText, footerText, internalNotes,
        companySnapshot, totalHT, totalTTC, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      reference,
      "brouillon",                              // toujours brouillon
      `Copie de ${source.title || source.reference}`,
      source.clientId,
      source.chantierId,
      now.slice(0, 10),                          // nouvelle date d'émission
      "",                                         // reset validUntil
      "",                                         // reset acceptedAt
      "",                                         // reset sentAt
      source.items,
      source.globalDiscountMode,
      source.globalDiscountPercent,
      source.globalDiscountAmount,
      source.introText,
      source.conditionsText,
      source.footerText,
      source.internalNotes,
      source.companySnapshot,
      source.totalHT,
      source.totalTTC,
      now, now
    );
    return { success: true, id, reference };
  } catch (e) {
    console.error("[quotes:duplicate]", e);
    return { success: false, error: e.message };
  }
});

// ─── Conversion devis → BdC sous-traitant (Session 20) ───────────────────
// Nécessite un subcontractorId fourni (le BdC est forcément lié à un ST)
ipcMain.handle("quotes:convertToPo", (_e, { quoteId, subcontractorId }) => {
  try {
    const quoteRow = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
    if (!quoteRow) return { success: false, error: "Devis introuvable" };
    if (!subcontractorId) return { success: false, error: "Sous-traitant requis" };

    const st = db.prepare("SELECT companyName FROM subcontractors WHERE id = ?").get(subcontractorId);
    if (!st) return { success: false, error: "Sous-traitant introuvable" };

    const items = JSON.parse(quoteRow.items || "[]");
    const id = `po_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Reference avec préfixe BC
    const year = new Date().getFullYear();
    const last = db.prepare(`
      SELECT reference FROM purchase_orders
      WHERE reference LIKE ?
      ORDER BY reference DESC LIMIT 1
    `).get(`BC-${year}-%`);
    let n = 1;
    if (last && last.reference) {
      const m = last.reference.match(/-(\d+)$/);
      if (m) n = parseInt(m[1], 10) + 1;
    }
    const reference = `BC-${year}-${String(n).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    db.prepare(`
      INSERT INTO purchase_orders (
        id, reference, subcontractorId, subcontractorName, chantierId,
        poDate, startDate, endDate, signedDate,
        title, description,
        totalHt, totalVat, totalTtc,
        retentionEnabled, retentionPct, retentionAmount, retentionReleaseDate, retentionReleased,
        hasSituations, paymentDelay,
        cautionRequired, cautionReceived, cautionVaultDocumentId,
        vaultDocumentId, status, notes,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 5, 0, ?, 0, 0, 30, 0, 0, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      reference,
      subcontractorId,
      st.companyName,
      quoteRow.chantierId,
      today, "", "", "",
      `Issu du devis ${quoteRow.reference}${quoteRow.title ? " — " + quoteRow.title : ""}`,
      quoteRow.introText || "",
      "",  // retentionReleaseDate
      "",  // cautionVaultDocumentId
      "",  // vaultDocumentId
      "brouillon",
      `Bon de commande créé par conversion depuis le devis ${quoteRow.reference}.`,
      now, now
    );

    // Insérer lignes (uniquement les "line" du devis, pas les sections)
    const insLine = db.prepare(`
      INSERT INTO po_lines (
        id, purchaseOrderId, designation, quantity, unit,
        unitPriceHt, totalHt, vatRate, notes, sortOrder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let order = 0;
    for (const it of items) {
      if (it.kind !== "line") continue;
      const qty = Number(it.quantity) || 0;
      const pu = Number(it.unitPriceHT) || 0;
      const designation = [it.title, it.description].filter(Boolean).join(" — ");
      insLine.run(
        `pol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${order}`,
        id,
        designation,
        qty,
        it.unit || "u",
        pu,
        +(qty * pu).toFixed(2),
        Number(it.vatRate) || 20,
        "",
        order
      );
      order++;
    }

    // Recalcul des totaux du PO
    if (typeof recalcPoTotals === "function") {
      try { recalcPoTotals(id); } catch {}
    } else {
      // Fallback : calcul direct si helper non global
      const totals = db.prepare(`
        SELECT COALESCE(SUM(totalHt),0) AS th,
               COALESCE(SUM(totalHt * vatRate / 100), 0) AS tv
        FROM po_lines WHERE purchaseOrderId = ?
      `).get(id);
      const th = Number(totals.th) || 0;
      const tv = Number(totals.tv) || 0;
      db.prepare(`UPDATE purchase_orders SET totalHt = ?, totalVat = ?, totalTtc = ? WHERE id = ?`)
        .run(th, tv, +(th + tv).toFixed(2), id);
    }

    return { success: true, id, reference };
  } catch (e) {
    console.error("[quotes:convertToPo]", e);
    return { success: false, error: e.message };
  }
});

// ─── Duplication d'une facture (Session 20) ──────────────────────────────
ipcMain.handle("invoices:duplicate", (_e, sourceId) => {
  try {
    const source = db.prepare("SELECT * FROM invoices WHERE id = ?").get(sourceId);
    if (!source) return { success: false, error: "Facture introuvable" };

    const prefix = getSetting("invoicePrefix", "FACT");
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const reference = nextInvoiceReference(prefix);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const paymentTermsDays = source.paymentTermsDays || Number(getSetting("invoicePaymentTermsDays", 30));
    const dueDate = (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + paymentTermsDays);
      return d.toISOString().slice(0, 10);
    })();

    db.prepare(`
      INSERT INTO invoices (
        id, reference, status, type, title, clientId, chantierId, fromQuoteId,
        issueDate, dueDate, paymentTermsDays, sentAt, paidAt,
        items, globalDiscountMode, globalDiscountPercent, globalDiscountAmount,
        acompteBasedOnQuoteId, acomptePercent, avoirReferenceInvoiceId,
        introText, conditionsText, footerText, internalNotes, companySnapshot,
        totalHT, totalVAT, totalTTC, totalPaid, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      reference,
      "brouillon",                                     // statut reset
      source.type,
      `Copie de ${source.title || source.reference}`,
      source.clientId,
      source.chantierId,
      "",                                                // fromQuoteId reset
      today,
      dueDate,
      paymentTermsDays,
      "",                                                // sentAt
      "",                                                // paidAt
      source.items,
      source.globalDiscountMode,
      source.globalDiscountPercent,
      source.globalDiscountAmount,
      "",                                                // acompteBasedOnQuoteId
      0,
      "",
      source.introText,
      source.conditionsText,
      source.footerText,
      source.internalNotes,
      source.companySnapshot,
      source.totalHT,
      source.totalVAT,
      source.totalTTC,
      0,                                                 // totalPaid reset
      now, now
    );
    return { success: true, id, reference };
  } catch (e) {
    console.error("[invoices:duplicate]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("quotes:count", () => {
  try {
    return db.prepare("SELECT COUNT(*) as n FROM quotes").get().n;
  } catch {
    return 0;
  }
});

ipcMain.handle("quotes:countByStatus", () => {
  try {
    const rows = db.prepare("SELECT status, COUNT(*) as n FROM quotes GROUP BY status").all();
    const result = { brouillon: 0, envoye: 0, accepte: 0, refuse: 0 };
    for (const r of rows) result[r.status] = r.n;
    return result;
  } catch {
    return { brouillon: 0, envoye: 0, accepte: 0, refuse: 0 };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD — Factures (Session 10)
// ═══════════════════════════════════════════════════════════════════════════

function rowToInvoice(row) {
  if (!row) return null;
  return {
    ...row,
    items: JSON.parse(row.items || "[]"),
    companySnapshot: JSON.parse(row.companySnapshot || "{}"),
    globalDiscountPercent: Number(row.globalDiscountPercent || 0),
    globalDiscountAmount: Number(row.globalDiscountAmount || 0),
    paymentTermsDays: Number(row.paymentTermsDays || 30),
    acomptePercent: Number(row.acomptePercent || 0),
    totalHT: Number(row.totalHT || 0),
    totalTTC: Number(row.totalTTC || 0),
    totalPaid: Number(row.totalPaid || 0),
    remindersCount: Number(row.remindersCount || 0),
  };
}

function rowToPayment(row) {
  if (!row) return null;
  return {
    ...row,
    amount: Number(row.amount || 0),
  };
}

function nextInvoiceReference(prefix = "FACT") {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;
  try {
    const rows = db.prepare("SELECT reference FROM invoices WHERE reference LIKE ?").all(`${base}%`);
    let maxNum = 0;
    for (const r of rows) {
      const match = new RegExp(`${prefix}-\\d{4}-(\\d+)`).exec(r.reference || "");
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const next = String(maxNum + 1).padStart(4, "0");
    return `${base}${next}`;
  } catch {
    return `${base}0001`;
  }
}

// Helper pour lire une clé depuis la table settings (qui est en JSON dans une colonne "data")
function getSetting(key, defaultValue = undefined) {
  try {
    const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    const settings = JSON.parse(row?.data || "{}");
    return settings[key] !== undefined ? settings[key] : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Auto-stockage dans le coffre-fort après génération PDF (Session 11 msg 3+)
// Range automatiquement les PDFs de devis/factures dans le bon dossier vault.
// ───────────────────────────────────────────────────────────────────────────
async function autoStoreInVault({ pdfPath, fileName, clientId, chantierId, originType, originId, description, tagName }) {
  console.log(`[autoStoreInVault] START - file: ${fileName}, clientId: ${clientId}, chantierId: ${chantierId}`);
  try {
    if (!fs.existsSync(pdfPath)) {
      console.warn(`[autoStoreInVault] PDF source introuvable : ${pdfPath}`);
      return;
    }
    if (!db) {
      console.warn(`[autoStoreInVault] db non initialisée`);
      return;
    }

    // Trouver le dossier cible : priorité chantier > client > Entreprise
    let targetFolderId = null;

    if (chantierId) {
      // Récupérer ou créer le dossier chantier
      const existing = db.prepare("SELECT id FROM vault_folders WHERE chantierId = ?").get(chantierId);
      if (existing) {
        targetFolderId = existing.id;
      } else {
        const chantier = db.prepare("SELECT title, reference, clientId FROM chantiers WHERE id = ?").get(chantierId);
        if (chantier) {
          const id = "fold_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          const now = new Date().toISOString();
          db.prepare(`
            INSERT INTO vault_folders (id, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdAt, updatedAt)
            VALUES (?, 'root_chantiers', ?, 'hammer', 'amber', ?, ?, '', ?, ?)
          `).run(id, chantier.title || chantier.reference || "Chantier", chantier.clientId || "", chantierId, now, now);
          targetFolderId = id;
        }
      }
    } else if (clientId) {
      const existing = db.prepare("SELECT id FROM vault_folders WHERE clientId = ?").get(clientId);
      if (existing) {
        targetFolderId = existing.id;
      } else {
        const client = db.prepare("SELECT type, companyName, firstName, lastName FROM clients WHERE id = ?").get(clientId);
        if (client) {
          const displayName = client.type === "pro" && client.companyName
            ? client.companyName
            : `${client.firstName || ""} ${client.lastName || ""}`.trim() || "Client";
          const id = "fold_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          const now = new Date().toISOString();
          db.prepare(`
            INSERT INTO vault_folders (id, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdAt, updatedAt)
            VALUES (?, 'root_clients', ?, 'users', 'violet', ?, '', '', ?, ?)
          `).run(id, displayName, clientId, now, now);
          targetFolderId = id;
        }
      }
    }

    // Si pas de cible, ne rien ranger (on stocke pas dans Entreprise par défaut)
    if (!targetFolderId) {
      console.warn(`[autoStoreInVault] Aucun dossier cible (clientId: ${clientId}, chantierId: ${chantierId}). Le devis/facture n'est pas lié à un client/chantier ?`);
      return;
    }
    console.log(`[autoStoreInVault] Dossier cible : ${targetFolderId}`);

    // Trouver si un document avec ce fileName existe déjà dans ce dossier (mise à jour)
    const existing = db.prepare(`
      SELECT id, storagePath FROM vault_documents
      WHERE folderId = ? AND fileName = ? AND deletedAt = ''
    `).get(targetFolderId, fileName);

    // Détection MIME (PDF dans 99% des cas)
    const mimeType = "application/pdf";
    const userDataPath = app.getPath("userData");
    const vaultDir = path.join(userDataPath, "vault");
    if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

    // Dériver la clé (même algo que vault.js)
    const crypto = require("crypto");
    const salt = Buffer.from("batidesk-vault-v1-salt", "utf8");
    const key = crypto.scryptSync(userDataPath, salt, 32);

    // Chiffrer le PDF dans le vault
    const encryptStream = (srcPath, destPath) => new Promise((resolve, reject) => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
      const inStream = fs.createReadStream(srcPath);
      const outStream = fs.createWriteStream(destPath);
      const hash = crypto.createHash("sha256");
      let totalSize = 0;
      inStream.on("data", (chunk) => { hash.update(chunk); totalSize += chunk.length; });
      inStream.pipe(cipher).pipe(outStream)
        .on("finish", () => resolve({ iv: iv.toString("base64"), fileHash: hash.digest("hex"), fileSize: totalSize }))
        .on("error", reject);
      inStream.on("error", reject);
    });

    const docId = existing ? existing.id : ("doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
    const storedFileName = `${docId}.enc`;
    const destPath = path.join(vaultDir, storedFileName);

    // Si remplacement, supprimer l'ancien
    if (existing) {
      const oldPath = path.join(vaultDir, existing.storagePath);
      try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
    }

    const enc = await encryptStream(pdfPath, destPath);

    // Extraction texte PDF
    let extractedText = "";
    try {
      const pdfParse = require("pdf-parse");
      const buffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(buffer);
      extractedText = (data.text || "").slice(0, 500000);
    } catch {}

    const now = new Date().toISOString();
    if (existing) {
      db.prepare(`
        UPDATE vault_documents
        SET storagePath = ?, iv = ?, fileSize = ?, fileHash = ?, extractedText = ?,
            description = ?, updatedAt = ?
        WHERE id = ?
      `).run(storedFileName, enc.iv, enc.fileSize, enc.fileHash, extractedText,
              description || "", now, docId);
    } else {
      db.prepare(`
        INSERT INTO vault_documents (
          id, folderId, fileName, originalFileName, storagePath, isEncrypted,
          iv, fileSize, mimeType, fileHash, extractedText, description,
          expirationDate, deletedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, '', '', ?, ?)
      `).run(
        docId, targetFolderId, fileName, fileName,
        storedFileName, enc.iv, enc.fileSize, mimeType, enc.fileHash, extractedText,
        description || "", now, now
      );

      // Tag automatique
      if (tagName) {
        let tagId;
        const existingTag = db.prepare("SELECT id FROM vault_tags WHERE name = ?").get(tagName);
        if (existingTag) tagId = existingTag.id;
        else {
          tagId = "tag_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          db.prepare("INSERT INTO vault_tags (id, name, colorKey, createdAt) VALUES (?, ?, ?, ?)")
            .run(tagId, tagName, "blue", now);
        }
        db.prepare("INSERT OR IGNORE INTO vault_document_tags (documentId, tagId) VALUES (?, ?)")
          .run(docId, tagId);
      }
    }

    // Reindex FTS
    const tagsForDoc = db.prepare(`
      SELECT t.name FROM vault_tags t
      INNER JOIN vault_document_tags dt ON dt.tagId = t.id
      WHERE dt.documentId = ?
    `).all(docId);
    const tagsStr = tagsForDoc.map(t => t.name).join(" ");
    db.prepare("DELETE FROM vault_search WHERE documentId = ?").run(docId);
    db.prepare(`
      INSERT INTO vault_search (documentId, fileName, description, extractedText, tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(docId, fileName, description || "", extractedText, tagsStr);

    console.log(`[autoStoreInVault] PDF rangé : ${fileName} → ${targetFolderId}`);
    return { stored: true, replaced: !!existing, folderId: targetFolderId, docId };
  } catch (e) {
    console.error("[autoStoreInVault]", e);
    // Non-bloquant : on ne fait pas planter la génération PDF si l'auto-store échoue
    return { stored: false, error: e.message };
  }
}

// Recalcul du totalPaid à partir des paiements enregistrés
function recomputeInvoiceTotalPaid(invoiceId) {
  try {
    const sum = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoice_payments WHERE invoiceId = ?").get(invoiceId);
    const totalPaid = Number(sum.total || 0);
    const inv = db.prepare("SELECT status, totalTTC FROM invoices WHERE id = ?").get(invoiceId);
    if (!inv) return;
    let newStatus = inv.status;
    if (inv.status !== "brouillon" && inv.status !== "annulee") {
      if (totalPaid >= Number(inv.totalTTC) - 0.01) newStatus = "payee";
      else if (totalPaid > 0.01) newStatus = "partiellement-payee";
      else if (inv.status === "partiellement-payee" || inv.status === "payee") newStatus = "envoyee";
    }
    const paidAt = newStatus === "payee" && inv.status !== "payee"
      ? new Date().toISOString()
      : undefined;
    db.prepare(`
      UPDATE invoices SET totalPaid = ?, status = ?${paidAt ? ", paidAt = ?" : ""}, updatedAt = ?
      WHERE id = ?
    `).run(
      totalPaid,
      newStatus,
      ...(paidAt ? [paidAt] : []),
      new Date().toISOString(),
      invoiceId,
    );
  } catch (e) {
    console.error("[invoices] recomputeTotalPaid", e);
  }
}

ipcMain.handle("invoices:list", () => {
  try {
    const rows = db.prepare("SELECT * FROM invoices ORDER BY createdAt DESC").all();
    return rows.map(rowToInvoice);
  } catch (e) {
    console.error("[invoices:list]", e);
    return [];
  }
});

ipcMain.handle("invoices:get", (_e, id) => {
  try {
    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    return row ? rowToInvoice(row) : null;
  } catch (e) {
    console.error("[invoices:get]", e);
    return null;
  }
});

ipcMain.handle("invoices:listByClient", (_e, clientId) => {
  try {
    const rows = db.prepare("SELECT * FROM invoices WHERE clientId = ? ORDER BY createdAt DESC").all(clientId);
    return rows.map(rowToInvoice);
  } catch {
    return [];
  }
});

ipcMain.handle("invoices:listByChantier", (_e, chantierId) => {
  try {
    const rows = db.prepare("SELECT * FROM invoices WHERE chantierId = ? ORDER BY createdAt DESC").all(chantierId);
    return rows.map(rowToInvoice);
  } catch {
    return [];
  }
});

ipcMain.handle("invoices:listByQuote", (_e, quoteId) => {
  try {
    const rows = db.prepare("SELECT * FROM invoices WHERE fromQuoteId = ? OR acompteBasedOnQuoteId = ? ORDER BY createdAt DESC").all(quoteId, quoteId);
    return rows.map(rowToInvoice);
  } catch {
    return [];
  }
});

ipcMain.handle("invoices:create", (_e, data) => {
  try {
    const id = "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const prefix = getSetting("invoicePrefix", "FACT");
    const reference = data.reference || nextInvoiceReference(prefix);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO invoices (
        id, reference, status, type, title, clientId, chantierId, fromQuoteId,
        issueDate, dueDate, paymentTermsDays, sentAt, paidAt,
        items, globalDiscountMode, globalDiscountPercent, globalDiscountAmount,
        acompteBasedOnQuoteId, acomptePercent, avoirReferenceInvoiceId,
        introText, conditionsText, footerText, internalNotes, companySnapshot,
        totalHT, totalTTC, totalPaid,
        lastReminderSentAt, remindersCount,
        createdAt, updatedAt
      ) VALUES (
        @id, @reference, @status, @type, @title, @clientId, @chantierId, @fromQuoteId,
        @issueDate, @dueDate, @paymentTermsDays, @sentAt, @paidAt,
        @items, @globalDiscountMode, @globalDiscountPercent, @globalDiscountAmount,
        @acompteBasedOnQuoteId, @acomptePercent, @avoirReferenceInvoiceId,
        @introText, @conditionsText, @footerText, @internalNotes, @companySnapshot,
        @totalHT, @totalTTC, @totalPaid,
        @lastReminderSentAt, @remindersCount,
        @createdAt, @updatedAt
      )
    `).run({
      id,
      reference,
      status: data.status || "brouillon",
      type: data.type || "standard",
      title: data.title || "",
      clientId: data.clientId || "",
      chantierId: data.chantierId || "",
      fromQuoteId: data.fromQuoteId || "",
      issueDate: data.issueDate || new Date().toISOString().slice(0, 10),
      dueDate: data.dueDate || "",
      paymentTermsDays: data.paymentTermsDays || 30,
      sentAt: data.sentAt || "",
      paidAt: data.paidAt || "",
      items: JSON.stringify(data.items || []),
      globalDiscountMode: data.globalDiscountMode || "none",
      globalDiscountPercent: data.globalDiscountPercent || 0,
      globalDiscountAmount: data.globalDiscountAmount || 0,
      acompteBasedOnQuoteId: data.acompteBasedOnQuoteId || "",
      acomptePercent: data.acomptePercent || 0,
      avoirReferenceInvoiceId: data.avoirReferenceInvoiceId || "",
      introText: data.introText || "",
      conditionsText: data.conditionsText || "",
      footerText: data.footerText || "",
      internalNotes: data.internalNotes || "",
      companySnapshot: JSON.stringify(data.companySnapshot || {}),
      totalHT: data.totalHT || 0,
      totalTTC: data.totalTTC || 0,
      totalPaid: 0,
      lastReminderSentAt: "",
      remindersCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id, reference };
  } catch (e) {
    console.error("[invoices:create]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:update", (_e, { id, data }) => {
  try {
    const keys = Object.keys(data).filter(
      (k) => !["id", "reference", "createdAt", "totalPaid"].includes(k),
    );
    const sets = keys.map((k) => `${k} = @${k}`).join(", ");
    const payload = { id, updatedAt: new Date().toISOString() };
    for (const k of keys) {
      const v = data[k];
      if (k === "items" || k === "companySnapshot") {
        payload[k] = JSON.stringify(v || (k === "items" ? [] : {}));
      } else {
        payload[k] = v;
      }
    }
    db.prepare(`UPDATE invoices SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
    return { success: true };
  } catch (e) {
    console.error("[invoices:update]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:updateStatus", (_e, { id, status }) => {
  try {
    const now = new Date().toISOString();
    const updates = { status, updatedAt: now };
    if (status === "envoyee") updates.sentAt = now;
    if (status === "payee") updates.paidAt = now;

    const sets = Object.keys(updates).map((k) => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE invoices SET ${sets} WHERE id = @id`).run({ ...updates, id });
    return { success: true };
  } catch (e) {
    console.error("[invoices:updateStatus]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM invoice_payments WHERE invoiceId = ?").run(id);
    db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    console.error("[invoices:delete]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:count", () => {
  try {
    return db.prepare("SELECT COUNT(*) as n FROM invoices").get().n;
  } catch {
    return 0;
  }
});

ipcMain.handle("invoices:countByStatus", () => {
  try {
    const rows = db.prepare("SELECT status, COUNT(*) as n FROM invoices GROUP BY status").all();
    const result = { brouillon: 0, envoyee: 0, "partiellement-payee": 0, payee: 0, annulee: 0 };
    for (const r of rows) result[r.status] = r.n;
    return result;
  } catch {
    return { brouillon: 0, envoyee: 0, "partiellement-payee": 0, payee: 0, annulee: 0 };
  }
});

// Conversion devis → facture
ipcMain.handle("invoices:convertFromQuote", (_e, { quoteId, options }) => {
  try {
    const quoteRow = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
    if (!quoteRow) return { success: false, error: "Devis introuvable" };

    const type = options.type || "standard";
    const acomptePercent = type === "acompte" ? (options.acomptePercent || 30) : 0;

    // Récupérer la durée de paiement par défaut dans les settings
    const paymentTermsDays = Number(getSetting("invoicePaymentTermsDays", 30));

    // Calcul de la date d'échéance
    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate = (() => {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + paymentTermsDays);
      return d.toISOString().slice(0, 10);
    })();

    // Items : pour un acompte, on modifie les montants
    let items = JSON.parse(quoteRow.items || "[]");
    let totalHT = Number(quoteRow.totalHT);
    let totalTTC = Number(quoteRow.totalTTC);

    if (type === "acompte") {
      // Pour une facture d'acompte, on crée UNE SEULE ligne qui représente le %
      items = [
        {
          id: "item_" + Date.now(),
          kind: "line",
          title: `Acompte de ${acomptePercent} % sur devis ${quoteRow.reference}`,
          description: `Facture d'acompte correspondant à ${acomptePercent} % du montant total du devis ${quoteRow.reference}`,
          quantity: 1,
          unit: "forfait",
          unitPriceHT: Number((totalHT * acomptePercent / 100).toFixed(2)),
          vatRate: 20,
          discountPercent: 0,
          discountAmount: 0,
          discountMode: "none",
        },
      ];
      totalHT = Number((totalHT * acomptePercent / 100).toFixed(2));
      totalTTC = Number((totalTTC * acomptePercent / 100).toFixed(2));
    } else if (type === "avoir") {
      // Pour un avoir, on inverse les signes (montants négatifs)
      items = items.map((it) => ({
        ...it,
        unitPriceHT: it.kind === "line" ? -Math.abs(it.unitPriceHT) : it.unitPriceHT,
      }));
      totalHT = -Math.abs(totalHT);
      totalTTC = -Math.abs(totalTTC);
    }

    const prefix = getSetting("invoicePrefix", "FACT");
    const id = "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const reference = nextInvoiceReference(prefix);
    const now = new Date().toISOString();

    const defaultConditions = getSetting("invoiceConditions",
      "Paiement à réception de facture. Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €."
    );

    db.prepare(`
      INSERT INTO invoices (
        id, reference, status, type, title, clientId, chantierId, fromQuoteId,
        issueDate, dueDate, paymentTermsDays, sentAt, paidAt,
        items, globalDiscountMode, globalDiscountPercent, globalDiscountAmount,
        acompteBasedOnQuoteId, acomptePercent, avoirReferenceInvoiceId,
        introText, conditionsText, footerText, internalNotes, companySnapshot,
        totalHT, totalTTC, totalPaid,
        lastReminderSentAt, remindersCount,
        createdAt, updatedAt
      ) VALUES (
        @id, @reference, 'brouillon', @type, @title, @clientId, @chantierId, @fromQuoteId,
        @issueDate, @dueDate, @paymentTermsDays, '', '',
        @items, @globalDiscountMode, @globalDiscountPercent, @globalDiscountAmount,
        @acompteBasedOnQuoteId, @acomptePercent, '',
        @introText, @conditionsText, '', '', @companySnapshot,
        @totalHT, @totalTTC, 0,
        '', 0,
        @now, @now
      )
    `).run({
      id,
      reference,
      type,
      title: type === "acompte"
        ? `Acompte ${acomptePercent}% - ${quoteRow.title}`
        : type === "avoir"
        ? `Avoir - ${quoteRow.title}`
        : quoteRow.title,
      clientId: quoteRow.clientId,
      chantierId: quoteRow.chantierId,
      fromQuoteId: type === "acompte" ? "" : quoteId, // standard ou avoir = lien direct
      issueDate,
      dueDate,
      paymentTermsDays,
      items: JSON.stringify(items),
      globalDiscountMode: type === "acompte" ? "none" : quoteRow.globalDiscountMode,
      globalDiscountPercent: type === "acompte" ? 0 : Number(quoteRow.globalDiscountPercent),
      globalDiscountAmount: type === "acompte" ? 0 : Number(quoteRow.globalDiscountAmount),
      acompteBasedOnQuoteId: type === "acompte" ? quoteId : "",
      acomptePercent,
      introText: "",
      conditionsText: defaultConditions,
      companySnapshot: quoteRow.companySnapshot || "{}",
      totalHT,
      totalTTC,
      now,
    });

    const createdRow = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    return { success: true, invoice: rowToInvoice(createdRow) };
  } catch (e) {
    console.error("[invoices:convertFromQuote]", e);
    return { success: false, error: e.message };
  }
});

// ─── Paiements ───────────────────────────────────────────────────────────

ipcMain.handle("invoices:listPayments", (_e, invoiceId) => {
  try {
    const rows = db.prepare("SELECT * FROM invoice_payments WHERE invoiceId = ? ORDER BY date DESC").all(invoiceId);
    return rows.map(rowToPayment);
  } catch {
    return [];
  }
});

ipcMain.handle("invoices:addPayment", (_e, payment) => {
  try {
    const id = "pay_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO invoice_payments (id, invoiceId, amount, date, method, reference, notes, createdAt)
      VALUES (@id, @invoiceId, @amount, @date, @method, @reference, @notes, @createdAt)
    `).run({
      id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      date: payment.date,
      method: payment.method || "virement",
      reference: payment.reference || "",
      notes: payment.notes || "",
      createdAt: now,
    });
    recomputeInvoiceTotalPaid(payment.invoiceId);
    return { success: true, id };
  } catch (e) {
    console.error("[invoices:addPayment]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:deletePayment", (_e, paymentId) => {
  try {
    const row = db.prepare("SELECT invoiceId FROM invoice_payments WHERE id = ?").get(paymentId);
    if (!row) return { success: false, error: "Paiement introuvable" };
    db.prepare("DELETE FROM invoice_payments WHERE id = ?").run(paymentId);
    recomputeInvoiceTotalPaid(row.invoiceId);
    return { success: true };
  } catch (e) {
    console.error("[invoices:deletePayment]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:markReminderSent", (_e, invoiceId) => {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE invoices SET lastReminderSentAt = ?, remindersCount = remindersCount + 1, updatedAt = ?
      WHERE id = ?
    `).run(now, now, invoiceId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD — Bibliothèque (Session 8)
// ═══════════════════════════════════════════════════════════════════════════

function rowToLibraryItem(row) {
  if (!row) return null;
  return {
    ...row,
    unitPriceHT: Number(row.unitPriceHT || 0),
    vatRate: Number(row.vatRate || 20),
    usageCount: Number(row.usageCount || 0),
  };
}

ipcMain.handle("library:list", () => {
  try {
    const rows = db.prepare("SELECT * FROM library_items ORDER BY usageCount DESC, title ASC").all();
    return rows.map(rowToLibraryItem);
  } catch {
    return [];
  }
});

ipcMain.handle("library:create", (_e, data) => {
  try {
    const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO library_items (id, category, title, description, unit, unitPriceHT, vatRate, usageCount, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.category || "", data.title || "", data.description || "",
           data.unit || "u", Number(data.unitPriceHT || 0), Number(data.vatRate || 20),
           0, now, now);
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("library:update", (_e, { id, data }) => {
  try {
    const now = new Date().toISOString();
    const cols = ["category","title","description","unit","unitPriceHT","vatRate","updatedAt"];
    const set = cols.map(c => `${c} = ?`).join(", ");
    const values = [
      data.category || "", data.title || "", data.description || "",
      data.unit || "u", Number(data.unitPriceHT || 0), Number(data.vatRate || 20),
      now,
    ];
    db.prepare(`UPDATE library_items SET ${set} WHERE id = ?`).run(...values, id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("library:delete", (_e, id) => {
  try {
    db.prepare("DELETE FROM library_items WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Incrémenter le usageCount quand on utilise une presta dans un devis
ipcMain.handle("library:incrementUsage", (_e, id) => {
  try {
    db.prepare("UPDATE library_items SET usageCount = usageCount + 1 WHERE id = ?").run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY : Upload logo (Session 9)
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle("company:uploadLogo", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
      title: "Choisir un logo",
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const srcPath = result.filePaths[0];

    const userDataDir = app.getPath("userData");
    const logoDir = path.join(userDataDir, "company-logo");
    if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

    // On supprime les anciens logos pour éviter l'accumulation
    try {
      fs.readdirSync(logoDir).forEach((f) => {
        try { fs.unlinkSync(path.join(logoDir, f)); } catch {}
      });
    } catch {}

    const ext = path.extname(srcPath);
    const destPath = path.join(logoDir, `logo${ext}`);
    fs.copyFileSync(srcPath, destPath);

    // Stocker le path dans company
    const row = db.prepare("SELECT data FROM company WHERE id = 1").get();
    const current = JSON.parse(row?.data || "{}");
    const merged = { ...current, logoPath: destPath, updatedAt: new Date().toISOString() };
    db.prepare("UPDATE company SET data = ?, updatedAt = ? WHERE id = 1").run(JSON.stringify(merged), merged.updatedAt);

    return { success: true, logoPath: destPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("company:deleteLogo", async () => {
  try {
    const row = db.prepare("SELECT data FROM company WHERE id = 1").get();
    const current = JSON.parse(row?.data || "{}");
    if (current.logoPath && fs.existsSync(current.logoPath)) {
      try { fs.unlinkSync(current.logoPath); } catch {}
    }
    const merged = { ...current, logoPath: "", updatedAt: new Date().toISOString() };
    db.prepare("UPDATE company SET data = ?, updatedAt = ? WHERE id = 1").run(JSON.stringify(merged), merged.updatedAt);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("company:readLogo", (_e, logoPath) => {
  try {
    if (!logoPath || !fs.existsSync(logoPath)) return null;
    const buffer = fs.readFileSync(logoPath);
    const ext = path.extname(logoPath).slice(1).toLowerCase();
    const mime = ext === "jpg" ? "jpeg" : ext;
    return `data:image/${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// QUOTES : Export PDF via Puppeteer (Session 9)
// ═══════════════════════════════════════════════════════════════════════════
const { renderQuoteHtml } = require("./quoteTemplate");

let puppeteerBrowser = null;

// ─── Trouver le binaire Chromium (dev + prod, plateforme-aware) ──────
function findChromiumExecutable() {
  const candidates = [];

  // 1) En prod packagée (via extraResources) : resources/puppeteer-cache/
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "puppeteer-cache"));
  }

  // 2) En dev avec puppeteer.config.cjs : apps/desktop/.puppeteer-cache/
  candidates.push(path.join(__dirname, "..", ".puppeteer-cache"));
  candidates.push(path.join(process.cwd(), ".puppeteer-cache"));

  // 3) Fallback : ~/.cache/puppeteer/ (emplacement par défaut historique)
  candidates.push(path.join(app.getPath("home"), ".cache", "puppeteer"));

  // ─── Détection de la plateforme courante ───────────────────────────
  // process.platform peut être : 'win32', 'darwin', 'linux', etc.
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  // Noms de binaires acceptés pour la plateforme courante
  const acceptedNames = isWin
    ? ["chrome.exe", "chromium.exe"]
    : isMac
      ? ["chrome", "chromium", "Google Chrome for Testing", "Chromium"]
      : ["chrome", "chromium"]; // Linux

  // Mots-clés DEVANT figurer dans le chemin pour filtrer la bonne archi
  // (ex: sur Mac, refuser un binaire trouvé dans un dossier "win64-...")
  const acceptedPathKeywords = isWin
    ? ["win64", "win32", "windows"]
    : isMac
      ? ["mac", "darwin"]
      : ["linux"];

  // Mots-clés à BANNIR du chemin (anti-faux-positifs cross-plateforme)
  const bannedPathKeywords = isWin
    ? ["mac_", "darwin", "linux"]
    : isMac
      ? ["win64", "win32", "windows", "linux"]
      : ["win64", "win32", "windows", "mac_", "darwin"];

  // Explorateur récursif (recherche un binaire compatible avec la plateforme)
  const findChromeBinary = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const lowerPath = full.toLowerCase();

        // Filtre 1 : si le chemin contient un mot-clé d'une AUTRE plateforme,
        // on saute ce dossier entier (évite d'explorer chrome-win64/ sur Mac)
        if (bannedPathKeywords.some((k) => lowerPath.includes(k))) {
          continue;
        }

        if (entry.isFile()) {
          // Filtre 2 : nom du binaire compatible avec la plateforme
          if (acceptedNames.includes(entry.name)) {
            // Sur Mac, vérifier en plus que le binaire est exécutable
            // (les .exe copiés depuis Windows perdent le bit +x)
            if (isMac || isLinux) {
              try {
                fs.accessSync(full, fs.constants.X_OK);
              } catch {
                continue; // pas exécutable, on saute
              }
            }
            return full;
          }
        } else if (entry.isDirectory()) {
          const found = findChromeBinary(full);
          if (found) return found;
        }
      }
    } catch {}
    return null;
  };

  for (const base of candidates) {
    if (fs.existsSync(base)) {
      const found = findChromeBinary(base);
      if (found) {
        console.log(`[puppeteer] Chromium ${process.platform} trouvé :`, found);
        return found;
      }
    }
  }

  // ─── Session S28 hotfix NSIS — Fallback Chrome/Edge système ──────────
  // Si aucun binaire packagé n'est trouvé, on cherche Chrome/Edge système.
  // Permet de packager une app légère (sans embarquer Chromium) tout en
  // gardant la génération PDF fonctionnelle sur les machines Windows
  // (Edge est installé par défaut sur Windows 10+).
  console.log("[puppeteer] Pas de Chromium embarqué. Recherche Chrome/Edge système...");
  const systemCandidates = isWin
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      ]
    : isMac
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/usr/bin/microsoft-edge",
        ];

  for (const sysPath of systemCandidates) {
    if (sysPath && fs.existsSync(sysPath)) {
      console.log(`[puppeteer] Chrome/Edge système trouvé :`, sysPath);
      return sysPath;
    }
  }

  // Diagnostic verbose si rien trouvé : on liste ce qui existe pour aider au debug
  console.warn(`[puppeteer] Aucun binaire Chromium ${process.platform} trouvé.`);
  console.warn("[puppeteer] Candidates packagés testés :");
  for (const c of candidates) {
    console.warn(`  - ${c} ${fs.existsSync(c) ? "(existe)" : "(absent)"}`);
  }
  console.warn("[puppeteer] Candidats système testés :");
  for (const c of systemCandidates) {
    console.warn(`  - ${c} ${c && fs.existsSync(c) ? "(existe)" : "(absent)"}`);
  }
  console.warn(`[puppeteer] Plateforme : ${process.platform}, noms acceptés : ${acceptedNames.join(", ")}`);
  console.warn("[puppeteer] Pour résoudre : installer Google Chrome ou Microsoft Edge.");

  return null;
}

async function getPuppeteerBrowser() {
  if (puppeteerBrowser && puppeteerBrowser.connected !== false) {
    return puppeteerBrowser;
  }
  const puppeteer = require("puppeteer-core");
  const executablePath = findChromiumExecutable();

  if (!executablePath) {
    throw new Error(
      "Moteur PDF introuvable : Chromium n'est pas trouvé. " +
      "Installez Google Chrome ou Microsoft Edge (Edge est installé par défaut sur Windows 10/11)."
    );
  }

  const launchOptions = {
    headless: "new",
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  };

  try {
    puppeteerBrowser = await puppeteer.launch(launchOptions);
    return puppeteerBrowser;
  } catch (e) {
    console.error("[puppeteer] Launch failed:", e.message);
    throw new Error(
      `Impossible de démarrer le moteur PDF. Chemin testé : ${executablePath}. Erreur : ${e.message}`
    );
  }
}

// Helper : génère le PDF, retourne le path
async function generateQuotePdf(quoteId, outputPath) {
  const row = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
  if (!row) throw new Error("Devis introuvable");
  const quote = {
    ...row,
    items: (() => { try { return JSON.parse(row.items || "[]"); } catch { return []; } })(),
    companySnapshot: (() => { try { return JSON.parse(row.companySnapshot || "{}"); } catch { return {}; } })(),
  };

  // Client
  const client = row.clientId
    ? db.prepare("SELECT * FROM clients WHERE id = ?").get(row.clientId)
    : null;

  // Chantier (optionnel)
  const chantier = row.chantierId
    ? db.prepare("SELECT * FROM chantiers WHERE id = ?").get(row.chantierId)
    : null;

  // Company actuelle (fallback si pas de snapshot)
  const companyRow = db.prepare("SELECT data FROM company WHERE id = 1").get();
  const company = companyRow ? JSON.parse(companyRow.data || "{}") : {};

  // Session 22 — Charger les catégories pour rendre les badges sur les lignes
  let categories = [];
  try {
    categories = db.prepare("SELECT * FROM chantier_categories").all();
  } catch {
    categories = [];
  }

  // Session S26 — Charger les settings PDF + champs S25 (cachet, signature, RGE, CGV)
  const settingsRowQuote = db.prepare("SELECT data FROM settings WHERE id = 1").get();
  const allSettingsQuote = settingsRowQuote ? JSON.parse(settingsRowQuote.data || "{}") : {};
  let rgeQualifsQuote = [];
  try {
    rgeQualifsQuote = allSettingsQuote.rgeQualifications
      ? JSON.parse(allSettingsQuote.rgeQualifications)
      : [];
    if (!Array.isArray(rgeQualifsQuote)) rgeQualifsQuote = [];
  } catch {
    rgeQualifsQuote = [];
  }
  const pdfSettingsQuote = {
    pdfAccentColor: allSettingsQuote.pdfAccentColor,
    pdfStyle: allSettingsQuote.pdfStyle,
    pdfFooterText: allSettingsQuote.pdfFooterText,
    pdfShowLogoInHeader: allSettingsQuote.pdfShowLogoInHeader,
    pdfShowCompanyAddress: allSettingsQuote.pdfShowCompanyAddress,
    pdfIbanShown: allSettingsQuote.pdfIbanShown,
    // Champs S25
    companyStampDataUrl: allSettingsQuote.companyStampDataUrl || "",
    companySignatureDataUrl: allSettingsQuote.companySignatureDataUrl || "",
    rgeQualifications: rgeQualifsQuote,
    cgvText: allSettingsQuote.cgvText || "",
    quoteValidityDays: Number(allSettingsQuote.quoteValidityDays || 90),
    // Session S26.3 — Personnalisation visuelle
    pdfLogoSizeMm: Number(allSettingsQuote.pdfLogoSizeMm || 35),
    pdfStampSizeMm: Number(allSettingsQuote.pdfStampSizeMm || 26),
    pdfSignatureSizeMm: Number(allSettingsQuote.pdfSignatureSizeMm || 22),
    pdfStampPosition: allSettingsQuote.pdfStampPosition || "right",
    pdfDensity: allSettingsQuote.pdfDensity || "normal",
    pdfShowAccordBlock: allSettingsQuote.pdfShowAccordBlock !== false,
    pdfShowSignatureBlock: allSettingsQuote.pdfShowSignatureBlock !== false,
    pdfShowQualifications: allSettingsQuote.pdfShowQualifications !== false,
    // Session S28 — Police + Multi-style devis
    pdfFont: allSettingsQuote.pdfFont || "Inter",
    pdfQuoteStyle: allSettingsQuote.pdfQuoteStyle || "moderne",
  };

  const html = renderQuoteHtml({ quote, client, chantier, company, categories, pdfSettings: pdfSettingsQuote });

  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close();
  }
  return outputPath;
}

// Génère le PDF dans un dossier cache (aperçu rapide)
ipcMain.handle("quotes:exportPdfPreview", async (_e, quoteId) => {
  try {
    const row = db.prepare("SELECT reference, clientId, chantierId FROM quotes WHERE id = ?").get(quoteId);
    if (!row) return { success: false, error: "Devis introuvable" };

    const cacheDir = path.join(app.getPath("userData"), "pdf-cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    // Nettoyer les anciens PDFs de ce devis (qui ne sont plus ouverts)
    const baseName = `${row.reference || quoteId}`.replace(/[/\\:*?"<>|]/g, "_");
    try {
      const files = fs.readdirSync(cacheDir);
      for (const f of files) {
        if (f.startsWith(baseName) && f.endsWith(".pdf")) {
          try { fs.unlinkSync(path.join(cacheDir, f)); } catch {}
        }
      }
    } catch {}

    // Nom unique avec timestamp pour éviter les conflits si ouvert dans un lecteur
    const fileName = `${baseName}.pdf`;
    const uniqueFileName = `${baseName}_${Date.now()}.pdf`;
    const outputPath = path.join(cacheDir, uniqueFileName);

    await generateQuotePdf(quoteId, outputPath);

    // Auto-stockage dans le coffre-fort (Session 11)
    const vaultResult = await autoStoreInVault({
      pdfPath: outputPath,
      fileName,
      clientId: row.clientId,
      chantierId: row.chantierId,
      originType: "quote",
      originId: quoteId,
      description: `Devis ${row.reference}`,
      tagName: "Devis",
    });

    return { success: true, path: outputPath, vault: vaultResult };
  } catch (e) {
    console.error("[quotes:exportPdfPreview]", e);
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SESSION S28 — PDF Lab : génère un PDF d'aperçu avec données factices
// pour que l'utilisateur teste sa personnalisation rapidement
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle("pdf:generatePreview", async (_e, docType = "quote") => {
  try {
    // Récupère les paramètres et la company actuels
    const settingsRow = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    const allSettings = settingsRow ? JSON.parse(settingsRow.data || "{}") : {};
    const companyRow = db.prepare("SELECT data FROM company WHERE id = 1").get();
    const company = companyRow ? JSON.parse(companyRow.data || "{}") : {};

    // RGE qualifications
    let rgeQualifs = [];
    try {
      rgeQualifs = allSettings.rgeQualifications
        ? JSON.parse(allSettings.rgeQualifications)
        : [];
    } catch {
      rgeQualifs = [];
    }

    // Données factices d'un devis BTP réaliste
    const fakeClient = {
      civility: "Mme", firstName: "Camille", lastName: "DURAND",
      addressLine1: "12 rue des Lilas", postalCode: "55000", city: "Bar-le-Duc",
      email: "camille.durand@example.fr", phone: "06 12 34 56 78",
    };
    const fakeChantier = {
      title: "Rénovation salle de bain et cuisine",
      addressLine1: "12 rue des Lilas", postalCode: "55000", city: "Bar-le-Duc",
    };

    const fakeItems = [
      { id: "i1", title: "Dépose carrelage existant", description: "Évacuation déchets incluse", quantity: 18, unit: "m²", unitPriceHT: 22, vatRate: 10, category: "Démolition" },
      { id: "i2", title: "Pose carrelage 60x60", description: "Référence: Atlas Concorde Marvel", quantity: 18, unit: "m²", unitPriceHT: 85, vatRate: 10, category: "Carrelage" },
      { id: "i3", title: "Plomberie complète douche italienne", quantity: 1, unit: "u", unitPriceHT: 1200, vatRate: 10, category: "Plomberie" },
      { id: "i4", title: "Installation meuble vasque double", quantity: 1, unit: "u", unitPriceHT: 850, vatRate: 10, category: "Plomberie" },
      { id: "i5", title: "Pose cuisine équipée", description: "Hors fourniture meubles client", quantity: 1, unit: "u", unitPriceHT: 1800, vatRate: 10, category: "Cuisine" },
      { id: "i6", title: "Électricité aux normes (mise en sécurité)", quantity: 1, unit: "u", unitPriceHT: 750, vatRate: 10, category: "Électricité" },
    ];

    // Calcul des totaux
    const totalHT = fakeItems.reduce((s, i) => s + i.quantity * i.unitPriceHT, 0);
    const totalTVA = fakeItems.reduce((s, i) => s + i.quantity * i.unitPriceHT * (i.vatRate / 100), 0);
    const totalTTC = totalHT + totalTVA;

    const today = new Date();
    const issueDate = today.toISOString().slice(0, 10);
    const validUntil = new Date(today.getTime() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const dueDate = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    let html;
    if (docType === "invoice") {
      const fakeInvoice = {
        reference: "APERÇU-FACT-XXXX",
        title: fakeChantier.title,
        items: fakeItems,
        totalHT: Math.round(totalHT * 100) / 100,
        totalTTC: Math.round(totalTTC * 100) / 100,
        issueDate, dueDate,
        conditionsText: "Paiement à 30 jours fin de mois. Pénalités de retard : taux BCE +10 points.",
      };
      const pdfSettings = {
        pdfAccentColor: allSettings.pdfAccentColor,
        pdfStyle: allSettings.pdfStyle,
        pdfFooterText: allSettings.pdfFooterText,
        pdfShowLogoInHeader: allSettings.pdfShowLogoInHeader,
        pdfShowCompanyAddress: allSettings.pdfShowCompanyAddress,
        pdfIbanShown: allSettings.pdfIbanShown,
        companyStampDataUrl: allSettings.companyStampDataUrl || "",
        companySignatureDataUrl: allSettings.companySignatureDataUrl || "",
        rgeQualifications: rgeQualifs,
        pdfLogoSizeMm: Number(allSettings.pdfLogoSizeMm || 35),
        pdfStampSizeMm: Number(allSettings.pdfStampSizeMm || 26),
        pdfSignatureSizeMm: Number(allSettings.pdfSignatureSizeMm || 22),
        pdfStampPosition: allSettings.pdfStampPosition || "right",
        pdfDensity: allSettings.pdfDensity || "normal",
        pdfShowAccordBlock: allSettings.pdfShowAccordBlock !== false,
        pdfShowSignatureBlock: allSettings.pdfShowSignatureBlock !== false,
        pdfShowQualifications: allSettings.pdfShowQualifications !== false,
        pdfFont: allSettings.pdfFont || "Inter",
      };
      html = renderInvoiceHtml({ invoice: fakeInvoice, client: fakeClient, chantier: fakeChantier, company, payments: [], pdfSettings });
    } else {
      // Devis (par défaut)
      const fakeQuote = {
        reference: "APERÇU-DEV-XXXX",
        title: fakeChantier.title,
        items: fakeItems,
        totalHT: Math.round(totalHT * 100) / 100,
        totalTTC: Math.round(totalTTC * 100) / 100,
        issueDate, validUntil,
        conditionsText: "Devis gratuit valable 90 jours. Acompte de 30% à la commande.",
      };
      let categories = [];
      try { categories = db.prepare("SELECT * FROM chantier_categories").all(); } catch {}
      const pdfSettings = {
        pdfAccentColor: allSettings.pdfAccentColor,
        pdfStyle: allSettings.pdfStyle,
        pdfFooterText: allSettings.pdfFooterText,
        pdfShowLogoInHeader: allSettings.pdfShowLogoInHeader,
        pdfShowCompanyAddress: allSettings.pdfShowCompanyAddress,
        pdfIbanShown: allSettings.pdfIbanShown,
        companyStampDataUrl: allSettings.companyStampDataUrl || "",
        companySignatureDataUrl: allSettings.companySignatureDataUrl || "",
        rgeQualifications: rgeQualifs,
        cgvText: allSettings.cgvText || "",
        quoteValidityDays: Number(allSettings.quoteValidityDays || 90),
        pdfLogoSizeMm: Number(allSettings.pdfLogoSizeMm || 35),
        pdfStampSizeMm: Number(allSettings.pdfStampSizeMm || 26),
        pdfSignatureSizeMm: Number(allSettings.pdfSignatureSizeMm || 22),
        pdfStampPosition: allSettings.pdfStampPosition || "right",
        pdfDensity: allSettings.pdfDensity || "normal",
        pdfShowAccordBlock: allSettings.pdfShowAccordBlock !== false,
        pdfShowSignatureBlock: allSettings.pdfShowSignatureBlock !== false,
        pdfShowQualifications: allSettings.pdfShowQualifications !== false,
        pdfFont: allSettings.pdfFont || "Inter",
        pdfQuoteStyle: allSettings.pdfQuoteStyle || "moderne",
      };
      html = renderQuoteHtml({ quote: fakeQuote, client: fakeClient, chantier: fakeChantier, company, categories, pdfSettings });
    }

    // Génération avec Puppeteer
    const cacheDir = path.join(app.getPath("userData"), "pdf-lab");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const outputPath = path.join(cacheDir, `apercu-${docType}-${Date.now()}.pdf`);

    const browser = await getPuppeteerBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
    } finally {
      await page.close();
    }

    // Ouvre le PDF avec la visionneuse système
    shell.openPath(outputPath);

    return { success: true, path: outputPath };
  } catch (e) {
    console.error("[pdf:generatePreview]", e);
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SESSION S28 — Templates email : envoi devis/facture par mail (Outlook)
// ═══════════════════════════════════════════════════════════════════════════

// Helper : remplace les variables {client}, {reference}, etc. dans un template
function replaceMailVariables(template, vars) {
  if (!template || typeof template !== "string") return "";
  let out = template;
  for (const [key, value] of Object.entries(vars || {})) {
    const regex = new RegExp("\\{" + key + "\\}", "g");
    out = out.replace(regex, value != null ? String(value) : "");
  }
  return out;
}

// Helper : prépare les variables d'un devis pour les templates email
function buildQuoteMailVars(quoteRow, clientRow, companyRow) {
  const totalTTC = Number(quoteRow.totalTTC || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const validUntilDate = quoteRow.validUntil
    ? new Date(quoteRow.validUntil).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const clientName = clientRow
    ? `${clientRow.civility || ""} ${clientRow.firstName || ""} ${clientRow.lastName || ""}`.trim()
    : "";
  return {
    client: clientName,
    reference: quoteRow.reference || "",
    title: quoteRow.title || "",
    company: (companyRow && companyRow.companyName) || "",
    totalTTC,
    validUntil: validUntilDate,
  };
}

function buildInvoiceMailVars(invoiceRow, clientRow, companyRow) {
  const totalTTC = Number(invoiceRow.totalTTC || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const dueDateFormatted = invoiceRow.dueDate
    ? new Date(invoiceRow.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  // Calcul jours retard
  let daysOverdue = 0;
  if (invoiceRow.dueDate) {
    const due = new Date(invoiceRow.dueDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (24 * 3600 * 1000));
    daysOverdue = Math.max(0, diff);
  }
  const clientName = clientRow
    ? `${clientRow.civility || ""} ${clientRow.firstName || ""} ${clientRow.lastName || ""}`.trim()
    : "";
  return {
    client: clientName,
    reference: invoiceRow.reference || "",
    title: invoiceRow.title || "",
    company: (companyRow && companyRow.companyName) || "",
    totalTTC,
    dueDate: dueDateFormatted,
    daysOverdue: String(daysOverdue),
  };
}

// Récupère les templates email et la prévisualisation pour devis
ipcMain.handle("email:prepareQuoteMail", async (_e, quoteId) => {
  try {
    const row = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
    if (!row) return { success: false, error: "Devis introuvable" };
    const client = row.clientId ? db.prepare("SELECT * FROM clients WHERE id = ?").get(row.clientId) : null;
    if (!client) return { success: false, error: "Client introuvable" };
    if (!client.email) return { success: false, error: "Le client n'a pas d'adresse email enregistrée" };

    const settingsRow = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    const allSettings = settingsRow ? JSON.parse(settingsRow.data || "{}") : {};
    const companyRow = db.prepare("SELECT data FROM company WHERE id = 1").get();
    const company = companyRow ? JSON.parse(companyRow.data || "{}") : {};

    const subjectTemplate = allSettings.emailQuoteSubject || "Votre devis {reference} - {company}";
    const bodyTemplate = allSettings.emailQuoteBody
      || "Bonjour {client},\n\nVeuillez trouver en pièce jointe votre devis {reference} pour {title}, d'un montant de {totalTTC}.\n\nCe devis est valable jusqu'au {validUntil}.\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{company}";

    const vars = buildQuoteMailVars(row, client, company);
    const subject = replaceMailVariables(subjectTemplate, vars);
    const body = replaceMailVariables(bodyTemplate, vars);

    return {
      success: true,
      to: client.email,
      subject,
      body,
      quoteRef: row.reference,
    };
  } catch (e) {
    console.error("[email:prepareQuoteMail]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("email:prepareInvoiceMail", async (_e, { invoiceId, mode }) => {
  // mode = "send" (envoi initial) ou "reminder" (relance)
  try {
    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!row) return { success: false, error: "Facture introuvable" };
    const client = row.clientId ? db.prepare("SELECT * FROM clients WHERE id = ?").get(row.clientId) : null;
    if (!client) return { success: false, error: "Client introuvable" };
    if (!client.email) return { success: false, error: "Le client n'a pas d'adresse email enregistrée" };

    const settingsRow = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    const allSettings = settingsRow ? JSON.parse(settingsRow.data || "{}") : {};
    const companyRow = db.prepare("SELECT data FROM company WHERE id = 1").get();
    const company = companyRow ? JSON.parse(companyRow.data || "{}") : {};

    let subjectTemplate, bodyTemplate;
    if (mode === "reminder") {
      subjectTemplate = allSettings.emailReminderSubject || "Relance : facture {reference} - {company}";
      bodyTemplate = allSettings.emailReminderBody
        || "Bonjour {client},\n\nSauf erreur de notre part, votre facture {reference} d'un montant de {totalTTC} reste impayée.\n\nElle était due le {dueDate}, soit un retard de {daysOverdue} jours.\n\nMerci de procéder au règlement dans les meilleurs délais.\n\nCordialement,\n{company}";
    } else {
      subjectTemplate = allSettings.emailInvoiceSubject || "Votre facture {reference} - {company}";
      bodyTemplate = allSettings.emailInvoiceBody
        || "Bonjour {client},\n\nVeuillez trouver en pièce jointe votre facture {reference} pour {title}, d'un montant de {totalTTC}.\n\nÉchéance de paiement : {dueDate}.\n\nCordialement,\n{company}";
    }

    const vars = buildInvoiceMailVars(row, client, company);
    const subject = replaceMailVariables(subjectTemplate, vars);
    const body = replaceMailVariables(bodyTemplate, vars);

    return {
      success: true,
      to: client.email,
      subject,
      body,
      invoiceRef: row.reference,
    };
  } catch (e) {
    console.error("[email:prepareInvoiceMail]", e);
    return { success: false, error: e.message };
  }
});

// Envoi effectif du mail avec PDF en pièce jointe
ipcMain.handle("email:sendDocument", async (_e, { docType, docId, to, subject, body }) => {
  try {
    // Vérifs sécu
    if (!to || !to.includes("@")) {
      return { success: false, error: "Destinataire invalide" };
    }
    if (!subject || !subject.trim()) {
      return { success: false, error: "Objet vide" };
    }

    // Génère le PDF dans un fichier temporaire
    const cacheDir = path.join(app.getPath("userData"), "email-attachments");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    let pdfPath, attachmentName;
    if (docType === "quote") {
      const row = db.prepare("SELECT reference FROM quotes WHERE id = ?").get(docId);
      if (!row) return { success: false, error: "Devis introuvable" };
      const safe = (row.reference || `devis-${docId}`).replace(/[/\\:*?"<>|]/g, "_");
      pdfPath = path.join(cacheDir, `${safe}.pdf`);
      attachmentName = `${safe}.pdf`;
      await generateQuotePdf(docId, pdfPath);
    } else if (docType === "invoice") {
      const row = db.prepare("SELECT reference FROM invoices WHERE id = ?").get(docId);
      if (!row) return { success: false, error: "Facture introuvable" };
      const safe = (row.reference || `facture-${docId}`).replace(/[/\\:*?"<>|]/g, "_");
      pdfPath = path.join(cacheDir, `${safe}.pdf`);
      attachmentName = `${safe}.pdf`;
      await generateInvoicePdf(docId, pdfPath);
    } else {
      return { success: false, error: "Type de document invalide" };
    }

    // Envoi via msGraph
    await msGraph.sendMail({ to, subject, body, attachmentPath: pdfPath, attachmentName });

    return { success: true };
  } catch (e) {
    console.error("[email:sendDocument]", e);
    return { success: false, error: e.message };
  }
});

// Sauvegarde le PDF à un emplacement choisi par l'utilisateur
ipcMain.handle("quotes:exportPdfSaveAs", async (_e, quoteId) => {
  try {
    const row = db.prepare("SELECT reference, clientId, chantierId FROM quotes WHERE id = ?").get(quoteId);
    if (!row) return { success: false, error: "Devis introuvable" };

    const defaultName = `${row.reference || quoteId}.pdf`.replace(/[/\\:*?"<>|]/g, "_");
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Enregistrer le devis",
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };

    await generateQuotePdf(quoteId, result.filePath);

    // Auto-stockage dans le coffre-fort
    const vaultResult = await autoStoreInVault({
      pdfPath: result.filePath,
      fileName: defaultName,
      clientId: row.clientId,
      chantierId: row.chantierId,
      originType: "quote",
      originId: quoteId,
      description: `Devis ${row.reference}`,
      tagName: "Devis",
    });

    return { success: true, path: result.filePath, vault: vaultResult };
  } catch (e) {
    console.error("[quotes:exportPdfSaveAs]", e);
    return { success: false, error: e.message };
  }
});

// Ouvre le PDF avec l'app système
ipcMain.handle("quotes:openPdfExternal", (_e, pdfPath) => {
  try {
    shell.openPath(pdfPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// QUOTES : Envoi email via Outlook Graph (Session 9)
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle("quotes:sendViaOutlook", async (_e, { quoteId, to, subject, body, cc }) => {
  try {
    // Vérifier qu'on est loggué à MS
    const account = await msAuth.getAccount();
    if (!account) {
      return { success: false, error: "Vous devez d'abord vous connecter à Microsoft dans Paramètres > Sauvegarde", needsLogin: true };
    }

    // Générer le PDF d'abord
    const row = db.prepare("SELECT reference FROM quotes WHERE id = ?").get(quoteId);
    if (!row) return { success: false, error: "Devis introuvable" };

    const cacheDir = path.join(app.getPath("userData"), "pdf-cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const baseName = `${row.reference || quoteId}`.replace(/[/\\:*?"<>|]/g, "_");
    const fileName = `${baseName}.pdf`;
    // Nom unique pour éviter les conflits de fichiers verrouillés
    const pdfPath = path.join(cacheDir, `${baseName}_${Date.now()}.pdf`);
    await generateQuotePdf(quoteId, pdfPath);

    // Lire le PDF en base64
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");

    // Récupérer le token
    const token = await msAuth.getAccessToken();
    if (!token) return { success: false, error: "Token Microsoft indisponible" };

    // Construire la requête Graph
    const axios = require("axios");
    const message = {
      message: {
        subject: subject || `Votre devis ${row.reference}`,
        body: {
          contentType: "HTML",
          content: (body || "").replace(/\n/g, "<br/>"),
        },
        toRecipients: (to || "").split(/[,;]/).filter(s => s.trim()).map((addr) => ({
          emailAddress: { address: addr.trim() },
        })),
        ccRecipients: (cc || "").split(/[,;]/).filter(s => s.trim()).map((addr) => ({
          emailAddress: { address: addr.trim() },
        })),
        attachments: [{
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: fileName,
          contentType: "application/pdf",
          contentBytes: pdfBase64,
        }],
      },
      saveToSentItems: true,
    };

    await axios.post(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      message,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    // Update status to "envoye" si c'était brouillon
    const current = db.prepare("SELECT status FROM quotes WHERE id = ?").get(quoteId);
    if (current && current.status === "brouillon") {
      const now = new Date().toISOString();
      db.prepare("UPDATE quotes SET status = 'envoye', sentAt = ?, updatedAt = ? WHERE id = ?")
        .run(now, now, quoteId);
    }

    return { success: true };
  } catch (e) {
    console.error("[quotes:sendViaOutlook]", e);
    return { success: false, error: e.response?.data?.error?.message || e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INVOICES : Export PDF + Envoi email + Relance (Session 10 msg 3)
// ═══════════════════════════════════════════════════════════════════════════

const { renderInvoiceHtml } = require("./invoiceTemplate");

async function generateInvoicePdf(invoiceId, outputPath) {
  const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  if (!row) throw new Error("Facture introuvable");

  const invoice = {
    ...row,
    items: (() => { try { return JSON.parse(row.items || "[]"); } catch { return []; } })(),
    companySnapshot: (() => { try { return JSON.parse(row.companySnapshot || "{}"); } catch { return {}; } })(),
    totalPaid: Number(row.totalPaid || 0),
  };

  const client = row.clientId
    ? db.prepare("SELECT * FROM clients WHERE id = ?").get(row.clientId)
    : null;
  const chantier = row.chantierId
    ? db.prepare("SELECT * FROM chantiers WHERE id = ?").get(row.chantierId)
    : null;

  const companyRow = db.prepare("SELECT data FROM company WHERE id = 1").get();
  const company = companyRow ? JSON.parse(companyRow.data || "{}") : {};

  // Charger les paiements
  const payments = db.prepare("SELECT * FROM invoice_payments WHERE invoiceId = ? ORDER BY date DESC").all(invoiceId);

  // Charger les settings PDF de personnalisation
  const settingsRow = db.prepare("SELECT data FROM settings WHERE id = 1").get();
  const allSettings = settingsRow ? JSON.parse(settingsRow.data || "{}") : {};
  // Session S26 — Charger les qualifications RGE depuis les settings JSON
  let rgeQualifs = [];
  try {
    rgeQualifs = allSettings.rgeQualifications
      ? JSON.parse(allSettings.rgeQualifications)
      : [];
    if (!Array.isArray(rgeQualifs)) rgeQualifs = [];
  } catch {
    rgeQualifs = [];
  }
  const pdfSettings = {
    pdfAccentColor: allSettings.pdfAccentColor,
    pdfStyle: allSettings.pdfStyle,
    pdfFooterText: allSettings.pdfFooterText,
    pdfShowLogoInHeader: allSettings.pdfShowLogoInHeader,
    pdfShowCompanyAddress: allSettings.pdfShowCompanyAddress,
    pdfIbanShown: allSettings.pdfIbanShown,
    // Session S26 — Champs S25 pour rendu sur PDF
    companyStampDataUrl: allSettings.companyStampDataUrl || "",
    companySignatureDataUrl: allSettings.companySignatureDataUrl || "",
    rgeQualifications: rgeQualifs,
    // Session S26.3 — Personnalisation visuelle
    pdfLogoSizeMm: Number(allSettings.pdfLogoSizeMm || 35),
    pdfStampSizeMm: Number(allSettings.pdfStampSizeMm || 26),
    pdfSignatureSizeMm: Number(allSettings.pdfSignatureSizeMm || 22),
    pdfStampPosition: allSettings.pdfStampPosition || "right",
    pdfDensity: allSettings.pdfDensity || "normal",
    pdfShowAccordBlock: allSettings.pdfShowAccordBlock !== false,
    pdfShowSignatureBlock: allSettings.pdfShowSignatureBlock !== false,
    pdfShowQualifications: allSettings.pdfShowQualifications !== false,
    // Session S28 — Police personnalisable
    pdfFont: allSettings.pdfFont || "Inter",
  };

  const html = renderInvoiceHtml({ invoice, client, chantier, company, payments, pdfSettings });

  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close();
  }
  return outputPath;
}

ipcMain.handle("invoices:exportPdfPreview", async (_e, invoiceId) => {
  try {
    const row = db.prepare("SELECT reference, clientId, chantierId FROM invoices WHERE id = ?").get(invoiceId);
    if (!row) return { success: false, error: "Facture introuvable" };

    const cacheDir = path.join(app.getPath("userData"), "pdf-cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    // Nettoyer les anciens PDFs de cette facture (qui ne sont plus ouverts)
    const baseName = `${row.reference || invoiceId}`.replace(/[/\\:*?"<>|]/g, "_");
    try {
      const files = fs.readdirSync(cacheDir);
      for (const f of files) {
        if (f.startsWith(baseName) && f.endsWith(".pdf")) {
          try { fs.unlinkSync(path.join(cacheDir, f)); } catch {}
        }
      }
    } catch {}

    const fileName = `${baseName}.pdf`;
    const uniqueFileName = `${baseName}_${Date.now()}.pdf`;
    const outputPath = path.join(cacheDir, uniqueFileName);

    await generateInvoicePdf(invoiceId, outputPath);

    // Auto-stockage dans le coffre-fort
    const vaultResult = await autoStoreInVault({
      pdfPath: outputPath,
      fileName,
      clientId: row.clientId,
      chantierId: row.chantierId,
      originType: "invoice",
      originId: invoiceId,
      description: `Facture ${row.reference}`,
      tagName: "Facture",
    });

    return { success: true, path: outputPath, vault: vaultResult };
  } catch (e) {
    console.error("[invoices:exportPdfPreview]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:exportPdfSaveAs", async (_e, invoiceId) => {
  try {
    const row = db.prepare("SELECT reference, clientId, chantierId FROM invoices WHERE id = ?").get(invoiceId);
    if (!row) return { success: false, error: "Facture introuvable" };

    const defaultName = `${row.reference || invoiceId}.pdf`.replace(/[/\\:*?"<>|]/g, "_");
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Enregistrer la facture",
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };

    await generateInvoicePdf(invoiceId, result.filePath);

    // Auto-stockage dans le coffre-fort
    const vaultResult = await autoStoreInVault({
      pdfPath: result.filePath,
      fileName: defaultName,
      clientId: row.clientId,
      chantierId: row.chantierId,
      originType: "invoice",
      originId: invoiceId,
      description: `Facture ${row.reference}`,
      tagName: "Facture",
    });

    return { success: true, path: result.filePath, vault: vaultResult };
  } catch (e) {
    console.error("[invoices:exportPdfSaveAs]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:openPdfExternal", (_e, pdfPath) => {
  try {
    shell.openPath(pdfPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("invoices:sendViaOutlook", async (_e, { invoiceId, to, subject, body, cc, markAsReminder }) => {
  try {
    const account = await msAuth.getAccount();
    if (!account) {
      return { success: false, error: "Vous devez d'abord vous connecter à Microsoft dans Paramètres > Sauvegarde", needsLogin: true };
    }

    const row = db.prepare("SELECT reference FROM invoices WHERE id = ?").get(invoiceId);
    if (!row) return { success: false, error: "Facture introuvable" };

    const cacheDir = path.join(app.getPath("userData"), "pdf-cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const baseName = `${row.reference || invoiceId}`.replace(/[/\\:*?"<>|]/g, "_");
    const fileName = `${baseName}.pdf`;
    const pdfPath = path.join(cacheDir, `${baseName}_${Date.now()}.pdf`);
    await generateInvoicePdf(invoiceId, pdfPath);

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");

    const token = await msAuth.getAccessToken();
    if (!token) return { success: false, error: "Token Microsoft indisponible" };

    const axios = require("axios");
    const recipients = to.split(/[,;]/).map(s => s.trim()).filter(Boolean)
      .map(addr => ({ emailAddress: { address: addr } }));
    const ccRecipients = cc
      ? cc.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(addr => ({ emailAddress: { address: addr } }))
      : [];

    const emailPayload = {
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: recipients,
        ccRecipients,
        attachments: [{
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: fileName,
          contentType: "application/pdf",
          contentBytes: pdfBase64,
        }],
      },
      saveToSentItems: true,
    };

    await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", emailPayload, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    // Update statut
    const current = db.prepare("SELECT status FROM invoices WHERE id = ?").get(invoiceId);
    const now = new Date().toISOString();

    if (markAsReminder) {
      // Si c'est une relance, on incrémente le compteur
      db.prepare("UPDATE invoices SET lastReminderSentAt = ?, remindersCount = remindersCount + 1, updatedAt = ? WHERE id = ?")
        .run(now, now, invoiceId);
    } else if (current && current.status === "brouillon") {
      // Passage en envoyée
      db.prepare("UPDATE invoices SET status = 'envoyee', sentAt = ?, updatedAt = ? WHERE id = ?")
        .run(now, now, invoiceId);
    }

    return { success: true };
  } catch (e) {
    console.error("[invoices:sendViaOutlook]", e);
    return { success: false, error: e.response?.data?.error?.message || e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// QUOTES : Historique de désignations pour autocomplete (Session 9)
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle("quotes:getDesignationHistory", () => {
  try {
    const rows = db.prepare("SELECT items FROM quotes ORDER BY createdAt DESC LIMIT 200").all();
    const map = new Map(); // title → { title, description, unit, unitPriceHT, vatRate, count, lastUsed }
    for (const r of rows) {
      try {
        const items = JSON.parse(r.items || "[]");
        for (const it of items) {
          if (it.kind !== "line" || !it.title || !it.title.trim()) continue;
          const key = it.title.trim().toLowerCase();
          if (map.has(key)) {
            const existing = map.get(key);
            existing.count++;
          } else {
            map.set(key, {
              title: it.title,
              description: it.description || "",
              unit: it.unit || "u",
              unitPriceHT: Number(it.unitPriceHT || 0),
              vatRate: Number(it.vatRate || 20),
              count: 1,
            });
          }
        }
      } catch {}
    }
    // Retourner triés par popularité
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  } catch (e) {
    console.error("[quotes:getDesignationHistory]", e);
    return [];
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MICROSOFT OAUTH + GRAPH (OneDrive API)
// ═══════════════════════════════════════════════════════════════════════════
const msAuth = require("./msAuth");
const msGraph = require("./msGraph");

// ─── Auth ────────────────────────────────────────────────────────────────
ipcMain.handle("ms:login", async () => {
  try {
    const result = await msAuth.login();
    const profile = await msGraph.getProfile();
    return {
      success: true,
      profile: {
        name: profile.name,
        email: profile.email,
        id: profile.id,
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("ms:logout", async () => {
  try {
    await msAuth.logout();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("ms:getAccount", async () => {
  try {
    const account = await msAuth.getAccount();
    if (!account) return null;
    // Essayer de récupérer le profil complet
    try {
      const profile = await msGraph.getProfile();
      return {
        name: profile.name,
        email: profile.email,
        id: profile.id,
      };
    } catch {
      // Fallback : juste les infos du cache
      return {
        name: account.name || account.username,
        email: account.username,
        id: account.homeAccountId,
      };
    }
  } catch {
    return null;
  }
});

ipcMain.handle("ms:getQuota", async () => {
  try {
    return await msGraph.getQuota();
  } catch {
    return null;
  }
});

// ─── OneDrive Backup via Graph API ───────────────────────────────────────
// ─── OneDrive Backup via Graph API (Session iOS-1 — format .btpbackup) ────
// Upload un backup .btpbackup complet (avec manifest + SHA-256 + vault + settings)
// vers OneDrive. Cohérent avec le format S23. Utilisé par BatiDesk Compagnon iOS
// pour télécharger les données sur le mobile.
ipcMain.handle("msOneDrive:uploadBackup", async (_e, { includeVault = true, includeSettings = false, includeLogs = false, settingsJson, type = "manual" }) => {
  try {
    const userDataDir = app.getPath("userData");
    const dbSrc = path.join(userDataDir, "btp-v16.db");
    const vaultSrc = path.join(userDataDir, "vault");
    const logsSrc = path.join(userDataDir, "logs");

    if (!fs.existsSync(dbSrc)) throw new Error("Base de données introuvable");

    // Checkpoint WAL avant copie
    try {
      if (db) db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (e) {
      console.warn("[msOneDrive:upload] wal_checkpoint", e.message);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const baseName = `btp-v16_${timestamp}_${type}`;
    const remoteName = `${baseName}.btpbackup`;

    // SHA-256 + stats DB
    const dbBuffer = fs.readFileSync(dbSrc);
    const dbHash = crypto.createHash("sha256").update(dbBuffer).digest("hex");
    let dbStats = { clients: 0, chantiers: 0, devis: 0, factures: 0, sousTraitants: 0 };
    try {
      dbStats.clients      = db.prepare("SELECT COUNT(*) as n FROM clients").get().n;
      dbStats.chantiers    = db.prepare("SELECT COUNT(*) as n FROM chantiers").get().n;
      dbStats.devis        = db.prepare("SELECT COUNT(*) as n FROM quotes").get().n;
      dbStats.factures     = db.prepare("SELECT COUNT(*) as n FROM invoices").get().n;
      dbStats.sousTraitants = db.prepare("SELECT COUNT(*) as n FROM subcontractors").get().n;
    } catch (e) {
      console.warn("[msOneDrive:upload] stats DB", e.message);
    }

    // Construire le ZIP en mémoire
    const AdmZip = require("adm-zip");
    const zip = new AdmZip();
    zip.addFile("database.db", dbBuffer);
    zip.addFile("sha256.txt", Buffer.from(dbHash, "utf8"));

    let settingsIncluded = false;
    if (includeSettings && settingsJson) {
      zip.addFile("settings.json", Buffer.from(settingsJson, "utf8"));
      settingsIncluded = true;
    }

    let vaultIncluded = false;
    let vaultFileCount = 0;
    let vaultSize = 0;
    if (includeVault && fs.existsSync(vaultSrc)) {
      const addFolderToZip = (folderPath, zipPathPrefix) => {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(folderPath, entry.name);
          const inZip = `${zipPathPrefix}/${entry.name}`;
          if (entry.isDirectory()) {
            addFolderToZip(full, inZip);
          } else {
            const buf = fs.readFileSync(full);
            zip.addFile(inZip, buf);
            vaultFileCount++;
            vaultSize += buf.length;
          }
        }
      };
      addFolderToZip(vaultSrc, "vault");
      vaultIncluded = true;
    }

    let logsIncluded = false;
    let logsCount = 0;
    if (includeLogs && fs.existsSync(logsSrc)) {
      try {
        const logFiles = fs.readdirSync(logsSrc)
          .filter(f => f.endsWith(".log"))
          .map(f => ({ name: f, path: path.join(logsSrc, f), mtime: fs.statSync(path.join(logsSrc, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 10);
        for (const lf of logFiles) {
          zip.addLocalFile(lf.path, "logs", lf.name);
          logsCount++;
        }
        logsIncluded = logsCount > 0;
      } catch {}
    }

    // Manifest
    const manifest = {
      formatVersion: 1,
      appVersion: app.getVersion(),
      backupId: baseName,
      type,
      createdAt: new Date().toISOString(),
      platform: process.platform,
      database: { size: dbBuffer.length, sha256: dbHash, stats: dbStats },
      vault: { included: vaultIncluded, fileCount: vaultFileCount, size: vaultSize },
      settings: { included: settingsIncluded },
      logs: { included: logsIncluded, fileCount: logsCount },
      // Marqueur OneDrive : utile pour différencier les sources côté mobile
      source: "pc-direct-upload",
    };
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

    // Écrire le ZIP dans un fichier temporaire pour upload
    const tmpDir = app.getPath("temp");
    const tmpZipPath = path.join(tmpDir, remoteName);
    zip.writeZip(tmpZipPath);

    // Upload via Graph API
    const meta = await msGraph.uploadFile(tmpZipPath, remoteName);

    // Cleanup temp
    try { fs.unlinkSync(tmpZipPath); } catch {}

    return {
      success: true,
      backup: {
        id: meta.id,
        name: meta.name,
        size: meta.size,
        createdAt: meta.modifiedAt,
        type,
        source: "onedrive-api",
        manifest,
      },
    };
  } catch (e) {
    console.error("[msOneDrive:upload]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("msOneDrive:listBackups", async () => {
  try {
    const files = await msGraph.listFiles();
    return files
      .filter(f => f.name.startsWith("btp-v16_") && (f.name.endsWith(".btpbackup") || f.name.endsWith(".db")))
      .map(f => {
        const isLegacy = f.name.endsWith(".db");
        const baseId = isLegacy ? f.name.replace(".db", "") : f.name.replace(".btpbackup", "");
        return {
          id: baseId,
          path: f.name,
          size: f.size,
          createdAt: f.modifiedAt,
          type: f.name.includes("_manual") ? "manual" : f.name.includes("_on-close") ? "on-close" : "auto",
          version: "",
          format: isLegacy ? "legacy-db" : "btpbackup",
          source: "onedrive-api",
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (e) {
    console.warn("[msOneDrive:listBackups]", e.message);
    return [];
  }
});

ipcMain.handle("msOneDrive:deleteBackup", async (_e, remoteName) => {
  try {
    await msGraph.deleteFile(remoteName);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Session iOS-1.5 : Rétention OneDrive ─────────────────────────────────
// Garde les N derniers backups, supprime les anciens.
// Compte les .btpbackup ET les .db (legacy) ensemble pour cohérence.
ipcMain.handle("msOneDrive:applyRetention", async (_e, { keepCount = 3 } = {}) => {
  try {
    if (keepCount < 1) return { deleted: 0 };

    const files = await msGraph.listFiles();
    const sorted = files
      .filter(f => f.name.startsWith("btp-v16_") && (f.name.endsWith(".btpbackup") || f.name.endsWith(".db")))
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    const toDelete = sorted.slice(keepCount);
    let deleted = 0;
    const errors = [];
    for (const f of toDelete) {
      try {
        await msGraph.deleteFile(f.name);
        deleted++;
      } catch (e) {
        errors.push(`${f.name}: ${e.message}`);
      }
    }
    return { deleted, total: sorted.length, kept: Math.min(sorted.length, keepCount), errors };
  } catch (e) {
    console.warn("[msOneDrive:applyRetention]", e.message);
    return { deleted: 0, error: e.message };
  }
});

// ─── Session iOS-1.5 : Vérification au démarrage ──────────────────────────
// Compare la DB locale (modification time + size) avec le dernier .btpbackup
// sur OneDrive. Retourne s'il y a un backup cloud plus récent que la locale.
ipcMain.handle("msOneDrive:checkLatest", async () => {
  try {
    const userDataDir = app.getPath("userData");
    const dbLocal = path.join(userDataDir, "btp-v16.db");

    if (!fs.existsSync(dbLocal)) {
      return { success: false, error: "DB locale introuvable" };
    }

    const localStats = fs.statSync(dbLocal);
    const localMtime = localStats.mtime.toISOString();

    const files = await msGraph.listFiles();
    const cloudBackups = files
      .filter(f => f.name.startsWith("btp-v16_") && f.name.endsWith(".btpbackup"))
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    if (cloudBackups.length === 0) {
      return {
        success: true,
        hasCloudBackup: false,
        cloudIsNewer: false,
        localMtime,
      };
    }

    const latest = cloudBackups[0];
    const cloudMtime = latest.modifiedAt;
    const cloudIsNewer = new Date(cloudMtime) > new Date(localMtime);

    // Tenter de récupérer le manifest pour stats
    let manifest = null;
    if (cloudIsNewer) {
      try {
        // Télécharger juste le manifest (on télécharge tout puis on extrait)
        const tmpPath = path.join(app.getPath("temp"), `peek-${Date.now()}.btpbackup`);
        await msGraph.downloadFile(latest.name, tmpPath);
        const AdmZip = require("adm-zip");
        const zip = new AdmZip(tmpPath);
        const entry = zip.getEntry("manifest.json");
        if (entry) {
          manifest = JSON.parse(entry.getData().toString("utf8"));
        }
        try { fs.unlinkSync(tmpPath); } catch {}
      } catch (e) {
        console.warn("[msOneDrive:checkLatest] peek manifest:", e.message);
      }
    }

    return {
      success: true,
      hasCloudBackup: true,
      cloudIsNewer,
      latest: {
        name: latest.name,
        size: latest.size,
        modifiedAt: cloudMtime,
        manifest,
      },
      localMtime,
    };
  } catch (e) {
    console.warn("[msOneDrive:checkLatest]", e.message);
    return { success: false, error: e.message };
  }
});

// ─── Session iOS-1.5 : SHA-256 de la DB locale (pour détection inchangée) ──
ipcMain.handle("backup:getLocalDbHash", () => {
  try {
    const userDataDir = app.getPath("userData");
    const dbLocal = path.join(userDataDir, "btp-v16.db");
    if (!fs.existsSync(dbLocal)) return { success: false, error: "DB introuvable" };

    if (db) {
      try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {}
    }

    const buffer = fs.readFileSync(dbLocal);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return { success: true, hash, size: buffer.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("msOneDrive:restoreBackup", async (_e, { remoteName }) => {
  try {
    const userDataDir = app.getPath("userData");
    const dbDest = path.join(userDataDir, "btp-v16.db");
    const tempPath = path.join(userDataDir, `restore-from-onedrive-${Date.now()}.db`);

    // Backup de sécurité
    if (fs.existsSync(dbDest)) {
      const safe = path.join(userDataDir, `btp-v16.before-restore-${Date.now()}.db`);
      fs.copyFileSync(dbDest, safe);
    }

    // Télécharger depuis OneDrive vers un fichier temp
    await msGraph.downloadFile(remoteName, tempPath);

    // Fermer la DB
    if (db) { try { db.close(); } catch {} db = null; }

    // Remplacer
    fs.copyFileSync(tempPath, dbDest);
    try { fs.unlinkSync(tempPath); } catch {}

    app.relaunch();
    app.exit();
    return { success: true };
  } catch (e) {
    if (!db) { try { await initDB(); } catch {} }
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════
// SESSION 18 — Génération PDF des documents administratifs
// ═══════════════════════════════════════════════════════════════════════════

const { renderReceptionHtml } = require("./templates/receptionTemplate");
const { renderTvaAttestationHtml } = require("./templates/tvaAttestationTemplate");
const { renderTvaAttestationCerfaHtml } = require("./templates/tvaAttestationCerfaTemplate");
const { renderDc4Html } = require("./templates/dc4Template");

// Helper : génère un PDF à partir d'un HTML
async function generatePdfFromHtml(html, outputPath) {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close();
  }
  return outputPath;
}

// Helper : prépare un nom de fichier sain et nettoie l'ancien cache
function preparePdfPath(basePrefix) {
  const cacheDir = path.join(app.getPath("userData"), "pdf-cache");
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const baseName = String(basePrefix).replace(/[/\\:*?"<>|]/g, "_");
  // Nettoyer les anciens PDFs de ce doc
  try {
    const files = fs.readdirSync(cacheDir);
    for (const f of files) {
      if (f.startsWith(baseName) && f.endsWith(".pdf")) {
        try { fs.unlinkSync(path.join(cacheDir, f)); } catch {}
      }
    }
  } catch {}
  const fileName = `${baseName}.pdf`;
  const uniqueFileName = `${baseName}_${Date.now()}.pdf`;
  return {
    cacheDir,
    fileName,
    outputPath: path.join(cacheDir, uniqueFileName),
  };
}

// Helper : récupère la company actuelle
function getCompanyData() {
  try {
    const row = db.prepare("SELECT data FROM company WHERE id = 1").get();
    return row ? JSON.parse(row.data || "{}") : {};
  } catch { return {}; }
}

// ─── PV de réception ────────────────────────────────────────────────────────
async function generateReceptionPdf(reportId, outputPath) {
  const report = db.prepare("SELECT * FROM reception_reports WHERE id = ?").get(reportId);
  if (!report) throw new Error("PV de réception introuvable");
  // Convertir bools
  report.ownerSigned = !!report.ownerSigned;
  report.contractorSigned = !!report.contractorSigned;

  const reserves = db.prepare(`
    SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC
  `).all(reportId).map((r) => ({ ...r, fixed: !!r.fixed }));

  const client = report.clientId
    ? db.prepare("SELECT * FROM clients WHERE id = ?").get(report.clientId)
    : null;
  const chantier = report.chantierId
    ? db.prepare("SELECT * FROM chantiers WHERE id = ?").get(report.chantierId)
    : null;
  const company = getCompanyData();

  const html = renderReceptionHtml({ report, reserves, client, chantier, company });
  await generatePdfFromHtml(html, outputPath);
  return outputPath;
}

ipcMain.handle("admin:reception:exportPdfPreview", async (_e, reportId) => {
  try {
    const row = db.prepare("SELECT reference, clientId, chantierId FROM reception_reports WHERE id = ?").get(reportId);
    if (!row) return { success: false, error: "PV introuvable" };

    const { fileName, outputPath } = preparePdfPath(`PV-${row.reference || reportId}`);
    await generateReceptionPdf(reportId, outputPath);

    const vaultResult = await autoStoreInVault({
      pdfPath: outputPath,
      fileName,
      clientId: row.clientId,
      chantierId: row.chantierId,
      originType: "reception",
      originId: reportId,
      description: `PV de réception ${row.reference}`,
      tagName: "PV de réception",
    });

    // Mettre à jour vaultDocumentId si stocké
    if (vaultResult && vaultResult.documentId) {
      db.prepare("UPDATE reception_reports SET vaultDocumentId = ?, updatedAt = ? WHERE id = ?")
        .run(vaultResult.documentId, new Date().toISOString(), reportId);
    }

    return { success: true, path: outputPath, vault: vaultResult };
  } catch (e) {
    console.error("[admin:reception:exportPdfPreview]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("admin:reception:exportPdfSaveAs", async (_e, reportId) => {
  try {
    const row = db.prepare("SELECT reference FROM reception_reports WHERE id = ?").get(reportId);
    if (!row) return { success: false, error: "PV introuvable" };

    const defaultName = `PV-${row.reference || reportId}.pdf`.replace(/[/\\:*?"<>|]/g, "_");
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Enregistrer le PV de réception",
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };

    await generateReceptionPdf(reportId, result.filePath);
    return { success: true, path: result.filePath };
  } catch (e) {
    console.error("[admin:reception:exportPdfSaveAs]", e);
    return { success: false, error: e.message };
  }
});

// ─── Attestations TVA ───────────────────────────────────────────────────────
async function generateTvaAttestationPdf(attestationId, outputPath) {
  const attestation = db.prepare("SELECT * FROM tva_attestations WHERE id = ?").get(attestationId);
  if (!attestation) throw new Error("Attestation TVA introuvable");
  // Convertir bool + parse JSON
  attestation.logementBuiltOver2Years = !!attestation.logementBuiltOver2Years;
  try {
    attestation.clientCommitments = JSON.parse(attestation.clientCommitments || "[]");
  } catch {
    attestation.clientCommitments = [];
  }

  const company = getCompanyData();

  // Choisir le template selon attestationType
  const html = attestation.attestationType === "cerfa_1300"
    ? renderTvaAttestationCerfaHtml({ attestation, company })
    : renderTvaAttestationHtml({ attestation, company });

  await generatePdfFromHtml(html, outputPath);
  return outputPath;
}

ipcMain.handle("admin:tva:exportPdfPreview", async (_e, attestationId) => {
  try {
    const row = db.prepare("SELECT reference, clientId, chantierId, attestationType FROM tva_attestations WHERE id = ?").get(attestationId);
    if (!row) return { success: false, error: "Attestation introuvable" };

    const isCerfa = row.attestationType === "cerfa_1300";
    const prefix = isCerfa ? `CERFA-${row.reference || attestationId}` : `TVA-${row.reference || attestationId}`;
    const { fileName, outputPath } = preparePdfPath(prefix);
    await generateTvaAttestationPdf(attestationId, outputPath);

    const vaultResult = await autoStoreInVault({
      pdfPath: outputPath,
      fileName,
      clientId: row.clientId,
      chantierId: row.chantierId,
      originType: "tva_attestation",
      originId: attestationId,
      description: isCerfa
        ? `Attestation TVA CERFA 1300 - ${row.reference}`
        : `Attestation TVA - ${row.reference}`,
      tagName: "Attestation TVA",
    });

    if (vaultResult && vaultResult.documentId) {
      db.prepare("UPDATE tva_attestations SET vaultDocumentId = ?, updatedAt = ? WHERE id = ?")
        .run(vaultResult.documentId, new Date().toISOString(), attestationId);
    }

    return { success: true, path: outputPath, vault: vaultResult };
  } catch (e) {
    console.error("[admin:tva:exportPdfPreview]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("admin:tva:exportPdfSaveAs", async (_e, attestationId) => {
  try {
    const row = db.prepare("SELECT reference, attestationType FROM tva_attestations WHERE id = ?").get(attestationId);
    if (!row) return { success: false, error: "Attestation introuvable" };

    const isCerfa = row.attestationType === "cerfa_1300";
    const defaultName = isCerfa
      ? `CERFA-${row.reference || attestationId}.pdf`
      : `Attestation-TVA-${row.reference || attestationId}.pdf`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Enregistrer l'attestation TVA",
      defaultPath: defaultName.replace(/[/\\:*?"<>|]/g, "_"),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };

    await generateTvaAttestationPdf(attestationId, result.filePath);
    return { success: true, path: result.filePath };
  } catch (e) {
    console.error("[admin:tva:exportPdfSaveAs]", e);
    return { success: false, error: e.message };
  }
});

// ─── DC4 ────────────────────────────────────────────────────────────────────
async function generateDc4Pdf(declarationId, outputPath) {
  const declaration = db.prepare("SELECT * FROM dc4_declarations WHERE id = ?").get(declarationId);
  if (!declaration) throw new Error("DC4 introuvable");
  declaration.cautionRequired = !!declaration.cautionRequired;
  declaration.cautionReceived = !!declaration.cautionReceived;

  const subcontractor = declaration.subcontractorId
    ? db.prepare("SELECT * FROM subcontractors WHERE id = ?").get(declaration.subcontractorId)
    : null;
  const chantier = declaration.chantierId
    ? db.prepare("SELECT * FROM chantiers WHERE id = ?").get(declaration.chantierId)
    : null;
  const company = getCompanyData();

  const html = renderDc4Html({ declaration, subcontractor, chantier, company });
  await generatePdfFromHtml(html, outputPath);
  return outputPath;
}

ipcMain.handle("admin:dc4:exportPdfPreview", async (_e, declarationId) => {
  try {
    const row = db.prepare("SELECT reference, chantierId FROM dc4_declarations WHERE id = ?").get(declarationId);
    if (!row) return { success: false, error: "DC4 introuvable" };

    const { fileName, outputPath } = preparePdfPath(`DC4-${row.reference || declarationId}`);
    await generateDc4Pdf(declarationId, outputPath);

    const vaultResult = await autoStoreInVault({
      pdfPath: outputPath,
      fileName,
      clientId: null,
      chantierId: row.chantierId,
      originType: "dc4",
      originId: declarationId,
      description: `DC4 - ${row.reference}`,
      tagName: "DC4 sous-traitance",
    });

    if (vaultResult && vaultResult.documentId) {
      db.prepare("UPDATE dc4_declarations SET vaultDocumentId = ?, updatedAt = ? WHERE id = ?")
        .run(vaultResult.documentId, new Date().toISOString(), declarationId);
    }

    return { success: true, path: outputPath, vault: vaultResult };
  } catch (e) {
    console.error("[admin:dc4:exportPdfPreview]", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("admin:dc4:exportPdfSaveAs", async (_e, declarationId) => {
  try {
    const row = db.prepare("SELECT reference FROM dc4_declarations WHERE id = ?").get(declarationId);
    if (!row) return { success: false, error: "DC4 introuvable" };

    const defaultName = `DC4-${row.reference || declarationId}.pdf`.replace(/[/\\:*?"<>|]/g, "_");
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Enregistrer le DC4",
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };

    await generateDc4Pdf(declarationId, result.filePath);
    return { success: true, path: result.filePath };
  } catch (e) {
    console.error("[admin:dc4:exportPdfSaveAs]", e);
    return { success: false, error: e.message };
  }
});

// Open external (réutilise le pattern existant)
ipcMain.handle("admin:openPdfExternal", (_e, pdfPath) => {
  try {
    shell.openPath(pdfPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// Initialisation du module Coffre-fort (Session 11)
const vaultModule = require("./vault");
// Initialisation du module Agenda (Session 12)
const agendaModule = require("./agenda");
// Initialisation du module Comptabilité (Session 13)
const accountingModule = require("./accounting");
// Initialisation du module Notes de frais (Session 14)
const expenseNotesModule = require("./expenseNotes");
// Initialisation du module Sous-traitants (Session 15)
const subcontractorsModule = require("./subcontractors");
// Initialisation du module Stats (Session 16)
const statsModule = require("./stats");
// Initialisation du module Documents administratifs (Session 17)
const administrativeDocsModule = require("./administrativeDocs");

app.whenReady().then(async () => {
  await initDB();
  createMenu();
  createWindow();

  // Initialiser le coffre-fort une fois la DB et la fenêtre prêtes
  try {
    vaultModule.init({
      db,
      userDataPath: app.getPath("userData"),
      mainWindow,
    });
  } catch (e) {
    console.error("[vault] init failed:", e.message);
  }

  // Initialiser l'agenda (Session 12)
  try {
    agendaModule.init({ db, msAuth });
  } catch (e) {
    console.error("[agenda] init failed:", e.message);
  }

  // Initialiser la comptabilité (Session 13)
  try {
    accountingModule.init({ db, mainWindow });
  } catch (e) {
    console.error("[accounting] init failed:", e.message);
  }

  // Initialiser les notes de frais (Session 14)
  try {
    expenseNotesModule.init({ db, mainWindow });
  } catch (e) {
    console.error("[expenseNotes] init failed:", e.message);
  }

  // Initialiser les sous-traitants (Session 15)
  try {
    subcontractorsModule.init({ db });
  } catch (e) {
    console.error("[subcontractors] init failed:", e.message);
  }

  // Initialiser les stats (Session 16)
  try {
    statsModule.init({ db });
  } catch (e) {
    console.error("[stats] init failed:", e.message);
  }

  // Initialiser les documents administratifs (Session 17)
  try {
    administrativeDocsModule.init({ db });
  } catch (e) {
    console.error("[administrativeDocs] init failed:", e.message);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── Backup on app quit (Session 23 — format .btpbackup avec manifest) ────
app.on("before-quit", () => {
  if (backupOnCloseConfig && backupOnCloseConfig.enabled && backupOnCloseConfig.destinationPath) {
    try {
      const userDataDir = app.getPath("userData");
      const dbSrc = path.join(userDataDir, "btp-v16.db");
      const vaultSrc = path.join(userDataDir, "vault");
      if (!fs.existsSync(dbSrc)) return;
      if (!fs.existsSync(backupOnCloseConfig.destinationPath)) {
        fs.mkdirSync(backupOnCloseConfig.destinationPath, { recursive: true });
      }

      // Checkpoint WAL avant copie
      try {
        if (db) db.pragma("wal_checkpoint(TRUNCATE)");
      } catch {}

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const baseName = `btp-v16_${timestamp}_on-close`;
      const zipPath = path.join(backupOnCloseConfig.destinationPath, `${baseName}.btpbackup`);

      // Stats + hash
      const dbBuffer = fs.readFileSync(dbSrc);
      const dbHash = crypto.createHash("sha256").update(dbBuffer).digest("hex");

      let dbStats = { clients: 0, chantiers: 0, devis: 0, factures: 0, sousTraitants: 0 };
      try {
        if (db) {
          dbStats.clients      = db.prepare("SELECT COUNT(*) as n FROM clients").get().n;
          dbStats.chantiers    = db.prepare("SELECT COUNT(*) as n FROM chantiers").get().n;
          dbStats.devis        = db.prepare("SELECT COUNT(*) as n FROM quotes").get().n;
          dbStats.factures     = db.prepare("SELECT COUNT(*) as n FROM invoices").get().n;
          dbStats.sousTraitants = db.prepare("SELECT COUNT(*) as n FROM subcontractors").get().n;
        }
      } catch {}

      // ZIP
      const AdmZip = require("adm-zip");
      const zip = new AdmZip();
      zip.addFile("database.db", dbBuffer);
      zip.addFile("sha256.txt", Buffer.from(dbHash, "utf8"));

      let vaultIncluded = false;
      let vaultFileCount = 0;
      let vaultSize = 0;
      // Pour le on-close : on inclut TOUJOURS le vault s'il existe (zéro perte)
      if (fs.existsSync(vaultSrc)) {
        const addFolderToZip = (folderPath, zipPathPrefix) => {
          const entries = fs.readdirSync(folderPath, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(folderPath, entry.name);
            const inZip = `${zipPathPrefix}/${entry.name}`;
            if (entry.isDirectory()) {
              addFolderToZip(full, inZip);
            } else {
              const buf = fs.readFileSync(full);
              zip.addFile(inZip, buf);
              vaultFileCount++;
              vaultSize += buf.length;
            }
          }
        };
        addFolderToZip(vaultSrc, "vault");
        vaultIncluded = true;
      }

      const manifest = {
        formatVersion: 1,
        appVersion: app.getVersion(),
        backupId: baseName,
        type: "on-close",
        createdAt: new Date().toISOString(),
        platform: process.platform,
        database: { size: dbBuffer.length, sha256: dbHash, stats: dbStats },
        vault: { included: vaultIncluded, fileCount: vaultFileCount, size: vaultSize },
        settings: { included: false }, // pas de settings côté main process
        logs: { included: false, fileCount: 0 },
      };
      zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
      zip.writeZip(zipPath);

      // Rétention sur les 2 formats
      if (backupOnCloseConfig.retentionCount > 0) {
        const files = fs.readdirSync(backupOnCloseConfig.destinationPath)
          .filter(f => f.startsWith("btp-v16_") && (f.endsWith(".btpbackup") || f.endsWith(".db")))
          .map(f => ({
            path: path.join(backupOnCloseConfig.destinationPath, f),
            isLegacy: f.endsWith(".db"),
            mtime: fs.statSync(path.join(backupOnCloseConfig.destinationPath, f)).mtime,
          }))
          .sort((a, b) => b.mtime - a.mtime);
        for (const f of files.slice(backupOnCloseConfig.retentionCount)) {
          try {
            fs.unlinkSync(f.path);
            if (f.isLegacy) {
              const vp = f.path.replace(/\.db$/, "_vault");
              if (fs.existsSync(vp)) fs.rmSync(vp, { recursive: true, force: true });
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn("[Backup on-close] Erreur:", e.message);
    }
  }
});
