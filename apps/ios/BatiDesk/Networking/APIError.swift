import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// APIError — erreurs réseau présentables à l'utilisateur (messages fr).
// ═══════════════════════════════════════════════════════════════════════════

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case server(status: Int, message: String)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "L'adresse du serveur est invalide. Vérifie-la dans les Réglages."
        case .unauthorized:
            return "Session expirée. Reconnecte-toi."
        case .server(_, let message):
            return message
        case .decoding(let detail):
            return "Réponse inattendue du serveur (\(detail))."
        case .transport(let detail):
            return "Connexion au serveur impossible : \(detail)"
        }
    }
}
