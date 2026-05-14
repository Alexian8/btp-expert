import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// StatusMeta — libellé + couleur d'un statut métier.
// Port des QUOTE_STATUS_META / INVOICE_STATUS_META / CHANTIER_STATUS_META
// (packages/types/src/*.ts).
// ═══════════════════════════════════════════════════════════════════════════

struct StatusMeta {
    let label: String
    let colorName: String   // slate | blue | emerald | amber | rose

    var color: Color { Theme.statusColor(colorName) }

    static func quote(_ status: String) -> StatusMeta {
        switch status {
        case "brouillon": return StatusMeta(label: "Brouillon", colorName: "slate")
        case "envoye":    return StatusMeta(label: "Envoyé",    colorName: "blue")
        case "accepte":   return StatusMeta(label: "Accepté",   colorName: "emerald")
        case "refuse":    return StatusMeta(label: "Refusé",    colorName: "rose")
        default:          return StatusMeta(label: status.isEmpty ? "—" : status, colorName: "slate")
        }
    }

    static func invoice(_ status: String) -> StatusMeta {
        switch status {
        case "brouillon":            return StatusMeta(label: "Brouillon",   colorName: "slate")
        case "envoyee":              return StatusMeta(label: "Envoyée",     colorName: "blue")
        case "partiellement-payee":  return StatusMeta(label: "Part. payée", colorName: "amber")
        case "payee":                return StatusMeta(label: "Payée",       colorName: "emerald")
        case "annulee":              return StatusMeta(label: "Annulée",     colorName: "rose")
        default:                     return StatusMeta(label: status.isEmpty ? "—" : status, colorName: "slate")
        }
    }

    static func chantier(_ status: String) -> StatusMeta {
        switch status {
        case "prospect": return StatusMeta(label: "Prospect", colorName: "slate")
        case "en-cours": return StatusMeta(label: "En cours", colorName: "blue")
        case "termine":  return StatusMeta(label: "Terminé",  colorName: "emerald")
        case "annule":   return StatusMeta(label: "Annulé",   colorName: "rose")
        default:         return StatusMeta(label: status.isEmpty ? "—" : status, colorName: "slate")
        }
    }

    static func priority(_ priority: String) -> StatusMeta {
        switch priority {
        case "high":   return StatusMeta(label: "Priorité haute", colorName: "amber")
        case "normal": return StatusMeta(label: "Priorité normale", colorName: "blue")
        case "low":    return StatusMeta(label: "Priorité basse", colorName: "slate")
        default:       return StatusMeta(label: "", colorName: "slate")
        }
    }
}
