import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ExpenseNoteFormView — création / édition d'une note de frais (feuille
// modale). Port de ExpenseNoteEditorModal.tsx (web) : payeur, catégorie avec
// TVA par défaut, montant TTC → HT/TVA calculés, chantier, refacturation.
// ═══════════════════════════════════════════════════════════════════════════

struct ExpenseNoteDraft: Encodable {
    var id = ""
    var payerType = "dirigeant"
    var payerName = ""
    var chantierId = ""
    var category = "carburant"
    var description = ""
    var notes = ""
    var amountTtc = 0.0
    var amountHt = 0.0
    var amountVat = 0.0
    var vatRate = 20.0
    var expenseDate = Format.todayISODay()
    var refacturable = false
    var refacturationMargePct = 0.0
    var status = "brouillon"
    var receiptVaultDocumentId = ""

    init() {}

    init(from note: ExpenseNote) {
        id = note.id
        payerType = note.payerType.isEmpty ? "dirigeant" : note.payerType
        payerName = note.payerName
        chantierId = note.chantierId
        category = note.category.isEmpty ? "autre" : note.category
        description = note.description
        notes = note.notes
        amountTtc = note.amountTtc
        amountHt = note.amountHt
        amountVat = note.amountVat
        vatRate = note.vatRate
        expenseDate = note.expenseDate.isEmpty ? Format.todayISODay() : note.expenseDate
        refacturable = note.refacturable
        refacturationMargePct = note.refacturationMargePct
        status = note.status.isEmpty ? "brouillon" : note.status
        receiptVaultDocumentId = note.receiptVaultDocumentId
    }
}

struct ExpenseNoteFormView: View {
    @Environment(\.dismiss) private var dismiss

    private let editingId: String?
    let onSaved: (ExpenseNote) -> Void

    @State private var draft: ExpenseNoteDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    @StateObject private var chantiersVM = ResourceListViewModel<Chantier>(path: "/api/chantiers")

    init(editing note: ExpenseNote? = nil, onSaved: @escaping (ExpenseNote) -> Void) {
        self.editingId = note?.id
        self.onSaved = onSaved
        if let note {
            _draft = State(initialValue: ExpenseNoteDraft(from: note))
        } else {
            _draft = State(initialValue: ExpenseNoteDraft())
        }
    }

    // ─── Calculs (mêmes formules que le web : TTC → HT/TVA) ───────────────
    private var computedHt: Double {
        draft.vatRate > 0 ? draft.amountTtc / (1 + draft.vatRate / 100) : draft.amountTtc
    }

    private var computedVat: Double { draft.amountTtc - computedHt }

    private var refacturationHtAmount: Double {
        computedHt * (1 + draft.refacturationMargePct / 100)
    }

    private var isValid: Bool {
        draft.amountTtc > 0
            && !draft.expenseDate.isEmpty
            && (!draft.refacturable || !draft.chantierId.isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Qui a payé ?") {
                    Picker("Payeur", selection: $draft.payerType) {
                        ForEach(ExpenseNote.payerTypes, id: \.self) { p in
                            Text(ExpenseNote.payerLabel(p)).tag(p)
                        }
                    }
                    .pickerStyle(.segmented)
                    if draft.payerType == "employe" {
                        TextField("Nom de l'employé", text: $draft.payerName)
                            .textContentType(.name)
                    }
                }
                .listRowBackground(Theme.card)

                Section("Dépense") {
                    TextField("Description (ex : Café avec client Dupont)",
                              text: $draft.description)
                    Picker("Catégorie", selection: $draft.category) {
                        ForEach(ExpenseNoteCategoryMeta.all, id: \.key) { meta in
                            Label(meta.label, systemImage: meta.systemImage).tag(meta.key)
                        }
                    }
                    RequiredDateRow(label: "Date", dateString: $draft.expenseDate)
                }
                .listRowBackground(Theme.card)

                Section("Montants") {
                    DecimalField("Montant TTC", value: $draft.amountTtc, suffix: "€")
                    Picker("Taux TVA", selection: $draft.vatRate) {
                        ForEach(ExpenseNote.vatRates, id: \.self) { rate in
                            Text("\(Format.trimNumber(rate)) %").tag(rate)
                        }
                    }
                    HStack {
                        Text("Montant HT")
                            .foregroundStyle(Theme.mutedForeground)
                        Spacer()
                        Text(Format.currency(computedHt))
                            .foregroundStyle(Theme.mutedForeground)
                    }
                    HStack {
                        Text("TVA (\(Format.trimNumber(draft.vatRate)) %)")
                            .foregroundStyle(Theme.mutedForeground)
                        Spacer()
                        Text(Format.currency(computedVat))
                            .foregroundStyle(Theme.mutedForeground)
                    }
                }
                .listRowBackground(Theme.card)

                Section("Chantier") {
                    Picker(draft.refacturable ? "Chantier *" : "Chantier",
                           selection: $draft.chantierId) {
                        Text(draft.refacturable ? "Sélectionnez un chantier" : "Aucun chantier")
                            .tag("")
                        ForEach(chantiersVM.items) { chantier in
                            Text("\(chantier.reference) · \(chantier.title)")
                                .tag(chantier.id)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section {
                    Toggle(isOn: $draft.refacturable) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Refacturable au client")
                            Text("Cette dépense sera intégrée à une facture future")
                                .font(.caption)
                                .foregroundStyle(Theme.mutedForeground)
                        }
                    }
                    if draft.refacturable {
                        DecimalField("Marge appliquée", value: $draft.refacturationMargePct,
                                     suffix: "%")
                        HStack {
                            Text("Refacturation")
                                .foregroundStyle(Theme.mutedForeground)
                            Spacer()
                            Text("\(Format.currency(computedHt)) → \(Format.currency(refacturationHtAmount)) HT")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.primary)
                        }
                    }
                } header: {
                    Text("Refacturation")
                }
                .listRowBackground(Theme.card)

                Section("Statut") {
                    Picker("Statut", selection: $draft.status) {
                        ForEach(ExpenseNote.statuses, id: \.self) { s in
                            Text(ExpenseNoteStatusMeta.of(s).label).tag(s)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Notes") {
                    TextField("Détails additionnels…", text: $draft.notes, axis: .vertical)
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
            .navigationTitle(editingId == nil ? "Nouvelle note de frais" : "Modifier la note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button(editingId == nil ? "Créer" : "Enregistrer") {
                            Task { await save() }
                        }
                        .fontWeight(.semibold)
                        .disabled(!isValid)
                    }
                }
            }
            .onChange(of: draft.category) { _, newValue in
                // En création, adapter le taux de TVA par défaut de la catégorie
                // (même comportement que le web).
                if editingId == nil {
                    draft.vatRate = ExpenseNoteCategoryMeta.of(newValue).defaultVatRate
                }
            }
            .task { await chantiersVM.loadIfNeeded() }
        }
    }

    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        // Montants dérivés arrondis à 2 décimales (parité web).
        draft.amountHt = (computedHt * 100).rounded() / 100
        draft.amountVat = (computedVat * 100).rounded() / 100
        if !draft.refacturable { draft.refacturationMargePct = 0 }
        draft.payerName = draft.payerName.trimmingCharacters(in: .whitespaces)
        draft.description = draft.description.trimmingCharacters(in: .whitespaces)
        draft.notes = draft.notes.trimmingCharacters(in: .whitespaces)

        do {
            let saved: ExpenseNote
            if let editingId {
                saved = try await APIClient.shared.update("/api/expense-notes/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/expense-notes", body: draft)
            }
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
