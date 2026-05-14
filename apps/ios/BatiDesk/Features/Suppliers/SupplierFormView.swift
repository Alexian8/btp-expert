import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// SupplierFormView — création / édition d'un fournisseur (feuille modale).
// ═══════════════════════════════════════════════════════════════════════════

struct SupplierDraft: Encodable {
    var id = ""
    var companyName = ""
    var contactFirstName = ""
    var contactLastName = ""
    var email = ""
    var phoneMobile = ""
    var phoneFixed = ""
    var website = ""
    var addressLine1 = ""
    var postalCode = ""
    var city = ""
    var country = "France"
    var category = "Matériaux"
    var siret = ""
    var notes = ""

    init() {}

    init(from supplier: Supplier) {
        id = supplier.id
        companyName = supplier.companyName
        contactFirstName = supplier.contactFirstName
        contactLastName = supplier.contactLastName
        email = supplier.email
        phoneMobile = supplier.phoneMobile
        phoneFixed = supplier.phoneFixed
        website = supplier.website
        addressLine1 = supplier.addressLine1
        postalCode = supplier.postalCode
        city = supplier.city
        country = supplier.country.isEmpty ? "France" : supplier.country
        category = supplier.category.isEmpty ? "Matériaux" : supplier.category
        siret = supplier.siret
        notes = supplier.notes
    }
}

struct SupplierFormView: View {
    @Environment(\.dismiss) private var dismiss

    private let editingId: String?
    let onSaved: (Supplier) -> Void

    @State private var draft: SupplierDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    // cf SUPPLIER_CATEGORIES (packages/types/src/contacts.ts)
    private let categories = [
        "Matériaux", "Outillage", "Sous-traitant", "Services",
        "Transport", "Location", "Énergie", "Télécom", "Autre",
    ]

    init(editing supplier: Supplier? = nil, onSaved: @escaping (Supplier) -> Void) {
        self.editingId = supplier?.id
        self.onSaved = onSaved
        if let supplier {
            _draft = State(initialValue: SupplierDraft(from: supplier))
        } else {
            _draft = State(initialValue: SupplierDraft())
        }
    }

    private var isValid: Bool {
        !draft.companyName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identité") {
                    TextField("Raison sociale", text: $draft.companyName)
                    Picker("Catégorie", selection: $draft.category) {
                        ForEach(categories, id: \.self) { Text($0).tag($0) }
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
                    TextField("Site web", text: $draft.website)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                .listRowBackground(Theme.card)

                Section("Adresse") {
                    TextField("Adresse", text: $draft.addressLine1)
                    TextField("Code postal", text: $draft.postalCode)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Ville", text: $draft.city)
                    TextField("Pays", text: $draft.country)
                }
                .listRowBackground(Theme.card)

                Section("Informations légales") {
                    TextField("SIRET", text: $draft.siret)
                        .keyboardType(.numbersAndPunctuation)
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
            .navigationTitle(editingId == nil ? "Nouveau fournisseur" : "Modifier le fournisseur")
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
            let saved: Supplier
            if let editingId {
                saved = try await APIClient.shared.update("/api/suppliers/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/suppliers", body: draft)
            }
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
