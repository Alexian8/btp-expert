// ═══════════════════════════════════════════════════════════════════════════
// Moteur compta partie double — version serveur MySQL.
// Port du apps/desktop/electron/accountingEngine.js
// ═══════════════════════════════════════════════════════════════════════════

import type { DB as Pool, RowDataPacket } from "../db";
import { CATEGORY_PCG } from "./seed";

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ymd(date: string | Date | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string") return date.slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ─── Paramètres ───────────────────────────────────────────────────────────

export interface AccountingSettingsRow {
  id: number;
  mode: string;
  modeChosenAt: string;
  exerciceStart: string;
  fiscalYear: number;
  lastLockedDate: string;
  defaultVatRegime: string;
  autoGenerateEntries: number;
}

export async function getSettings(db: Pool): Promise<AccountingSettingsRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM accounting_settings WHERE id = 1"
  );
  return (rows[0] as AccountingSettingsRow) || null;
}

async function getMode(db: Pool): Promise<string> {
  const s = await getSettings(db);
  return s ? s.mode : "engagement";
}

async function isAutoEnabled(db: Pool): Promise<boolean> {
  const s = await getSettings(db);
  return s ? !!s.autoGenerateEntries : true;
}

// ─── Comptes auxiliaires ──────────────────────────────────────────────────

