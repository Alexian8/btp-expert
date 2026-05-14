import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// QuoteItem — une ligne (ou un chapitre) d'un devis ou d'une facture.
// Structure partagée devis / factures (cf packages/types/src/quotes.ts).
//
// Codable : décodé depuis la colonne JSON `items`, ré-encodé tel quel lors de
// l'enregistrement. Le décodage est tolérant (champs manquants → défauts).
// ═══════════════════════════════════════════════════════════════════════════

struct QuoteItem: Codable, Identifiable, Equatable {
    var id: String
    var kind: String          // "line" | "section"
    var title: String         // utilisé pour les chapitres (kind == "section")
    var description: String   // désignation de la ligne
    var quantity: Double
    var unit: String
    var unitPriceHT: Double
    var vatRate: Double       // 0 | 5.5 | 10 | 20
    var discountPercent: Double
    var discountAmount: Double
    var discountMode: String  // "percent" | "amount" | "none"
    var lineType: String      // "" | "P" (pose) | "F" (fourniture) | "PF"

    enum CodingKeys: String, CodingKey {
        case id, kind, title, description, quantity, unit, unitPriceHT
        case vatRate, discountPercent, discountAmount, discountMode, lineType
    }

    // ─── Décodage tolérant ─────────────────────────────────────────────────
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        var decodedId = c.str(.id)
        if decodedId.isEmpty { decodedId = APIClient.newID() }
        id = decodedId
        let decodedKind = c.str(.kind)
        kind = decodedKind.isEmpty ? "line" : decodedKind
        title = c.str(.title)
        description = c.str(.description)
        quantity = c.dbl(.quantity)
        unit = c.str(.unit)
        unitPriceHT = c.dbl(.unitPriceHT)
        vatRate = c.dbl(.vatRate)
        discountPercent = c.dbl(.discountPercent)
        discountAmount = c.dbl(.discountAmount)
        let decodedMode = c.str(.discountMode)
        discountMode = decodedMode.isEmpty ? "none" : decodedMode
        lineType = c.str(.lineType)
    }

    // L'encodage est synthétisé automatiquement à partir de CodingKeys.

    // ─── Construction d'une ligne / d'un chapitre vierge ───────────────────
    init(line: Bool) {
        id = APIClient.newID()
        kind = line ? "line" : "section"
        title = line ? "" : "Nouveau chapitre"
        description = ""
        quantity = 1
        unit = "u"
        unitPriceHT = 0
        vatRate = 20
        discountPercent = 0
        discountAmount = 0
        discountMode = "none"
        lineType = ""
    }

    var isSection: Bool { kind == "section" }

    /// Libellé affiché dans les listes.
    var displayLabel: String {
        if isSection {
            return title.isEmpty ? "Chapitre" : title
        }
        return description.isEmpty ? "Ligne sans désignation" : description
    }

    var lineTypeLabel: String {
        switch lineType {
        case "P":  return "Pose"
        case "F":  return "Fourniture"
        case "PF": return "Pose + fourniture"
        default:   return ""
        }
    }
}
