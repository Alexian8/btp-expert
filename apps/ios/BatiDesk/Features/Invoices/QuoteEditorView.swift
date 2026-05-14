import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// QuoteEditorView — création / édition d'un devis (feuille modale).
// Éditeur de lignes + remise globale + totaux recalculés en direct.
// ═══════════════════════════════════════════════════════════════════════════

struct QuoteDraft: Encodable {
    var id = ""
    var reference = ""
    var status = "brouillon"
    var title = ""
    var clientId = ""
    var chantierId = ""
    var issueDate = ""
    var validUntilDate = ""
    var items: [QuoteItem] = []
    var globalDiscountMode = "none"
    var globalDiscountPercent = 0.0
    var globalDiscountAmount = 0.0
    var introText = ""
    var conditionsText = ""
    var totalHT = 0.0
    var totalTTC = 0.0

    init() {
        issueDate = Format.todayISODay()
    }

    init(from quote: Quote) {
        id = quote.id
        reference = quote.reference
        status = quote.status.isEmpty ? "brouillon" : quote.status
        title = quote.title
        clientId = quote.clientId
        chantierId = quote.chantierId
        issueDate = quote.issueDate.isEmpty ? Format.todayISODay() : quote.issueDate
        validUntilDate = quote.validUntilDate
        items = quote.items
        globalDiscountMode = quote.globalDiscountMode.isEmpty ? "none" : quote.globalDiscountMode
        globalDiscountPercent = quote.globalDiscountPercent
        globalDiscountAmount = quote.globalDiscountAmount
        introText = quote.introText
        conditionsText = quote.conditionsText
        totalHT = quote.totalHT
        totalTTC = quote.totalTTC
    }
}

struct QuoteEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var clientDirectory: ClientDirectory

    private let editingId: String?
    let onSaved: (Quote) -> Void

    @State private var draft: QuoteDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(editing quote: Quote? = nil, onSaved: @escaping (Quote) -> Void) {
        self.editingId = quote?.id
        self.onSaved = onSaved
        if let quote {
            _draft = State(initialValue: QuoteDraft(from: quote))
        } else {
            _draft = State(initialValue: QuoteDraft())
        }
    }

    private var totals: QuoteMath.Totals {
        QuoteMath.computeTotals(
            items: draft.items,
            globalDiscountMode: draft.globalDiscountMode,
            globalDiscountPercent: draft.globalDiscountPercent,
            globalDiscountAmount: draft.globalDiscountAmount
        )
    }

    private var isValid: Bool {
        !draft.title.trimmingCharacters(in: .whitespaces).isEmpty && !draft.clientId.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Devis") {
                    TextField("Titre du devis", text: $draft.title)
                    TextField("Référence (optionnel)", text: $draft.reference)
                    Picker("Statut", selection: $draft.status) {
                        Text("Brouillon").tag("brouillon")
                        Text("Envoyé").tag("envoye")
                        Text("Accepté").tag("accepte")
                        Text("Refusé").tag("refuse")
                    }
                }
                .listRowBackground(Theme.card)

                Section("Client") {
                    Picker("Client", selection: $draft.clientId) {
                        Text("Choisir un client").tag("")
                        ForEach(clientDirectory.allClientsSorted) { client in
                            Text(client.displayName).tag(client.id)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Dates") {
                    RequiredDateRow(label: "Date d'émission", dateString: $draft.issueDate)
                    OptionalDateRow(label: "Valable jusqu'au", dateString: $draft.validUntilDate)
                }
                .listRowBackground(Theme.card)

                LineItemsSection(items: $draft.items)

                GlobalDiscountSection(
                    mode: $draft.globalDiscountMode,
                    percent: $draft.globalDiscountPercent,
                    amount: $draft.globalDiscountAmount
                )

                EditorTotalsSection(totals: totals)

                Section("Mentions") {
                    TextField("Texte d'introduction", text: $draft.introText, axis: .vertical)
                        .lineLimit(2...5)
                    TextField("Conditions de règlement", text: $draft.conditionsText, axis: .vertical)
                        .lineLimit(2...6)
                }
                .listRowBackground(Theme.card)

                if let errorMessage {
                    Section { FormErrorRow(message: errorMessage) }
                        .listRowBackground(Theme.card)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(editingId == nil ? "Nouveau devis" : "Modifier le devis")
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

        let computed = totals
        draft.totalHT = computed.totalHT
        draft.totalTTC = computed.totalTTC

        do {
            let saved: Quote
            if let editingId {
                saved = try await APIClient.shared.update("/api/quotes/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/quotes", body: draft)
            }
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