async function nextAuxNumber(db: Pool, prefix: "411" | "401"): Promise<string> {
  const tiersTable = prefix === "411" ? "clients" : "suppliers";
  const [tRows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(accountNumber, 4) AS UNSIGNED)), 0) AS n
     FROM \`${tiersTable}\`
     WHERE accountNumber LIKE ? AND CHAR_LENGTH(accountNumber) = 6`,
    [`${prefix}%`]
  );
  const fromTiers = Number((tRows[0] as { n: number }).n);
  const [pRows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(numero, 4) AS UNSIGNED)), 0) AS n
     FROM chart_of_accounts
     WHERE numero LIKE ? AND CHAR_LENGTH(numero) = 6 AND numero NOT IN (?, ?)`,
    [`${prefix}%`, `${prefix}000`, `${prefix}999`]
  );
  const fromPlan = Number((pRows[0] as { n: number }).n);
  const next = Math.max(fromTiers, fromPlan) + 1;
  if (next > 998) throw new Error(`Plage ${prefix}xxx épuisée (>998 auxiliaires)`);
  return prefix + String(next).padStart(3, "0");
}

async function upsertAuxiliaryAccount(
  db: Pool,
  numero: string,
  parentNumero: string,
  libelle: string
): Promise<void> {
  const [existRows] = await db.query<RowDataPacket[]>(
    "SELECT numero, isAuxiliary, isLocked FROM chart_of_accounts WHERE numero = ?",
    [numero]
  );
  const existing = existRows[0] as { numero: string; isAuxiliary: number; isLocked: number } | undefined;
  if (existing && (!existing.isAuxiliary || existing.isLocked)) {
    throw new Error(`Conflit : le compte ${numero} existe déjà comme compte non-auxiliaire`);
  }
  if (existing) {
    await db.query("UPDATE chart_of_accounts SET libelle = ? WHERE numero = ?", [libelle, numero]);
  } else {
    const type = parentNumero.startsWith("411") ? "actif" : "passif";
    await db.query(
      `INSERT INTO chart_of_accounts
         (numero, libelle, classe, type, nature, parentNumero, isAuxiliary, isLocked)
       VALUES (?, ?, 4, ?, 'detail', ?, 1, 0)`,
      [numero, libelle, type, parentNumero]
    );
  }
}

export async function ensureClientAccountNumber(
  db: Pool,
  clientId: string
): Promise<string | null> {
  if (!clientId) return null;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, accountNumber, lastName, firstName, companyName, type FROM clients WHERE id = ?",
    [clientId]
  );
  const row = rows[0] as
    | { id: string; accountNumber?: string; lastName?: string; firstName?: string; companyName?: string; type?: string }
    | undefined;
  if (!row) return null;
  if (row.accountNumber && row.accountNumber.length >= 6) return row.accountNumber;
  const numero = await nextAuxNumber(db, "411");
  const libelle = row.type === "pro" && row.companyName
    ? row.companyName
    : `${row.lastName || ""} ${row.firstName || ""}`.trim() || "Client";
  await upsertAuxiliaryAccount(db, numero, "411000", libelle);
  await db.query("UPDATE clients SET accountNumber = ? WHERE id = ?", [numero, clientId]);
  return numero;
}

export async function ensureSupplierAccountNumber(
  db: Pool,
  supplierId: string,
  fallbackName?: string
): Promise<string | null> {
  if (!supplierId) return null;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, accountNumber, companyName FROM suppliers WHERE id = ?",
    [supplierId]
  );
  const row = rows[0] as { id: string; accountNumber?: string; companyName?: string } | undefined;
  if (!row) return null;
  if (row.accountNumber && row.accountNumber.length >= 6) return row.accountNumber;
  const numero = await nextAuxNumber(db, "401");
  await upsertAuxiliaryAccount(
    db,
    numero,
    "401000",
    row.companyName || fallbackName || "Fournisseur"
  );
  await db.query("UPDATE suppliers SET accountNumber = ? WHERE id = ?", [numero, supplierId]);
  return numero;
}

async function getClientName(db: Pool, clientId: string): Promise<string> {
  if (!clientId) return "Client";
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT firstName, lastName, companyName, type FROM clients WHERE id = ?",
    [clientId]
  );
  const r = rows[0] as { firstName?: string; lastName?: string; companyName?: string; type?: string } | undefined;
  if (!r) return "Client";
  if (r.type === "pro" && r.companyName) return r.companyName;
  return `${r.lastName || ""} ${r.firstName || ""}`.trim() || "Client";
}

// ─── Insertion d'écritures ────────────────────────────────────────────────

interface EntryHeader {
  id?: string;
  numero?: number;
  journalCode: string;
  date: string;
  dateValidation?: string;
  libelle: string;
  pieceRef?: string;
  pieceDate?: string;
  sourceType: string;
  sourceId: string;
}

interface LineInput {
  compteNum: string;
  compAuxNum?: string;
  compAuxLib?: string;
  libelle?: string;
  debit: number;
  credit: number;
}

async function nextEntryNumero(db: Pool, journalCode: string, year: number): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS n
     FROM journal_entries WHERE journalCode = ? AND exerciceYear = ?`,
    [journalCode, year]
  );
  return Number((rows[0] as { n: number }).n) || 1;
}

async function insertEntry(db: Pool, entry: EntryHeader, lines: LineInput[]): Promise<{ id: string; numero: number }> {
  const totalDebit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}`);
  }
  const id = entry.id || genId("je");
  const year = parseInt(entry.date.slice(0, 4), 10) || new Date().getFullYear();
  const numero = entry.numero || (await nextEntryNumero(db, entry.journalCode, year));

  await db.query(
    `INSERT INTO journal_entries (
      id, journalCode, numero, \`date\`, dateValidation, libelle,
      pieceRef, pieceDate, sourceType, sourceId, exerciceYear,
      isLocked, isReversed, reversedById
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '')`,
    [
      id,
      entry.journalCode,
      numero,
      entry.date,
      entry.dateValidation || entry.date,
      entry.libelle || "",
      entry.pieceRef || "",
      entry.pieceDate || entry.date,
      entry.sourceType || "manual",
      entry.sourceId || "",
      year,
    ]
  );

  let ordre = 0;
  for (const l of lines) {
    await db.query(
      `INSERT INTO journal_lines
        (id, entryId, compteNum, compAuxNum, compAuxLib, libelle, debit, credit, lettrage, dateLettrage, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)`,
      [
        genId("jl"),
        id,
        l.compteNum,
        l.compAuxNum || "",
        l.compAuxLib || "",
        l.libelle || entry.libelle || "",
        round2(l.debit || 0),
        round2(l.credit || 0),
        ordre++,
      ]
    );
  }
  return { id, numero };
}

