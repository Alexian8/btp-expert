import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// SubcontractorFormView — création / édition d'un sous-traitant (feuille
// modale). Les champs correspondent aux colonnes autorisées côté serveur
// (writableColumns dans apps/server/src/app.ts, route /api/subcontractors).
// ═══════════════════════════════════════════════════════════════════════════

struct SubcontractorDraft: Encodable {
    var id = ""
    var companyName = ""
    var contactFirstName = ""
    var contactLastName = ""
    var email = ""
    var phoneMobile = ""
    var phoneFixed = ""
    var siret = ""
    var siren = ""
    var tvaIntracom = ""
    var addressLine1 = ""
    var addressLine2 = ""
    var postalCode = ""
    var city = ""
    var country = "France"
    var activity = "maconnerie"
    var retentionRate = 0.0
    var vatRate = 20.0
    var isVatExempt = false
    var iban = ""
    var bic = ""
    var paymentTermsDays = 30
    var notes = ""

    init() {}

    init(from subcontractor: Subcontractor) {
        id = subcontractor.id
        companyName = subcontractor.companyName
        contactFirstName = subcontractor.contactFirstName
        contactLastName = subcontractor.contactLastName
        email = subcontractor.email
        phoneMobile = subcontractor.phoneMobile
        phoneFixed = subcontractor.phoneFixed
        siret = subcontractor.siret
        siren = subcontractor.siren
        tvaIntracom = subcontractor.tvaIntracom
        addressLine1 = subcontractor.addressLine1
        addressLine2 = subcontractor.addressLine2
        postalCode = subcontractor.postalCode
        city = subcontractor.city
        country = subcontractor.country.isEmpty ? "France" : subcontractor.country
        activity = subcontractor.activity.isEmpty ? "maconnerie" : subcontractor.activity
        retentionRate = subcontractor.retentionRate
        vatRate = subcontractor.vatRate
        isVatExempt = subcontractor.isVatExempt
        iban = subcontractor.iban
        bic = subcontractor.bic
        paymentTermsDays = subcontractor.paymentTermsDays
        notes = subcontractor.notes
    }
}

struct SubcontractorFormView: View {
    @Environment(\.dismiss) private var dismiss

    private let editingId: String?
    let onSaved: (Subcontractor) -> Void

    @State private var draft: SubcontractorDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(editing subcontractor: Subcontractor? = nil, onSaved: @escaping (Subcontractor) -> Void) {
        self.editingId = subcontractor?.id
        self.onSaved = onSaved
        if let subcontractor {
            _draft = State(initialValue: SubcontractorDraft(from: subcontractor))
        } else {
            _draft = State(initialValue: SubcontractorDraft())
        }
    }

    private var isValid: Bool {
        !draft.companyName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var paymentTermsBinding: Binding<Double> {
        Binding(
            get: { Double(draft.paymentTermsDays) },
            set: { draft.paymentTermsDays = Int($0) }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identité") {
                    TextField("Raison sociale", text: $draft.companyName)
                    Picker("Activité", selection: $draft.activity) {
                        ForEach(SubcontractorActivity.all, id: \.key) { item in
                            Text(item.label).tag(item.key)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Interlocuteur") {
                    TextField("Prénom", text: $draft.contactFirstName)
                        .textContentType(.givenName)
                    TextField("Nom", text: $draft.contactLastName)
                        .textContentType(.familyName)
                }
                .listRowBackground(Theme.card)

                Section("Coordonnées") {
                    TextField("E-mail", text: $draft.email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Mobile", text: $draft.phoneMobile)
                        .keyboardType(.phonePad)
                    TextField("Téléphone fixe", text: $draft.phoneFixed)
                        .keyboardType(.phonePad)
                }
                .listRowBackground(Theme.card)

                Section("Adresse") {
                    TextField("Adresse", text: $draft.addressLine1)
                    TextField("Complément d'adresse", text: $draft.addressLine2)
                    TextField("Code postal", text: $draft.postalCode)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Ville", text: $draft.city)
                    TextField("Pays", text: $draft.country)
                }
                .listRowBackground(Theme.card)

                Section("Informations légales") {
                    TextField("SIRET", text: $draft.siret)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("SIREN", text: $draft.siren)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("N° TVA intracommunautaire", text: $draft.tvaIntracom)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                }
                .listRowBackground(Theme.card)

                Section("Conditions") {
                    Toggle("Autoliquidation de TVA", isOn: $draft.isVatExempt)
                    if !draft.isVatExempt {
                        DecimalField("Taux de TVA", value: $draft.vatRate, suffix: "%")
                    }
                    DecimalField("Retenue de garantie", value: $draft.retentionRate, suffix: "%")
                    DecimalField("Délai de paiement", value: paymentTermsBinding, suffix: "jours")
                }
                .listRowBackground(Theme.card)

                Section("Coordonnées bancaires") {
                    TextField("IBAN", text: $draft.iban)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    TextField("BIC", text: $draft.bic)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                }
                .listRowBackground(Theme.card)

                Section("Notes") {
                    TextField("Notes internes", text: $draft.notes, axis: .vertical)
                        .lineLimit(3...6)
                }
                .listRowBackground(Theme.card)

                if let errorMessage {
                    Section {
                        FormErrorRow(message: errorMessage)
                    }
                    .listRowBackground(Theme.card)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(editingId == nil ? "Nouveau sous-traitant" : "Modifier le sous-traitant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Enregistrer") {
                            Task { await save() }
                        }
                        .fontWeight(.semibold)
                        .disabled(!isValid)
                    }
                }
            }
        }
    }

    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }
        do {
            let saved: Subcontractor
            if let editingId {
                saved = try await APIClient.shared.update("/api/subcontractors/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/subcontractors", body: draft)
            }
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
