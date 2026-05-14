import Foundation
import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// AuthManager — session utilisateur (équivalent du authStore Zustand côté web).
//
// • restoreSession() : au boot, si un JWT est en Keychain, on appelle
//   /api/auth/me pour réhydrater le user (évite un re-login forcé).
// • login() : POST /api/auth/login, stocke le token, expose le user.
// • logout() : best-effort POST /api/auth/logout puis purge du token.
// ═══════════════════════════════════════════════════════════════════════════

@MainActor
final class AuthManager: ObservableObject {
    @Published var user: User?
    @Published var isBooting = true
    @Published var isLoggingIn = false
    @Published var loginError: String?

    private let api = APIClient.shared

    init() {
        // Le serveur a renvoyé 401 hors login → la session n'est plus valide.
        NotificationCenter.default.addObserver(
            forName: .batiDeskUnauthorized,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.user = nil }
        }
    }

    var isAuthenticated: Bool { user != nil }

    func restoreSession() async {
        defer { isBooting = false }
        guard api.hasToken else { return }
        do {
            let me: User = try await api.get("/api/auth/me")
            user = me
        } catch {
            api.setToken(nil)
            user = nil
        }
    }

    func login(username: String, password: String) async {
        let trimmedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedUsername.isEmpty, !password.isEmpty else {
            loginError = "Saisis ton identifiant et ton mot de passe."
            return
        }

        isLoggingIn = true
        loginError = nil
        defer { isLoggingIn = false }

        struct Credentials: Encodable {
            let username: String
            let password: String
        }

        do {
            let response: LoginResponse = try await api.request(
                "POST", "/api/auth/login",
                body: Credentials(username: trimmedUsername, password: password)
            )
            guard !response.token.isEmpty else {
                loginError = "Le serveur n'a pas renvoyé de jeton de connexion."
                return
            }
            api.setToken(response.token)
            user = response.user
        } catch APIError.unauthorized {
            loginError = "Identifiants invalides."
        } catch let APIError.server(_, message) {
            loginError = message
        } catch {
            loginError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func logout() async {
        try? await api.rawRequest("POST", "/api/auth/logout")
        api.setToken(nil)
        user = nil
        loginError = nil
    }
}
