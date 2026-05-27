// ═══════════════════════════════════════════════════════════════════════════
// accountingEngine.js — Moteur de génération automatique des écritures
//                       comptables en partie double.
//
// Selon le mode comptable configuré (engagement | tresorerie), génère ou non
// les écritures à l'émission d'une facture / saisie d'une dépense.
//
//   Mode ENGAGEMENT (norme SARL/SAS) :
//     - Facture (≠ brouillon) : VE → 411 D | 706 + 445710 C
//     - Dépense saisie        : AC → 6xx + 445660 D | 401 C
//     - Encaissement facture  : BQ → 512 D | 411 C  (+ lettrage auto)
//     - Paiement dépense      : BQ → 401 D | 512 C  (+ lettrage)
//
//   Mode TRÉSORERIE (micro/EI) :
//     - Pas d'écriture à l'émission
//     - Encaissement facture  : VE+BQ → 512 D | 706 + 445710 C
//     - Paiement dépense      : AC+BQ → 6xx + 445660 D | 512 C
//
// Toutes les écritures portent un sourceType + sourceId pour pouvoir être
// régénérées de manière idempotente.
// ═══════════════════════════════════════════════════════════════════════════

const { CATEGORY_PCG } = require("./chartOfAccountsSeed");

// ─── Utilitaires ───────────────────────────────────────────────────────────

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() { return new Date().toISOString(); }
function ymd(date) {
  if (!date) return "";
  if (typeof date === "string") return date.slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// ─── Lecture paramètres ────────────────────────────────────────────────────

function getSettings(db) {
  const row = db.prepare("SELECT * FROM accounting_settings WHERE id = 1").get();
  if (!row) return null;
  return row;
}

function getMode(db) {
  const s = getSettings(db);
  return s ? s.mode : "engagement";
}

function isAutoEnabled(db) {
  const s = getSettings(db);
  return s ? !!s.autoGenerateEntries : true;
}

// ─── Comptes auxiliaires ───────────────────────────────────────────────────
//
// Convention : les comptes auxiliaires occupent la plage 411001-411998 (clients)
// et 401001-401998 (fournisseurs). 411000 et 401000 sont les comptes collectifs
// système (parents). 411999 et 401999 sont réservés "divers".
//
// Le numéro suivant est calculé en prenant le MAX dans DEUX sources :
//   1. tiers déjà numérotés (clients.accountNumber / suppliers.accountNumber)
//   2. plan comptable (chart_of_accounts.numero) — pour les saisies manuelles
// On ne réutilise jamais un numéro déjà connu, même si le tiers/compte a été
// supprimé entre temps. Cela garantit l'absence de collision silencieuse.

function nextAuxNumber(db, prefix /* "411" | "401" */) {
  const tiersTable = prefix === "411" ? "clients" : "suppliers";
  const fromTiers = db.prepare(`
    SELECT COALESCE(MAX(CAST(SUBSTR(accountNumber, 4) AS INTEGER)), 0) AS n
    FROM ${tiersTable}
    WHERE accountNumber LIKE ? AND LENGTH(accountNumber) = 6
  `).get(`${prefix}%`).n;
  // On exclut le compte collectif (411000 / 401000) et la plage "divers" (xx999)
  const fromPlan = db.prepare(`
    SELECT COALESCE(MAX(CAST(SUBSTR(numero, 4) AS INTEGER)), 0) AS n
    FROM chart_of_accounts
    WHERE numero LIKE ? AND LENGTH(numero) = 6 AND numero NOT IN (?, ?)
  `).get(`${prefix}%`, `${prefix}000`, `${prefix}999`).n;
  const next = Math.max(fromTiers, fromPlan) + 1;
  if (next > 998) throw new Error(`Plage ${prefix}xxx épuisée (>998 auxiliaires)`);
  return prefix + String(next).padStart(3, "0");
}

// Attribue un numéro auxiliaire séquentiel (411001, 411002...) à un tiers
// s'il n'en a pas déjà un. Retourne le numéro.
function ensureClientAccountNumber(db, clientId) {
  if (!clientId) return null;
  const row = db.prepare("SELECT id, accountNumber, lastName, firstName, companyName, type FROM clients WHERE id = ?").get(clientId);
  if (!row) return null;
  if (row.accountNumber && row.accountNumber.length >= 6) return row.accountNumber;
  const numero = nextAuxNumber(db, "411");
  const libelle = row.type === "pro" && row.companyName
    ? row.companyName
    : `${row.lastName || ""} ${row.firstName || ""}`.trim() || "Client";
  // Création du compte AVANT mise à jour du tiers : si le compte existe déjà
  // (cas anormal — collision), on lève une erreur plutôt qu'écraser.
  upsertAuxiliaryAccount(db, numero, "411000", libelle);
  db.prepare("UPDATE clients SET accountNumber = ? WHERE id = ?").run(numero, clientId);
  return numero;
}

function ensureSupplierAccountNumber(db, supplierId, fallbackName) {
  if (!supplierId) return null;
  const row = db.prepare("SELECT id, accountNumber, companyName FROM suppliers WHERE id = ?").get(supplierId);
  if (!row) return null;
  if (row.accountNumber && row.accountNumber.length >= 6) return row.accountNumber;
  const numero = nextAuxNumber(db, "401");
  upsertAuxiliaryAccount(db, numero, "401000", row.companyName || fallbackName || "Fournisseur");
  db.prepare("UPDATE suppliers SET accountNumber = ? WHERE id = ?").run(numero, supplierId);
  return numero;
}

// Insère un compte auxiliaire. Si un compte avec ce numéro existe déjà :
//   - et qu'il n'est PAS un compte auxiliaire (isAuxiliary=0) → ERREUR
//     (refus d'écraser un compte du plan comptable manuel ou système)
//   - et qu'il est auxiliaire avec un libellé différent → mise à jour libellé
function upsertAuxiliaryAccount(db, numero, parentNumero, libelle) {
  const existing = db.prepare("SELECT numero, isAuxiliary, isLocked FROM chart_of_accounts WHERE numero = ?").get(numero);
  if (existing && (!existing.isAuxiliary || existing.isLocked)) {
    throw new Error(`Conflit : le compte ${numero} existe déjà comme compte non-auxiliaire`);
  }
  const now = nowIso();
  if (existing) {
    db.prepare("UPDATE chart_of_accounts SET libelle = ?, updatedAt = ? WHERE numero = ?").run(libelle, now, numero);
  } else {
    db.prepare(`
      INSERT INTO chart_of_accounts
        (numero, libelle, classe, type, nature, parentNumero, isAuxiliary, isLocked, createdAt, updatedAt)
      VALUES (?, ?, 4, ?, 'detail', ?, 1, 0, ?, ?)
    `).run(numero, libelle, parentNumero.startsWith("411") ? "actif" : "passif", parentNumero, now, now);
  }
}

// ─── Numérotation d'écritures ──────────────────────────────────────────────

function nextEntryNumero(db, journalCode, year) {
  const row = db.prepare(`
    SELECT COALESCE(MAX(numero), 0) + 1 AS n
    FROM journal_entries
    WHERE journalCode = ? AND exerciceYear = ?
  `).get(journalCode, year);
  return row.n || 1;
}

// ─── Insertion d'une écriture ──────────────────────────────────────────────

function insertEntry(db, entry, lines) {
  // Validation partie double
  const totalDebit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}`);
  }

  const id = entry.id || generateId("je");
  const now = nowIso();
  const year = parseInt((entry.date || "").slice(0, 4), 10) || new Date().getFullYear();
  const numero = entry.numero || nextEntryNumero(db, entry.journalCode, year);

  db.prepare(`
    INSERT INTO journal_entries (
      id, journalCode, numero, date, dateValidation, libelle,
      pieceRef, pieceDate, sourceType, sourceId, exerciceYear,
      isLocked, isReversed, reversedById, createdAt, updatedAt
    ) VALUES (
      @id, @journalCode, @numero, @date, @dateValidation, @libelle,
      @pieceRef, @pieceDate, @sourceType, @sourceId, @exerciceYear,
      0, 0, '', @now, @now
    )
  `).run({
    id,
    journalCode: entry.journalCode,
    numero,
    date: entry.date,
    dateValidation: entry.dateValidation || entry.date,
    libelle: entry.libelle || "",
    pieceRef: entry.pieceRef || "",
    pieceDate: entry.pieceDate || entry.date,
    sourceType: entry.sourceType || "manual",
    sourceId: entry.sourceId || "",
    exerciceYear: year,
    now,
  });

  const insLine = db.prepare(`
    INSERT INTO journal_lines (
      id, entryId, compteNum, compAuxNum, compAuxLib, libelle,
      debit, credit, lettrage, dateLettrage, ordre
    ) VALUES (@id, @entryId, @compteNum, @compAuxNum, @compAuxLib, @libelle,
              @debit, @credit, '', '', @ordre)
  `);
  let i = 0;
  for (const l of lines) {
    insLine.run({
      id: generateId("jl"),
      entryId: id,
      compteNum: l.compteNum,
      compAuxNum: l.compAuxNum || "",
      compAuxLib: l.compAuxLib || "",
      libelle: l.libelle || entry.libelle || "",
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0),
      ordre: i++,
    });
  }
  return { id, numero };
}

// Supprime toutes les écritures liées à une source (idempotence)
function deleteEntriesForSource(db, sourceType, sourceId) {
  if (!sourceId) return;
  const rows = db.prepare("SELECT id FROM journal_entries WHERE sourceType = ? AND sourceId = ? AND isLocked = 0").all(sourceType, sourceId);
  const ids = rows.map(r => r.id);
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`DELETE FROM journal_lines WHERE entryId IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM journal_entries WHERE id IN (${placeholders})`).run(...ids);
}

// ─── Génération des écritures par source ───────────────────────────────────

// FACTURE — mode engagement uniquement
function generateInvoiceEntry(db, invoiceId) {
  if (!isAutoEnabled(db)) return null;
  const mode = getMode(db);
  if (mode !== "engagement") {
    // En trésorerie : pas d'écriture à l'émission, on supprime si existante
    deleteEntriesForSource(db, "invoice", invoiceId);
    return null;
  }

  const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  if (!inv) return null;
  if (inv.status === "brouillon" || inv.status === "annulee") {
    deleteEntriesForSource(db, "invoice", invoiceId);
    return null;
  }
  // Idempotent : on supprime puis on recrée
  deleteEntriesForSource(db, "invoice", invoiceId);

  const totalTtc = round2(inv.totalTTC);
  const totalHt = round2(inv.totalHT);
  const totalVat = round2(totalTtc - totalHt);
  if (totalTtc === 0) return null;

  const date = ymd(inv.issueDate) || ymd(inv.createdAt);
  const clientAccount = ensureClientAccountNumber(db, inv.clientId) || "411000";
  const clientName = getClientName(db, inv.clientId);
  const isAvoir = inv.type === "avoir";
  const sign = isAvoir ? -1 : 1;

  const lines = [
    {
      compteNum: clientAccount,
      compAuxNum: clientAccount,
      compAuxLib: clientName,
      libelle: `Facture ${inv.reference}`,
      debit: sign > 0 ? totalTtc : 0,
      credit: sign < 0 ? totalTtc : 0,
    },
    {
      compteNum: "706000",
      libelle: `Facture ${inv.reference}`,
      debit: sign < 0 ? totalHt : 0,
      credit: sign > 0 ? totalHt : 0,
    },
  ];
  if (totalVat !== 0) {
    lines.push({
      compteNum: "445710",
      libelle: `TVA collectée - ${inv.reference}`,
      debit: sign < 0 ? totalVat : 0,
      credit: sign > 0 ? totalVat : 0,
    });
  }

  return insertEntry(db, {
    journalCode: "VE",
    date,
    libelle: `${isAvoir ? "Avoir" : "Facture"} ${inv.reference} - ${clientName}`,
    pieceRef: inv.reference,
    pieceDate: date,
    sourceType: "invoice",
    sourceId: invoiceId,
  }, lines);
}

// DÉPENSE — mode engagement uniquement
function generateExpenseEntry(db, expenseId) {
  if (!isAutoEnabled(db)) return null;
  const mode = getMode(db);
  if (mode !== "engagement") {
    deleteEntriesForSource(db, "expense", expenseId);
    return null;
  }

  const exp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId);
  if (!exp) return null;
  if (exp.status === "annulee") {
    deleteEntriesForSource(db, "expense", expenseId);
    return null;
  }
  deleteEntriesForSource(db, "expense", expenseId);

  const totalHt = round2(exp.amountHt);
  const totalVat = round2(exp.amountVat);
  const totalTtc = round2(exp.amountTtc);
  if (totalTtc === 0) return null;

  const date = ymd(exp.expenseDate);
  const pcgAccount = CATEGORY_PCG[exp.category] || "658000";
  const supplierAccount = ensureSupplierAccountNumber(db, exp.supplierId, exp.supplierName) || "401000";
  const supplierName = exp.supplierName || "Fournisseur";

  const lines = [
    {
      compteNum: pcgAccount,
      libelle: exp.description || `Achat ${exp.reference}`,
      debit: totalHt,
      credit: 0,
    },
  ];
  if (totalVat > 0) {
    lines.push({
      compteNum: "445660",
      libelle: `TVA déductible - ${exp.reference}`,
      debit: totalVat,
      credit: 0,
    });
  }
  lines.push({
    compteNum: supplierAccount,
    compAuxNum: supplierAccount,
    compAuxLib: supplierName,
    libelle: `Facture ${exp.reference} - ${supplierName}`,
    debit: 0,
    credit: totalTtc,
  });

  return insertEntry(db, {
    journalCode: "AC",
    date,
    libelle: `Achat ${exp.reference} - ${supplierName}`,
    pieceRef: exp.reference,
    pieceDate: date,
    sourceType: "expense",
    sourceId: expenseId,
  }, lines);
}

// PAIEMENT FACTURE — selon mode
function generateInvoicePaymentEntry(db, paymentId) {
  if (!isAutoEnabled(db)) return null;
  const pay = db.prepare("SELECT * FROM invoice_payments WHERE id = ?").get(paymentId);
  if (!pay) return null;
  const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(pay.invoiceId);
  if (!inv) return null;

  deleteEntriesForSource(db, "invoice_payment", paymentId);

  const mode = getMode(db);
  const date = ymd(pay.date);
  const amount = round2(pay.amount);
  if (amount === 0) return null;

  const bankAccount = bankAccountForMethod(pay.method);
  const clientName = getClientName(db, inv.clientId);
  const clientAccount = ensureClientAccountNumber(db, inv.clientId) || "411000";

  if (mode === "engagement") {
    // BQ : 512 D | 411 C
    const lines = [
      {
        compteNum: bankAccount,
        libelle: `Encaissement ${inv.reference}`,
        debit: amount,
        credit: 0,
      },
      {
        compteNum: clientAccount,
        compAuxNum: clientAccount,
        compAuxLib: clientName,
        libelle: `Encaissement ${inv.reference}`,
        debit: 0,
        credit: amount,
      },
    ];
    return insertEntry(db, {
      journalCode: bankAccount === "530000" ? "CA" : "BQ",
      date,
      libelle: `Encaissement facture ${inv.reference} - ${clientName}`,
      pieceRef: inv.reference,
      pieceDate: date,
      sourceType: "invoice_payment",
      sourceId: paymentId,
    }, lines);
  } else {
    // Trésorerie : VE+BQ → 512 D | 706 C + 445710 C (prorata)
    const totalTtc = round2(inv.totalTTC);
    const totalHt = round2(inv.totalHT);
    const totalVat = round2(totalTtc - totalHt);
    const ratio = totalTtc > 0 ? amount / totalTtc : 1;
    const htPart = round2(totalHt * ratio);
    const vatPart = round2(amount - htPart);

    const lines = [
      { compteNum: bankAccount, libelle: `Encaissement ${inv.reference}`, debit: amount, credit: 0 },
      { compteNum: "706000",   libelle: `Vente ${inv.reference}`,         debit: 0, credit: htPart },
    ];
    if (vatPart !== 0) {
      lines.push({ compteNum: "445710", libelle: `TVA collectée ${inv.reference}`, debit: 0, credit: vatPart });
    }
    return insertEntry(db, {
      journalCode: bankAccount === "530000" ? "CA" : "BQ",
      date,
      libelle: `Encaissement facture ${inv.reference} - ${clientName}`,
      pieceRef: inv.reference,
      pieceDate: date,
      sourceType: "invoice_payment",
      sourceId: paymentId,
    }, lines);
  }
}

// PAIEMENT DÉPENSE — selon mode
function generateExpensePaymentEntry(db, expenseId) {
  if (!isAutoEnabled(db)) return null;
  const exp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId);
  if (!exp) return null;
  if (exp.status !== "payee" || !exp.paidDate) {
    deleteEntriesForSource(db, "expense_payment", expenseId);
    return null;
  }

  deleteEntriesForSource(db, "expense_payment", expenseId);

  const mode = getMode(db);
  const date = ymd(exp.paidDate);
  const amount = round2(exp.amountTtc);
  if (amount === 0) return null;

  const bankAccount = bankAccountForMethod(exp.paymentMethod);
  const supplierAccount = ensureSupplierAccountNumber(db, exp.supplierId, exp.supplierName) || "401000";
  const supplierName = exp.supplierName || "Fournisseur";

  if (mode === "engagement") {
    // BQ : 401 D | 512 C
    const lines = [
      {
        compteNum: supplierAccount,
        compAuxNum: supplierAccount,
        compAuxLib: supplierName,
        libelle: `Règlement ${exp.reference}`,
        debit: amount,
        credit: 0,
      },
      {
        compteNum: bankAccount,
        libelle: `Règlement ${exp.reference}`,
        debit: 0,
        credit: amount,
      },
    ];
    return insertEntry(db, {
      journalCode: bankAccount === "530000" ? "CA" : "BQ",
      date,
      libelle: `Règlement ${exp.reference} - ${supplierName}`,
      pieceRef: exp.reference,
      pieceDate: date,
      sourceType: "expense_payment",
      sourceId: expenseId,
    }, lines);
  } else {
    // Trésorerie : AC+BQ → 6xx + 445660 D | 512 C
    const pcgAccount = CATEGORY_PCG[exp.category] || "658000";
    const totalHt = round2(exp.amountHt);
    const totalVat = round2(exp.amountVat);
    const lines = [
      { compteNum: pcgAccount, libelle: exp.description || `Achat ${exp.reference}`, debit: totalHt, credit: 0 },
    ];
    if (totalVat > 0) {
      lines.push({ compteNum: "445660", libelle: `TVA déductible ${exp.reference}`, debit: totalVat, credit: 0 });
    }
    lines.push({ compteNum: bankAccount, libelle: `Règlement ${exp.reference}`, debit: 0, credit: amount });
    return insertEntry(db, {
      journalCode: bankAccount === "530000" ? "CA" : "BQ",
      date,
      libelle: `Achat/règlement ${exp.reference} - ${supplierName}`,
      pieceRef: exp.reference,
      pieceDate: date,
      sourceType: "expense_payment",
      sourceId: expenseId,
    }, lines);
  }
}

// ─── Helpers internes ──────────────────────────────────────────────────────

function bankAccountForMethod(method) {
  if (method === "espece") return "530000";
  if (method === "cheque") return "514000";
  return "512000";
}

function getClientName(db, clientId) {
  if (!clientId) return "Client";
  const row = db.prepare("SELECT firstName, lastName, companyName, type FROM clients WHERE id = ?").get(clientId);
  if (!row) return "Client";
  if (row.type === "pro" && row.companyName) return row.companyName;
  return `${row.lastName || ""} ${row.firstName || ""}`.trim() || "Client";
}

// ─── Régénération massive (migration historique) ──────────────────────────

function regenerateAll(db) {
  const results = { invoices: 0, expenses: 0, invoicePayments: 0, expensePayments: 0, errors: [] };

  // 1) Purge complète des écritures auto (on garde les manuelles)
  const autoSources = ["invoice", "expense", "invoice_payment", "expense_payment"];
  const placeholders = autoSources.map(() => "?").join(",");
  const oldIds = db.prepare(`SELECT id FROM journal_entries WHERE sourceType IN (${placeholders}) AND isLocked = 0`).all(...autoSources).map(r => r.id);
  if (oldIds.length) {
    const ph = oldIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM journal_lines WHERE entryId IN (${ph})`).run(...oldIds);
    db.prepare(`DELETE FROM journal_entries WHERE id IN (${ph})`).run(...oldIds);
  }

  // 2) Factures
  const invoices = db.prepare("SELECT id FROM invoices WHERE status != 'brouillon' AND status != 'annulee' ORDER BY issueDate").all();
  for (const inv of invoices) {
    try { if (generateInvoiceEntry(db, inv.id)) results.invoices++; }
    catch (e) { results.errors.push(`Facture ${inv.id}: ${e.message}`); }
  }

  // 3) Dépenses
  const expenses = db.prepare("SELECT id FROM expenses WHERE status != 'annulee' ORDER BY expenseDate").all();
  for (const exp of expenses) {
    try { if (generateExpenseEntry(db, exp.id)) results.expenses++; }
    catch (e) { results.errors.push(`Dépense ${exp.id}: ${e.message}`); }
  }

  // 4) Paiements factures
  const payments = db.prepare("SELECT id FROM invoice_payments ORDER BY date").all();
  for (const p of payments) {
    try { if (generateInvoicePaymentEntry(db, p.id)) results.invoicePayments++; }
    catch (e) { results.errors.push(`Paiement facture ${p.id}: ${e.message}`); }
  }

  // 5) Paiements dépenses (status payee)
  const paidExpenses = db.prepare("SELECT id FROM expenses WHERE status = 'payee' AND paidDate != '' ORDER BY paidDate").all();
  for (const e of paidExpenses) {
    try { if (generateExpensePaymentEntry(db, e.id)) results.expensePayments++; }
    catch (err) { results.errors.push(`Règlement dépense ${e.id}: ${err.message}`); }
  }

  return results;
}

