import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// BatiDeskApp — point d'entrée de l'app iPhone.
//
// App native SwiftUI qui reprend le design et les onglets de la web app
// BatiDesk (apps/web). Elle parle au même backend Express via /api/*.
// ═══════════════════════════════════════════════════════════════════════════

@main
struct BatiDeskApp: App {
    @StateObject private var auth = AuthManager()

    var body: some Scene {
        WindowGroup {
            RootContainerView()
                .environmentObject(auth)
        }
    }
}
