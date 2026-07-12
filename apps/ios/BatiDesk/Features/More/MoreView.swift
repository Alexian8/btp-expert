import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// MoreView — onglet « Plus » : regroupe les entrées de menu de la web app
// qui ne tiennent pas dans la TabBar.
//
// Fournisseurs et Réglages sont fonctionnels. Les autres écrans (Agenda,
// Dépenses, Notes de frais, Sous-traitants, Finances, Statistiques, Documents
// admin, Coffre-fort) sont des placeholders : à porter dans une prochaine
// itération (cf README).
// ═══════════════════════════════════════════════════════════════════════════

struct MoreView: View {
    @EnvironmentObject private var auth: AuthManager

    var body: some View {
        List {
            Section {
                accountHeader
            }

            Section("Gestion") {
                moreLink("Fournisseurs", systemImage: "shippingbox.fill", tint: Theme.warning) {
                    SuppliersView()
                }
                moreLink("Agenda", systemImage: "calendar", tint: Theme.primary) {
                    AgendaView()
                }
                moreLink("Sous-traitants", systemImage: "person.3.fill", tint: Theme.primary) {
                    SubcontractorsView()
                }
            }

            Section("Comptabilité") {
                moreLink("Dépenses", systemImage: "creditcard.fill", tint: Theme.destructive) {
                    ExpensesView()
                }
                moreLink("Notes de frais", systemImage: "wallet.pass.fill", tint: Theme.success) {
                    ExpenseNotesView()
                }
                moreLink("Finances", systemImage: "chart.bar.fill", tint: Theme.primary) {
                    FinancesView()
                }
                moreLink("Statistiques", systemImage: "chart.line.uptrend.xyaxis", tint: Theme.success) {
                    PlaceholderView(title: "Statistiques", icon: "chart.line.uptrend.xyaxis")
                }
            }

            Section("Documents") {
                moreLink("Documents admin", systemImage: "doc.badge.gearshape", tint: Theme.primary) {
                    PlaceholderView(title: "Documents admin", icon: "doc.badge.gearshape")
                }
                moreLink("Coffre-fort", systemImage: "lock.fill", tint: Theme.warning) {
                    PlaceholderView(title: "Coffre-fort", icon: "lock.fill")
                }
            }

            Section {
                moreLink("Réglages", systemImage: "gearshape.fill", tint: Theme.mutedForeground) {
                    SettingsView()
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Plus")
    }

    // ─── En-tête compte ────────────────────────────────────────────────────
    private var accountHeader: some View {
        HStack(spacing: 12) {
            Avatar(initials: auth.user?.initials ?? "?", size: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(auth.user?.displayName ?? "—")
                    .font(.headline)
                    .foregroundStyle(Theme.foreground)
                Text(auth.user?.roleLabel ?? "")
                    .font(.caption)
                    .foregroundStyle(Theme.mutedForeground)
                if let company = auth.user?.companyName, !company.isEmpty {
                    Text(company)
                        .font(.caption2)
                        .foregroundStyle(Theme.mutedForeground)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
        .listRowBackground(Theme.card)
    }

    // ─── Lien de menu ──────────────────────────────────────────────────────
    @ViewBuilder
    private func moreLink<Destination: View>(
        _ title: String,
        systemImage: String,
        tint: Color,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            Label {
                Text(title).foregroundStyle(Theme.foreground)
            } icon: {
                Image(systemName: systemImage)
                    .foregroundStyle(tint)
            }
        }
        .listRowBackground(Theme.card)
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PlaceholderView — écran « bientôt disponible » pour les sections non portées.
// ═══════════════════════════════════════════════════════════════════════════

struct PlaceholderView: View {
    let title: String
    var icon: String = "hammer.fill"

    var body: some View {
        VStack(spacing: 16) {
            IconBadge(systemName: icon, size: 72, tint: Theme.primary)
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)
            Text("Cette section sera portée dans une prochaine version de l'app mobile. Elle reste accessible depuis la web app et l'application desktop BatiDesk.")
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
