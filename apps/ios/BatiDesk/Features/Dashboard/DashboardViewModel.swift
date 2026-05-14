import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// DashboardViewModel — agrège clients / chantiers / devis / factures pour
// alimenter les KPI et alertes du tableau de bord (port de DashboardPage.tsx).
// ═══════════════════════════════════════════════════════════════════════════

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var phase: LoadPhase = .idle
    @Published private(set) var clients: [Client] = []
    @Published private(set) var chantiers: [Chantier] = []
    @Published private(set) var quotes: [Quote] = []
    @Published private(set) var invoices: [Invoice] = []

    private let api = APIClient.shared

    var isEmpty: Bool {
        clients.isEmpty && chantiers.isEmpty && quotes.isEmpty && invoices.isEmpty
    }

    func loadIfNeeded() async {
        if case .idle = phase { await load() }
    }

    func load() async {
        if isEmpty { phase = .loading }
        do {
            clients = try await api.list("/api/clients")
            chantiers = try await api.list("/api/chantiers")
            quotes = try await api.list("/api/quotes")
            invoices = try await api.list("/api/invoices")
            phase = .loaded
        } catch {
            phase = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    // ─── KPI ───────────────────────────────────────────────────────────────
    var clientsCount: Int { clients.count }
    var chantiersActifs: Int { chantiers.filter { $0.isActive }.count }
    var devisEnAttente: Int { quotes.filter { $0.status == "envoye" }.count }
    var devisBrouillons: Int { quotes.filter { $0.status == "brouillon" }.count }

    var facturesEnRetard: [Invoice] {
        invoices.filter { $0.isOverdue }
    }

    var montantImpaye: Double {
        invoices
            .filter { $0.status == "envoyee" || $0.status == "partiellement-payee" }
            .reduce(0) { $0 + $1.remainingDue }
    }

    /// CA encaissé sur le mois courant (somme des totalPaid des factures émises ce mois).
    var caEncaisseMois: Double {
        let calendar = Calendar.current
        let now = Date()
        return invoices.reduce(0) { sum, invoice in
            guard invoice.status != "annulee" else { return sum }
            guard let issued = Format.parseDate(invoice.issueDate) else { return sum }
            return calendar.isDate(issued, equalTo: now, toGranularity: .month)
                ? sum + invoice.totalPaid
                : sum
        }
    }

    // ─── Listes "récents" ──────────────────────────────────────────────────
    var recentQuotes: [Quote] {
        Array(quotes.sorted { sortKey($0) > sortKey($1) }.prefix(4))
    }

    var chantiersEnCours: [Chantier] {
        Array(chantiers.filter { $0.isActive }.prefix(5))
    }

    private func sortKey(_ quote: Quote) -> String {
        // createdAt MySQL "yyyy-MM-dd HH:mm:ss" : le tri lexical = tri chrono.
        quote.createdAt.isEmpty ? quote.issueDate : quote.createdAt
    }
}
