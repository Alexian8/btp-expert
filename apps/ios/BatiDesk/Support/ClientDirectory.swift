import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// ClientDirectory — annuaire clients partagé.
//
// Chargé une fois puis injecté dans l'environnement. Permet aux écrans
// Chantiers / Devis / Factures d'afficher le nom du client à partir de son
// clientId, sans recharger la liste à chaque fois.
// ═══════════════════════════════════════════════════════════════════════════

@MainActor
final class ClientDirectory: ObservableObject {
    @Published private(set) var byId: [String: Client] = [:]

    private var hasLoaded = false
    private let api = APIClient.shared

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await reload()
    }

    func reload() async {
        do {
            let clients: [Client] = try await api.list("/api/clients")
            byId = Dictionary(clients.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            hasLoaded = true
        } catch {
            // Silencieux : ne pas bloquer un écran juste parce que les noms
            // de clients ne sont pas résolus.
        }
    }

    func name(for clientId: String) -> String? {
        guard !clientId.isEmpty else { return nil }
        return byId[clientId]?.displayName
    }

    func client(_ clientId: String) -> Client? {
        byId[clientId]
    }
}
