import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Chantier — chantier BTP. Route /api/chantiers.
// (cf packages/types/src/chantiers.ts)
// ═══════════════════════════════════════════════════════════════════════════

struct Chantier: Decodable, Identifiable, Equatable {
    let id: String
    var reference: String
    var title: String
    var status: String        // prospect | en-cours | termine | annule
    var priority: String      // low | normal | high
    var clientId: String
    var addressLine1: String
    var addressLine2: String
    var postalCode: String
    var city: String
    var country: String
    var nature: String
    var description: String
    var startDateEstimated: String
    var endDateEstimated: String
    var budgetEstimatedHT: Double
    var budgetEstimatedTTC: Double
    var notes: String
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, reference, title, status, priority, clientId
        case addressLine1, addressLine2, postalCode, city, country
        case nature, description, startDateEstimated, endDateEstimated
        case budgetEstimatedHT, budgetEstimatedTTC, notes, createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        reference = c.str(.reference)
        title = c.str(.title)
        status = c.str(.status)
        priority = c.str(.priority)
        clientId = c.str(.clientId)
        addressLine1 = c.str(.addressLine1)
        addressLine2 = c.str(.addressLine2)
        postalCode = c.str(.postalCode)
        city = c.str(.city)
        country = c.str(.country)
        nature = c.str(.nature)
        description = c.str(.description)
        startDateEstimated = c.str(.startDateEstimated)
        endDateEstimated = c.str(.endDateEstimated)
        budgetEstimatedHT = c.dbl(.budgetEstimatedHT)
        budgetEstimatedTTC = c.dbl(.budgetEstimatedTTC)
        notes = c.str(.notes)
        createdAt = c.str(.createdAt)
    }

    var displayTitle: String {
        title.isEmpty ? (reference.isEmpty ? "Chantier sans titre" : reference) : title
    }

    var statusMeta: StatusMeta { StatusMeta.chantier(status) }
    var priorityMeta: StatusMeta { StatusMeta.priority(priority) }
    var isActive: Bool { status == "en-cours" }

    var locationLine: String {
        [postalCode, city].filter { !$0.isEmpty }.joined(separator: " ")
    }

    var fullAddress: String {
        [addressLine1, addressLine2, locationLine]
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }
}