export async function deleteEntriesForSource(
  db: Pool,
  sourceType: string,
  sourceId: string
): Promise<void> {
  if (!sourceId) return;
  await db.query(
    `DELETE FROM journal_entries WHERE sourceType = ? AND sourceId = ? AND isLocked = 0`,
    [sourceType, sourceId]
  );
  // CASCADE supprime les journal_lines via FK
}

// ─── Génération d'écritures par source ────────────────────────────────────

function bankAccountForMethod(method: string | undefined): string {
  if (method === "espece" || method === "especes") return "530000";
  if (method === "cheque") return "514000";
  return "512000";
}

export async function generateInvoiceEntry(db: Pool, invoiceId: string): Promise<void> {
  if (!(await isAutoEnabled(db))) return;
  const mode = await getMode(db);
  if (mode !== "engagement") {
    await deleteEntriesForSource(db, "invoice", invoiceId);
    return;
  }
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
  const inv = rows[0] as
    | { id: string; status: string; type?: string; reference: string; clientId: string; issueDate: string; createdAt: string; totalTTC: number; totalHT: number }
    | undefined;
  if (!inv) return;
  if (inv.status === "brouillon" || inv.status === "annulee") {
    await deleteEntriesForSource(db, "invoice", invoiceId);
    return;
  }
  await deleteEntriesForSource(db, "invoice", invoiceId);

  const totalTtc = round2(Number(inv.totalTTC));
  const totalHt = round2(Number(inv.totalHT));
  const totalVat = round2(totalTtc - totalHt);
  if (totalTtc === 0) return;

  const date = ymd(inv.issueDate) || ymd(inv.createdAt);
  const clientAccount = (await ensureClientAccountNumber(db, inv.clientId)) || "411000";
  const clientName = await getClientName(db, inv.clientId);
  const isAvoir = inv.type === "avoir";
  const sign = isAvoir ? -1 : 1;

  const lines: LineInput[] = [
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
  await insertEntry(
    db,
    {
      journalCode: "VE",
      date,
      libelle: `${isAvoir ? "Avoir" : "Facture"} ${inv.reference} - ${clientName}`,
      pieceRef: inv.reference,
      pieceDate: date,
      sourceType: "invoice",
      sourceId: invoiceId,
    },
    lines
  );
}

export async function generateExpenseEntry(db: Pool, expenseId: string): Promise<void> {
  if (!(await isAutoEnabled(db))) return;
  const mode = await getMode(db);
  if (mode !== "engagement") {
    await deleteEntriesForSource(db, "expense", expenseId);
    return;
  }
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM expenses WHERE id = ?", [expenseId]);
  const exp = rows[0] as
    | { id: string; status: string; reference: string; supplierId: string; supplierName: string; category: string; description: string; amountHt: number; amountVat: number; amountTtc: number; expenseDate: string }
    | undefined;
  if (!exp) return;
  if (exp.status === "annulee") {
    await deleteEntriesForSource(db, "expense", expenseId);
    return;
  }
  await deleteEntriesForSource(db, "expense", expenseId);

  const totalHt = round2(Number(exp.amountHt));
  const totalVat = round2(Number(exp.amountVat));
  const totalTtc = round2(Number(exp.amountTtc));
  if (totalTtc === 0) return;

  const date = ymd(exp.expenseDate);
  const pcgAccount = CATEGORY_PCG[exp.category] || "658000";
  const supplierAccount =
    (await ensureSupplierAccountNumber(db, exp.supplierId, exp.supplierName)) || "401000";
  const supplierName = exp.supplierName || "Fournisseur";

  const lines: LineInput[] = [
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
  await insertEntry(
    db,
    {
      journalCode: "AC",
      date,
      libelle: `Achat ${exp.reference} - ${supplierName}`,
      pieceRef: exp.reference,
      pieceDate: date,
      sourceType: "expense",
      sourceId: expenseId,
    },
    lines
  );
}

export async function generateInvoicePaymentEntry(db: Pool, paymentId: string): Promise<void> {
  if (!(await isAutoEnabled(db))) return;
  const [pRows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM invoice_payments WHERE id = ?",
    [paymentId]
  );
  const pay = pRows[0] as { id: string; invoiceId: string; amount: number; date: string; method: string } | undefined;
  if (!pay) return;
  const [iRows] = await db.query<RowDataPacket[]>("SELECT * FROM invoices WHERE id = ?", [pay.invoiceId]);
  const inv = iRows[0] as { id: string; reference: string; clientId: string; totalTTC: number; totalHT: number } | undefined;
  if (!inv) return;

  await deleteEntriesForSource(db, "invoice_payment", paymentId);

  const mode = await getMode(db);
  const date = ymd(pay.date);
  const amount = round2(Number(pay.amount));
  if (amount === 0) return;

  const bankAccount = bankAccountForMethod(pay.method);
  const clientName = await getClientName(db, inv.clientId);
  const clientAccount = (await ensureClientAccountNumber(db, inv.clientId)) || "411000";

  if (mode === "engagement") {
    await insertEntry(
      db,
      {
        journalCode: bankAccount === "530000" ? "CA" : "BQ",
        date,
        libelle: `Encaissement facture ${inv.reference} - ${clientName}`,
        pieceRef: inv.reference,
        pieceDate: date,
        sourceType: "invoice_payment",
        sourceId: paymentId,
      },
      [
        { compteNum: bankAccount, libelle: `Encaissement ${inv.reference}`, debit: amount, credit: 0 },
        {
          compteNum: clientAccount,
          compAuxNum: clientAccount,
          compAuxLib: clientName,
          libelle: `Encaissement ${inv.reference}`,
          debit: 0,
          credit: amount,
        },
      ]
    );
  } else {
    const totalTtc = round2(Number(inv.totalTTC));
    const totalHt = round2(Number(inv.totalHT));
    const ratio = totalTtc > 0 ? amount / totalTtc : 1;
    const htPart = round2(totalHt * ratio);
    const vatPart = round2(amount - htPart);
    const lines: LineInput[] = [
      { compteNum: bankAccount, libelle: `Encaissement ${inv.reference}`, debit: amount, credit: 0 },
      { compteNum: "706000", libelle: `Vente ${inv.reference}`, debit: 0, credit: htPart },
    ];
    if (vatPart !== 0) {
      lines.push({ compteNum: "445710", libelle: `TVA collectée ${inv.reference}`, debit: 0, credit: vatPart });
    }
    await insertEntry(
      db,
      {
        journalCode: bankAccount === "530000" ? "CA" : "BQ",
        date,
        libelle: `Encaissement facture ${inv.reference} - ${clientName}`,
        pieceRef: inv.reference,
        pieceDate: date,
        sourceType: "invoice_payment",
        sourceId: paymentId,
      },
      lines
    );
  }
}

export async function generateExpensePaymentEntry(db: Pool, expenseId: string): Promise<void> {
  if (!(await isAutoEnabled(db))) return;
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM expenses WHERE id = ?", [expenseId]);
  const exp = rows[0] as
    | { id: string; status: string; paidDate: string; reference: string; supplierId: string; supplierName: string; category: string; description: string; amountHt: number; amountVat: number; amountTtc: number; paymentMethod: string }
    | undefined;
  if (!exp) return;
  if (exp.status !== "payee" || !exp.paidDate) {
    await deleteEntriesForSource(db, "expense_payment", expenseId);
    return;
  }
  await deleteEntriesForSource(db, "expense_payment", expenseId);

  const mode = await getMode(db);
  const date = ymd(exp.paidDate);
  const amount = round2(Number(exp.amountTtc));
  if (amount === 0) return;

  const bankAccount = bankAccountForMethod(exp.paymentMethod);
  const supplierAccount =
    (await ensureSupplierAccountNumber(db, exp.supplierId, exp.supplierName)) || "401000";
  const supplierName = exp.supplierName || "Fournisseur";

  if (mode === "engagement") {
    await insertEntry(
      db,
      {
        journalCode: bankAccount === "530000" ? "CA" : "BQ",
        date,
        libelle: `Règlement ${exp.reference} - ${supplierName}`,
        pieceRef: exp.reference,
        pieceDate: date,
        sourceType: "expense_payment",
        sourceId: expenseId,
      },
      [
        {
          compteNum: supplierAccount,
          compAuxNum: supplierAccount,
          compAuxLib: supplierName,
          libelle: `Règlement ${exp.reference}`,
          debit: amount,
          credit: 0,
        },
        { compteNum: bankAccount, libelle: `Règlement ${exp.reference}`, debit: 0, credit: amount },
      ]
    );
  } else {
    const pcgAccount = CATEGORY_PCG[exp.category] || "658000";
    const totalHt = round2(Number(exp.amountHt));
    const totalVat = round2(Number(exp.amountVat));
    const lines: LineInput[] = [
      { compteNum: pcgAccount, libelle: exp.description || `Achat ${exp.reference}`, debit: totalHt, credit: 0 },
    ];
    if (totalVat > 0) {
      lines.push({ compteNum: "445660", libelle: `TVA déductible ${exp.reference}`, debit: totalVat, credit: 0 });
    }
    lines.push({ compteNum: bankAccount, libelle: `Règlement ${exp.reference}`, debit: 0, credit: amount });
    await insertEntry(
      db,
      {
        journalCode: bankAccount === "530000" ? "CA" : "BQ",
        date,
        libelle: `Achat/règlement ${exp.reference} - ${supplierName}`,
        pieceRef: exp.reference,
        pieceDate: date,
        sourceType: "expense_payment",
        sourceId: expenseId,
      },
      lines
    );
  }
}

// ─── Notes de frais ──────────────────────────────────────────────────────
//   - status 'validee'/'remboursee'/'refacturee' → écriture AC :
//       6xx + 4456 D | 108 (dirigeant) ou 421 (employé) C
//   - status 'remboursee' + reimbursedDate → écriture BQ :
//       108/421 D | 512 C

function payerCompte(payerType?: string): string {
  return payerType === "employe" ? "421000" : "108000";
}

export async function generateExpenseNoteEntry(db: Pool, noteId: string): Promise<void> {
  if (!(await isAutoEnabled(db))) return;
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM expense_notes WHERE id = ?", [noteId]);
  const note = rows[0] as
    | { id: string; status: string; reference: string; payerType?: string; payerName?: string; category: string; description?: string; amountHt: number; amountVat: number; amountTtc: number; expenseDate: string; createdAt: string }
    | undefined;
  if (!note) return;
  await deleteEntriesForSource(db, "expense_note", noteId);
  if (note.status === "brouillon") return;

  const totalHt = round2(Number(note.amountHt));
  const totalVat = round2(Number(note.amountVat));
  const totalTtc = round2(Number(note.amountTtc));
  if (totalTtc === 0) return;

  const date = ymd(note.expenseDate) || ymd(note.createdAt);
  const pcgAccount = CATEGORY_PCG[note.category] || "658000";
  const payerAccount = payerCompte(note.payerType);
  const payerLabel = note.payerName || (note.payerType === "employe" ? "Employé" : "Dirigeant");

  const lines: LineInput[] = [
    { compteNum: pcgAccount, libelle: note.description || `Note de frais ${note.reference}`, debit: totalHt, credit: 0 },
  ];
  if (totalVat > 0) {
    lines.push({ compteNum: "445660", libelle: `TVA déductible - ${note.reference}`, debit: totalVat, credit: 0 });
  }
  lines.push({
    compteNum: payerAccount,
    compAuxLib: payerLabel,
    libelle: `Note de frais ${note.reference} - ${payerLabel}`,
    debit: 0,
    credit: totalTtc,
  });

  await insertEntry(db, {
    journalCode: "AC",
    date,
    libelle: `Note de frais ${note.reference} - ${payerLabel}`,
    pieceRef: note.reference,
    pieceDate: date,
    sourceType: "expense_note",
    sourceId: noteId,
  }, lines);
}

export async function generateExpenseNoteRefundEntry(db: Pool, noteId: string): Promise<void> {
  if (!(await isAutoEnabled(db))) return;
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM expense_notes WHERE id = ?", [noteId]);
  const note = rows[0] as
    | { id: string; status: string; reimbursedDate: string; reference: string; payerType?: string; payerName?: string; amountTtc: number }
    | undefined;
  if (!note) return;
  await deleteEntriesForSource(db, "expense_note_refund", noteId);
  if (note.status !== "remboursee" || !note.reimbursedDate) return;

  const amount = round2(Number(note.amountTtc));
  if (amount === 0) return;

  const date = ymd(note.reimbursedDate);
  const payerAccount = payerCompte(note.payerType);
  const payerLabel = note.payerName || (note.payerType === "employe" ? "Employé" : "Dirigeant");

  await insertEntry(db, {
    journalCode: "BQ",
    date,
    libelle: `Remboursement note de frais ${note.reference} - ${payerLabel}`,
    pieceRef: note.reference,
    pieceDate: date,
    sourceType: "expense_note_refund",
    sourceId: noteId,
  }, [
    { compteNum: payerAccount, compAuxLib: payerLabel, libelle: `Remboursement ${note.reference}`, debit: amount, credit: 0 },
    { compteNum: "512000", libelle: `Remboursement ${note.reference}`, debit: 0, credit: amount },
  ]);
}

// ─── Régénération massive ─────────────────────────────────────────────────

export interface RegenerateResult {
  success: boolean;
  invoices: number;
  expenses: number;
  invoicePayments: number;
  expensePayments: number;
  expenseNotes: number;
  expenseNoteRefunds: number;
  errors: string[];
}

export async function regenerateAll(db: Pool): Promise<RegenerateResult> {
  const result: RegenerateResult = {
    success: true,
    invoices: 0,
    expenses: 0,
    invoicePayments: 0,
    expensePayments: 0,
    expenseNotes: 0,
    expenseNoteRefunds: 0,
    errors: [],
  };

  // Purge écritures auto
  await db.query(
    `DELETE FROM journal_entries
     WHERE sourceType IN ('invoice', 'expense', 'invoice_payment', 'expense_payment', 'expense_note', 'expense_note_refund')
       AND isLocked = 0`
  );

  // Factures
  const [invRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM invoices WHERE status != 'brouillon' AND status != 'annulee' ORDER BY issueDate"
  );
  for (const r of invRows) {
    try {
      await generateInvoiceEntry(db, (r as { id: string }).id);
      result.invoices++;
    } catch (e) {
      result.errors.push(`Facture ${(r as { id: string }).id}: ${(e as Error).message}`);
    }
  }

  // Dépenses
  const [expRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM expenses WHERE status != 'annulee' ORDER BY expenseDate"
  );
  for (const r of expRows) {
    try {
      await generateExpenseEntry(db, (r as { id: string }).id);
      result.expenses++;
    } catch (e) {
      result.errors.push(`Dépense ${(r as { id: string }).id}: ${(e as Error).message}`);
    }
  }

  // Paiements factures
  const [payRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM invoice_payments ORDER BY `date`"
  );
  for (const r of payRows) {
    try {
      await generateInvoicePaymentEntry(db, (r as { id: string }).id);
      result.invoicePayments++;
    } catch (e) {
      result.errors.push(`Paiement facture ${(r as { id: string }).id}: ${(e as Error).message}`);
    }
  }

  // Paiements dépenses
  const [paidRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM expenses WHERE status = 'payee' AND paidDate != '' ORDER BY paidDate"
  );
  for (const r of paidRows) {
    try {
      await generateExpensePaymentEntry(db, (r as { id: string }).id);
      result.expensePayments++;
    } catch (e) {
      result.errors.push(`Règlement dépense ${(r as { id: string }).id}: ${(e as Error).message}`);
    }
  }

  // Notes de frais
  const [noteRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM expense_notes WHERE status IN ('validee', 'remboursee', 'refacturee') ORDER BY expenseDate"
  );
  for (const r of noteRows) {
    try {
      await generateExpenseNoteEntry(db, (r as { id: string }).id);
      result.expenseNotes++;
    } catch (e) {
      result.errors.push(`Note de frais ${(r as { id: string }).id}: ${(e as Error).message}`);
    }
  }

  // Remboursements notes de frais
  const [refRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM expense_notes WHERE status = 'remboursee' AND reimbursedDate != '' ORDER BY reimbursedDate"
  );
  for (const r of refRows) {
    try {
      await generateExpenseNoteRefundEntry(db, (r as { id: string }).id);
      result.expenseNoteRefunds++;
    } catch (e) {
      result.errors.push(`Remboursement note ${(r as { id: string }).id}: ${(e as Error).message}`);
    }
  }

  return result;
}

// ─── Lettrage automatique ─────────────────────────────────────────────────

function nextLetter(prev: string): string {
  if (!prev) return "A";
  const chars = prev.split("");
  let i = chars.length - 1;
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
  return "A".repeat(prev.length + 1);
}

export async function autoLettrerAccount(db: Pool, compteAuxNum: string): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT jl.id, jl.debit, jl.credit, je.pieceRef
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entryId
     WHERE jl.compAuxNum = ? AND jl.lettrage = '' AND je.pieceRef != ''
     ORDER BY je.date, je.id`,
    [compteAuxNum]
  );
  const byPiece: Record<string, { id: string; debit: number; credit: number }[]> = {};
  for (const r of rows) {
    const rr = r as { id: string; debit: number; credit: number; pieceRef: string };
    if (!byPiece[rr.pieceRef]) byPiece[rr.pieceRef] = [];
    byPiece[rr.pieceRef].push({ id: rr.id, debit: Number(rr.debit), credit: Number(rr.credit) });
  }
  const [lastRows] = await db.query<RowDataPacket[]>(
    `SELECT lettrage FROM journal_lines
     WHERE compAuxNum = ? AND lettrage != ''
     ORDER BY lettrage DESC LIMIT 1`,
    [compteAuxNum]
  );
  let current = (lastRows[0] as { lettrage?: string } | undefined)?.lettrage || "";
  const today = ymd(new Date());
  for (const piece of Object.keys(byPiece)) {
    const lines = byPiece[piece];
    const td = round2(lines.reduce((s, l) => s + l.debit, 0));
    const tc = round2(lines.reduce((s, l) => s + l.credit, 0));
    if (Math.abs(td - tc) <= 0.01 && lines.length >= 2) {
      current = nextLetter(current);
      for (const l of lines) {
        await db.query(
          "UPDATE journal_lines SET lettrage = ?, dateLettrage = ? WHERE id = ?",
          [current, today, l.id]
        );
      }
    }
  }
}

export async function autoLettrerAll(db: Pool): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT compAuxNum FROM journal_lines WHERE compAuxNum != ''"
  );
  for (const r of rows) {
    await autoLettrerAccount(db, (r as { compAuxNum: string }).compAuxNum);
  }
}
