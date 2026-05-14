import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Client — particulier ou professionnel. Route /api/clients.
// (cf packages/types/src/contacts.ts)
// ═══════════════════════════════════════════════════════════════════════════

struct Client: Decodable, Identifiable, Equatable {
    let id: String
    var type: String          // "particulier" | "pro"
    var civility: String
    var firstName: String
    var lastName: String
    var companyName: String
    var email: String
    var phoneMobile: String
    var phoneFixed: String
    var addressLine1: String
    var addressLine2: String
    var postalCode: String
    var city: String
    var siret: String
    var notes: String
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, civility, firstName, lastName, companyName, email
        case phoneMobile, phoneFixed, addressLine1, addressLine2
        case postalCode, city, siret, notes, createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        type = c.str(.type)
        civility = c.str(.civility)
        firstName = c.str(.firstName)
        lastName = c.str(.lastName)
        companyName = c.str(.companyName)
        email = c.str(.email)
        phoneMobile = c.str(.phoneMobile)
        phoneFixed = c.str(.phoneFixed)
        addressLine1 = c.str(.addressLine1)
        addressLine2 = c.str(.addressLine2)
        postalCode = c.str(.postalCode)
        city = c.str(.city)
        siret = c.str(.siret)
        notes = c.str(.notes)
        createdAt = c.str(.createdAt)
    }

    var isPro: Bool { type == "pro" }

    var displayName: String {
        if isPro, !companyName.isEmpty { return companyName }
        let full = [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ")
        if !full.isEmpty { return full }
        if !companyName.isEmpty { return companyName }
        return "Client sans nom"
    }

    var initials: String {
        isPro ? Format.initials(companyName) : Format.initials(firstName, lastName)
    }

    var contactName: String {
        [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ")
    }

    var phone: String { phoneMobile.isEmpty ? phoneFixed : phoneMobile }

    var locationLine: String {
        [postalCode, city].filter { !$0.isEmpty }.joined(separator: " ")
    }

    var fullAddress: String {
        [addressLine1, addressLine2, locationLine]
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }

    var typeLabel: String { isPro ? "Professionnel" : "Particulier" }
}
