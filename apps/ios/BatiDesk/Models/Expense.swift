import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Expense — dépense fournisseur. Route /api/expenses.
// (cf packages/types/src/accounting.ts : Expense, EXPENSE_CATEGORY_META,
// EXPENSE_STATUS_META, PAYMENT_METHOD_LABEL)
// ═══════════════════════════════════════════════════════════════════════════

struct Expense: Decodable, Identifiable, Equatable {
    let id: String
    var reference: String            // numéro auto DEP-2026-0001 (généré serveur)
    var supplierId: String           // lien fournisseur (optionnel "")
    var supplierName: String         // dénormalisé pour affichage
    var chantierId: String           // chantier rattaché (optionnel)

    // Montants (MySQL DECIMAL → parfois String, d'où dbl())
    var amountHt: Double
    var amountVat: Double
    var amountTtc: Double
    var vatRate: Double              // taux principal (20, 10, 5.5, 0)

    // Détails
    var category: String             // ExpenseCategory (materiaux, outillage…)
    var description: String          // libellé court
    var notes: String

    // Dates ("yyyy-MM-dd", "" si non renseignée)
    var expenseDate: String          // date de la facture
    var dueDate: String              // échéance
    var paidDate: String             // date de paiement effective

    // Statut & paiement
    var status: String               // a_payer | payee | annulee
    var paymentMethod: String        // cb | virement | prelevement | cheque | espece | autre

    // Pièces & rapprochement bancaire
    var supplierInvoiceNumber: String   // n° de la facture du fournisseur
    var bankTransactionId: String       // réf. transaction bancaire (Qonto)
    var receiptVaultDocumentId: String  // justificatif dans le coffre-fort

    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, reference, supplierId, supplierName, chantierId
        case amountHt, amountVat, amountTtc, vatRate
        case category, description, notes
        case expenseDate, dueDate, paidDate
        case status, paymentMethod
        case supplierInvoiceNumber, bankTransactionId, receiptVaultDocumentId
        case createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        reference = c.str(.reference)
        supplierId = c.str(.supplierId)
        supplierName = c.str(.supplierName)
        chantierId = c.str(.chantierId)
        amountHt = c.dbl(.amountHt)
        amountVat = c.dbl(.amountVat)
        amountTtc = c.dbl(.amountTtc)
        vatRate = c.dbl(.vatRate)
        category = c.str(.category)
        description = c.str(.description)
        notes = c.str(.notes)
        expenseDate = c.str(.expenseDate)
        dueDate = c.str(.dueDate)
        paidDate = c.str(.paidDate)
        status = c.str(.status)
        paymentMethod = c.str(.paymentMethod)
        supplierInvoiceNumber = c.str(.supplierInvoiceNumber)
        bankTransactionId = c.str(.bankTransactionId)
        receiptVaultDocumentId = c.str(.receiptVaultDocumentId)
        createdAt = c.str(.createdAt)
        updatedAt = c.str(.updatedAt)
    }

    var displayLabel: String {
        if !description.isEmpty { return description }
        if !supplierName.isEmpty { return supplierName }
        return reference.isEmpty ? "Dépense" : reference
    }

    var statusMeta: StatusMeta { StatusMeta.expense(status) }
    var categoryLabel: String { ExpenseMeta.categoryLabel(category) }
    var paymentMethodLabel: String { ExpenseMeta.paymentMethodLabel(paymentMethod) }
}

// ─── Métadonnées (port de EXPENSE_*_META, libellés français) ──────────────
extension StatusMeta {
    /// Port de EXPENSE_STATUS_META (packages/types/src/accounting.ts).
    static func expense(_ status: String) -> StatusMeta {
        switch status {
        case "a_payer": return StatusMeta(label: "À payer", colorName: "amber")
        case "payee":   return StatusMeta(label: "Payée",   colorName: "emerald")
        case "annulee": return StatusMeta(label: "Annulée", colorName: "slate")
        default:        return StatusMeta(label: status.isEmpty ? "—" : status, colorName: "slate")
        }
    }
}

enum ExpenseMeta {
    /// Statuts dans l'ordre du cycle de vie (cf ExpenseStatus).
    static let statuses: [String] = ["a_payer", "payee", "annulee"]

    /// Catégories (clé, libellé) — port de EXPENSE_CATEGORY_META.
    static let categories: [(key: String, label: String)] = [
        ("materiaux",       "Matériaux"),
        ("outillage",       "Outillage"),
        ("carburant",       "Carburant"),
        ("vehicule",        "Véhicule"),
        ("sous_traitance",  "Sous-traitance"),
        ("loyer",           "Loyer"),
        ("energie",         "Énergie"),
        ("telecom",         "Téléphone / Internet"),
        ("assurance",       "Assurances"),
        ("frais_bancaires", "Frais bancaires"),
        ("honoraires",      "Honoraires"),
        ("fourniture",      "Fournitures"),
        ("repas",           "Repas"),
        ("deplacement",     "Déplacements"),
        ("formation",       "Formation"),
        ("logiciel",        "Logiciels"),
        ("publicite",       "Publicité"),
        ("autre",           "Autre"),
    ]

    /// Modes de paiement (clé, libellé) — port de PAYMENT_METHOD_LABEL.
    static let paymentMethods: [(key: String, label: String)] = [
        ("cb",          "Carte bancaire"),
        ("virement",    "Virement"),
        ("prelevement", "Prélèvement"),
        ("cheque",      "Chèque"),
        ("espece",      "Espèces"),
        ("autre",       "Autre"),
    ]

    /// Taux de TVA proposés (cf VAT_RATES de ExpenseEditorModal.tsx).
    static let vatRates: [Double] = [20, 10, 5.5, 2.1, 0]

    static func categoryLabel(_ key: String) -> String {
        categories.first(where: { $0.key == key })?.label ?? (key.isEmpty ? "—" : key)
    }

    static func paymentMethodLabel(_ key: String) -> String {
        paymentMethods.first(where: { $0.key == key })?.label ?? (key.isEmpty ? "—" : key)
    }
}
