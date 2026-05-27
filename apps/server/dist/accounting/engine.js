"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Moteur compta partie double — version serveur MySQL.
// Port du apps/desktop/electron/accountingEngine.js
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.ensureClientAccountNumber = ensureClientAccountNumber;
exports.ensureSupplierAccountNumber = ensureSupplierAccountNumber;
exports.deleteEntriesForSource = deleteEntriesForSource;
exports.generateInvoiceEntry = generateInvoiceEntry;
exports.generateExpenseEntry = generateExpenseEntry;
exports.generateInvoicePaymentEntry = generateInvoicePaymentEntry;
exports.generateExpensePaymentEntry = generateExpensePaymentEntry;
exports.generateExpenseNoteEntry = generateExpenseNoteEntry;
exports.generateExpenseNoteRefundEntry = generateExpenseNoteRefundEntry;
exports.regenerateAll = regenerateAll;
exports.autoLettrerAccount = autoLettrerAccount;
exports.autoLettrerAll = autoLettrerAll;
const seed_1 = require("./seed");
function genId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function ymd(date) {
    if (!date)
        return "";
    if (typeof date === "string")
        return date.slice(0, 10);
    return new Date(date).toISOString().slice(0, 10);
}
function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}
async function getSettings(db) {
    const [rows] = await db.query("SELECT * FROM accounting_settings WHERE id = 1");
    return rows[0] || null;
}
async function getMode(db) {
    const s = await getSettings(db);
    return s ? s.mode : "engagement";
}
async function isAutoEnabled(db) {
    const s = await getSettings(db);
    return s ? !!s.autoGenerateEntries : true;
}
// ─── Comptes auxiliaires ──────────────────────────────────────────────────
async function nextAuxNumber(db, prefix) {
    const tiersTable = prefix === "411" ? "clients" : "suppliers";
    const [tRows] = await db.query(`SELECT COALESCE(MAX(CAST(SUBSTR(accountNumber, 4) AS UNSIGNED)), 0) AS n
     FROM \`${tiersTable}\`
     WHERE accountNumber LIKE ? AND CHAR_LENGTH(accountNumber) = 6`, [`${prefix}%`]);
    const fromTiers = Number(tRows[0].n);
    const [pRows] = await db.query(`SELECT COALESCE(MAX(CAST(SUBSTR(numero, 4) AS UNSIGNED)), 0) AS n
     FROM chart_of_accounts
     WHERE numero LIKE ? AND CHAR_LENGTH(numero) = 6 AND numero NOT IN (?, ?)`, [`${prefix}%`, `${prefix}000`, `${prefix}999`]);
    const fromPlan = Number(pRows[0].n);
    const next = Math.max(fromTiers, fromPlan) + 1;
    if (next > 998)
        throw new Error(`Plage ${prefix}xxx épuisée (>998 auxiliaires)`);
    return prefix + String(next).padStart(3, "0");
}
async function upsertAuxiliaryAccount(db, numero, parentNumero, libelle) {
    const [existRows] = await db.query("SELECT numero, isAuxiliary, isLocked FROM chart_of_accounts WHERE numero = ?", [numero]);
    const existing = existRows[0];
    if (existing && (!existing.isAuxiliary || existing.isLocked)) {
        throw new Error(`Conflit : le compte ${numero} existe déjà comme compte non-auxiliaire`);
    }
    if (existing) {
        await db.query("UPDATE chart_of_accounts SET libelle = ? WHERE numero = ?", [libelle, numero]);
    }
    else {
        const type = parentNumero.startsWith("411") ? "actif" : "passif";
        await db.query(`INSERT INTO chart_of_accounts
         (numero, libelle, classe, type, nature, parentNumero, isAuxiliary, isLocked)
       VALUES (?, ?, 4, ?, 'detail', ?, 1, 0)`, [numero, libelle, type, parentNumero]);
    }
}
async function ensureClientAccountNumber(db, clientId) {
    if (!clientId)
        return null;
    const [rows] = await db.query("SELECT id, accountNumber, lastName, firstName, companyName, type FROM clients WHERE id = ?", [clientId]);
    const row = rows[0];
    if (!row)
        return null;
    if (row.accountNumber && row.accountNumber.length >= 6)
        return row.accountNumber;
    const numero = await nextAuxNumber(db, "411");
    const libelle = row.type === "pro" && row.companyName
        ? row.companyName
        : `${row.lastName || ""} ${row.firstName || ""}`.trim() || "Client";
    await upsertAuxiliaryAccount(db, numero, "411000", libelle);
    await db.query("UPDATE clients SET accountNumber = ? WHERE id = ?", [numero, clientId]);
    return numero;
}
async function ensureSupplierAccountNumber(db, supplierId, fallbackName) {
    if (!supplierId)
        return null;
    const [rows] = await db.query("SELECT id, accountNumber, companyName FROM suppliers WHERE id = ?", [supplierId]);
    const row = rows[0];
    if (!row)
        return null;
    if (row.accountNumber && row.accountNumber.length >= 6)
        return row.accountNumber;
    const numero = await nextAuxNumber(db, "401");
    await upsertAuxiliaryAccount(db, numero, "401000", row.companyName || fallbackName || "Fournisseur");
    await db.query("UPDATE suppliers SET accountNumber = ? WHERE id = ?", [numero, supplierId]);
    return numero;
}
async function getClientName(db, clientId) {
    if (!clientId)
        return "Client";
    const [rows] = await db.query("SELECT firstName, lastName, companyName, type FROM clients WHERE id = ?", [clientId]);
    const r = rows[0];
    if (!r)
        return "Client";
    if (r.type === "pro" && r.companyName)
        return r.companyName;
    return `${r.lastName || ""} ${r.firstName || ""}`.trim() || "Client";
}
async function nextEntryNumero(db, journalCode, year) {
    const [rows] = await db.query(`SELECT COALESCE(MAX(numero), 0) + 1 AS n
     FROM journal_entries WHERE journalCode = ? AND exerciceYear = ?`, [journalCode, year]);
    return Number(rows[0].n) || 1;
}
async function insertEntry(db, entry, lines) {
    const totalDebit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
    const totalCredit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}`);
    }
    const id = entry.id || genId("je");
    const year = parseInt(entry.date.slice(0, 4), 10) || new Date().getFullYear();
    const numero = entry.numero || (await nextEntryNumero(db, entry.journalCode, year));
    await db.query(`INSERT INTO journal_entries (
      id, journalCode, numero, \`date\`, dateValidation, libelle,
      pieceRef, pieceDate, sourceType, sourceId, exerciceYear,
      isLocked, isReversed, reversedById
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '')`, [
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
    ]);
    let ordre = 0;
    for (const l of lines) {
        await db.query(`INSERT INTO journal_lines
        (id, entryId, compteNum, compAuxNum, compAuxLib, libelle, debit, credit, lettrage, dateLettrage, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)`, [
            genId("jl"),
            id,
            l.compteNum,
            l.compAuxNum || "",
            l.compAuxLib || "",
            l.libelle || entry.libelle || "",
            round2(l.debit || 0),
            round2(l.credit || 0),
            ordre++,
        ]);
    }
    return { id, numero };
}
async function deleteEntriesForSource(db, sourceType, sourceId) {
    if (!sourceId)
        return;
    await db.query(`DELETE FROM journal_entries WHERE sourceType = ? AND sourceId = ? AND isLocked = 0`, [sourceType, sourceId]);
    // CASCADE supprime les journal_lines via FK
}
// ─── Génération d'écritures par source ────────────────────────────────────
function bankAccountForMethod(method) {
    if (method === "espece" || method === "especes")
        return "530000";
    if (method === "cheque")
        return "514000";
    return "512000";
}
async function generateInvoiceEntry(db, invoiceId) {
    if (!(await isAutoEnabled(db)))
        return;
    const mode = await getMode(db);
    if (mode !== "engagement") {
        await deleteEntriesForSource(db, "invoice", invoiceId);
        return;
    }
    const [rows] = await db.query("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
    const inv = rows[0];
    if (!inv)
        return;
    if (inv.status === "brouillon" || inv.status === "annulee") {
        await deleteEntriesForSource(db, "invoice", invoiceId);
        return;
    }
    await deleteEntriesForSource(db, "invoice", invoiceId);
    const totalTtc = round2(Number(inv.totalTTC));
    const totalHt = round2(Number(inv.totalHT));
    const totalVat = round2(totalTtc - totalHt);
    if (totalTtc === 0)
        return;
    const date = ymd(inv.issueDate) || ymd(inv.createdAt);
    const clientAccount = (await ensureClientAccountNumber(db, inv.clientId)) || "411000";
    const clientName = await getClientName(db, inv.clientId);
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
    await insertEntry(db, {
        journalCode: "VE",
        date,
        libelle: `${isAvoir ? "Avoir" : "Facture"} ${inv.reference} - ${clientName}`,
        pieceRef: inv.reference,
        pieceDate: date,
        sourceType: "invoice",
        sourceId: invoiceId,
    }, lines);
}
async function generateExpenseEntry(db, expenseId) {
    if (!(await isAutoEnabled(db)))
        return;
    const mode = await getMode(db);
    if (mode !== "engagement") {
        await deleteEntriesForSource(db, "expense", expenseId);
        return;
    }
    const [rows] = await db.query("SELECT * FROM expenses WHERE id = ?", [expenseId]);
    const exp = rows[0];
    if (!exp)
        return;
    if (exp.status === "annulee") {
        await deleteEntriesForSource(db, "expense", expenseId);
        return;
    }
    await deleteEntriesForSource(db, "expense", expenseId);
    const totalHt = round2(Number(exp.amountHt));
    const totalVat = round2(Number(exp.amountVat));
    const totalTtc = round2(Number(exp.amountTtc));
    if (totalTtc === 0)
        return;
    const date = ymd(exp.expenseDate);
    const pcgAccount = seed_1.CATEGORY_PCG[exp.category] || "658000";
    const supplierAccount = (await ensureSupplierAccountNumber(db, exp.supplierId, exp.supplierName)) || "401000";
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
    await insertEntry(db, {
        journalCode: "AC",
        date,
        libelle: `Achat ${exp.reference} - ${supplierName}`,
        pieceRef: exp.reference,
        pieceDate: date,
        sourceType: "expense",
        sourceId: expenseId,
    }, lines);
}
async function generateInvoicePaymentEntry(db, paymentId) {
    if (!(await isAutoEnabled(db)))
        return;
    const [pRows] = await db.query("SELECT * FROM invoice_payments WHERE id = ?", [paymentId]);
    const pay = pRows[0];
    if (!pay)
        return;
    const [iRows] = await db.query("SELECT * FROM invoices WHERE id = ?", [pay.invoiceId]);
    const inv = iRows[0];
    if (!inv)
        return;
    await deleteEntriesForSource(db, "invoice_payment", paymentId);
    const mode = await getMode(db);
    const date = ymd(pay.date);
    const amount = round2(Number(pay.amount));
    if (amount === 0)
        return;
    const bankAccount = bankAccountForMethod(pay.method);
    const clientName = await getClientName(db, inv.clientId);
    const clientAccount = (await ensureClientAccountNumber(db, inv.clientId)) || "411000";
    if (mode === "engagement") {
        await insertEntry(db, {
            journalCode: bankAccount === "530000" ? "CA" : "BQ",
            date,
            libelle: `Encaissement facture ${inv.reference} - ${clientName}`,
            pieceRef: inv.reference,
            pieceDate: date,
            sourceType: "invoice_payment",
            sourceId: paymentId,
        }, [
            { compteNum: bankAccount, libelle: `Encaissement ${inv.reference}`, debit: amount, credit: 0 },
            {
                compteNum: clientAccount,
                compAuxNum: clientAccount,
                compAuxLib: clientName,
                libelle: `Encaissement ${inv.reference}`,
                debit: 0,
                credit: amount,
            },
        ]);
    }
    else {
        const totalTtc = round2(Number(inv.totalTTC));
        const totalHt = round2(Number(inv.totalHT));
        const ratio = totalTtc > 0 ? amount / totalTtc : 1;
        const htPart = round2(totalHt * ratio);
        const vatPart = round2(amount - htPart);
        const lines = [
            { compteNum: bankAccount, libelle: `Encaissement ${inv.reference}`, debit: amount, credit: 0 },
            { compteNum: "706000", libelle: `Vente ${inv.reference}`, debit: 0, credit: htPart },
        ];
        if (vatPart !== 0) {
            lines.push({ compteNum: "445710", libelle: `TVA collectée ${inv.reference}`, debit: 0, credit: vatPart });
        }
        await insertEntry(db, {
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
async function generateExpensePaymentEntry(db, expenseId) {
    if (!(await isAutoEnabled(db)))
        return;
    const [rows] = await db.query("SELECT * FROM expenses WHERE id = ?", [expenseId]);
    const exp = rows[0];
    if (!exp)
        return;
    if (exp.status !== "payee" || !exp.paidDate) {
        await deleteEntriesForSource(db, "expense_payment", expenseId);
        return;
    }
    await deleteEntriesForSource(db, "expense_payment", expenseId);
    const mode = await getMode(db);
    const date = ymd(exp.paidDate);
    const amount = round2(Number(exp.amountTtc));
    if (amount === 0)
        return;
    const bankAccount = bankAccountForMethod(exp.paymentMethod);
    const supplierAccount = (await ensureSupplierAccountNumber(db, exp.supplierId, exp.supplierName)) || "401000";
    const supplierName = exp.supplierName || "Fournisseur";
    if (mode === "engagement") {
        await insertEntry(db, {
            journalCode: bankAccount === "530000" ? "CA" : "BQ",
            date,
            libelle: `Règlement ${exp.reference} - ${supplierName}`,
            pieceRef: exp.reference,
            pieceDate: date,
            sourceType: "expense_payment",
            sourceId: expenseId,
        }, [
            {
                compteNum: supplierAccount,
                compAuxNum: supplierAccount,
                compAuxLib: supplierName,
                libelle: `Règlement ${exp.reference}`,
                debit: amount,
                credit: 0,
            },
            { compteNum: bankAccount, libelle: `Règlement ${exp.reference}`, debit: 0, credit: amount },
        ]);
    }
    else {
        const pcgAccount = seed_1.CATEGORY_PCG[exp.category] || "658000";
        const totalHt = round2(Number(exp.amountHt));
        const totalVat = round2(Number(exp.amountVat));
        const lines = [
            { compteNum: pcgAccount, libelle: exp.description || `Achat ${exp.reference}`, debit: totalHt, credit: 0 },
        ];
        if (totalVat > 0) {
            lines.push({ compteNum: "445660", libelle: `TVA déductible ${exp.reference}`, debit: totalVat, credit: 0 });
        }
        lines.push({ compteNum: bankAccount, libelle: `Règlement ${exp.reference}`, debit: 0, credit: amount });
        await insertEntry(db, {
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
// ─── Notes de frais ──────────────────────────────────────────────────────
//   - status 'validee'/'remboursee'/'refacturee' → écriture AC :
//       6xx + 4456 D | 108 (dirigeant) ou 421 (employé) C
//   - status 'remboursee' + reimbursedDate → écriture BQ :
//       108/421 D | 512 C
function payerCompte(payerType) {
    return payerType === "employe" ? "421000" : "108000";
}
async function generateExpenseNoteEntry(db, noteId) {
    if (!(await isAutoEnabled(db)))
        return;
    const [rows] = await db.query("SELECT * FROM expense_notes WHERE id = ?", [noteId]);
    const note = rows[0];
    if (!note)
        return;
    await deleteEntriesForSource(db, "expense_note", noteId);
    if (note.status === "brouillon")
        return;
    const totalHt = round2(Number(note.amountHt));
    const totalVat = round2(Number(note.amountVat));
    const totalTtc = round2(Number(note.amountTtc));
    if (totalTtc === 0)
        return;
    const date = ymd(note.expenseDate) || ymd(note.createdAt);
    const pcgAccount = seed_1.CATEGORY_PCG[note.category] || "658000";
    const payerAccount = payerCompte(note.payerType);
    const payerLabel = note.payerName || (note.payerType === "employe" ? "Employé" : "Dirigeant");
    const lines = [
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
async function generateExpenseNoteRefundEntry(db, noteId) {
    if (!(await isAutoEnabled(db)))
        return;
    const [rows] = await db.query("SELECT * FROM expense_notes WHERE id = ?", [noteId]);
    const note = rows[0];
    if (!note)
        return;
    await deleteEntriesForSource(db, "expense_note_refund", noteId);
    if (note.status !== "remboursee" || !note.reimbursedDate)
        return;
    const amount = round2(Number(note.amountTtc));
    if (amount === 0)
        return;
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
async function regenerateAll(db) {
    const result = {
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
    await db.query(`DELETE FROM journal_entries
     WHERE sourceType IN ('invoice', 'expense', 'invoice_payment', 'expense_payment', 'expense_note', 'expense_note_refund')
       AND isLocked = 0`);
    // Factures
    const [invRows] = await db.query("SELECT id FROM invoices WHERE status != 'brouillon' AND status != 'annulee' ORDER BY issueDate");
    for (const r of invRows) {
        try {
            await generateInvoiceEntry(db, r.id);
            result.invoices++;
        }
        catch (e) {
            result.errors.push(`Facture ${r.id}: ${e.message}`);
        }
    }
    // Dépenses
    const [expRows] = await db.query("SELECT id FROM expenses WHERE status != 'annulee' ORDER BY expenseDate");
    for (const r of expRows) {
        try {
            await generateExpenseEntry(db, r.id);
            result.expenses++;
        }
        catch (e) {
            result.errors.push(`Dépense ${r.id}: ${e.message}`);
        }
    }
    // Paiements factures
    const [payRows] = await db.query("SELECT id FROM invoice_payments ORDER BY `date`");
    for (const r of payRows) {
        try {
            await generateInvoicePaymentEntry(db, r.id);
            result.invoicePayments++;
        }
        catch (e) {
            result.errors.push(`Paiement facture ${r.id}: ${e.message}`);
        }
    }
    // Paiements dépenses
    const [paidRows] = await db.query("SELECT id FROM expenses WHERE status = 'payee' AND paidDate != '' ORDER BY paidDate");
    for (const r of paidRows) {
        try {
            await generateExpensePaymentEntry(db, r.id);
            result.expensePayments++;
        }
        catch (e) {
            result.errors.push(`Règlement dépense ${r.id}: ${e.message}`);
        }
    }
    // Notes de frais
    const [noteRows] = await db.query("SELECT id FROM expense_notes WHERE status IN ('validee', 'remboursee', 'refacturee') ORDER BY expenseDate");
    for (const r of noteRows) {
        try {
            await generateExpenseNoteEntry(db, r.id);
            result.expenseNotes++;
        }
        catch (e) {
            result.errors.push(`Note de frais ${r.id}: ${e.message}`);
        }
    }
    // Remboursements notes de frais
    const [refRows] = await db.query("SELECT id FROM expense_notes WHERE status = 'remboursee' AND reimbursedDate != '' ORDER BY reimbursedDate");
    for (const r of refRows) {
        try {
            await generateExpenseNoteRefundEntry(db, r.id);
            result.expenseNoteRefunds++;
        }
        catch (e) {
            result.errors.push(`Remboursement note ${r.id}: ${e.message}`);
        }
    }
    return result;
}
// ─── Lettrage automatique ─────────────────────────────────────────────────
function nextLetter(prev) {
    if (!prev)
        return "A";
    const chars = prev.split("");
    let i = chars.length - 1;
    while (i >= 0) {
        if (chars[i] === "Z") {
            chars[i] = "A";
            if (i === 0)
                return "A" + chars.join("");
            i--;
        }
        else {
            chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
            return chars.join("");
        }
    }
    return "A".repeat(prev.length + 1);
}
async function autoLettrerAccount(db, compteAuxNum) {
    const [rows] = await db.query(`SELECT jl.id, jl.debit, jl.credit, je.pieceRef
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entryId
     WHERE jl.compAuxNum = ? AND jl.lettrage = '' AND je.pieceRef != ''
     ORDER BY je.date, je.id`, [compteAuxNum]);
    const byPiece = {};
    for (const r of rows) {
        const rr = r;
        if (!byPiece[rr.pieceRef])
            byPiece[rr.pieceRef] = [];
        byPiece[rr.pieceRef].push({ id: rr.id, debit: Number(rr.debit), credit: Number(rr.credit) });
    }
    const [lastRows] = await db.query(`SELECT lettrage FROM journal_lines
     WHERE compAuxNum = ? AND lettrage != ''
     ORDER BY lettrage DESC LIMIT 1`, [compteAuxNum]);
    let current = lastRows[0]?.lettrage || "";
    const today = ymd(new Date());
    for (const piece of Object.keys(byPiece)) {
        const lines = byPiece[piece];
        const td = round2(lines.reduce((s, l) => s + l.debit, 0));
        const tc = round2(lines.reduce((s, l) => s + l.credit, 0));
        if (Math.abs(td - tc) <= 0.01 && lines.length >= 2) {
            current = nextLetter(current);
            for (const l of lines) {
                await db.query("UPDATE journal_lines SET lettrage = ?, dateLettrage = ? WHERE id = ?", [current, today, l.id]);
            }
        }
    }
}
async function autoLettrerAll(db) {
    const [rows] = await db.query("SELECT DISTINCT compAuxNum FROM journal_lines WHERE compAuxNum != ''");
    for (const r of rows) {
        await autoLettrerAccount(db, r.compAuxNum);
    }
}
