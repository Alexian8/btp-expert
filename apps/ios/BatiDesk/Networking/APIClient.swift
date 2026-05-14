import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// APIClient — client HTTP du backend BatiDesk (apps/server).
//
// Équivalent natif du shim window.btpAPI de la web app : il parle aux mêmes
// routes REST /api/*. Le JWT est ajouté en Authorization: Bearer sur chaque
// requête et conservé dans le Keychain entre deux lancements.
//
// L'URL de base est configurable (Réglages) — par défaut le serveur de prod.
// ═══════════════════════════════════════════════════════════════════════════

@MainActor
final class APIClient: ObservableObject {
    static let shared = APIClient()

    /// Serveur o2switch de production (cf apps/web/README.md).
    static let defaultBaseURL = "https://intranet.jacobhabitat-dev.fr"
    private static let baseURLKey = "apiBaseURL"

    /// URL de base configurable, persistée dans UserDefaults.
    var baseURLString: String {
        get { UserDefaults.standard.string(forKey: Self.baseURLKey) ?? Self.defaultBaseURL }
        set { UserDefaults.standard.set(newValue.trimmingCharacters(in: .whitespaces), forKey: Self.baseURLKey) }
    }

    private(set) var token: String?
    private let session: URLSession

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 20
        configuration.waitsForConnectivity = true
        session = URLSession(configuration: configuration)
        token = Keychain.read(.authToken)
    }

    var hasToken: Bool { token != nil }

    func setToken(_ newToken: String?) {
        token = newToken
        if let newToken {
            Keychain.save(.authToken, value: newToken)
        } else {
            Keychain.delete(.authToken)
        }
    }

    // ─── Construction d'URL ────────────────────────────────────────────────
    private func makeURL(_ path: String) throws -> URL {
        var base = baseURLString.trimmingCharacters(in: .whitespaces)
        while base.hasSuffix("/") { base.removeLast() }
        let suffix = path.hasPrefix("/") ? path : "/" + path
        guard !base.isEmpty, let url = URL(string: base + suffix) else {
            throw APIError.invalidURL
        }
        return url
    }

    // ─── Requête décodée ───────────────────────────────────────────────────
    // Le type `T` est toujours déduit du contexte d'appel (annotation de la
    // variable de réception ou type de retour de `list` / `get`).
    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        body: Encodable? = nil
    ) async throws -> T {
        let data = try await rawRequest(method, path, body: body)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(shortDecodingError(error))
        }
    }

    /// GET d'une liste (`/api/clients`, `/api/chantiers`…).
    func list<T: Decodable>(_ path: String) async throws -> [T] {
        let items: [T] = try await request("GET", path)
        return items
    }

    /// GET d'une entité unique.
    func get<T: Decodable>(_ path: String) async throws -> T {
        try await request("GET", path)
    }

    // ─── Requête brute (corps non décodé / réponses 204) ───────────────────
    @discardableResult
    func rawRequest(_ method: String, _ path: String, body: Encodable? = nil) async throws -> Data {
        let url = try makeURL(path)
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("réponse HTTP invalide")
        }

        if http.statusCode == 401 {
            // Sur l'écran de login un 401 = mauvais identifiants : on ne
            // déclenche pas la déconnexion globale dans ce cas précis.
            if !path.hasPrefix("/api/auth/login") {
                setToken(nil)
                NotificationCenter.default.post(name: .batiDeskUnauthorized, object: nil)
            }
            throw APIError.unauthorized
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = Self.extractMessage(from: data) ?? "Erreur serveur (\(http.statusCode))."
            throw APIError.server(status: http.statusCode, message: message)
        }

        return data
    }

    private static func extractMessage(from data: Data) -> String? {
        guard
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let message = object["message"] as? String,
            !message.isEmpty
        else { return nil }
        return message
    }

    private func shortDecodingError(_ error: Error) -> String {
        switch error {
        case let DecodingError.keyNotFound(key, _):
            return "champ manquant « \(key.stringValue) »"
        case let DecodingError.typeMismatch(_, context):
            return context.codingPath.last?.stringValue ?? "type inattendu"
        case let DecodingError.valueNotFound(_, context):
            return context.codingPath.last?.stringValue ?? "valeur nulle"
        default:
            return "format JSON"
        }
    }
}

extension Notification.Name {
    /// Émise quand le serveur répond 401 hors écran de login → déconnexion.
    static let batiDeskUnauthorized = Notification.Name("batiDeskUnauthorized")
}

/// Efface le type concret d'un `Encodable` pour permettre des corps de requête
/// hétérogènes tout en restant compatible avec `JSONEncoder`.
struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        encodeClosure = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
