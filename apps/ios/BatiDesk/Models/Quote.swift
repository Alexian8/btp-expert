import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Quote — devis. Route /api/quotes.
// (cf packages/types/src/quotes.ts ; colonnes : apps/server/src/db.ts)
// ═══════════════════════════════════════════════════════════════════════════

struct Quote: Decodable, Identifiable, Equatable {
    let id: String
    var reference: String
    var status: String        // brouillon | envoye | accepte | refuse
    var title: String
    var clientId: String
    var chantierId: String
    var issueDate: String
    var validUntilDate: String
    var sentAt: String
    var acceptedAt: String
    var items: [QuoteItem]
    var globalDiscountMode: String   // none | percent | amount
    var globalDiscountPercent: Double
    var globalDiscountAmount: Double
    var introText: String
    var conditionsText: String
    var totalHT: Double
    var totalTTC: Double
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, reference, status, title, clientId, chantierId
        case issueDate, validUntilDate, sentAt, acceptedAt, items
        case globalDiscountMode, globalDiscountPercent, globalDiscountAmount
        case introText, conditionsText, totalHT, totalTTC, createdAt
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
        validUntilDate = c.str(.validUntilDate)
        sentAt = c.str(.sentAt)
        acceptedAt = c.str(.acceptedAt)
        items = c.jsonArray(.items, of: QuoteItem.self)
        let mode = c.str(.globalDiscountMode)
        globalDiscountMode = mode.isEmpty ? "none" : mode
        globalDiscountPercent = c.dbl(.globalDiscountPercent)
        globalDiscountAmount = c.dbl(.globalDiscountAmount)
        introText = c.str(.introText)
        conditionsText = c.str(.conditionsText)
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

    /// Nombre de lignes facturables (hors chapitres).
    var lineCount: Int { items.filter { !$0.isSection }.count }
}
