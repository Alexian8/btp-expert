import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ExpenseNote — note de frais. Route /api/expense-notes.
// Port de packages/types/src/expense-notes.ts (catégories, statuts, payeurs
// avec libellés français + taux de TVA par défaut).
//
// Rappel métier : les notes de frais sont les petits frais du quotidien
// (carburant, repas, parking…) payés par le dirigeant ou un employé —
// à distinguer des « expenses » (factures fournisseurs).
// ═══════════════════════════════════════════════════════════════════════════

struct ExpenseNote: Decodable, Identifiable, Equatable {
    let id: String
    var reference: String            // NDF-2026-0001 (générée côté serveur)
    var payerType: String            // dirigeant | employe | carte_pro
    var payerName: String

    // Lien chantier (obligatoire si refacturable)
    var chantierId: String

    // Montants
    var amountTtc: Double
    var amountHt: Double
    var vatRate: Double              // 20, 10, 5.5, 2.1, 0
    var amountVat: Double

    // Détails
    var category: String             // cf ExpenseNoteCategory
    var description: String
    var notes: String

    // Dates
    var expenseDate: String

    // Refacturation client
    var refacturable: Bool
    var refacturationMargePct: Double

    // Statut
    var status: String               // brouillon | validee | remboursee | refacturee
    var reimbursedDate: String
    var refacturedInvoiceId: String

    // Justificatif (coffre-fort)
    var receiptVaultDocumentId: String

    // Paiement & rapprochement bancaire (Session 31)
    var paymentMethod: String
    var bankTransactionId: String
    var supplierInvoiceNumber: String

    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, reference, payerType, payerName, chantierId
        case amountTtc, amountHt, vatRate, amountVat
        case category, description, notes, expenseDate
        case refacturable, refacturationMargePct
        case status, reimbursedDate, refacturedInvoiceId
        case receiptVaultDocumentId
        case paymentMethod, bankTransactionId, supplierInvoiceNumber
        case createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        reference = c.str(.reference)
        payerType = c.str(.payerType)
        payerName = c.str(.payerName)
        chantierId = c.str(.chantierId)
        amountTtc = c.dbl(.amountTtc)
        amountHt = c.dbl(.amountHt)
        vatRate = c.dbl(.vatRate)
        amountVat = c.dbl(.amountVat)
        category = c.str(.category)
        description = c.str(.description)
        notes = c.str(.notes)
        expenseDate = c.str(.expenseDate)
        refacturable = c.boolVal(.refacturable)
        refacturationMargePct = c.dbl(.refacturationMargePct)
        status = c.str(.status)
        reimbursedDate = c.str(.reimbursedDate)
        refacturedInvoiceId = c.str(.refacturedInvoiceId)
        receiptVaultDocumentId = c.str(.receiptVaultDocumentId)
        paymentMethod = c.str(.paymentMethod)
        bankTransactionId = c.str(.bankTransactionId)
        supplierInvoiceNumber = c.str(.supplierInvoiceNumber)
        createdAt = c.str(.createdAt)
        updatedAt = c.str(.updatedAt)
    }

    // ─── Affichage ─────────────────────────────────────────────────────────
    var displayTitle: String {
        description.isEmpty ? categoryMeta.label : description
    }

    var displayReference: String {
        reference.isEmpty ? "Sans référence" : reference
    }

    var statusMeta: ExpenseNoteStatusMeta { ExpenseNoteStatusMeta.of(status) }
    var categoryMeta: ExpenseNoteCategoryMeta { ExpenseNoteCategoryMeta.of(category) }
    var payerLabel: String { ExpenseNote.payerLabel(payerType) }

    /// Libellé du payeur (port de EXPENSE_NOTE_PAYER_META).
    static func payerLabel(_ payerType: String) -> String {
        switch payerType {
        case "dirigeant": return "Dirigeant"
        case "employe":   return "Employé"
        case "carte_pro": return "Carte pro"
        default:          return payerType.isEmpty ? "—" : payerType
        }
    }

    static let payerTypes: [String] = ["dirigeant", "employe", "carte_pro"]
    static let statuses: [String] = ["brouillon", "validee", "remboursee", "refacturee"]
    static let vatRates: [Double] = [20, 10, 5.5, 2.1, 0]
}

