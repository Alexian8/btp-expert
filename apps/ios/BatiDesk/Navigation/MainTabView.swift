import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// MainTabView — coque de navigation à onglets.
//
// La web app a 13 entrées de menu (sidebar desktop / menu mobile). Sur iPhone
// on garde les 4 entrées les plus utilisées + un onglet « Plus » qui regroupe
// tout le reste — convention iOS.
// ═══════════════════════════════════════════════════════════════════════════

struct MainTabView: View {
    @StateObject private var clientDirectory = ClientDirectory()

    var body: some View {
        TabView {
            NavigationStack { DashboardView() }
                .tabItem { Label("Bord", systemImage: "square.grid.2x2.fill") }

            NavigationStack { QuotesInvoicesView() }
                .tabItem { Label("Devis & Factures", systemImage: "doc.text.fill") }

            NavigationStack { ChantiersView() }
                .tabItem { Label("Chantiers", systemImage: "hammer.fill") }

            NavigationStack { ClientsView() }
                .tabItem { Label("Clients", systemImage: "person.2.fill") }

            NavigationStack { MoreView() }
                .tabItem { Label("Plus", systemImage: "ellipsis") }
        }
        .tint(Theme.primary)
        .environmentObject(clientDirectory)
    }
}
