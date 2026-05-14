import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// StateViews — états de chargement / erreur / vide réutilisables.
// ═══════════════════════════════════════════════════════════════════════════

struct LoadingView: View {
    var label: String = "Chargement…"

    var body: some View {
        VStack(spacing: 14) {
            ProgressView()
                .controlSize(.large)
                .tint(Theme.primary)
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

struct ErrorStateView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 44))
                .foregroundStyle(Theme.destructive)
            Text("Connexion impossible")
                .font(.headline)
                .foregroundStyle(Theme.foreground)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground)
                .multilineTextAlignment(.center)
            Button(action: retry) {
                Label("Réessayer", systemImage: "arrow.clockwise")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 18)
                    .frame(height: 44)
                    .background(Theme.primary)
                    .foregroundStyle(Theme.primaryForeground)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
            }
            .padding(.top, 4)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

struct EmptyStateView: View {
    let title: String
    var message: String = ""
    var icon: String = "tray"

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 42))
                .foregroundStyle(Theme.mutedForeground)
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.foreground)
            if !message.isEmpty {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

// ─── Bandeau d'erreur "inline" : affiché au-dessus de données déjà à l'écran
struct InlineErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
                .font(.caption)
            Spacer(minLength: 0)
        }
        .foregroundStyle(Theme.destructive)
        .padding(10)
        .background(Theme.destructive.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
    }
}

// ─── Conteneur qui choisit l'état à afficher selon la LoadPhase ───────────
struct ResourceStateView<Content: View>: View {
    let phase: LoadPhase
    let isEmpty: Bool
    var emptyTitle: String = "Rien à afficher"
    var emptyMessage: String = ""
    var emptyIcon: String = "tray"
    let retry: () -> Void
    @ViewBuilder var content: () -> Content

    var body: some View {
        switch phase {
        case .idle, .loading:
            if isEmpty {
                LoadingView()
            } else {
                content()
            }
        case .failed(let message):
            if isEmpty {
                ErrorStateView(message: message, retry: retry)
            } else {
                // On garde les données déjà chargées, l'erreur reste discrète.
                content()
            }
        case .loaded:
            if isEmpty {
                EmptyStateView(title: emptyTitle, message: emptyMessage, icon: emptyIcon)
            } else {
                content()
            }
        }
    }
}
