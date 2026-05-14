import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// LoadPhase — état d'un chargement asynchrone partagé par les écrans liste.
// ═══════════════════════════════════════════════════════════════════════════

enum LoadPhase: Equatable {
    case idle
    case loading
    case loaded
    case failed(String)

    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    var failureMessage: String? {
        if case .failed(let message) = self { return message }
        return nil
    }
}
