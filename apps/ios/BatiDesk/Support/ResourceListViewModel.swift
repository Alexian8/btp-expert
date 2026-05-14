import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// ResourceListViewModel — chargement générique d'une liste REST.
//
// Réutilisé par les écrans Clients / Chantiers / Devis / Factures /
// Fournisseurs : tous suivent le même contrat CRUD côté serveur
// (GET /api/<ressource> → tableau JSON).
// ═══════════════════════════════════════════════════════════════════════════

@MainActor
final class ResourceListViewModel<T: Decodable & Identifiable>: ObservableObject {
    @Published private(set) var phase: LoadPhase = .idle
    @Published private(set) var items: [T] = []

    private let path: String
    private let api = APIClient.shared

    init(path: String) {
        self.path = path
    }

    /// Premier chargement uniquement (idempotent, à appeler dans `.task`).
    func loadIfNeeded() async {
        if case .idle = phase { await load() }
    }

    /// Rechargement complet (pull-to-refresh, bouton « Réessayer »).
    func load() async {
        if items.isEmpty { phase = .loading }
        do {
            items = try await api.list(path)
            phase = .loaded
        } catch {
            let message = (error as? APIError)?.errorDescription ?? error.localizedDescription
            phase = .failed(message)
        }
    }
}
