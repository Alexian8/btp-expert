import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ExpenseFormView — création / édition d'une dépense (feuille modale).
// Parité avec ExpenseEditorModal.tsx (web) : saisie du TTC + taux de TVA,
// HT et TVA recalculés automatiquement.
// ═══════════════════════════════════════════════════════════════════════════

struct ExpenseDraft: Encodable {
    var id = ""
    var supplierId = ""
    var supplierName = ""
    var chantierId = ""
    var category = "materiaux"
    var description = ""
    var notes = ""
    var amountHt: Double = 0
    var amountVat: Double = 0
    var amountTtc: Double = 0
    var vatRate: Double = 20
    var expenseDate = Format.todayISODay()
    var dueDate = ""
    var paidDate = ""
    var status = "a_payer"
    var paymentMethod = "cb"
    var supplierInvoiceNumber = ""
    var bankTransactionId = ""
    var receiptVaultDocumentId = ""

    init() {}

    init(from expense: Expense) {
        id = expense.id
        supplierId = expense.supplierId
        supplierName = expense.supplierName
        chantierId = expense.chantierId
        category = expense.category.isEmpty ? "materiaux" : expense.category
        description = expense.description
        notes = expense.notes
        amountHt = expense.amountHt
        amountVat = expense.amountVat
        amountTtc = expense.amountTtc
        vatRate = expense.vatRate
        expenseDate = expense.expenseDate.isEmpty ? Format.todayISODay() : expense.expenseDate
        dueDate = expense.dueDate
        paidDate = expense.paidDate
        status = expense.status.isEmpty ? "a_payer" : expense.status
        paymentMethod = expense.paymentMethod.isEmpty ? "cb" : expense.paymentMethod
        supplierInvoiceNumber = expense.supplierInvoiceNumber
        bankTransactionId = expense.bankTransactionId
        receiptVaultDocumentId = expense.receiptVaultDocumentId
    }
}

struct ExpenseFormView: View {
    @Environment(\.dismiss) private var dismiss

    private let editingId: String?
    let onSaved: (Expense) -> Void

    @State private var draft: ExpenseDraft
    @State private var isSaving = false
    @State private var errorMessage: String?

    // Listes de référence (fournisseurs & chantiers) pour les pickers
    @StateObject private var suppliersVM = ResourceListViewModel<Supplier>(path: "/api/suppliers")
    @StateObject private var chantiersVM = ResourceListViewModel<Chantier>(path: "/api/chantiers")

    init(editing expense: Expense? = nil, onSaved: @escaping (Expense) -> Void) {
        self.editingId = expense?.id
        self.onSaved = onSaved
        if let expense {
            _draft = State(initialValue: ExpenseDraft(from: expense))
        } else {
            _draft = State(initialValue: ExpenseDraft())
        }
    }

    // ─── Calcul auto HT/TVA à partir du TTC + taux (parité web) ───────────
    private var computedHt: Double {
        draft.vatRate > 0 ? draft.amountTtc / (1 + draft.vatRate / 100) : draft.amountTtc
    }
    private var computedVat: Double { draft.amountTtc - computedHt }

    private var isValid: Bool {
        let hasSupplier = !draft.supplierName.trimmingCharacters(in: .whitespaces).isEmpty
            || !draft.supplierId.isEmpty
        return hasSupplier && draft.amountTtc > 0 && !draft.expenseDate.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Fournisseur") {
                    Picker("Fournisseur", selection: $draft.supplierId) {
                        Text("Saisie libre").tag("")
                        ForEach(suppliersVM.items) { supplier in
                            Text(supplier.displayName).tag(supplier.id)
                        }
                    }
                    .onChange(of: draft.supplierId) { _, newValue in
                        if !newValue.isEmpty,
                           let supplier = suppliersVM.items.first(where: { $0.id == newValue }) {
                            draft.supplierName = supplier.displayName
                        }
                    }
                    if draft.supplierId.isEmpty {
                        TextField("Nom du fournisseur", text: $draft.supplierName)
                    }
                }
                .listRowBackground(Theme.card)