// ─── Statuts (port de EXPENSE_NOTE_STATUS_META) ───────────────────────────
struct ExpenseNoteStatusMeta: Equatable {
    let label: String
    let color: Color

    /// Violet des notes refacturées (bg-violet-500 côté web).
    private static let violet = Color(hslH: 258, s: 0.90, l: 0.66)

    static func of(_ status: String) -> ExpenseNoteStatusMeta {
        switch status {
        case "brouillon":  return ExpenseNoteStatusMeta(label: "Brouillon",  color: Theme.mutedForeground)
        case "validee":    return ExpenseNoteStatusMeta(label: "Validée",    color: Theme.primary)
        case "remboursee": return ExpenseNoteStatusMeta(label: "Remboursée", color: Theme.success)
        case "refacturee": return ExpenseNoteStatusMeta(label: "Refacturée", color: violet)
        default:
            return ExpenseNoteStatusMeta(label: status.isEmpty ? "—" : status,
                                         color: Theme.mutedForeground)
        }
    }
}

// ─── Catégories (port de EXPENSE_NOTE_CATEGORY_META) ──────────────────────
struct ExpenseNoteCategoryMeta: Equatable {
    let key: String
    let label: String
    let defaultVatRate: Double
    let systemImage: String

    /// Ordre identique à packages/types/src/expense-notes.ts.
    static let all: [ExpenseNoteCategoryMeta] = [
        ExpenseNoteCategoryMeta(key: "carburant",       label: "Carburant",       defaultVatRate: 20,  systemImage: "fuelpump.fill"),
        ExpenseNoteCategoryMeta(key: "peage",           label: "Péage",           defaultVatRate: 20,  systemImage: "road.lanes"),
        ExpenseNoteCategoryMeta(key: "parking",         label: "Parking",         defaultVatRate: 20,  systemImage: "parkingsign"),
        ExpenseNoteCategoryMeta(key: "repas",           label: "Repas",           defaultVatRate: 10,  systemImage: "fork.knife"),
        ExpenseNoteCategoryMeta(key: "hotel",           label: "Hôtel",           defaultVatRate: 10,  systemImage: "bed.double.fill"),
        ExpenseNoteCategoryMeta(key: "transport",       label: "Transport",       defaultVatRate: 10,  systemImage: "tram.fill"),
        ExpenseNoteCategoryMeta(key: "fourniture",      label: "Fournitures",     defaultVatRate: 20,  systemImage: "shippingbox.fill"),
        ExpenseNoteCategoryMeta(key: "epi",             label: "EPI",             defaultVatRate: 20,  systemImage: "shield.fill"),
        ExpenseNoteCategoryMeta(key: "outillage_petit", label: "Petit outillage", defaultVatRate: 20,  systemImage: "wrench.and.screwdriver.fill"),
        ExpenseNoteCategoryMeta(key: "telecom",         label: "Téléphone",       defaultVatRate: 20,  systemImage: "phone.fill"),
        ExpenseNoteCategoryMeta(key: "abonnement",      label: "Abonnement",      defaultVatRate: 20,  systemImage: "arrow.triangle.2.circlepath"),
        ExpenseNoteCategoryMeta(key: "cadeau",          label: "Cadeau client",   defaultVatRate: 20,  systemImage: "gift.fill"),
        ExpenseNoteCategoryMeta(key: "autre",           label: "Autre",           defaultVatRate: 20,  systemImage: "ellipsis.circle.fill"),
    ]

    static func of(_ key: String) -> ExpenseNoteCategoryMeta {
        all.first(where: { $0.key == key })
            ?? ExpenseNoteCategoryMeta(key: key,
                                       label: key.isEmpty ? "Autre" : key,
                                       defaultVatRate: 20,
                                       systemImage: "ellipsis.circle.fill")
    }
}
