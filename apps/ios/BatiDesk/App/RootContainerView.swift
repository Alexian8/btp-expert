import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// RootContainerView — aiguillage racine : splash → login → app.
// Applique aussi la préférence d'apparence (clair / sombre / système).
// ═══════════════════════════════════════════════════════════════════════════

enum AppearancePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: return "Système"
        case .light:  return "Clair"
        case .dark:   return "Sombre"
        }
    }

    var icon: String {
        switch self {
        case .system: return "circle.lefthalf.filled"
        case .light:  return "sun.max"
        case .dark:   return "moon"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light:  return .light
        case .dark:   return .dark
        }
    }
}

struct RootContainerView: View {
    @EnvironmentObject private var auth: AuthManager
    // La web app démarre en thème sombre par défaut — on fait pareil.
    @AppStorage("appearance") private var appearanceRaw: String = AppearancePreference.dark.rawValue

    private var appearance: AppearancePreference {
        AppearancePreference(rawValue: appearanceRaw) ?? .dark
    }

    var body: some View {
        Group {
            if auth.isBooting {
                SplashView()
            } else if auth.user == nil {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .tint(Theme.primary)
        .preferredColorScheme(appearance.colorScheme)
        .task {
            await auth.restoreSession()
        }
    }
}

// ─── Splash de démarrage (pendant restoreSession) ─────────────────────────
struct SplashView: View {
    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 24) {
                Image("LogoSquare")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 88, height: 88)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                ProgressView()
                    .controlSize(.large)
                    .tint(Theme.primary)
            }
        }
    }
}