                Section("Description") {
                    TextField("Ex : Carrelage chantier Dupont", text: $draft.description)
                    TextField("N° facture fournisseur", text: $draft.supplierInvoiceNumber)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    TextField("N° transaction (banque/Qonto)", text: $draft.bankTransactionId)
                        .autocorrectionDisabled()
                }
                .listRowBackground(Theme.card)

                Section("Catégorie") {
                    Picker("Catégorie", selection: $draft.category) {
                        ForEach(ExpenseMeta.categories, id: \.key) { category in
                            Text(category.label).tag(category.key)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Montants") {
                    DecimalField("Montant TTC", value: $draft.amountTtc, suffix: "€")
                    Picker("Taux TVA", selection: $draft.vatRate) {
                        ForEach(ExpenseMeta.vatRates, id: \.self) { rate in
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
                    .font(.subheadline)
                    HStack {
                        Text("TVA (\(Format.trimNumber(draft.vatRate)) %)")
                            .foregroundStyle(Theme.mutedForeground)
                        Spacer()
                        Text(Format.currency(computedVat))
                            .foregroundStyle(Theme.mutedForeground)
                    }
                    .font(.subheadline)
                }
                .listRowBackground(Theme.card)

                Section("Dates") {
                    RequiredDateRow(label: "Date de la facture", dateString: $draft.expenseDate)
                    OptionalDateRow(label: "Échéance", dateString: $draft.dueDate)
                }
                .listRowBackground(Theme.card)

                Section("Statut") {
                    Picker("Statut", selection: $draft.status) {
                        ForEach(ExpenseMeta.statuses, id: \.self) { status in
                            Text(StatusMeta.expense(status).label).tag(status)
                        }
                    }
                    .pickerStyle(.segmented)
                    if draft.status == "payee" {
                        RequiredDateRow(label: "Date de paiement", dateString: $draft.paidDate)
                        Picker("Mode de paiement", selection: $draft.paymentMethod) {
                            ForEach(ExpenseMeta.paymentMethods, id: \.key) { method in
                                Text(method.label).tag(method.key)
                            }
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Chantier (optionnel)") {
                    Picker("Chantier", selection: $draft.chantierId) {
                        Text("Aucun chantier").tag("")
                        ForEach(chantiersVM.items) { chantier in
                            Text("\(chantier.reference) · \(chantier.title)").tag(chantier.id)
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
            .navigationTitle(editingId == nil ? "Nouvelle dépense" : "Modifier la dépense")
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
            .task {
                await suppliersVM.loadIfNeeded()
                await chantiersVM.loadIfNeeded()
            }
        }
    }

    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        // Normalisation avant envoi (parité ExpenseEditorModal.tsx)
        var payload = draft
        payload.supplierName = draft.supplierName.trimmingCharacters(in: .whitespaces)
        payload.description = draft.description.trimmingCharacters(in: .whitespaces)
        payload.notes = draft.notes.trimmingCharacters(in: .whitespaces)
        payload.supplierInvoiceNumber = draft.supplierInvoiceNumber.trimmingCharacters(in: .whitespaces)
        payload.bankTransactionId = draft.bankTransactionId.trimmingCharacters(in: .whitespaces)
        payload.amountHt = (computedHt * 100).rounded() / 100
        payload.amountVat = (computedVat * 100).rounded() / 100
        payload.amountTtc = (draft.amountTtc * 100).rounded() / 100
        // La date de paiement n'a de sens que pour une dépense payée
        if payload.status == "payee" {
            payload.paidDate = payload.paidDate.isEmpty ? payload.expenseDate : payload.paidDate
        } else {
            payload.paidDate = ""
        }

        do {
            let saved: Expense
            if let editingId {
                saved = try await APIClient.shared.update("/api/expenses/\(editingId)", body: payload)
            } else {
                payload.id = APIClient.newID()
                saved = try await APIClient.shared.create("/api/expenses", body: payload)
            }
            onSaved(saved)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
