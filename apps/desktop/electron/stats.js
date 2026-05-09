// ═══════════════════════════════════════════════════════════════════════════
// stats.js — Statistiques avancées (Session 16)
//
// 4 axes :
//   1. Pipeline devis (taux conversion + carnet de commandes)
//   2. Délais de paiement (retards clients)
//   3. Comparatif Year-over-Year
//   4. Saisonnalité (heatmap année × mois)
// ═══════════════════════════════════════════════════════════════════════════

const { ipcMain } = require("electron");

function init({ db }) {

  // ═════════════════════════════════════════════════════════════════════════
  // PIPELINE DEVIS
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("stats:getQuotePipeline", () => {
    try {
      // Compteurs et montants par statut
      const byStatus = db.prepare(`
        SELECT status, COUNT(id) as cnt, COALESCE(SUM(totalHt), 0) as total
        FROM quotes
        GROUP BY status
      `).all();

      const stats = {
        countBrouillon: 0, countEnvoye: 0, countAccepte: 0, countRefuse: 0, countFactured: 0,
        amountBrouillon: 0, amountEnvoye: 0, amountAccepte: 0, amountFactured: 0, amountRefuse: 0,
        conversionEnvoyeToAccepte: 0, conversionGlobal: 0,
        avgSignatureDelayDays: 0,
        oldEnvoyeCount: 0, oldEnvoyeAmount: 0,
      };

      for (const row of byStatus) {
        if (row.status === "brouillon") {
          stats.countBrouillon = row.cnt;
          stats.amountBrouillon = row.total;
        } else if (row.status === "envoye") {
          stats.countEnvoye = row.cnt;
          stats.amountEnvoye = row.total;
        } else if (row.status === "accepte") {
          stats.countAccepte = row.cnt;
          stats.amountAccepte = row.total;
        } else if (row.status === "refuse") {
          stats.countRefuse = row.cnt;
          stats.amountRefuse = row.total;
        }
      }

      // Devis acceptés ET facturés (= il existe une invoice avec fromQuoteId)
      const facturedQuotes = db.prepare(`
        SELECT COUNT(DISTINCT q.id) as cnt, COALESCE(SUM(q.totalHt), 0) as total
        FROM quotes q
        WHERE q.status = 'accepte'
          AND EXISTS (SELECT 1 FROM invoices i WHERE i.fromQuoteId = q.id)
      `).get();
      stats.countFactured = facturedQuotes.cnt || 0;
      stats.amountFactured = facturedQuotes.total || 0;

      // Le "amountAccepte" représente le carnet de commandes (signé non encore facturé)
      stats.amountAccepte = Math.max(0, stats.amountAccepte - stats.amountFactured);

      // Taux conversion : envoyés → acceptés
      const envoyeOuPasse = stats.countEnvoye + stats.countAccepte + stats.countRefuse;
      if (envoyeOuPasse > 0) {
        stats.conversionEnvoyeToAccepte = +((stats.countAccepte / envoyeOuPasse) * 100).toFixed(1);
      }
      const totalQuotes = stats.countBrouillon + stats.countEnvoye + stats.countAccepte + stats.countRefuse;
      if (totalQuotes > 0) {
        stats.conversionGlobal = +((stats.countAccepte / totalQuotes) * 100).toFixed(1);
      }

      // Délai moyen de signature : entre quoteDate et la date où le statut est passé à accepte
      // On approxime via updatedAt si pas de signedDate
      const signedQuotes = db.prepare(`
        SELECT quoteDate, updatedAt
        FROM quotes
        WHERE status = 'accepte'
      `).all();
      if (signedQuotes.length > 0) {
        let totalDays = 0;
        let count = 0;
        for (const q of signedQuotes) {
          if (!q.quoteDate || !q.updatedAt) continue;
          try {
            const start = new Date(q.quoteDate);
            const end = new Date(q.updatedAt);
            const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
            if (days >= 0 && days < 365) {
              totalDays += days;
              count++;
            }
          } catch {}
        }
        if (count > 0) {
          stats.avgSignatureDelayDays = Math.round(totalDays / count);
        }
      }

      // Devis envoyés "anciens" (> 30 jours sans réponse)
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const oldEnvoye = db.prepare(`
        SELECT COUNT(id) as cnt, COALESCE(SUM(totalHt), 0) as total
        FROM quotes
        WHERE status = 'envoye' AND quoteDate < ?
      `).get(cutoff);
      stats.oldEnvoyeCount = oldEnvoye.cnt || 0;
      stats.oldEnvoyeAmount = oldEnvoye.total || 0;

      return stats;
    } catch (e) {
      console.error("[stats:getQuotePipeline]", e);
      return null;
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // DÉLAIS DE PAIEMENT
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("stats:getPaymentDelays", () => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Factures payées avec dates valides
      const paidInvoices = db.prepare(`
        SELECT issueDate, dueDate, paidAt
        FROM invoices
        WHERE status = 'payee'
          AND issueDate != '' AND paidAt != ''
      `).all();

      let totalDelay = 0;
      let totalLateness = 0;
      let count = 0;
      for (const inv of paidInvoices) {
        try {
          const issued = new Date(inv.issueDate);
          const paid = new Date(inv.paidAt);
          const delay = Math.round((paid - issued) / (1000 * 60 * 60 * 24));
          if (delay < 0 || delay > 365) continue;
          totalDelay += delay;
          if (inv.dueDate) {
            const due = new Date(inv.dueDate);
            const lateness = Math.round((paid - due) / (1000 * 60 * 60 * 24));
            // Si lateness < 0 = payé en avance, on garde 0
            totalLateness += Math.max(0, lateness);
          }
          count++;
        } catch {}
      }

      const avgPaymentDelayDays = count > 0 ? Math.round(totalDelay / count) : 0;
      const avgLatenessDays = count > 0 ? Math.round(totalLateness / count) : 0;

      // Factures actuellement en retard
      const overdue = db.prepare(`
        SELECT COUNT(id) as cnt, COALESCE(SUM(totalTtc - totalPaid), 0) as total
        FROM invoices
        WHERE status IN ('envoyee', 'partiellement-payee')
          AND dueDate != '' AND dueDate < ?
      `).get(today);

      // Factures en attente (envoyées non échues)
      const pending = db.prepare(`
        SELECT COUNT(id) as cnt, COALESCE(SUM(totalTtc - totalPaid), 0) as total
        FROM invoices
        WHERE status IN ('envoyee', 'partiellement-payee')
          AND (dueDate = '' OR dueDate >= ?)
      `).get(today);

      return {
        avgPaymentDelayDays,
        avgLatenessDays,
        invoicesOverdueCount: overdue.cnt || 0,
        invoicesOverdueAmount: overdue.total || 0,
        invoicesPendingCount: pending.cnt || 0,
        invoicesPendingAmount: pending.total || 0,
      };
    } catch (e) {
      console.error("[stats:getPaymentDelays]", e);
      return null;
    }
  });

  // Top mauvais payeurs (par client)
  ipcMain.handle("stats:getClientPaymentDelays", (_e, limit = 10) => {
    try {
      // Récupérer toutes les factures payées avec client + dates
      const rows = db.prepare(`
        SELECT i.id, i.clientId, i.totalTtc, i.totalPaid,
               i.issueDate, i.dueDate, i.paidAt,
               c.companyName, c.firstName, c.lastName, c.type
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.clientId
        WHERE i.status = 'payee'
          AND i.issueDate != '' AND i.paidAt != ''
      `).all();

      // Agréger par client
      const byClient = new Map();
      for (const r of rows) {
        if (!r.clientId) continue;
        try {
          const issued = new Date(r.issueDate);
          const paid = new Date(r.paidAt);
          const delay = Math.round((paid - issued) / (1000 * 60 * 60 * 24));
          if (delay < 0 || delay > 365) continue;

          let lateness = 0;
          if (r.dueDate) {
            const due = new Date(r.dueDate);
            lateness = Math.round((paid - due) / (1000 * 60 * 60 * 24));
            if (lateness < 0) lateness = 0;
          }

          let entry = byClient.get(r.clientId);
          if (!entry) {
            const clientName = r.type === "particulier"
              ? `${r.firstName || ""} ${r.lastName || ""}`.trim()
              : (r.companyName || "—");
            entry = {
              clientId: r.clientId,
              clientName: clientName || "—",
              invoicesPaidCount: 0,
              totalDelay: 0,
              totalLateness: 0,
              totalPaid: 0,
              worstLatenessDays: 0,
            };
            byClient.set(r.clientId, entry);
          }
          entry.invoicesPaidCount++;
          entry.totalDelay += delay;
          entry.totalLateness += lateness;
          entry.totalPaid += (r.totalPaid || 0);
          if (lateness > entry.worstLatenessDays) entry.worstLatenessDays = lateness;
        } catch {}
      }

      const result = Array.from(byClient.values()).map((c) => ({
        clientId: c.clientId,
        clientName: c.clientName,
        invoicesPaidCount: c.invoicesPaidCount,
        avgDelayDays: c.invoicesPaidCount > 0 ? Math.round(c.totalDelay / c.invoicesPaidCount) : 0,
        avgLatenessDays: c.invoicesPaidCount > 0 ? Math.round(c.totalLateness / c.invoicesPaidCount) : 0,
        totalPaid: c.totalPaid,
        worstLatenessDays: c.worstLatenessDays,
      }));

      // Tri par retard moyen DESC, puis par avgDelay DESC
      result.sort((a, b) => {
        if (b.avgLatenessDays !== a.avgLatenessDays) return b.avgLatenessDays - a.avgLatenessDays;
        return b.avgDelayDays - a.avgDelayDays;
      });

      return result.slice(0, limit);
    } catch (e) {
      console.error("[stats:getClientPaymentDelays]", e);
      return [];
    }
  });

  // Liste des factures actuellement en retard
  ipcMain.handle("stats:getOverdueInvoices", () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = db.prepare(`
        SELECT i.id, i.reference, i.clientId, i.totalTtc, i.totalPaid,
               i.issueDate, i.dueDate,
               c.companyName, c.firstName, c.lastName, c.type
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.clientId
        WHERE i.status IN ('envoyee', 'partiellement-payee')
          AND i.dueDate != '' AND i.dueDate < ?
        ORDER BY i.dueDate ASC
      `).all(today);

      return rows.map((r) => {
        const clientName = r.type === "particulier"
          ? `${r.firstName || ""} ${r.lastName || ""}`.trim()
          : (r.companyName || "—");
        let daysOverdue = 0;
        try {
          const due = new Date(r.dueDate);
          const t = new Date(today);
          daysOverdue = Math.round((t - due) / (1000 * 60 * 60 * 24));
        } catch {}
        return {
          id: r.id,
          reference: r.reference,
          clientId: r.clientId,
          clientName: clientName || "—",
          totalTtc: r.totalTtc || 0,
          totalPaid: r.totalPaid || 0,
          remainingAmount: +((r.totalTtc || 0) - (r.totalPaid || 0)).toFixed(2),
          issueDate: r.issueDate,
          dueDate: r.dueDate,
          daysOverdue,
        };
      });
    } catch (e) {
      console.error("[stats:getOverdueInvoices]", e);
      return [];
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // COMPARATIF YEAR-OVER-YEAR
  // ═════════════════════════════════════════════════════════════════════════

  function getYearMonthlyData(year) {
    // CA encaissé : SUM(totalPaid) où issueDate dans cette année
    const ca = db.prepare(`
      SELECT CAST(substr(issueDate, 6, 2) AS INTEGER) as month,
             COALESCE(SUM(totalPaid), 0) as total
      FROM invoices
      WHERE substr(issueDate, 1, 4) = ? AND status != 'annulee'
      GROUP BY month
    `).all(String(year));

    const expenses = db.prepare(`
      SELECT CAST(substr(expenseDate, 6, 2) AS INTEGER) as month,
             COALESCE(SUM(amountTtc), 0) as total
      FROM expenses
      WHERE substr(expenseDate, 1, 4) = ? AND status != 'annulee'
      GROUP BY month
    `).all(String(year));

    const caByMonth = {};
    const expByMonth = {};
    for (const r of ca) caByMonth[r.month] = r.total;
    for (const r of expenses) expByMonth[r.month] = r.total;

    return { caByMonth, expByMonth };
  }

  function computeDeltaPct(current, previous) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return +(((current - previous) / Math.abs(previous)) * 100).toFixed(1);
  }

  ipcMain.handle("stats:getYoYComparison", (_e, year) => {
    try {
      const yearCurrent = year || new Date().getFullYear();
      const yearPrevious = yearCurrent - 1;

      const current = getYearMonthlyData(yearCurrent);
      const previous = getYearMonthlyData(yearPrevious);

      const monthLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

      const monthly = [];
      let caTotalCurrent = 0, caTotalPrevious = 0;
      let expensesTotalCurrent = 0, expensesTotalPrevious = 0;

      for (let m = 1; m <= 12; m++) {
        const caCurrent = current.caByMonth[m] || 0;
        const caPrevious = previous.caByMonth[m] || 0;
        const expensesCurrent = current.expByMonth[m] || 0;
        const expensesPrevious = previous.expByMonth[m] || 0;
        const margeCurrent = caCurrent - expensesCurrent;
        const margePrevious = caPrevious - expensesPrevious;

        caTotalCurrent += caCurrent;
        caTotalPrevious += caPrevious;
        expensesTotalCurrent += expensesCurrent;
        expensesTotalPrevious += expensesPrevious;

        monthly.push({
          month: m,
          monthLabel: monthLabels[m - 1],
          caCurrent: +caCurrent.toFixed(2),
          caPrevious: +caPrevious.toFixed(2),
          caDeltaPct: computeDeltaPct(caCurrent, caPrevious),
          expensesCurrent: +expensesCurrent.toFixed(2),
          expensesPrevious: +expensesPrevious.toFixed(2),
          expensesDeltaPct: computeDeltaPct(expensesCurrent, expensesPrevious),
          margeCurrent: +margeCurrent.toFixed(2),
          margePrevious: +margePrevious.toFixed(2),
          margeDeltaPct: computeDeltaPct(margeCurrent, margePrevious),
        });
      }

      const margeTotalCurrent = caTotalCurrent - expensesTotalCurrent;
      const margeTotalPrevious = caTotalPrevious - expensesTotalPrevious;

      return {
        yearCurrent,
        yearPrevious,
        caTotalCurrent: +caTotalCurrent.toFixed(2),
        caTotalPrevious: +caTotalPrevious.toFixed(2),
        caEvolutionPct: computeDeltaPct(caTotalCurrent, caTotalPrevious),
        expensesTotalCurrent: +expensesTotalCurrent.toFixed(2),
        expensesTotalPrevious: +expensesTotalPrevious.toFixed(2),
        expensesEvolutionPct: computeDeltaPct(expensesTotalCurrent, expensesTotalPrevious),
        margeTotalCurrent: +margeTotalCurrent.toFixed(2),
        margeTotalPrevious: +margeTotalPrevious.toFixed(2),
        margeEvolutionPct: computeDeltaPct(margeTotalCurrent, margeTotalPrevious),
        monthly,
      };
    } catch (e) {
      console.error("[stats:getYoYComparison]", e);
      return null;
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SAISONNALITÉ (heatmap)
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("stats:getSeasonality", () => {
    try {
      // Récupérer tout le CA mensuel sur toutes les années disponibles
      const rows = db.prepare(`
        SELECT CAST(substr(issueDate, 1, 4) AS INTEGER) as year,
               CAST(substr(issueDate, 6, 2) AS INTEGER) as month,
               COALESCE(SUM(totalPaid), 0) as ca
        FROM invoices
        WHERE issueDate != '' AND status != 'annulee'
        GROUP BY year, month
        ORDER BY year ASC, month ASC
      `).all();

      const cells = rows.map((r) => ({
        year: r.year,
        month: r.month,
        ca: +(r.ca || 0).toFixed(2),
      }));

      const yearsSet = new Set();
      let maxCa = 0;
      for (const c of cells) {
        yearsSet.add(c.year);
        if (c.ca > maxCa) maxCa = c.ca;
      }
      const years = Array.from(yearsSet).sort();

      // Moyenne par mois sur toutes années
      const monthlyTotals = {};
      const monthlyCounts = {};
      for (const c of cells) {
        monthlyTotals[c.month] = (monthlyTotals[c.month] || 0) + c.ca;
        monthlyCounts[c.month] = (monthlyCounts[c.month] || 0) + 1;
      }
      const monthlyAverage = [];
      for (let m = 1; m <= 12; m++) {
        monthlyAverage.push({
          month: m,
          avgCa: monthlyCounts[m] ? +(monthlyTotals[m] / monthlyCounts[m]).toFixed(2) : 0,
        });
      }

      return { cells, years, maxCa, monthlyAverage };
    } catch (e) {
      console.error("[stats:getSeasonality]", e);
      return null;
    }
  });

  console.log("[stats] Module initialisé");
}

module.exports = { init };
