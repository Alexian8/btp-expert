import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// FinancesView — écran « Finances » (port lecture seule de FinancesPage.tsx).
// KPI financiers (CA encaissé / en attente, dépenses, marge, TVA) + marges
// par chantier, calculés sur l'année en cours.
// ═══════════════════════════════════════════════════════════════════════════

struct FinancesView: View {
    @StateObject private var vm = FinancesViewModel()

    private var currentYear: Int {
        Calendar.current.component(.year, from: Date())
    }

    var body: some View {
        Group {
            if vm.isEmpty && (vm.phase.isLoading || vm.phase == .idle) {
                LoadingView()
            } else if vm.isEmpty, let message = vm.phase.failureMessage {
                ErrorStateView(message: message) { Task { await vm.load() } }
            } else {
                financesScroll
            }
        }
        .background(Theme.background)
        .navigationTitle("Finances")
        .navigationBarTitleDisplayMode(.large)
        .task { await vm.loadIfNeeded() }
    }

    private var financesScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let message = vm.phase.failureMessage {
                    InlineErrorBanner(message: message)
                }

                kpiGrid
                tvaSection
                marginsSection
                footerNote
            }
            .padding(16)
        }
        .background(Theme.background)
        .refreshable { await vm.load() }
    }

    // ─── KPI ───────────────────────────────────────────────────────────────
    private var kpiGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
            spacing: 12
        ) {
            StatCard(
                title: "CA encaissé ce mois",
                value: Format.currencyCompact(vm.stats.caEncaisseMonth),
                icon: "wallet.pass.fill",
                tint: Theme.success,
                caption: "\(currentYear) : \(Format.currency(vm.stats.caEncaisseYear))"
            )
            StatCard(
                title: "CA en attente",
                value: Format.currencyCompact(vm.stats.caEnAttente),
                icon: "exclamationmark.circle.fill",
                tint: Theme.warning,
                caption: "Factures non payées"
            )
            StatCard(
                title: "Dépenses ce mois",
                value: Format.currencyCompact(vm.stats.expensesMonth),
                icon: "creditcard.fill",
                tint: Theme.destructive,
                caption: "\(currentYear) : \(Format.currency(vm.stats.expensesYear))"
            )
            StatCard(
                title: "Marge ce mois",
                value: Format.currencyCompact(vm.stats.margeMonth),
                icon: vm.stats.margeMonth >= 0 ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis",
                tint: vm.stats.margeMonth >= 0 ? Theme.success : Theme.destructive,
                caption: "\(currentYear) : \(Format.currency(vm.stats.margeYear))"
            )
        }
    }

    // ─── TVA ───────────────────────────────────────────────────────────────
    private var tvaSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("TVA · \(String(currentYear))")
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Collectée (sur encaissements)")
                        .font(.subheadline)
                        .foregroundStyle(Theme.foreground)
                    Spacer(minLength: 8)
                    Text(Format.currency(vm.stats.tvaCollectee))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .monospacedDigit()
                }
                HStack {
                    Text("Dépenses à payer")
                        .font(.subheadline)
                        .foregroundStyle(Theme.foreground)
                    Spacer(minLength: 8)
                    Text(Format.currency(vm.stats.expensesAPayer))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(vm.stats.expensesAPayer > 0 ? Theme.warning : Theme.success)
                        .monospacedDigit()
                }
                Text("Estimation cumulée sur l'année, au prorata des paiements reçus. Pour la déclaration, voir avec ton expert-comptable.")
                    .font(.caption2)
                    .foregroundStyle(Theme.mutedForeground)
            }
            .cardSurface(padding: 14)
        }
    }

    // ─── Marges par chantier ───────────────────────────────────────────────
    @ViewBuilder private var marginsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Marges par chantier")
            if vm.chantierMargins.isEmpty {
                Text("Pas encore de données — facture ou impute des dépenses à un chantier pour voir sa marge.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardSurface(padding: 14)
            } else {
                VStack(spacing: 10) {
                    ForEach(vm.chantierMargins) { margin in
                        ChantierMarginRow(margin: margin)
                    }
                }
            }
        }
    }

    private var footerNote: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("À propos de ces chiffres")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.foreground)
            Text("Le CA encaissé correspond au total payé sur tes factures ; le CA en attente couvre les factures envoyées non encore réglées. Données de pilotage, calculées sur l'appareil à partir des factures et dépenses.")
                .font(.caption2)
                .foregroundStyle(Theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(padding: 12)
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(Theme.foreground)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// ─── Ligne « marge chantier » : CA / dépenses / marge % ────────────────────
private struct ChantierMarginRow: View {
    let margin: ChantierMargin

    private var isPositive: Bool { margin.marge >= 0 }
    private var tint: Color { isPositive ? Theme.success : Theme.destructive }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(margin.chantierTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .lineLimit(1)
                    if !margin.chantierReference.isEmpty {
                        Text(margin.chantierReference)
                            .font(.caption2)
                            .foregroundStyle(Theme.mutedForeground)
                    }
                }
                Spacer(minLength: 8)
                Text(margin.ca > 0 ? String(format: "%+.0f %%", margin.margePct) : "—")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(tint)
                    .monospacedDigit()
            }
            HStack(spacing: 12) {
                amountColumn("CA", Format.currency(margin.ca), Theme.foreground)
                amountColumn("Dépenses", Format.currency(margin.expenses), Theme.foreground)
                amountColumn("Marge", Format.currency(margin.marge), tint)
            }
        }
        .cardSurface(padding: 14)
    }

    private func amountColumn(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.mutedForeground)
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(color)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
