import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ExpensesView — écran « Dépenses » (accessible depuis l'onglet Plus).
// Liste + recherche + filtres par statut + création / édition / suppression,
// même contrat CRUD que la web app (route /api/expenses).
// ═══════════════════════════════════════════════════════════════════════════

struct ExpensesView: View {
    @StateObject private var vm = ResourceListViewModel<Expense>(path: "/api/expenses")
    @State private var search = ""
    @State private var statusFilter: String? = nil     // nil = toutes
    @State private var showCreate = false
    @State private var actionError: String?

    private var filtered: [Expense] {
        var items = vm.items
        if let statusFilter {
            items = items.filter { $0.status == statusFilter }
        }
        if !search.isEmpty {
            let query = search.lowercased()
            items = items.filter {
                $0.description.lowercased().contains(query)
                || $0.supplierName.lowercased().contains(query)
                || $0.reference.lowercased().contains(query)
                || $0.categoryLabel.lowercased().contains(query)
            }
        }
        return items
    }

    var body: some View {
        ResourceStateView(
            phase: vm.phase,
            isEmpty: vm.items.isEmpty,
            emptyTitle: "Aucune dépense",
            emptyMessage: "Les dépenses créées depuis BatiDesk apparaîtront ici.",
            emptyIcon: "creditcard",
            retry: { Task { await vm.load() } }
        ) {
            VStack(spacing: 0) {
                statusChips
                List {
                    if let message = vm.phase.failureMessage {
                        InlineErrorBanner(message: message)
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    }
                    ForEach(filtered) { expense in
                        ZStack {
                            // NavigationLink invisible → carte custom sans chevron système
                            NavigationLink {
                                ExpenseDetailView(expense: expense) {
                                    Task { await vm.load() }
                                }
                            } label: {
                                EmptyView()
                            }
                            .opacity(0)
                            ExpenseRow(expense: expense)
                        }
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task { await performDelete(expense) }
                            } label: {
                                Label("Supprimer", systemImage: "trash")
                            }
                        }
                    }
                    if filtered.isEmpty {
                        Text(search.isEmpty
                             ? "Aucune dépense pour ce filtre"
                             : "Aucun résultat pour « \(search) »")
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 48)
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(Theme.background)
                .refreshable { await vm.load() }
            }
            .background(Theme.background)
        }
        .background(Theme.background)
        .navigationTitle("Dépenses")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Rechercher une dépense")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nouvelle dépense")
            }
        }
        .sheet(isPresented: $showCreate) {
            ExpenseFormView { _ in
                Task { await vm.load() }
            }
        }
        .alert(
            "Action impossible",
            isPresented: Binding(
                get: { actionError != nil },
                set: { if !$0 { actionError = nil } }
            )
        ) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
        .task { await vm.loadIfNeeded() }
    }

    // ─── Filtres par statut (pastilles horizontales) ──────────────────────
    private var statusChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ExpenseStatusChip(
                    label: "Toutes",
                    color: Theme.primary,
                    isSelected: statusFilter == nil
                ) { statusFilter = nil }
                ForEach(ExpenseMeta.statuses, id: \.self) { status in
                    let meta = StatusMeta.expense(status)
                    ExpenseStatusChip(
                        label: meta.label,
                        color: meta.color,
                        isSelected: statusFilter == status
                    ) {
                        statusFilter = (statusFilter == status) ? nil : status
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Theme.background)
    }

    private func performDelete(_ expense: Expense) async {
        do {
            try await APIClient.shared.delete("/api/expenses/\(expense.id)")
            await vm.load()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

// ─── Pastille de filtre ───────────────────────────────────────────────────
struct ExpenseStatusChip: View {
    let label: String
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(isSelected ? color.opacity(0.18) : Theme.muted)
                .foregroundStyle(isSelected ? color : Theme.mutedForeground)
                .clipShape(Capsule())
                .overlay(
                    Capsule().strokeBorder(
                        isSelected ? color.opacity(0.5) : Theme.border,
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(.plain)
    }
}

// ─── Ligne de liste ───────────────────────────────────────────────────────
struct ExpenseRow: View {
    let expense: Expense

    var body: some View {
        CardRow {
            Image(systemName: "creditcard.fill")
                .font(.subheadline)
                .foregroundStyle(Theme.destructive)
                .frame(width: 44, height: 44)
                .background(Theme.destructive.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        } content: {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(expense.displayLabel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(Format.currency(expense.amountTtc))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    StatusBadge(meta: expense.statusMeta, compact: true)
                    TagPill(text: expense.categoryLabel)
                    if !expense.expenseDate.isEmpty {
                        Text(Format.date(expense.expenseDate))
                            .font(.caption)
                            .foregroundStyle(Theme.mutedForeground)
                            .lineLimit(1)
                    }
                }
            }
        }
    }
}

// ─── Détail ───────────────────────────────────────────────────────────────
struct ExpenseDetailView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var expense: Expense
    let onChanged: () -> Void

    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    @State private var isWorking = false
    @State private var actionError: String?

    init(expense: Expense, onChanged: @escaping () -> Void = {}) {
        _expense = State(initialValue: expense)
        self.onChanged = onChanged
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // En-tête : montant + statut
                VStack(spacing: 10) {
                    Text(Format.currency(expense.amountTtc))
                        .font(.title.weight(.bold))
                        .foregroundStyle(Theme.foreground)
                    Text(expense.displayLabel)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground)
                        .multilineTextAlignment(.center)
                    StatusBadge(meta: expense.statusMeta)
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                if expense.status == "a_payer" {
                    Button {
                        Task { await markPaid() }
                    } label: {
                        HStack {
                            if isWorking {
                                ProgressView()
                            } else {
                                Image(systemName: "checkmark.circle.fill")
                            }
                            Text("Marquer payée")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Theme.success.opacity(0.16))
                        .foregroundStyle(Theme.success)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
                    }
                    .disabled(isWorking)
                }

                SectionCard(title: "Montants") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "eurosign", label: "Montant HT",
                                  value: Format.currency(expense.amountHt))
                        DetailRow(icon: "percent",
                                  label: "TVA (\(Format.trimNumber(expense.vatRate)) %)",
                                  value: Format.currency(expense.amountVat))
                        DetailRow(icon: "eurosign.circle", label: "Montant TTC",
                                  value: Format.currency(expense.amountTtc))
                    }
                }

                SectionCard(title: "Détails") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "number", label: "Référence", value: expense.reference)
                        DetailRow(icon: "shippingbox", label: "Fournisseur", value: expense.supplierName)
                        DetailRow(icon: "tag", label: "Catégorie", value: expense.categoryLabel)
                        if !expense.supplierInvoiceNumber.isEmpty {
                            DetailRow(icon: "doc.text", label: "N° facture fournisseur",
                                      value: expense.supplierInvoiceNumber)
                        }
                        if !expense.bankTransactionId.isEmpty {
                            DetailRow(icon: "building.columns", label: "N° transaction bancaire",
                                      value: expense.bankTransactionId)
                        }
                    }
                }

                SectionCard(title: "Dates & paiement") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "calendar", label: "Date de la facture",
                                  value: Format.date(expense.expenseDate))
                        if !expense.dueDate.isEmpty {
                            DetailRow(icon: "calendar.badge.clock", label: "Échéance",
                                      value: Format.date(expense.dueDate))
                        }
                        if !expense.paidDate.isEmpty {
                            DetailRow(icon: "checkmark.circle", label: "Payée le",
                                      value: Format.date(expense.paidDate))
                        }
                        DetailRow(icon: "creditcard", label: "Mode de paiement",
                                  value: expense.paymentMethodLabel)
                    }
                }

                if !expense.notes.isEmpty {
                    SectionCard(title: "Notes") {
                        DetailRow(icon: "note.text", label: "Notes",
                                  value: expense.notes, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(expense.reference.isEmpty ? "Dépense" : expense.reference)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showEdit = true
                    } label: {
                        Label("Modifier", systemImage: "pencil")
                    }
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Label("Supprimer", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            ExpenseFormView(editing: expense) { updated in
                expense = updated
                onChanged()
            }
        }
        .confirmationDialog(
            "Supprimer cette dépense ?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Supprimer", role: .destructive) {
                Task { await performDelete() }
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Cette action est définitive.")
        }
        .alert(
            "Action impossible",
            isPresented: Binding(
                get: { actionError != nil },
                set: { if !$0 { actionError = nil } }
            )
        ) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
    }

    // Parité web : « Marquer payée » = statut payee + date du jour.
    private func markPaid() async {
        isWorking = true
        defer { isWorking = false }
        struct MarkPaidBody: Encodable {
            let status: String
            let paidDate: String
        }
        do {
            let updated: Expense = try await APIClient.shared.update(
                "/api/expenses/\(expense.id)",
                body: MarkPaidBody(status: "payee", paidDate: Format.todayISODay())
            )
            expense = updated
            onChanged()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func performDelete() async {
        do {
            try await APIClient.shared.delete("/api/expenses/\(expense.id)")
            onChanged()
            dismiss()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
