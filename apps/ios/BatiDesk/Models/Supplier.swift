import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Supplier — fournisseur. Route /api/suppliers.
// (cf packages/types/src/contacts.ts)
// ═══════════════════════════════════════════════════════════════════════════

struct Supplier: Decodable, Identifiable, Equatable {
    let id: String
    var companyName: String
    var contactFirstName: String
    var contactLastName: String
    var email: String
    var phoneMobile: String
    var phoneFixed: String
    var website: String
    var addressLine1: String
    var postalCode: String
    var city: String
    var country: String
    var category: String
    var siret: String
    var notes: String
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, companyName, contactFirstName, contactLastName, email
        case phoneMobile, phoneFixed, website, addressLine1
        case postalCode, city, country, category, siret, notes, createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        companyName = c.str(.companyName)
        contactFirstName = c.str(.contactFirstName)
        contactLastName = c.str(.contactLastName)
        email = c.str(.email)
        phoneMobile = c.str(.phoneMobile)
        phoneFixed = c.str(.phoneFixed)
        website = c.str(.website)
        addressLine1 = c.str(.addressLine1)
        postalCode = c.str(.postalCode)
        city = c.str(.city)
        country = c.str(.country)
        category = c.str(.category)
        siret = c.str(.siret)
        notes = c.str(.notes)
        createdAt = c.str(.createdAt)
    }

    var displayName: String {
        companyName.isEmpty ? "Fournisseur sans nom" : companyName
    }

    var initials: String { Format.initials(companyName) }

    var contactName: String {
        [contactFirstName, contactLastName].filter { !$0.isEmpty }.joined(separator: " ")
    }

    var phone: String { phoneMobile.isEmpty ? phoneFixed : phoneMobile }

    var locationLine: String {
        [postalCode, city].filter { !$0.isEmpty }.joined(separator: " ")
    }
}
