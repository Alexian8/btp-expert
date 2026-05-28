// ═══════════════════════════════════════════════════════════════════════════
// expenseNotes.js — Module Notes de frais (Session 14)
//
// Gère les petits frais professionnels (carburant, repas, péage)
// avec workflow : brouillon → validée → remboursée/refacturée
// ═══════════════════════════════════════════════════════════════════════════

const { ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const engine = require("./accountingEngine");

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() { return new Date().toISOString(); }

function makeReference(db) {
  const year = new Date().getFullYear();
  const prefix = `NDF-${year}-`;
  const last = db.prepare(`
    SELECT reference FROM expense_notes
    WHERE reference LIKE ?
    ORDER BY reference DESC LIMIT 1
  `).get(`${prefix}%`);
  let n = 1;
  if (last && last.reference) {
    const m = last.reference.match(/-(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

function rowToNote(row) {
  if (!row) return null;
  return {
    ...row,
    refacturable: !!row.refacturable,
  };
}

function init({ db, mainWindow }) {

  // ─── CRUD ──────────────────────────────────────────────────────────────

  ipcMain.handle("expenseNotes:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM expense_notes WHERE 1=1";
      const params = [];
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      if (filters.category) { sql += " AND category = ?"; params.push(filters.category); }
      if (filters.payerType) { sql += " AND payerType = ?"; params.push(filters.payerType); }
      if (filters.chantierId) { sql += " AND chantierId = ?"; params.push(filters.chantierId); }
      if (filters.refacturable !== undefined) {
        sql += " AND refacturable = ?";
        params.push(filters.refacturable ? 1 : 0);
      }
      if (filters.yearMonth) {
        sql += " AND substr(expenseDate, 1, 7) = ?";
        params.push(filters.yearMonth);
      }
      if (filters.year) {
        sql += " AND substr(expenseDate, 1, 4) = ?";
        params.push(String(filters.year));
      }
      sql += " ORDER BY expenseDate DESC, createdAt DESC";
      const rows = db.prepare(sql).all(...params);
      return rows.map(rowToNote);
    } catch (e) {
      console.error("[expenseNotes:list]", e);
      return [];
    }
  });

  ipcMain.handle("expenseNotes:getById", (_e, id) => {
    try {
      return rowToNote(db.prepare("SELECT * FROM expense_notes WHERE id = ?").get(id));
    } catch { return null; }
  });

  ipcMain.handle("expenseNotes:create", (_e, data) => {
    try {
      const id = generateId("ndf");
      const reference = makeReference(db);
      const now = nowIso();
      db.prepare(`
        INSERT INTO expense_notes (
          id, reference, payerType, payerName,
          chantierId,
          amountTtc, amountHt, vatRate, amountVat,
          category, description, notes,
          expenseDate,
          refacturable, refacturationMargePct,
          status, reimbursedDate, refacturedInvoiceId,
          receiptVaultDocumentId,
          paymentMethod, bankTransactionId, supplierInvoiceNumber,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, reference,
        data.payerType || "dirigeant",
        data.payerName || "",
        data.chantierId || "",
        Number(data.amountTtc) || 0,
        Number(data.amountHt) || 0,
        Number(data.vatRate) || 20,
        Number(data.amountVat) || 0,
        data.category || "autre",
        data.description || "",
        data.notes || "",
        data.expenseDate || now.slice(0, 10),
        data.refacturable ? 1 : 0,
        Number(data.refacturationMargePct) || 0,
        data.status || "brouillon",
        data.reimbursedDate || "",
        data.refacturedInvoiceId || "",
        data.receiptVaultDocumentId || "",
        data.paymentMethod || "personnel",
        data.bankTransactionId || "",
        data.supplierInvoiceNumber || "",
        now, now
      );
      try {
        engine.generateExpenseNoteEntry(db, id);
        if ((data.status || "brouillon") === "remboursee") {
          engine.generateExpenseNoteRefundEntry(db, id);
        }
      } catch (err) { console.warn("[accounting hook expenseNotes:create]", err.message); }
      return { success: true, id, reference };
    } catch (e) {
      console.error("[expenseNotes:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("expenseNotes:update", (_e, { id, data }) => {
    try {
      const allowed = [
        "payerType", "payerName", "chantierId",
        "amountTtc", "amountHt", "vatRate", "amountVat",
        "category", "description", "notes",
        "expenseDate",
        "refacturable", "refacturationMargePct",
        "status", "reimbursedDate", "refacturedInvoiceId",
        "receiptVaultDocumentId",
        "paymentMethod", "bankTransactionId", "supplierInvoiceNumber",
      ];
      const keys = Object.keys(data).filter(k => allowed.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) {
        if (k === "refacturable") payload[k] = data[k] ? 1 : 0;
        else if (k.startsWith("amount") || k === "vatRate" || k === "refacturationMargePct") {
          payload[k] = Number(data[k]) || 0;
        } else payload[k] = data[k] !== undefined ? data[k] : "";
      }
      db.prepare(`UPDATE expense_notes SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      try {
        engine.generateExpenseNoteEntry(db, id);
        engine.generateExpenseNoteRefundEntry(db, id);
      } catch (err) { console.warn("[accounting hook expenseNotes:update]", err.message); }
      return { success: true };
    } catch (e) {
      console.error("[expenseNotes:update]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("expenseNotes:delete", (_e, id) => {
    try {
      try {
        engine.deleteEntriesForSource(db, "expense_note", id);
        engine.deleteEntriesForSource(db, "expense_note_refund", id);
      } catch (err) { console.warn("[accounting hook expenseNotes:delete]", err.message); }
      db.prepare("DELETE FROM expense_notes WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Workflow rapide ───────────────────────────────────────────────────

  ipcMain.handle("expenseNotes:validate", (_e, id) => {
    try {
      db.prepare("UPDATE expense_notes SET status = 'validee', updatedAt = ? WHERE id = ?")
        .run(nowIso(), id);
      try { engine.generateExpenseNoteEntry(db, id); }
      catch (err) { console.warn("[accounting hook expenseNotes:validate]", err.message); }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("expenseNotes:markReimbursed", (_e, { id, date }) => {
    try {
      const today = (date || nowIso()).slice(0, 10);
      db.prepare(`
        UPDATE expense_notes
        SET status = 'remboursee', reimbursedDate = ?, updatedAt = ?
        WHERE id = ?
      `).run(today, nowIso(), id);
      try {
        engine.generateExpenseNoteEntry(db, id);
        engine.generateExpenseNoteRefundEntry(db, id);
      } catch (err) { console.warn("[accounting hook expenseNotes:markReimbursed]", err.message); }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Stats ─────────────────────────────────────────────────────────────

  ipcMain.handle("expenseNotes:getStats", () => {
    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const totalMonth = db.prepare(`
        SELECT COALESCE(SUM(amountTtc), 0) as total, COUNT(id) as cnt
        FROM expense_notes
        WHERE substr(expenseDate, 1, 7) = ? AND status != 'brouillon'
      `).get(yearMonth);

      const totalRefacturable = db.prepare(`
        SELECT COALESCE(SUM(amountTtc), 0) as total
        FROM expense_notes
        WHERE refacturable = 1 AND status IN ('validee')
      `).get().total || 0;

      const totalARembourser = db.prepare(`
        SELECT COALESCE(SUM(amountTtc), 0) as total
        FROM expense_notes
        WHERE status = 'validee' AND payerType IN ('dirigeant', 'employe')
      `).get().total || 0;

      return {
        totalMonth: totalMonth.total || 0,
        notesCount: totalMonth.cnt || 0,
        totalRefacturable,
        totalARembourser,
      };
    } catch (e) {
      console.error("[expenseNotes:getStats]", e);
      return { totalMonth: 0, notesCount: 0, totalRefacturable: 0, totalARembourser: 0 };
    }
  });

  // ─── Vue groupée par chantier (pour refacturation) ─────────────────────
  ipcMain.handle("expenseNotes:listByChantier", (_e, chantierId) => {
    try {
      const rows = db.prepare(`
        SELECT * FROM expense_notes
        WHERE chantierId = ?
        ORDER BY expenseDate DESC
      `).all(chantierId);
      return rows.map(rowToNote);
    } catch {
      return [];
    }
  });

  // ─── Export Excel mensuel pour expert-comptable ────────────────────────
  ipcMain.handle("expenseNotes:exportMonth", async (_e, { year, month }) => {
    try {
      const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
      const notes = db.prepare(`
        SELECT n.*, c.title as chantierTitle, c.reference as chantierReference
        FROM expense_notes n
        LEFT JOIN chantiers c ON c.id = n.chantierId
        WHERE substr(n.expenseDate, 1, 7) = ? AND n.status != 'brouillon'
        ORDER BY n.expenseDate, n.reference
      `).all(yearMonth);

      const defaultName = `notes-de-frais_${yearMonth}.csv`;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Exporter les notes de frais",
        defaultPath: defaultName,
        filters: [{ name: "CSV (Excel)", extensions: ["csv"] }],
      });
      if (result.canceled || !result.filePath) return { success: false, cancelled: true };

      // CSV avec BOM UTF-8 + séparateur ; (pour ouverture directe Excel FR)
      const headers = [
        "Référence", "Date", "Catégorie", "Description",
        "Payeur", "Nom payeur",
        "Montant TTC", "Montant HT", "TVA",
        "Chantier", "Refacturable", "Statut",
        "Date remboursement", "Notes",
      ];
      const lines = [headers.join(";")];

      const escape = (s) => {
        if (s === null || s === undefined) return "";
        const str = String(s);
        // Si contient ; " ou retour ligne → encadrer de "..." et doubler les guillemets
        if (/[;"\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
      };

      const fmtMoney = (n) => (Number(n) || 0).toFixed(2).replace(".", ",");

      for (const n of notes) {
        lines.push([
          escape(n.reference),
          escape(n.expenseDate),
          escape(n.category),
          escape(n.description),
          escape(n.payerType),
          escape(n.payerName),
          fmtMoney(n.amountTtc),
          fmtMoney(n.amountHt),
          fmtMoney(n.amountVat),
          escape(n.chantierReference ? `${n.chantierReference} - ${n.chantierTitle}` : ""),
          n.refacturable ? "Oui" : "Non",
          escape(n.status),
          escape(n.reimbursedDate),
          escape(n.notes),
        ].join(";"));
      }

      const totalLine = [
        "", "", "", "TOTAL",
        "", "",
        fmtMoney(notes.reduce((s, n) => s + (n.amountTtc || 0), 0)),
        fmtMoney(notes.reduce((s, n) => s + (n.amountHt || 0), 0)),
        fmtMoney(notes.reduce((s, n) => s + (n.amountVat || 0), 0)),
        "", "", "", "", "",
      ];
      lines.push(totalLine.join(";"));

      const content = "\uFEFF" + lines.join("\r\n") + "\r\n";
      fs.writeFileSync(result.filePath, content, "utf8");

      return {
        success: true,
        path: result.filePath,
        notesCount: notes.length,
      };
    } catch (e) {
      console.error("[expenseNotes:exportMonth]", e);
      return { success: false, error: e.message };
    }
  });

  console.log("[expenseNotes] Module initialisé");
}

module.exports = { init };
