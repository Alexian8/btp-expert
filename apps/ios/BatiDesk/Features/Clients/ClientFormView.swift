import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ClientFormView — création / édition d'un client (feuille modale).
// Port du formulaire client de la web app. PATCH partiel : seuls les champs
// du formulaire sont envoyés au serveur.
// ═══════════════════════════════════════════════════════════════════════════

struct ClientDraft: Encodable {
    var id = ""
    var type = "particulier"
    var civility = "M."
    var firstName = ""
    var lastName = ""
    var companyName = ""
    var email = ""
    var phoneMobile = ""
    var phoneFixed = ""
    var addressLine1 = ""
    var addressLine2 = ""
    var postalCode = ""
    var city = ""
    var country = "France"
    var siret = ""
    var notes = ""

    init() {}

    init(from client: Client) {
        id = client.id
        type = client.type
        civility = client.civility.isEmpty ? "M." : client.civility
        firstName = client.firstName
        lastName = client.lastName
        companyName = client.companyName
        email = client.email
        phoneMobile = client.phoneMobile
        phoneFixed = client.phoneFixed
        addressLine1 = client.addressLine1
        addressLine2 = client.addressLine2
        postalCode = client.postalCode
        city = client.city
        country = client.country.isEmpty ? "France" : client.country
        siret = client.siret
        notes = client.notes
    }
}

struct ClientFormView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var clientDirectory: ClientDirectory

    private let editingId: String?
    let onSaved: (Client) -> Void

    @State private var draft: ClientDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let civilities = ["M.", "Mme", "M. et Mme", "Mlle", "Société", ""]

    init(editing client: Client? = nil, onSaved: @escaping (Client) -> Void) {
        self.editingId = client?.id
        self.onSaved = onSaved
        if let client {
            _draft = State(initialValue: ClientDraft(from: client))
        } else {
            _draft = State(initialValue: ClientDraft())
        }
    }

    private var isPro: Bool { draft.type == "pro" }

    private var isValid: Bool {
        if isPro {
            return !draft.companyName.trimmingCharacters(in: .whitespaces).isEmpty
        }
        return !draft.firstName.trimmingCharacters(in: .whitespaces).isEmpty
            || !draft.lastName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Type", selection: $draft.type) {
                        Text("Particulier").tag("particulier")
                        Text("Professionnel").tag("pro")
                    }
                    .pickerStyle(.segmented)
                }
                .listRowBackground(Theme.card)

                Section("Identité") {
                    Picker("Civilité", selection: $draft.civility) {
                        ForEach(civilities, id: \.self) { value in
                            Text(value.isEmpty ? "—" : value).tag(value)
                        }
                    }
                    TextField(isPro ? "Prénom (interlocuteur)" : "Prénom", text: $draft.firstName)
                        .textContentType(.givenName)
                    TextField(isPro ? "Nom (interlocuteur)" : "Nom", text: $draft.lastName)
                        .textContentType(.familyName)
                    if isPro {
                        TextField("Raison sociale", text: $draft.companyName)
                    }
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

                if isPro {
                    Section("Informations légales") {
                        TextField("SIRET", text: $draft.siret)
                            .keyboardType(.numbersAndPunctuation)
                    }
                    .listRowBackground(Theme.card)
                }

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
            .navigationTitle(editingId == nil ? "Nouveau client" : "Modifier le client")
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
            let saved: Client
            if let editingId {
                saved = try await APIClient.shared.update("/api/clients/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/clients", body: draft)
            }
            clientDirectory.upsert(saved)
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
