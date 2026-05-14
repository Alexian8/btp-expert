import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// SettingsView — « Réglages » : compte, apparence, serveur, déconnexion.
// ═══════════════════════════════════════════════════════════════════════════

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthManager
    @AppStorage("appearance") private var appearanceRaw: String = AppearancePreference.dark.rawValue

    @State private var showServerSheet = false
    @State private var showLogoutConfirm = false

    var body: some View {
        List {
            // ─── Compte ────────────────────────────────────────────────────
            Section("Compte") {
                infoRow(label: "Nom", value: auth.user?.displayName ?? "—")
                infoRow(label: "Identifiant", value: auth.user?.username ?? "—")
                if let email = auth.user?.email, !email.isEmpty {
                    infoRow(label: "E-mail", value: email)
                }
                infoRow(label: "Rôle", value: auth.user?.roleLabel ?? "—")
                if let company = auth.user?.companyName, !company.isEmpty {
                    infoRow(label: "Entreprise", value: company)
                }
            }

            // ─── Apparence ─────────────────────────────────────────────────
            Section("Apparence") {
                Picker(selection: $appearanceRaw) {
                    ForEach(AppearancePreference.allCases) { preference in
                        Label(preference.label, systemImage: preference.icon)
                            .tag(preference.rawValue)
                    }
                } label: {
                    Text("Thème").foregroundStyle(Theme.foreground)
                }
                .listRowBackground(Theme.card)
            }

            // ─── Serveur ───────────────────────────────────────────────────
            Section {
                Button {
                    showServerSheet = true
                } label: {
                    HStack {
                        Label {
                            Text("Serveur").foregroundStyle(Theme.foreground)
                        } icon: {
                            Image(systemName: "server.rack").foregroundStyle(Theme.primary)
                        }
                        Spacer()
                        Text(serverHost)
                            .font(.caption)
                            .foregroundStyle(Theme.mutedForeground)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.mutedForeground)
                    }
                }
                .listRowBackground(Theme.card)
            } header: {
                Text("Connexion")
            } footer: {
                Text("Adresse du backend BatiDesk utilisé pour la connexion et la synchronisation des données.")
            }

            // ─── À propos ──────────────────────────────────────────────────
            Section("À propos") {
                infoRow(label: "Application", value: "BatiDesk pour iPhone")
                infoRow(label: "Version", value: appVersion)
            }

            // ─── Déconnexion ───────────────────────────────────────────────
            Section {
                Button(role: .destructive) {
                    showLogoutConfirm = true
                } label: {
                    HStack {
                        Spacer()
                        Label("Se déconnecter", systemImage: "rectangle.portrait.and.arrow.right")
                        Spacer()
                    }
                }
                .listRowBackground(Theme.card)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Réglages")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showServerSheet) {
            ServerSettingsView()
        }
        .confirmationDialog("Se déconnecter de BatiDesk ?",
                            isPresented: $showLogoutConfirm,
                            titleVisibility: .visible) {
            Button("Se déconnecter", role: .destructive) {
                Task { await auth.logout() }
            }
            Button("Annuler", role: .cancel) {}
        }
    }

    private func infoRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(Theme.mutedForeground)
            Spacer()
            Text(value)
                .foregroundStyle(Theme.foreground)
                .multilineTextAlignment(.trailing)
                .textSelection(.enabled)
        }
        .font(.subheadline)
        .listRowBackground(Theme.card)
    }

    private var serverHost: String {
        let raw = APIClient.shared.baseURLString
        return URL(string: raw)?.host ?? raw
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ServerSettingsView — édition de l'URL du backend (feuille modale).
// Présentée depuis l'écran de login ET depuis les Réglages.
// ═══════════════════════════════════════════════════════════════════════════

struct ServerSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var urlText: String = APIClient.shared.baseURLString

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://…", text: $urlText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .foregroundStyle(Theme.foreground)
                        .listRowBackground(Theme.card)
                } header: {
                    Text("Adresse du serveur BatiDesk")
                } footer: {
                    Text("Serveur de production par défaut :\n\(APIClient.defaultBaseURL)\n\nUtilise une autre adresse pour pointer vers un serveur de test ou un développement local.")
                }

                Section {
                    Button("Réinitialiser l'adresse par défaut") {
                        urlText = APIClient.defaultBaseURL
                    }
                    .listRowBackground(Theme.card)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Serveur")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") {
                        let trimmed = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty {
                            APIClient.shared.baseURLString = trimmed
                        }
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}
