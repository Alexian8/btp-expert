import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// DashboardView — onglet « Tableau de bord » (port de DashboardPage.tsx).
// Salutation contextuelle + alertes + KPI + derniers devis / chantiers.
// ═══════════════════════════════════════════════════════════════════════════

struct DashboardView: View {
    @EnvironmentObject private var auth: AuthManager
    @StateObject private var vm = DashboardViewModel()

    var body: some View {
        Group {
            if vm.isEmpty && (vm.phase.isLoading || vm.phase == .idle) {
                LoadingView()
            } else if vm.isEmpty, let message = vm.phase.failureMessage {
                ErrorStateView(message: message) { Task { await vm.load() } }
            } else {
                dashboardScroll
            }
        }
        .background(Theme.background)
        .navigationTitle("Tableau de bord")
        .navigationBarTitleDisplayMode(.large)
        .task { await vm.loadIfNeeded() }
    }

    private var dashboardScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                greetingHeader

                if let message = vm.phase.failureMessage {
                    InlineErrorBanner(message: message)
                }

                alertsSection
                kpiGrid
                recentQuotesSection
                chantiersSection
            }
            .padding(16)
        }
        .background(Theme.background)
        .refreshable { await vm.load() }
    }

    // ─── En-tête ───────────────────────────────────────────────────────────
    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting + (firstName.isEmpty ? "" : ", \(firstName)"))
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)
            Text(todayLabel)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // ─── Alertes ───────────────────────────────────────────────────────────
    @ViewBuilder private var alertsSection: some View {
        let overdue = vm.facturesEnRetard
        if !overdue.isEmpty {
            AlertBanner(
                level: .danger,
                icon: "exclamationmark.triangle.fill",
                title: "\(overdue.count) facture\(overdue.count > 1 ? "s" : "") en retard",
                subtitle: "\(Format.currency(overdue.reduce(0) { $0 + $1.remainingDue })) à recouvrer",
                showsChevron: false
            )
        }
        if vm.devisEnAttente > 0 {
            AlertBanner(
                level: .warning,
                icon: "clock.badge.exclamationmark",
                title: "\(vm.devisEnAttente) devis en attente de réponse",
                subtitle: "Pense à relancer tes clients",
                showsChevron: false
            )
        }
    }

    // ─── KPI ───────────────────────────────────────────────────────────────
    private var kpiGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
            spacing: 12
        ) {
            StatCard(title: "Chantiers en cours", value: "\(vm.chantiersActifs)",
                     icon: "hammer.fill", tint: Theme.primary)
            StatCard(title: "Devis en attente", value: "\(vm.devisEnAttente)",
                     icon: "doc.text.fill", tint: Theme.warning)
            StatCard(title: "Encaissé ce mois", value: Format.currencyCompact(vm.caEncaisseMois),
                     icon: "eurosign.circle.fill", tint: Theme.success)
            StatCard(title: "Reste à encaisser", value: Format.currencyCompact(vm.montantImpaye),
                     icon: "creditcard.fill", tint: Theme.destructive)
        }
    }

    // ─── Derniers devis ────────────────────────────────────────────────────
    @ViewBuilder private var recentQuotesSection: some View {
        if !vm.recentQuotes.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("Derniers devis")
                ForEach(vm.recentQuotes) { quote in
                    NavigationLink {
                        QuoteDetailView(quote: quote)
                    } label: {
                        QuoteRow(quote: quote, clientName: vm.clientName(for: quote.clientId))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // ─── Chantiers en cours ────────────────────────────────────────────────
    @ViewBuilder private var chantiersSection: some View {
        if !vm.chantiersEnCours.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("Chantiers en cours")
                ForEach(vm.chantiersEnCours) { chantier in
                    NavigationLink {
                        ChantierDetailView(chantier: chantier)
                    } label: {
                        ChantierRow(chantier: chantier, clientName: vm.clientName(for: chantier.clientId))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(Theme.foreground)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // ─── Helpers ───────────────────────────────────────────────────────────
    private var firstName: String {
        let value = auth.user?.firstName ?? ""
        return value.isEmpty ? (auth.user?.username ?? "") : value
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 5..<12:  return "Bonjour"
        case 12..<18: return "Bon après-midi"
        default:      return "Bonsoir"
        }
    }

    private var todayLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "EEEE d MMMM"
        let raw = formatter.string(from: Date())
        return raw.prefix(1).uppercased() + raw.dropFirst()
    }
}

private extension DashboardViewModel {
    func clientName(for clientId: String) -> String? {
        guard !clientId.isEmpty else { return nil }
        return clients.first { $0.id == clientId }?.displayName
    }
}
