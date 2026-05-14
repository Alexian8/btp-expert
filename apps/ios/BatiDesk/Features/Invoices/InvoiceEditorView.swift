import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// InvoiceEditorView — création / édition d'une facture (feuille modale).
// Même éditeur de lignes que les devis ; n'écrit jamais totalPaid (préservé
// côté serveur via le PATCH partiel — les paiements se gèrent à part).
// ═══════════════════════════════════════════════════════════════════════════

struct InvoiceDraft: Encodable {
    var id = ""
    var reference = ""
    var status = "brouillon"
    var type = "standard"
    var title = ""
    var clientId = ""
    var chantierId = ""
    var issueDate = ""
    var dueDate = ""
    var paymentTermsDays = 30
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

    init(from invoice: Invoice) {
        id = invoice.id
        reference = invoice.reference
        status = invoice.status.isEmpty ? "brouillon" : invoice.status
        type = invoice.type.isEmpty ? "standard" : invoice.type
        title = invoice.title
        clientId = invoice.clientId
        chantierId = invoice.chantierId
        issueDate = invoice.issueDate.isEmpty ? Format.todayISODay() : invoice.issueDate
        dueDate = invoice.dueDate
        paymentTermsDays = invoice.paymentTermsDays
        items = invoice.items
        globalDiscountMode = invoice.globalDiscountMode.isEmpty ? "none" : invoice.globalDiscountMode
        globalDiscountPercent = invoice.globalDiscountPercent
        globalDiscountAmount = invoice.globalDiscountAmount
        introText = invoice.introText
        conditionsText = invoice.conditionsText
        totalHT = invoice.totalHT
        totalTTC = invoice.totalTTC
    }
}

struct InvoiceEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var clientDirectory: ClientDirectory

    private let editingId: String?
    let onSaved: (Invoice) -> Void

    @State private var draft: InvoiceDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let paymentTermsOptions = [0, 15, 30, 45, 60]

    init(editing invoice: Invoice? = nil, onSaved: @escaping (Invoice) -> Void) {
        self.editingId = invoice?.id
        self.onSaved = onSaved
        if let invoice {
            _draft = State(initialValue: InvoiceDraft(from: invoice))
        } else {
            _draft = State(initialValue: InvoiceDraft())
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
                Section("Facture") {
                    TextField("Titre de la facture", text: $draft.title)
                    TextField("Référence (optionnel)", text: $draft.reference)
                    Picker("Type", selection: $draft.type) {
                        Text("Standard").tag("standard")
                        Text("Acompte").tag("acompte")
                        Text("Avoir").tag("avoir")
                    }
                    Picker("Statut", selection: $draft.status) {
                        Text("Brouillon").tag("brouillon")
                        Text("Envoyée").tag("envoyee")
                        Text("Partiellement payée").tag("partiellement-payee")
                        Text("Payée").tag("payee")
                        Text("Annulée").tag("annulee")
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

                Section("Dates & règlement") {
                    RequiredDateRow(label: "Date d'émission", dateString: $draft.issueDate)
                    OptionalDateRow(label: "Échéance", dateString: $draft.dueDate)
                    Picker("Délai de règlement", selection: $draft.paymentTermsDays) {
                        ForEach(paymentTermsOptions, id: \.self) { days in
                            Text(days == 0 ? "À réception" : "\(days) jours").tag(days)
                        }
                    }
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
            .navigationTitle(editingId == nil ? "Nouvelle facture" : "Modifier la facture")
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
            let saved: Invoice
            if let editingId {
                saved = try await APIClient.shared.update("/api/invoices/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/invoices", body: draft)
            }
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
