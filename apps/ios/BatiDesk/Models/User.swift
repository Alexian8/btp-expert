import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// User — utilisateur connecté. Renvoyé par /api/auth/login et /api/auth/me.
// (cf apps/server/src/routes/auth.ts)
// ═══════════════════════════════════════════════════════════════════════════

struct User: Decodable, Identifiable, Equatable {
    let id: Int
    var username: String
    var role: String
    var email: String
    var firstName: String
    var lastName: String
    var companyId: Int
    var companyName: String
    var isSetupComplete: Bool
    var mustChangePassword: Bool

    enum CodingKeys: String, CodingKey {
        case id, username, role, email, firstName, lastName
        case companyId, companyName, isSetupComplete, mustChangePassword
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.intVal(.id)
        username = c.str(.username)
        role = c.str(.role)
        email = c.str(.email)
        firstName = c.str(.firstName)
        lastName = c.str(.lastName)
        companyId = c.intVal(.companyId)
        companyName = c.str(.companyName)
        isSetupComplete = c.boolVal(.isSetupComplete)
        mustChangePassword = c.boolVal(.mustChangePassword)
    }

    var displayName: String {
        let full = [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ")
        return full.isEmpty ? username : full
    }

    var initials: String {
        Format.initials(firstName, lastName, username)
    }

    var roleLabel: String {
        switch role {
        case "super_admin": return "Super administrateur"
        case "admin":       return "Administrateur"
        case "manager":     return "Responsable"
        case "accountant":  return "Comptable"
        case "worker":      return "Ouvrier"
        case "viewer":      return "Lecture seule"
        default:            return "Utilisateur"
        }
    }
}

// ─── Réponse de /api/auth/login : champs du user + token, à plat ──────────
struct LoginResponse: Decodable {
    let token: String
    let user: User

    enum CodingKeys: String, CodingKey {
        case token
    }

    init(from decoder: Decoder) throws {
        user = try User(from: decoder)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        token = (try? c.decode(String.self, forKey: .token)) ?? ""
    }
}