// ─── Lettrage automatique ──────────────────────────────────────────────────
//
// Lettre les écritures d'un compte auxiliaire (411xxx ou 401xxx) qui
// s'équilibrent débit/crédit sur une même pièce.
// Code de lettrage : A, B, C... AA, AB, ... (séquentiel par compte).

function nextLetter(prev) {
  if (!prev) return "A";
  let s = prev;
  let i = s.length - 1;
  const chars = s.split("");
  while (i >= 0) {
    if (chars[i] === "Z") {
      chars[i] = "A";
      if (i === 0) return "A" + chars.join("");
      i--;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
  }
  return "A".repeat(s.length + 1);
}

function autoLettrer(db, compteAuxNum) {
  // Lettre par pièce (pieceRef) pour les comptes auxiliaires
  // Pour chaque pieceRef, si Σ débits = Σ crédits, attribuer un code
  const rows = db.prepare(`
    SELECT jl.id, jl.debit, jl.credit, je.pieceRef
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entryId
    WHERE jl.compAuxNum = ? AND jl.lettrage = '' AND je.pieceRef != ''
    ORDER BY je.date, je.id
  `).all(compteAuxNum);

  // Grouper par pieceRef
  const byPiece = {};
  for (const r of rows) {
    if (!byPiece[r.pieceRef]) byPiece[r.pieceRef] = [];
    byPiece[r.pieceRef].push(r);
  }

  // Dernier code utilisé pour ce compte
  const lastRow = db.prepare(`
    SELECT lettrage FROM journal_lines
    WHERE compAuxNum = ? AND lettrage != ''
    ORDER BY lettrage DESC LIMIT 1
  `).get(compteAuxNum);
  let currentLetter = lastRow ? lastRow.lettrage : "";

  const today = ymd(new Date());
  const upd = db.prepare("UPDATE journal_lines SET lettrage = ?, dateLettrage = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const piece of Object.keys(byPiece)) {
      const lines = byPiece[piece];
      const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
      const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
      if (Math.abs(totalDebit - totalCredit) <= 0.01 && lines.length >= 2) {
        currentLetter = nextLetter(currentLetter);
        for (const l of lines) upd.run(currentLetter, today, l.id);
      }
    }
  });
  tx();
}

// Lance le lettrage sur tous les comptes auxiliaires touchés
function autoLettrerAll(db) {
  const accounts = db.prepare(`
    SELECT DISTINCT compAuxNum FROM journal_lines
    WHERE compAuxNum != ''
  `).all();
  for (const a of accounts) autoLettrer(db, a.compAuxNum);
}

module.exports = {
  // génération
  generateInvoiceEntry,
  generateExpenseEntry,
  generateInvoicePaymentEntry,
  generateExpensePaymentEntry,
  deleteEntriesForSource,
  regenerateAll,
  // lettrage
  autoLettrer,
  autoLettrerAll,
  // helpers
  ensureClientAccountNumber,
  ensureSupplierAccountNumber,
  upsertAuxiliaryAccount,
  getSettings,
  getMode,
  isAutoEnabled,
};
