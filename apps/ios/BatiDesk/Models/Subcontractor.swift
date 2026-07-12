import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Subcontractor — sous-traitant. Route /api/subcontractors.
// (cf packages/types/src/subcontractors.ts ; colonnes réelles côté serveur
//  dans apps/server/src/db.ts — table `subcontractors`)
//
// Rappel métier : un fournisseur vend des matériaux, un sous-traitant exécute
// une partie des chantiers au nom de l'entreprise (loi du 31/12/1975).
// ═══════════════════════════════════════════════════════════════════════════

struct Subcontractor: Decodable, Identifiable, Equatable {
    let id: String
    var companyName: String
    var contactFirstName: String
    var contactLastName: String
    var email: String
    var phoneMobile: String
    var phoneFixed: String
    var siret: String
    var siren: String
    var tvaIntracom: String
    var addressLine1: String
    var addressLine2: String
    var postalCode: String
    var city: String
    var country: String
    var activity: String
    var retentionRate: Double
    var vatRate: Double
    var isVatExempt: Bool
    var iban: String
    var bic: String
    var paymentTermsDays: Int
    var notes: String
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, companyName, contactFirstName, contactLastName, email
        case phoneMobile, phoneFixed, siret, siren, tvaIntracom
        case addressLine1, addressLine2, postalCode, city, country
        case activity, retentionRate, vatRate, isVatExempt
        case iban, bic, paymentTermsDays, notes, createdAt
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
        siret = c.str(.siret)
        siren = c.str(.siren)
        tvaIntracom = c.str(.tvaIntracom)
        addressLine1 = c.str(.addressLine1)
        addressLine2 = c.str(.addressLine2)
        postalCode = c.str(.postalCode)
        city = c.str(.city)
        country = c.str(.country)
        activity = c.str(.activity)
        retentionRate = c.dbl(.retentionRate)
        vatRate = c.dbl(.vatRate)
        isVatExempt = c.boolVal(.isVatExempt)
        iban = c.str(.iban)
        bic = c.str(.bic)
        paymentTermsDays = c.intVal(.paymentTermsDays)
        notes = c.str(.notes)
        createdAt = c.str(.createdAt)
    }

    var displayName: String {
        companyName.isEmpty ? "Sous-traitant sans nom" : companyName
    }

    var initials: String { Format.initials(companyName) }

    var contactName: String {
        [contactFirstName, contactLastName].filter { !$0.isEmpty }.joined(separator: " ")
    }

    var phone: String { phoneMobile.isEmpty ? phoneFixed : phoneMobile }

    var locationLine: String {
        [postalCode, city].filter { !$0.isEmpty }.joined(separator: " ")
    }

    /// Libellé lisible de l'activité (port de SUBCONTRACTOR_ACTIVITY_META).
    var activityLabel: String { SubcontractorActivity.label(for: activity) }
}

// ─── Activités (port de SUBCONTRACTOR_ACTIVITY_META) ──────────────────────
enum SubcontractorActivity {
    /// Couples (clé API, libellé) — l'ordre suit packages/types.
    static let all: [(key: String, label: String)] = [
        ("maconnerie",  "Maçonnerie"),
        ("couverture",  "Couverture"),
        ("menuiserie",  "Menuiserie"),
        ("plomberie",   "Plomberie"),
        ("electricite", "Électricité"),
        ("chauffage",   "Chauffage"),
        ("platrerie",   "Plâtrerie"),
        ("carrelage",   "Carrelage"),
        ("peinture",    "Peinture"),
        ("vrd",         "VRD"),
        ("demolition",  "Démolition"),
        ("etancheite",  "Étanchéité"),
        ("facade",      "Façade / ITE"),
        ("metallerie",  "Métallerie"),
        ("autre",       "Autre"),
    ]

    static func label(for key: String) -> String {
        guard !key.isEmpty else { return "" }
        return all.first(where: { $0.key == key })?.label ?? key
    }
}
