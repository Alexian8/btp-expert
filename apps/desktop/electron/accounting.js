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
      return { success: true };
    } catch (e) {
      console.error("[accounting:updateExpense]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("accounting:deleteExpense", (_e, id) => {
    try {
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

  console.log("[accounting] Module initialisé");
}

module.exports = { init };
