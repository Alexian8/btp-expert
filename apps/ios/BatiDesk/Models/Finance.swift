import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Finance — modèles de l'écran Finances (lecture seule).
//
// Le serveur n'expose pas (encore) de routes de stats financières : comme le
// shim web (financeStore + stubs), on recalcule les KPI côté client à partir
// de /api/invoices, /api/expenses et /api/chantiers, en reprenant les mêmes
// formules que le desktop (apps/desktop/electron/accounting.js).
// (cf FinanceStats / ChantierMargin dans packages/types/src/accounting.ts)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Dépense (vue Finances) — route /api/expenses ──────────────────────────
// La table expenses porte deux générations de colonnes (legacy : label/amount/
// date/isPaid ; compta : amountTtc/expenseDate/status). On décode les deux et
// on expose des accesseurs « effectifs » pour que les KPI restent justes quel
// que soit l'âge de la ligne. Le modèle CRUD complet vit dans Models/Expense.swift.
struct FinanceExpense: Decodable, Identifiable, Equatable {
    let id: String
    var label: String
    var amount: Double        // legacy — montant TTC
    var date: String          // legacy — "yyyy-MM-dd"
    var category: String
    var supplierId: String
    var chantierId: String
    var paymentMethod: String
    var paidDate: String
    var isPaid: Bool
    var notes: String
    var createdAt: String
    var amountTtc: Double     // compta — montant TTC (colonnes récentes)
    var expenseDate: String   // compta — date de la facture fournisseur
    var status: String        // compta — a-payer · payee · annulee

    enum CodingKeys: String, CodingKey {
        case id, label, amount, date, category, supplierId, chantierId
        case paymentMethod, paidDate, isPaid, notes, createdAt
        case amountTtc, expenseDate, status
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        label = c.str(.label)
        amount = c.dbl(.amount)
        date = c.str(.date)
        category = c.str(.category)
        supplierId = c.str(.supplierId)
        chantierId = c.str(.chantierId)
        paymentMethod = c.str(.paymentMethod)
        paidDate = c.str(.paidDate)
        isPaid = c.boolVal(.isPaid)
        notes = c.str(.notes)
        createdAt = c.str(.createdAt)
        amountTtc = c.dbl(.amountTtc)
        expenseDate = c.str(.expenseDate)
        status = c.str(.status)
    }

    /// Montant TTC effectif : colonne compta si renseignée, sinon legacy.
    var effectiveAmount: Double { amountTtc > 0 ? amountTtc : amount }
    /// Date effective de la dépense.
    var effectiveDate: String { expenseDate.isEmpty ? date : expenseDate }
    /// Payée ? (statut compta prioritaire, sinon flag legacy). Ignore les annulées.
    var effectiveIsPaid: Bool { status == "payee" || (status.isEmpty && isPaid) }
    /// Annulée → à exclure des totaux.
    var isCancelled: Bool { status == "annulee" }
}

// ─── Stats agrégées (port de FinanceStats, calculées côté iOS) ─────────────
struct FinanceStats: Equatable {
    var caEncaisseMonth: Double = 0     // CA encaissé ce mois
    var caEncaisseYear: Double = 0      // CA encaissé cette année
    var caEnAttente: Double = 0         // factures envoyées non payées
    var expensesMonth: Double = 0       // dépenses du mois
    var expensesYear: Double = 0        // dépenses de l'année
    var expensesAPayer: Double = 0      // dépenses non payées
    var margeMonth: Double = 0          // CA encaissé - dépenses (mois)
    var margeYear: Double = 0           // CA encaissé - dépenses (année)
    var tvaCollectee: Double = 0        // TVA estimée au prorata des encaissements
}

// ─── Marge par chantier (port de ChantierMargin) ───────────────────────────
struct ChantierMargin: Identifiable, Equatable {
    let chantierId: String
    let chantierTitle: String
    let chantierReference: String
    let ca: Double               // factures émises pour ce chantier (TTC)
    let expenses: Double         // dépenses imputées au chantier
    let marge: Double            // ca - expenses
    let margePct: Double         // (marge / ca) * 100, ou 0 si ca = 0

    var id: String { chantierId }
}
