import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ChantierFormView — création / édition d'un chantier (feuille modale).
// ═══════════════════════════════════════════════════════════════════════════

struct ChantierDraft: Encodable {
    var id = ""
    var reference = ""
    var title = ""
    var status = "prospect"
    var priority = "normal"
    var clientId = ""
    var addressLine1 = ""
    var addressLine2 = ""
    var postalCode = ""
    var city = ""
    var country = "France"
    var nature = ""
    var description = ""
    var startDateEstimated = ""
    var endDateEstimated = ""
    var budgetEstimatedHT: Double = 0
    var budgetEstimatedTTC: Double = 0
    var notes = ""

    init() {}

    init(from chantier: Chantier) {
        id = chantier.id
        reference = chantier.reference
        title = chantier.title
        status = chantier.status.isEmpty ? "prospect" : chantier.status
        priority = chantier.priority.isEmpty ? "normal" : chantier.priority
        clientId = chantier.clientId
        addressLine1 = chantier.addressLine1
        addressLine2 = chantier.addressLine2
        postalCode = chantier.postalCode
        city = chantier.city
        country = chantier.country.isEmpty ? "France" : chantier.country
        nature = chantier.nature
        description = chantier.description
        startDateEstimated = chantier.startDateEstimated
        endDateEstimated = chantier.endDateEstimated
        budgetEstimatedHT = chantier.budgetEstimatedHT
        budgetEstimatedTTC = chantier.budgetEstimatedTTC
        notes = chantier.notes
    }
}

struct ChantierFormView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var clientDirectory: ClientDirectory

    private let editingId: String?
    let onSaved: (Chantier) -> Void

    @State private var draft: ChantierDraft
    @State private var budgetHTText: String
    @State private var budgetTTCText: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(editing chantier: Chantier? = nil, onSaved: @escaping (Chantier) -> Void) {
        self.editingId = chantier?.id
        self.onSaved = onSaved
        let initialDraft: ChantierDraft
        if let chantier {
            initialDraft = ChantierDraft(from: chantier)
        } else {
            initialDraft = ChantierDraft()
        }
        _draft = State(initialValue: initialDraft)
        _budgetHTText = State(initialValue: Format.numberInputText(initialDraft.budgetEstimatedHT))
        _budgetTTCText = State(initialValue: Format.numberInputText(initialDraft.budgetEstimatedTTC))
    }

    private var isValid: Bool {
        !draft.title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Chantier") {
                    TextField("Titre du chantier", text: $draft.title)
                    TextField("Référence (optionnel)", text: $draft.reference)
                    Picker("Statut", selection: $draft.status) {
                        Text("Prospect").tag("prospect")
                        Text("En cours").tag("en-cours")
                        Text("Terminé").tag("termine")
                        Text("Annulé").tag("annule")
                    }
                    Picker("Priorité", selection: $draft.priority) {
                        Text("Basse").tag("low")
                        Text("Normale").tag("normal")
                        Text("Haute").tag("high")
                    }
                }
                .listRowBackground(Theme.card)

                Section("Client") {
                    Picker("Client", selection: $draft.clientId) {
                        Text("Aucun client").tag("")
                        ForEach(clientDirectory.allClientsSorted) { client in
                            Text(client.displayName).tag(client.id)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Lieu") {
                    TextField("Adresse", text: $draft.addressLine1)
                    TextField("Complément d'adresse", text: $draft.addressLine2)
                    TextField("Code postal", text: $draft.postalCode)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Ville", text: $draft.city)
                    TextField("Pays", text: $draft.country)
                }
                .listRowBackground(Theme.card)

                Section("Nature des travaux") {
                    TextField("Nature (ex: rénovation toiture)", text: $draft.nature)
                    TextField("Description", text: $draft.description, axis: .vertical)
                        .lineLimit(3...6)
                }
                .listRowBackground(Theme.card)

                Section("Planning prévisionnel") {
                    OptionalDateRow(label: "Date de début prévue",
                                    dateString: $draft.startDateEstimated)
                    OptionalDateRow(label: "Date de fin prévue",
                                    dateString: $draft.endDateEstimated)
                }
                .listRowBackground(Theme.card)

                Section("Budget estimé") {
                    HStack {
                        Text("Budget HT")
                        Spacer()
                        TextField("0", text: $budgetHTText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                        Text("€").foregroundStyle(Theme.mutedForeground)
                    }
                    HStack {
                        Text("Budget TTC")
                        Spacer()
                        TextField("0", text: $budgetTTCText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                        Text("€").foregroundStyle(Theme.mutedForeground)
                    }
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
            .navigationTitle(editingId == nil ? "Nouveau chantier" : "Modifier le chantier")
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
            .task { await clientDirectory.loadIfNeeded() }
        }
    }

    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        draft.budgetEstimatedHT = Format.parseUserNumber(budgetHTText)
        draft.budgetEstimatedTTC = Format.parseUserNumber(budgetTTCText)

        do {
            let saved: Chantier
            if let editingId {
                saved = try await APIClient.shared.update("/api/chantiers/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/chantiers", body: draft)
            }
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
