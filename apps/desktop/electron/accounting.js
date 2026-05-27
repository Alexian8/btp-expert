// ═══════════════════════════════════════════════════════════════════════════
// accounting.js — Module Comptabilité (Session 13)
//
// Gère :
//   - CRUD des dépenses (expenses)
//   - Calcul stats financières (CA, marge, TVA, top clients/fournisseurs)
//   - Marge par chantier
//   - Export FEC (Fichier des Écritures Comptables) aux normes
//   - 12 handlers IPC
// ═══════════════════════════════════════════════════════════════════════════

const { ipcMain, dialog, app } = require("electron");
const fs = require("fs");
const path = require("path");
const engine = require("./accountingEngine");

// ─── Utilitaires ─────────────────────────────────────────────────────────
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() { return new Date().toISOString(); }

function rowToExpense(row) {
  if (!row) return null;
  return row;
}

function makeExpenseReference(db) {
  const year = new Date().getFullYear();
  const prefix = `DEP-${year}-`;
  const last = db.prepare(`
    SELECT reference FROM expenses
    WHERE reference LIKE ?
    ORDER BY reference DESC LIMIT 1
  `).get(`${prefix}%`);
  let nextNum = 1;
  if (last && last.reference) {
    const m = last.reference.match(/-(\d+)$/);
    if (m) nextNum = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

// Plan comptable mapping (catégorie dépense → compte PCG)
const CATEGORY_PCG = {
  materiaux: "601000", outillage: "606300", carburant: "606100",
  vehicule: "615500", sous_traitance: "611000", loyer: "613200",
  energie: "606100", telecom: "626000", assurance: "616000",
  frais_bancaires: "627000", honoraires: "622600", fourniture: "606400",
  repas: "625100", deplacement: "625100", formation: "628100",
  logiciel: "651600", publicite: "623000", autre: "658000",
};

// ═══════════════════════════════════════════════════════════════════════════
// Initialisation du module
// ═══════════════════════════════════════════════════════════════════════════
function init({ db, mainWindow }) {

  // ─── CRUD dépenses ─────────────────────────────────────────────────────

  ipcMain.handle("accounting:listExpenses", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM expenses WHERE 1=1";
      const params = [];
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      if (filters.category) { sql += " AND category = ?"; params.push(filters.category); }
      if (filters.supplierId) { sql += " AND supplierId = ?"; params.push(filters.supplierId); }
      if (filters.chantierId) { sql += " AND chantierId = ?"; params.push(filters.chantierId); }
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
      return rows.map(rowToExpense);
    } catch (e) {
      console.error("[accounting:listExpenses]", e);
      return [];
    }
  });

  ipcMain.handle("accounting:getExpenseById", (_e, id) => {
    try {
      const row = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
      return rowToExpense(row);
    } catch {
      return null;
    }
  });

  ipcMain.handle("accounting:createExpense", (_e, data) => {
    try {
      const id = generateId("dep");
      const reference = makeExpenseReference(db);
      const now = nowIso();
      db.prepare(`
        INSERT INTO expenses (
          id, reference, supplierId, supplierName, chantierId,
          amountHt, amountVat, amountTtc, vatRate,
          category, description, notes,
          expenseDate, dueDate, paidDate,
          status, paymentMethod, receiptVaultDocumentId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, reference,
        data.supplierId || "",
        data.supplierName || "",
        data.chantierId || "",
        Number(data.amountHt) || 0,
        Number(data.amountVat) || 0,
        Number(data.amountTtc) || 0,
        Number(data.vatRate) || 20,
        data.category || "autre",
        data.description || "",
        data.notes || "",
        data.expenseDate || now.slice(0, 10),
        data.dueDate || "",
        data.paidDate || "",
        data.status || "a_payer",
        data.paymentMethod || "cb",
        data.receiptVaultDocumentId || "",
        now, now
      );
      try {
        engine.generateExpenseEntry(db, id);
        if ((data.status || "a_payer") === "payee") engine.generateExpensePaymentEntry(db, id);
      } catch (err) { console.warn("[accounting hook createExpense]", err.message); }
      return { success: true, id, reference };
    } catch (e) {
      console.error("[accounting:createExpense]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:updateExpense", (_e, { id, data }) => {
    try {
      const allowedKeys = [
        "supplierId", "supplierName", "chantierId",
        "amountHt", "amountVat", "amountTtc", "vatRate",
        "category", "description", "notes",
        "expenseDate", "dueDate", "paidDate",
        "status", "paymentMethod", "receiptVaultDocumentId",
      ];
      const keys = Object.keys(data).filter(k => allowedKeys.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) {
        payload[k] = (k.startsWith("amount") || k === "vatRate") ? Number(data[k]) : (data[k] !== undefined ? data[k] : "");
      }
      db.prepare(`UPDATE expenses SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      try {
        engine.generateExpenseEntry(db, id);
        engine.generateExpensePaymentEntry(db, id);
      } catch (err) { console.warn("[accounting hook updateExpense]", err.message); }
      return { success: true };
    } catch (e) {
      console.error("[accounting:updateExpense]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:deleteExpense", (_e, id) => {
    try {
      try {
        engine.deleteEntriesForSource(db, "expense", id);
        engine.deleteEntriesForSource(db, "expense_payment", id);
      } catch (err) { console.warn("[accounting hook deleteExpense]", err.message); }
      db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:markExpensePaid", (_e, { id, paidDate, paymentMethod }) => {
    try {
      const now = nowIso();
      db.prepare(`
        UPDATE expenses
        SET status = 'payee', paidDate = ?, paymentMethod = ?, updatedAt = ?
        WHERE id = ?
      `).run(paidDate || now.slice(0, 10), paymentMethod || "cb", now, id);
      try { engine.generateExpensePaymentEntry(db, id); }
      catch (err) { console.warn("[accounting hook markExpensePaid]", err.message); }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Stats financières ─────────────────────────────────────────────────

  ipcMain.handle("accounting:getFinanceStats", () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const yearStr = String(year);
      const yearMonthStr = `${year}-${String(month).padStart(2, "0")}`;

      // ─── CA encaissé ce mois (factures avec lastPaymentDate ce mois)
      // Comme on a pas une vraie date de paiement, on utilise une heuristique :
      // On regarde le total payé (totalPaid) sur factures avec status payée ou partiellement_payée
      // Pour le mois : on filtre par updatedAt si payée ce mois (proxi simple)
      // Mais le plus propre c'est de regarder les paiements stockés.
      // Ici on fait simple : on prend totalPaid des factures payées du mois (basé sur invoiceDate du mois)

      // CA encaissé = totalPaid de toutes les factures, par période (basé sur invoiceDate ou date paiement)
      // Pour simplifier : on utilise invoiceDate
      const caEncaisseMonth = db.prepare(`
        SELECT COALESCE(SUM(totalPaid), 0) as total FROM invoices
        WHERE substr(invoiceDate, 1, 7) = ? AND status != 'annulee'
      `).get(yearMonthStr).total || 0;

      const caEncaisseYear = db.prepare(`
        SELECT COALESCE(SUM(totalPaid), 0) as total FROM invoices
        WHERE substr(invoiceDate, 1, 4) = ? AND status != 'annulee'
      `).get(yearStr).total || 0;

      const caEnAttente = db.prepare(`
        SELECT COALESCE(SUM(totalTtc - totalPaid), 0) as total FROM invoices
        WHERE status IN ('envoyee', 'partiellement-payee') AND status != 'annulee'
      `).get().total || 0;

      // ─── Dépenses
      const expensesMonth = db.prepare(`
        SELECT COALESCE(SUM(amountTtc), 0) as total FROM expenses
        WHERE substr(expenseDate, 1, 7) = ? AND status != 'annulee'
      `).get(yearMonthStr).total || 0;

      const expensesYear = db.prepare(`
        SELECT COALESCE(SUM(amountTtc), 0) as total FROM expenses
        WHERE substr(expenseDate, 1, 4) = ? AND status != 'annulee'
      `).get(yearStr).total || 0;

      const expensesAPayer = db.prepare(`
        SELECT COALESCE(SUM(amountTtc), 0) as total FROM expenses
        WHERE status = 'a_payer'
      `).get().total || 0;

      // ─── TVA collectée (cumul année) - basée sur factures payées
      const tvaCollectee = db.prepare(`
        SELECT COALESCE(SUM(totalVat * (totalPaid * 1.0 / NULLIF(totalTtc, 0))), 0) as total
        FROM invoices
        WHERE substr(invoiceDate, 1, 4) = ? AND status != 'annulee' AND totalTtc > 0
      `).get(yearStr).total || 0;

      // ─── TVA déductible (cumul année) - basée sur dépenses payées
      const tvaDeductible = db.prepare(`
        SELECT COALESCE(SUM(amountVat), 0) as total FROM expenses
        WHERE substr(expenseDate, 1, 4) = ? AND status = 'payee'
      `).get(yearStr).total || 0;

      const tvaAReverser = tvaCollectee - tvaDeductible;

      // ─── Marges
      const margeMonth = caEncaisseMonth - expensesMonth;
      const margeYear = caEncaisseYear - expensesYear;

      return {
        caEncaisseMonth, caEncaisseYear, caEnAttente,
        expensesMonth, expensesYear, expensesAPayer,
        margeMonth, margeYear,
        tvaCollectee, tvaDeductible, tvaAReverser,
      };
    } catch (e) {
      console.error("[accounting:getFinanceStats]", e);
      return {
        caEncaisseMonth: 0, caEncaisseYear: 0, caEnAttente: 0,
        expensesMonth: 0, expensesYear: 0, expensesAPayer: 0,
        margeMonth: 0, margeYear: 0,
        tvaCollectee: 0, tvaDeductible: 0, tvaAReverser: 0,
      };
    }
  });

  ipcMain.handle("accounting:getMonthlyEvolution", (_e, monthsBack = 12) => {
    try {
      const now = new Date();
      const points = [];
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const yearMonth = `${y}-${String(m).padStart(2, "0")}`;

        const caRow = db.prepare(`
          SELECT COALESCE(SUM(totalPaid), 0) as total FROM invoices
          WHERE substr(invoiceDate, 1, 7) = ? AND status != 'annulee'
        `).get(yearMonth);

        const expRow = db.prepare(`
          SELECT COALESCE(SUM(amountTtc), 0) as total FROM expenses
          WHERE substr(expenseDate, 1, 7) = ? AND status != 'annulee'
        `).get(yearMonth);

        const ca = caRow.total || 0;
        const expenses = expRow.total || 0;
        points.push({
          month: yearMonth,
          monthLabel: yearMonth, // sera reformaté côté UI
          ca,
          expenses,
          marge: ca - expenses,
        });
      }
      return points;
    } catch (e) {
      console.error("[accounting:getMonthlyEvolution]", e);
      return [];
    }
  });

  ipcMain.handle("accounting:getTopClients", (_e, limit = 5) => {
    try {
      const rows = db.prepare(`
        SELECT
          i.clientId,
          c.companyName,
          c.firstName,
          c.lastName,
          c.type,
          COALESCE(SUM(i.totalTtc), 0) as totalCa,
          COUNT(i.id) as invoicesCount
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.clientId
        WHERE i.status != 'annulee'
        GROUP BY i.clientId
        ORDER BY totalCa DESC
        LIMIT ?
      `).all(limit);
      return rows.map(r => ({
        clientId: r.clientId,
        clientName: r.type === "pro" && r.companyName
          ? r.companyName
          : `${r.firstName || ""} ${r.lastName || ""}`.trim() || "Client",
        totalCa: r.totalCa || 0,
        invoicesCount: r.invoicesCount || 0,
      }));
    } catch (e) {
      console.error("[accounting:getTopClients]", e);
      return [];
    }
  });

  ipcMain.handle("accounting:getTopSuppliers", (_e, limit = 5) => {
    try {
      const rows = db.prepare(`
        SELECT
          supplierId,
          supplierName,
          COALESCE(SUM(amountTtc), 0) as totalSpent,
          COUNT(id) as expensesCount
        FROM expenses
        WHERE status != 'annulee' AND supplierName != ''
        GROUP BY supplierId, supplierName
        ORDER BY totalSpent DESC
        LIMIT ?
      `).all(limit);
      return rows.map(r => ({
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        totalSpent: r.totalSpent || 0,
        expensesCount: r.expensesCount || 0,
      }));
    } catch (e) {
      console.error("[accounting:getTopSuppliers]", e);
      return [];
    }
  });

  ipcMain.handle("accounting:getChantierMargins", () => {
    try {
      // Pour chaque chantier, calculer CA et dépenses
      const rows = db.prepare(`
        SELECT
          c.id as chantierId,
          c.title as chantierTitle,
          c.reference as chantierReference,
          (SELECT COALESCE(SUM(totalTtc), 0) FROM invoices WHERE chantierId = c.id AND status != 'annulee') as ca,
          (SELECT COALESCE(SUM(amountTtc), 0) FROM expenses WHERE chantierId = c.id AND status != 'annulee') as expenses
        FROM chantiers c
        ORDER BY ca DESC
      `).all();
      return rows.map(r => {
        const ca = r.ca || 0;
        const expenses = r.expenses || 0;
        const marge = ca - expenses;
        return {
          chantierId: r.chantierId,
          chantierTitle: r.chantierTitle || "Chantier",
          chantierReference: r.chantierReference || "",
          ca, expenses, marge,
          margePct: ca > 0 ? (marge / ca) * 100 : 0,
        };
      });
    } catch (e) {
      console.error("[accounting:getChantierMargins]", e);
      return [];
    }
  });

  // ─── Export FEC ────────────────────────────────────────────────────────
  // Format aux normes : 18 colonnes séparées par tab, encodage UTF-8 BOM
  // Réf : article A47 A-1 du LPF

  function pad(n, len = 2) {
    return String(n).padStart(len, "0");
  }
  function formatFecDate(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    } catch { return ""; }
  }
  function formatFecAmount(n) {
    return (Number(n) || 0).toFixed(2).replace(".", ",");
  }
  function fecEscape(s) {
    return String(s || "").replace(/[\t\r\n|]/g, " ").trim();
  }

  ipcMain.handle("accounting:exportFEC", async (_e, { year }) => {
    try {
      // Récupérer SIREN entreprise
      const companyRow = db.prepare("SELECT data FROM company WHERE id = 1").get();
      const company = companyRow ? JSON.parse(companyRow.data || "{}") : {};
      const siren = (company.siret || "").replace(/\s/g, "").slice(0, 9) || "999999999";
      const yearStr = String(year);

      // Demander où enregistrer
      const defaultName = `${siren}FEC${year}1231.txt`;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Exporter le FEC",
        defaultPath: defaultName,
        filters: [{ name: "Fichier FEC", extensions: ["txt"] }],
      });
      if (result.canceled || !result.filePath) return { success: false, cancelled: true };

      // Header (18 colonnes)
      const headers = [
        "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
        "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
        "PieceRef", "PieceDate", "EcritureLib",
        "Debit", "Credit", "EcritureLet", "DateLet",
        "ValidDate", "Montantdevise", "Idevise",
      ];
      const lines = [headers.join("\t")];

      // ─── Journal des VENTES (VE) : factures
      const invoices = db.prepare(`
        SELECT i.*, c.companyName, c.firstName, c.lastName, c.type as clientType
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.clientId
        WHERE substr(i.invoiceDate, 1, 4) = ? AND i.status != 'annulee'
        ORDER BY i.invoiceDate, i.reference
      `).all(yearStr);

      let ecritureNum = 1;
      for (const inv of invoices) {
        const date = formatFecDate(inv.invoiceDate);
        const validDate = formatFecDate(inv.invoiceDate);
        const clientName = inv.clientType === "pro" && inv.companyName
          ? inv.companyName
          : `${inv.firstName || ""} ${inv.lastName || ""}`.trim() || "Client";
        const compAuxNum = "411" + (inv.clientId || "").slice(-4).padStart(4, "0");
        const lib = `Facture ${inv.reference}`;

        // 1. Débit client (411xxx)
        lines.push([
          "VE", "Ventes", ecritureNum, date,
          compAuxNum, fecEscape(clientName), compAuxNum, fecEscape(clientName),
          fecEscape(inv.reference), date, fecEscape(lib),
          formatFecAmount(inv.totalTtc), "0,00", "", "",
          validDate, "", "",
        ].join("\t"));

        // 2. Crédit produit (706000 - prestations services)
        lines.push([
          "VE", "Ventes", ecritureNum, date,
          "706000", "Prestations de services", "", "",
          fecEscape(inv.reference), date, fecEscape(lib),
          "0,00", formatFecAmount(inv.totalHt), "", "",
          validDate, "", "",
        ].join("\t"));

        // 3. Crédit TVA (44571)
        if (inv.totalVat > 0) {
          lines.push([
            "VE", "Ventes", ecritureNum, date,
            "445710", "TVA collectée", "", "",
            fecEscape(inv.reference), date, fecEscape(lib),
            "0,00", formatFecAmount(inv.totalVat), "", "",
            validDate, "", "",
          ].join("\t"));
        }
        ecritureNum++;
      }

      // ─── Journal des ACHATS (AC) : dépenses
      const expenses = db.prepare(`
        SELECT * FROM expenses
        WHERE substr(expenseDate, 1, 4) = ? AND status != 'annulee'
        ORDER BY expenseDate, reference
      `).all(yearStr);

      for (const exp of expenses) {
        const date = formatFecDate(exp.expenseDate);
        const validDate = formatFecDate(exp.expenseDate);
        const compAuxNum = "401" + (exp.supplierId || "").slice(-4).padStart(4, "0");
        const supplier = exp.supplierName || "Fournisseur";
        const lib = `Achat ${exp.reference}`;
        const pcgAccount = CATEGORY_PCG[exp.category] || "658000";

        // 1. Débit charge (6xxxxx)
        lines.push([
          "AC", "Achats", ecritureNum, date,
          pcgAccount, fecEscape(getPcgLabel(exp.category)), "", "",
          fecEscape(exp.reference), date, fecEscape(lib),
          formatFecAmount(exp.amountHt), "0,00", "", "",
          validDate, "", "",
        ].join("\t"));

        // 2. Débit TVA déductible (445660)
        if (exp.amountVat > 0) {
          lines.push([
            "AC", "Achats", ecritureNum, date,
            "445660", "TVA déductible", "", "",
            fecEscape(exp.reference), date, fecEscape(lib),
            formatFecAmount(exp.amountVat), "0,00", "", "",
            validDate, "", "",
          ].join("\t"));
        }

        // 3. Crédit fournisseur (401xxx)
        lines.push([
          "AC", "Achats", ecritureNum, date,
          compAuxNum, fecEscape(supplier), compAuxNum, fecEscape(supplier),
          fecEscape(exp.reference), date, fecEscape(lib),
          "0,00", formatFecAmount(exp.amountTtc), "", "",
          validDate, "", "",
        ].join("\t"));

        ecritureNum++;
      }

      // Encodage UTF-8 avec BOM (recommandé par DGFIP)
      const content = "\uFEFF" + lines.join("\r\n") + "\r\n";
      fs.writeFileSync(result.filePath, content, "utf8");

      return {
        success: true,
        path: result.filePath,
        invoicesCount: invoices.length,
        expensesCount: expenses.length,
        lineCount: lines.length - 1,
      };
    } catch (e) {
      console.error("[accounting:exportFEC]", e);
      return { success: false, error: e.message };
    }
  });

  function getPcgLabel(category) {
    const labels = {
      materiaux: "Achats matériaux", outillage: "Petit outillage",
      carburant: "Carburant", vehicule: "Entretien véhicules",
      sous_traitance: "Sous-traitance", loyer: "Locations immobilières",
      energie: "Eau-Gaz-Électricité", telecom: "Frais postaux et télécom",
      assurance: "Primes d'assurance", frais_bancaires: "Services bancaires",
      honoraires: "Honoraires", fourniture: "Fournitures",
      repas: "Repas", deplacement: "Déplacements",
      formation: "Formation", logiciel: "Cotisations logiciels",
      publicite: "Publicité", autre: "Charges diverses",
    };
    return labels[category] || "Charges diverses";
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Session 30 — Comptabilité partie double : nouveaux handlers
  // ═════════════════════════════════════════════════════════════════════════

  // ─── Paramètres compta ────────────────────────────────────────────────

  ipcMain.handle("accounting:getSettings", () => {
    try {
      const row = db.prepare("SELECT * FROM accounting_settings WHERE id = 1").get();
      return row || null;
    } catch (e) {
      console.error("[accounting:getSettings]", e);
      return null;
    }
  });

  ipcMain.handle("accounting:updateSettings", (_e, patch = {}) => {
    try {
      const allowed = ["mode", "exerciceStart", "fiscalYear", "lastLockedDate", "defaultVatRegime", "autoGenerateEntries"];
      const keys = Object.keys(patch).filter(k => allowed.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { updatedAt: nowIso() };
      for (const k of keys) {
        payload[k] = k === "autoGenerateEntries" || k === "fiscalYear" ? Number(patch[k]) : patch[k];
      }
      // Si le mode est défini la première fois, on enregistre la date
      if (patch.mode) {
        const current = db.prepare("SELECT mode, modeChosenAt FROM accounting_settings WHERE id = 1").get();
        if (current && !current.modeChosenAt) {
          payload.modeChosenAt = nowIso();
        }
      }
      const extraKeys = Object.keys(payload).filter(k => !keys.includes(k) && k !== "updatedAt");
      const allSets = [...keys.map(k => `${k} = @${k}`), ...extraKeys.map(k => `${k} = @${k}`), "updatedAt = @updatedAt"].join(", ");
      db.prepare(`UPDATE accounting_settings SET ${allSets} WHERE id = 1`).run(payload);
      return { success: true };
    } catch (e) {
      console.error("[accounting:updateSettings]", e);
      return { success: false, error: e.message };
    }
  });

  // ─── Plan comptable ───────────────────────────────────────────────────

  ipcMain.handle("accounting:listAccounts", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM chart_of_accounts WHERE 1=1";
      const params = [];
      if (filters.classe) { sql += " AND classe = ?"; params.push(Number(filters.classe)); }
      if (filters.search) {
        sql += " AND (numero LIKE ? OR libelle LIKE ?)";
        params.push(`${filters.search}%`, `%${filters.search}%`);
      }
      if (filters.parentNumero) { sql += " AND parentNumero = ?"; params.push(filters.parentNumero); }
      sql += " ORDER BY numero ASC";
      return db.prepare(sql).all(...params);
    } catch (e) {
      console.error("[accounting:listAccounts]", e);
      return [];
    }
  });

  ipcMain.handle("accounting:getAccount", (_e, numero) => {
    try {
      return db.prepare("SELECT * FROM chart_of_accounts WHERE numero = ?").get(numero) || null;
    } catch { return null; }
  });

  ipcMain.handle("accounting:createAccount", (_e, data) => {
    try {
      const numero = String(data.numero || "").trim();
      if (!numero) return { success: false, error: "Numéro requis" };
      // Plages réservées à la génération automatique des auxiliaires
      // 411001-411998 : clients, 401001-401998 : fournisseurs
      // On autorise toujours les comptes parents (411000, 401000) ainsi que
      // toute valeur en dehors de ces plages (412xxx, 413xxx, etc.).
      if (numero.length === 6) {
        const isClientAux = numero.startsWith("411") && numero !== "411000" && numero !== "411999";
        const isSupplierAux = numero.startsWith("401") && numero !== "401000" && numero !== "401999";
        if (isClientAux || isSupplierAux) {
          const tier = isClientAux ? "clients" : "suppliers";
          return {
            success: false,
            error: `La plage ${numero.slice(0, 3)}001-${numero.slice(0, 3)}998 est réservée aux comptes auxiliaires ${tier === "clients" ? "clients" : "fournisseurs"} (générés automatiquement). Utilisez ${numero.slice(0, 3)}999 pour un compte divers.`,
          };
        }
      }
      const exists = db.prepare("SELECT numero FROM chart_of_accounts WHERE numero = ?").get(numero);
      if (exists) return { success: false, error: "Ce numéro de compte existe déjà" };

      const now = nowIso();
      db.prepare(`
        INSERT INTO chart_of_accounts (numero, libelle, classe, type, nature, parentNumero, isAuxiliary, isLocked, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        numero, data.libelle || "", Number(data.classe) || 0,
        data.type || "neutre", data.nature || "detail",
        data.parentNumero || "", Number(data.isAuxiliary) || 0,
        now, now,
      );
      return { success: true, numero };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:updateAccount", (_e, { numero, data }) => {
    try {
      const allowed = ["libelle", "classe", "type", "nature", "parentNumero"];
      const keys = Object.keys(data).filter(k => allowed.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { numero, updatedAt: nowIso() };
      for (const k of keys) payload[k] = k === "classe" ? Number(data[k]) : data[k];
      db.prepare(`UPDATE chart_of_accounts SET ${sets}, updatedAt = @updatedAt WHERE numero = @numero AND isLocked = 0`).run(payload);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:deleteAccount", (_e, numero) => {
    try {
      const acc = db.prepare("SELECT isLocked FROM chart_of_accounts WHERE numero = ?").get(numero);
      if (!acc) return { success: false, error: "Compte introuvable" };
      if (acc.isLocked) return { success: false, error: "Compte verrouillé (système)" };
      const used = db.prepare("SELECT 1 FROM journal_lines WHERE compteNum = ? LIMIT 1").get(numero);
      if (used) return { success: false, error: "Compte utilisé par des écritures" };
      db.prepare("DELETE FROM chart_of_accounts WHERE numero = ?").run(numero);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Journaux ────────────────────────────────────────────────────────

  ipcMain.handle("accounting:listJournals", () => {
    try { return db.prepare("SELECT * FROM journals ORDER BY code").all(); }
    catch { return []; }
  });

  // ─── Écritures (livre journal) ───────────────────────────────────────

  ipcMain.handle("accounting:listEntries", (_e, filters = {}) => {
    try {
      let sql = `
        SELECT je.*, j.libelle as journalLibelle
        FROM journal_entries je
        LEFT JOIN journals j ON j.code = je.journalCode
        WHERE 1=1
      `;
      const params = [];
      if (filters.journalCode) { sql += " AND je.journalCode = ?"; params.push(filters.journalCode); }
      if (filters.year) { sql += " AND je.exerciceYear = ?"; params.push(Number(filters.year)); }
      if (filters.dateFrom) { sql += " AND je.date >= ?"; params.push(filters.dateFrom); }
      if (filters.dateTo) { sql += " AND je.date <= ?"; params.push(filters.dateTo); }
      if (filters.search) {
        sql += " AND (je.libelle LIKE ? OR je.pieceRef LIKE ?)";
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      sql += " ORDER BY je.date ASC, je.numero ASC";
      if (filters.limit) { sql += " LIMIT ?"; params.push(Number(filters.limit)); }
      const entries = db.prepare(sql).all(...params);
      const linesStmt = db.prepare("SELECT * FROM journal_lines WHERE entryId = ? ORDER BY ordre");
      return entries.map(e => ({ ...e, lines: linesStmt.all(e.id) }));
    } catch (e) {
      console.error("[accounting:listEntries]", e);
      return [];
    }
  });

  ipcMain.handle("accounting:getEntry", (_e, entryId) => {
    try {
      const entry = db.prepare(`
        SELECT je.*, j.libelle as journalLibelle
        FROM journal_entries je LEFT JOIN journals j ON j.code = je.journalCode
        WHERE je.id = ?
      `).get(entryId);
      if (!entry) return null;
      entry.lines = db.prepare("SELECT * FROM journal_lines WHERE entryId = ? ORDER BY ordre").all(entryId);
      return entry;
    } catch { return null; }
  });

  // Création manuelle d'une écriture (journal OD)
  ipcMain.handle("accounting:createManualEntry", (_e, data) => {
    try {
      if (!data.journalCode) return { success: false, error: "Journal requis" };
      if (!Array.isArray(data.lines) || data.lines.length < 2) return { success: false, error: "Au moins 2 lignes requises" };
      const totalDebit = data.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = data.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return { success: false, error: "Écriture déséquilibrée" };
      }
      // Réutilise le moteur via insertEntry-like
      const id = "je_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const now = nowIso();
      const date = data.date || now.slice(0, 10);
      const year = parseInt(date.slice(0, 4), 10);
      const numeroRow = db.prepare(`
        SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM journal_entries
        WHERE journalCode = ? AND exerciceYear = ?
      `).get(data.journalCode, year);
      const numero = numeroRow.n || 1;

      db.prepare(`
        INSERT INTO journal_entries (
          id, journalCode, numero, date, dateValidation, libelle,
          pieceRef, pieceDate, sourceType, sourceId, exerciceYear,
          isLocked, isReversed, reversedById, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', '', ?, 0, 0, '', ?, ?)
      `).run(
        id, data.journalCode, numero, date, date,
        data.libelle || "", data.pieceRef || "", data.pieceDate || date,
        year, now, now,
      );
      const insLine = db.prepare(`
        INSERT INTO journal_lines (id, entryId, compteNum, compAuxNum, compAuxLib, libelle, debit, credit, lettrage, dateLettrage, ordre)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)
      `);
      let i = 0;
      for (const l of data.lines) {
        insLine.run(
          "jl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          id, l.compteNum || "",
          l.compAuxNum || "", l.compAuxLib || "",
          l.libelle || data.libelle || "",
          Math.round((Number(l.debit) || 0) * 100) / 100,
          Math.round((Number(l.credit) || 0) * 100) / 100,
          i++,
        );
      }
      return { success: true, id, numero };
    } catch (e) {
      console.error("[accounting:createManualEntry]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:deleteEntry", (_e, entryId) => {
    try {
      const entry = db.prepare("SELECT isLocked, sourceType FROM journal_entries WHERE id = ?").get(entryId);
      if (!entry) return { success: false, error: "Écriture introuvable" };
      if (entry.isLocked) return { success: false, error: "Écriture verrouillée (exercice clôturé)" };
      if (entry.sourceType !== "manual") {
        return { success: false, error: "Écriture générée automatiquement — modifiez la source (facture/dépense)" };
      }
      db.prepare("DELETE FROM journal_lines WHERE entryId = ?").run(entryId);
      db.prepare("DELETE FROM journal_entries WHERE id = ?").run(entryId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Régénération massive (migration historique) ─────────────────────

  ipcMain.handle("accounting:regenerateAllEntries", () => {
    try {
      const tx = db.transaction(() => engine.regenerateAll(db));
      const result = tx();
      try { engine.autoLettrerAll(db); } catch (err) { console.warn("[lettrage]", err.message); }
      return { success: true, ...result };
    } catch (e) {
      console.error("[accounting:regenerateAllEntries]", e);
      return { success: false, error: e.message };
    }
  });

  // ─── Lettrage ────────────────────────────────────────────────────────

  ipcMain.handle("accounting:autoLettrer", (_e, compteAuxNum) => {
    try {
      if (compteAuxNum) engine.autoLettrer(db, compteAuxNum);
      else engine.autoLettrerAll(db);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:setLettrage", (_e, { lineIds, code }) => {
    try {
      if (!Array.isArray(lineIds) || lineIds.length === 0) return { success: false, error: "Aucune ligne" };
      const today = new Date().toISOString().slice(0, 10);
      const upd = db.prepare("UPDATE journal_lines SET lettrage = ?, dateLettrage = ? WHERE id = ?");
      const clear = db.prepare("UPDATE journal_lines SET lettrage = '', dateLettrage = '' WHERE id = ?");
      const tx = db.transaction(() => {
        for (const id of lineIds) {
          if (code) upd.run(code, today, id);
          else clear.run(id);
        }
      });
      tx();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Vues : Grand livre, Balance, Compte de résultat, Bilan ─────────

  ipcMain.handle("accounting:getGrandLivre", (_e, { compteNum, year, dateFrom, dateTo }) => {
    try {
      let sql = `
        SELECT jl.*, je.journalCode, je.numero as entryNumero, je.date, je.pieceRef, je.libelle as entryLibelle
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        WHERE jl.compteNum = ?
      `;
      const params = [compteNum];
      if (year) { sql += " AND je.exerciceYear = ?"; params.push(Number(year)); }
      if (dateFrom) { sql += " AND je.date >= ?"; params.push(dateFrom); }
      if (dateTo) { sql += " AND je.date <= ?"; params.push(dateTo); }
      sql += " ORDER BY je.date ASC, je.numero ASC, jl.ordre ASC";
      const lines = db.prepare(sql).all(...params);
      let soldeDebit = 0, soldeCredit = 0;
      const enriched = lines.map(l => {
        soldeDebit += l.debit;
        soldeCredit += l.credit;
        return { ...l, soldeProgressif: Math.round((soldeDebit - soldeCredit) * 100) / 100 };
      });
      return {
        compteNum,
        lines: enriched,
        totals: {
          debit: Math.round(soldeDebit * 100) / 100,
          credit: Math.round(soldeCredit * 100) / 100,
          solde: Math.round((soldeDebit - soldeCredit) * 100) / 100,
        },
      };
    } catch (e) {
      console.error("[accounting:getGrandLivre]", e);
      return { compteNum, lines: [], totals: { debit: 0, credit: 0, solde: 0 } };
    }
  });

  ipcMain.handle("accounting:getBalance", (_e, { year, dateFrom, dateTo } = {}) => {
    try {
      let sql = `
        SELECT jl.compteNum, jl.compAuxNum, jl.compAuxLib,
               coa.libelle as compteLibelle, coa.classe, coa.type, coa.nature,
               SUM(jl.debit) as totalDebit, SUM(jl.credit) as totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE 1=1
      `;
      const params = [];
      if (year) { sql += " AND je.exerciceYear = ?"; params.push(Number(year)); }
      if (dateFrom) { sql += " AND je.date >= ?"; params.push(dateFrom); }
      if (dateTo) { sql += " AND je.date <= ?"; params.push(dateTo); }
      sql += " GROUP BY jl.compteNum, jl.compAuxNum ORDER BY jl.compteNum";
      const rows = db.prepare(sql).all(...params);
      return rows.map(r => ({
        ...r,
        totalDebit: Math.round((r.totalDebit || 0) * 100) / 100,
        totalCredit: Math.round((r.totalCredit || 0) * 100) / 100,
        solde: Math.round(((r.totalDebit || 0) - (r.totalCredit || 0)) * 100) / 100,
      }));
    } catch (e) {
      console.error("[accounting:getBalance]", e);
      return [];
    }
  });

  ipcMain.handle("accounting:getIncomeStatement", (_e, { year, dateFrom, dateTo } = {}) => {
    try {
      // Classe 6 = charges, classe 7 = produits
      let sql = `
        SELECT jl.compteNum, coa.libelle, coa.classe,
               SUM(jl.debit) as totalDebit, SUM(jl.credit) as totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE coa.classe IN (6, 7)
      `;
      const params = [];
      if (year) { sql += " AND je.exerciceYear = ?"; params.push(Number(year)); }
      if (dateFrom) { sql += " AND je.date >= ?"; params.push(dateFrom); }
      if (dateTo) { sql += " AND je.date <= ?"; params.push(dateTo); }
      sql += " GROUP BY jl.compteNum ORDER BY jl.compteNum";
      const rows = db.prepare(sql).all(...params);
      const charges = [];
      const produits = [];
      let totalCharges = 0, totalProduits = 0;
      for (const r of rows) {
        const debit = Math.round((r.totalDebit || 0) * 100) / 100;
        const credit = Math.round((r.totalCredit || 0) * 100) / 100;
        if (r.classe === 6) {
          const montant = debit - credit;
          charges.push({ compteNum: r.compteNum, libelle: r.libelle, montant });
          totalCharges += montant;
        } else if (r.classe === 7) {
          const montant = credit - debit;
          produits.push({ compteNum: r.compteNum, libelle: r.libelle, montant });
          totalProduits += montant;
        }
      }
      return {
        charges,
        produits,
        totalCharges: Math.round(totalCharges * 100) / 100,
        totalProduits: Math.round(totalProduits * 100) / 100,
        resultat: Math.round((totalProduits - totalCharges) * 100) / 100,
      };
    } catch (e) {
      console.error("[accounting:getIncomeStatement]", e);
      return { charges: [], produits: [], totalCharges: 0, totalProduits: 0, resultat: 0 };
    }
  });

  ipcMain.handle("accounting:getBalanceSheet", (_e, { year, asOfDate } = {}) => {
    try {
      // Bilan : actif (classes 2, 3, 4 débiteurs, 5) / passif (classes 1, 4 créditeurs)
      let sql = `
        SELECT jl.compteNum, coa.libelle, coa.classe, coa.type, coa.nature,
               SUM(jl.debit) as totalDebit, SUM(jl.credit) as totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE coa.classe IN (1, 2, 3, 4, 5)
      `;
      const params = [];
      if (year) { sql += " AND je.exerciceYear <= ?"; params.push(Number(year)); }
      if (asOfDate) { sql += " AND je.date <= ?"; params.push(asOfDate); }
      sql += " GROUP BY jl.compteNum ORDER BY jl.compteNum";
      const rows = db.prepare(sql).all(...params);

      // Calcul du résultat de l'exercice (classes 6 & 7) pour l'intégrer au bilan
      let resSql = `
        SELECT coa.classe, SUM(jl.debit) as totalDebit, SUM(jl.credit) as totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE coa.classe IN (6, 7)
      `;
      const resParams = [];
      if (year) { resSql += " AND je.exerciceYear = ?"; resParams.push(Number(year)); }
      if (asOfDate) { resSql += " AND je.date <= ?"; resParams.push(asOfDate); }
      resSql += " GROUP BY coa.classe";
      const resRows = db.prepare(resSql).all(...resParams);
      let totalCharges = 0, totalProduits = 0;
      for (const r of resRows) {
        if (r.classe === 6) totalCharges = (r.totalDebit || 0) - (r.totalCredit || 0);
        if (r.classe === 7) totalProduits = (r.totalCredit || 0) - (r.totalDebit || 0);
      }
      const resultat = Math.round((totalProduits - totalCharges) * 100) / 100;

      const actif = [];
      const passif = [];
      let totalActif = 0, totalPassif = 0;
      for (const r of rows) {
        const debit = r.totalDebit || 0;
        const credit = r.totalCredit || 0;
        const solde = Math.round((debit - credit) * 100) / 100;
        if (solde === 0) continue;
        const item = { compteNum: r.compteNum, libelle: r.libelle, classe: r.classe, montant: Math.abs(solde) };
        // Heuristique : un compte d'actif a un solde débiteur, un compte de passif un solde créditeur
        // Mais ça dépend du type. On utilise type quand disponible.
        if (r.type === "actif" || (r.type !== "passif" && solde > 0)) {
          actif.push(item);
          totalActif += Math.abs(solde);
        } else {
          passif.push(item);
          totalPassif += Math.abs(solde);
        }
      }
      // Intégrer le résultat de l'exercice au passif (capitaux propres)
      if (resultat !== 0) {
        passif.push({
          compteNum: resultat >= 0 ? "120000" : "129000",
          libelle: resultat >= 0 ? "Résultat de l'exercice (bénéfice)" : "Résultat de l'exercice (perte)",
          classe: 1,
          montant: Math.abs(resultat),
        });
        if (resultat >= 0) totalPassif += resultat;
        else totalActif += Math.abs(resultat);
      }
      return {
        actif,
        passif,
        totalActif: Math.round(totalActif * 100) / 100,
        totalPassif: Math.round(totalPassif * 100) / 100,
        resultat,
      };
    } catch (e) {
      console.error("[accounting:getBalanceSheet]", e);
      return { actif: [], passif: [], totalActif: 0, totalPassif: 0, resultat: 0 };
    }
  });

  // ─── Numéro de compte auxiliaire (assignation manuelle) ──────────────

  ipcMain.handle("accounting:ensureClientAccount", (_e, clientId) => {
    try {
      const numero = engine.ensureClientAccountNumber(db, clientId);
      return { success: true, numero };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:ensureSupplierAccount", (_e, supplierId) => {
    try {
      const numero = engine.ensureSupplierAccountNumber(db, supplierId);
      return { success: true, numero };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log("[accounting] Module initialisé");
}

module.exports = { init };
