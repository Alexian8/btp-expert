import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// FinancesViewModel — agrège factures / dépenses / chantiers pour reproduire
// les KPI de la page web /finances (FinancesPage.tsx + financeStore.ts).
//
// Mêmes formules que le desktop (apps/desktop/electron/accounting.js) :
//   • CA encaissé mois/année = Σ totalPaid des factures (par issueDate),
//     hors annulées.
//   • CA en attente = Σ (totalTTC − totalPaid) des factures envoyées ou
//     partiellement payées.
//   • Dépenses mois/année = Σ amount (par date) ; à payer = non réglées.
//   • Marge = CA encaissé − dépenses.
//   • TVA collectée ≈ Σ (totalTTC − totalHT) × (totalPaid / totalTTC)
//     (TVA sur encaissements ; la TVA déductible n'est pas suivie côté
//     serveur — les dépenses n'ont pas de détail TVA).
//   • Marges par chantier = Σ factures TTC vs Σ dépenses, par chantier.
// ═══════════════════════════════════════════════════════════════════════════

@MainActor
final class FinancesViewModel: ObservableObject {
    @Published private(set) var phase: LoadPhase = .idle
    @Published private(set) var stats = FinanceStats()
    @Published private(set) var chantierMargins: [ChantierMargin] = []

    private let api = APIClient.shared
    private var hasData = false

    var isEmpty: Bool { !hasData }

    func loadIfNeeded() async {
        if case .idle = phase { await load() }
    }

    func load() async {
        if isEmpty { phase = .loading }
        do {
            let invoices: [Invoice] = try await api.list("/api/invoices")
            let expenses: [FinanceExpense] = try await api.list("/api/expenses")
            let chantiers: [Chantier] = try await api.list("/api/chantiers")
            compute(invoices: invoices, expenses: expenses, chantiers: chantiers)
            hasData = true
            phase = .loaded
        } catch {
            phase = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    // ─── Calculs ───────────────────────────────────────────────────────────
    private func compute(invoices: [Invoice], expenses: [FinanceExpense], chantiers: [Chantier]) {
        let calendar = Calendar.current
        let now = Date()
        let year = calendar.component(.year, from: now)
        let month = calendar.component(.month, from: now)
        let yearPrefix = String(format: "%04d", year)                    // "2026"
        let monthPrefix = String(format: "%04d-%02d", year, month)       // "2026-07"

        var s = FinanceStats()

        // ─── Factures (hors annulées) ──────────────────────────────────────
        for invoice in invoices where invoice.status != "annulee" {
            let day = String(invoice.issueDate.prefix(10))
            if day.hasPrefix(yearPrefix) {
                s.caEncaisseYear += invoice.totalPaid
                if day.hasPrefix(monthPrefix) {
                    s.caEncaisseMonth += invoice.totalPaid
                }
                // TVA sur encaissements, au prorata du payé.
                if invoice.totalTTC > 0 {
                    let tva = invoice.totalTTC - invoice.totalHT
                    s.tvaCollectee += tva * (invoice.totalPaid / invoice.totalTTC)
                }
            }
            if invoice.status == "envoyee" || invoice.status == "partiellement-payee" {
                s.caEnAttente += max(0, invoice.totalTTC - invoice.totalPaid)
            }
        }

        // ─── Dépenses (hors annulées ; colonnes compta ou legacy) ──────────
        for expense in expenses where !expense.isCancelled {
            let day = String(expense.effectiveDate.prefix(10))
            if day.hasPrefix(yearPrefix) {
                s.expensesYear += expense.effectiveAmount
                if day.hasPrefix(monthPrefix) {
                    s.expensesMonth += expense.effectiveAmount
                }
            }
            if !expense.effectiveIsPaid {
                s.expensesAPayer += expense.effectiveAmount
            }
        }

        s.margeMonth = s.caEncaisseMonth - s.expensesMonth
        s.margeYear = s.caEncaisseYear - s.expensesYear
        stats = s

        // ─── Marges par chantier ───────────────────────────────────────────
        var caByChantier: [String: Double] = [:]
        for invoice in invoices where invoice.status != "annulee" && !invoice.chantierId.isEmpty {
            caByChantier[invoice.chantierId, default: 0] += invoice.totalTTC
        }
        var expensesByChantier: [String: Double] = [:]
        for expense in expenses where !expense.chantierId.isEmpty && !expense.isCancelled {
            expensesByChantier[expense.chantierId, default: 0] += expense.effectiveAmount
        }

        chantierMargins = chantiers
            .map { chantier -> ChantierMargin in
                let ca = caByChantier[chantier.id] ?? 0
                let exp = expensesByChantier[chantier.id] ?? 0
                let marge = ca - exp
                return ChantierMargin(
                    chantierId: chantier.id,
                    chantierTitle: chantier.displayTitle,
                    chantierReference: chantier.reference,
                    ca: ca,
                    expenses: exp,
                    marge: marge,
                    margePct: ca > 0 ? (marge / ca) * 100 : 0
                )
            }
            .filter { $0.ca != 0 || $0.expenses != 0 }
            .sorted { $0.ca > $1.ca }
    }
}
