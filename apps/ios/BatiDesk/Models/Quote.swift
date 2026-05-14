import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Quote — devis. Route /api/quotes.
// (cf packages/types/src/quotes.ts)
// ═══════════════════════════════════════════════════════════════════════════

struct Quote: Decodable, Identifiable, Equatable {
    let id: String
    var reference: String
    var status: String        // brouillon | envoye | accepte | refuse
    var title: String
    var clientId: String
    var chantierId: String
    var issueDate: String
    var validUntil: String
    var sentAt: String
    var acceptedAt: String
    var totalHT: Double
    var totalTTC: Double
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, reference, status, title, clientId, chantierId
        case issueDate, validUntil, sentAt, acceptedAt
        case totalHT, totalTTC, createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        reference = c.str(.reference)
        status = c.str(.status)
        title = c.str(.title)
        clientId = c.str(.clientId)
        chantierId = c.str(.chantierId)
        issueDate = c.str(.issueDate)
        validUntil = c.str(.validUntil)
        sentAt = c.str(.sentAt)
        acceptedAt = c.str(.acceptedAt)
        totalHT = c.dbl(.totalHT)
        totalTTC = c.dbl(.totalTTC)
        createdAt = c.str(.createdAt)
    }

    var displayTitle: String {
        title.isEmpty ? (reference.isEmpty ? "Devis sans titre" : reference) : title
    }

    var displayReference: String {
        reference.isEmpty ? "Brouillon" : reference
    }

    var statusMeta: StatusMeta { StatusMeta.quote(status) }
}
