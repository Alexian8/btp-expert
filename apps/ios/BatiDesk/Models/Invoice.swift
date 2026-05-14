import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Invoice — facture. Route /api/invoices.
// (cf packages/types/src/invoices.ts ; colonnes : apps/server/src/db.ts)
// ═══════════════════════════════════════════════════════════════════════════

struct Invoice: Decodable, Identifiable, Equatable {
    let id: String
    var reference: String
    var status: String        // brouillon | envoyee | partiellement-payee | payee | annulee
    var type: String          // standard | acompte | avoir
    var title: String
    var clientId: String
    var chantierId: String
    var fromQuoteId: String
    var issueDate: String
    var dueDate: String
    var paymentTermsDays: Int
    var sentAt: String
    var paidAt: String
    var items: [QuoteItem]
    var globalDiscountMode: String   // none | percent | amount
    var globalDiscountPercent: Double
    var globalDiscountAmount: Double
    var introText: String
    var conditionsText: String
    var totalHT: Double
    var totalTTC: Double
    var totalPaid: Double
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, reference, status, type, title, clientId, chantierId, fromQuoteId
        case issueDate, dueDate, paymentTermsDays, sentAt, paidAt, items
        case globalDiscountMode, globalDiscountPercent, globalDiscountAmount
        case introText, conditionsText, totalHT, totalTTC, totalPaid, createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        reference = c.str(.reference)
        status = c.str(.status)
        type = c.str(.type)
        title = c.str(.title)
        clientId = c.str(.clientId)
        chantierId = c.str(.chantierId)
        fromQuoteId = c.str(.fromQuoteId)
        issueDate = c.str(.issueDate)
        dueDate = c.str(.dueDate)
        paymentTermsDays = c.intVal(.paymentTermsDays)
        sentAt = c.str(.sentAt)
        paidAt = c.str(.paidAt)
        items = c.jsonArray(.items, of: QuoteItem.self)
        let mode = c.str(.globalDiscountMode)
        globalDiscountMode = mode.isEmpty ? "none" : mode
        globalDiscountPercent = c.dbl(.globalDiscountPercent)
        globalDiscountAmount = c.dbl(.globalDiscountAmount)
        introText = c.str(.introText)
        conditionsText = c.str(.conditionsText)
        totalHT = c.dbl(.totalHT)
        totalTTC = c.dbl(.totalTTC)
        totalPaid = c.dbl(.totalPaid)
        createdAt = c.str(.createdAt)
    }

    var displayTitle: String {
        title.isEmpty ? (reference.isEmpty ? "Facture sans titre" : reference) : title
    }

    var displayReference: String {
        reference.isEmpty ? "Brouillon" : reference
    }

    var statusMeta: StatusMeta { StatusMeta.invoice(status) }

    var typeLabel: String {
        switch type {
        case "acompte": return "Acompte"
        case "avoir":   return "Avoir"
        default:        return "Standard"
        }
    }

    var remainingDue: Double { max(0, totalTTC - totalPaid) }

    var lineCount: Int { items.filter { !$0.isSection }.count }

    /// En retard : envoyée ou partiellement payée + échéance dépassée.
    var isOverdue: Bool {
        guard status == "envoyee" || status == "partiellement-payee" else { return false }
        guard let due = Format.parseDate(dueDate) else { return false }
        return due < Calendar.current.startOfDay(for: Date())
    }
}
