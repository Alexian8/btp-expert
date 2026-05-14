import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// LoginView — écran de connexion (port de apps/desktop/.../LoginPage.tsx).
// Carte centrée, logo horizontal, champs identifiant / mot de passe.
// ═══════════════════════════════════════════════════════════════════════════

struct LoginView: View {
    @EnvironmentObject private var auth: AuthManager

    @State private var username = ""
    @State private var password = ""
    @State private var showServerSheet = false
    @FocusState private var focusedField: Field?

    private enum Field { case username, password }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    Spacer(minLength: 40)

                    Image("LogoHorizontal")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 52)
                        .padding(.bottom, 4)

                    VStack(spacing: 6) {
                        Text("Connexion")
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(Theme.foreground)
                        Text("Accède à ton espace BatiDesk")
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground)
                    }

                    VStack(spacing: 14) {
                        FieldLabelStack(label: "Identifiant") {
                            TextField("ex. jdupont", text: $username)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .textContentType(.username)
                                .submitLabel(.next)
                                .focused($focusedField, equals: .username)
                                .onSubmit { focusedField = .password }
                                .batiDeskField()
                        }

                        FieldLabelStack(label: "Mot de passe") {
                            SecureField("••••••••", text: $password)
                                .textContentType(.password)
                                .submitLabel(.go)
                                .focused($focusedField, equals: .password)
                                .onSubmit { submit() }
                                .batiDeskField()
                        }

                        if let error = auth.loginError {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                Text(error)
                            }
                            .font(.footnote)
                            .foregroundStyle(Theme.destructive)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(action: submit) {
                            HStack(spacing: 8) {
                                if auth.isLoggingIn {
                                    ProgressView()
                                        .controlSize(.small)
                                        .tint(Theme.primaryForeground)
                                }
                                Text(auth.isLoggingIn ? "Connexion…" : "Se connecter")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Theme.primary)
                            .foregroundStyle(Theme.primaryForeground)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
                        }
                        .disabled(auth.isLoggingIn)
                        .padding(.top, 4)
                    }
                    .cardSurface(padding: 20)

                    Button {
                        showServerSheet = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "server.rack")
                            Text(serverHostLabel)
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.mutedForeground)
                    }

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 460)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .sheet(isPresented: $showServerSheet) {
            ServerSettingsView()
        }
    }

    private var serverHostLabel: String {
        let raw = APIClient.shared.baseURLString
        if let host = URL(string: raw)?.host { return host }
        return raw
    }

    private func submit() {
        focusedField = nil
        Task { await auth.login(username: username, password: password) }
    }
}

// ─── Petit conteneur "label + champ" réutilisé sur le formulaire ──────────
struct FieldLabelStack<Content: View>: View {
    let label: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.mutedForeground)
            content()
        }
    }
}

extension View {
    /// Style commun des champs de saisie (fond muted, bordure douce).
    func batiDeskField() -> some View {
        self
            .font(.body)
            .foregroundStyle(Theme.foreground)
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(Theme.muted)
            .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
    }
}
