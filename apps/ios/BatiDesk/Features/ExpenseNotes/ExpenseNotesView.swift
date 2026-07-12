import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ExpenseNotesView — écran « Notes de frais » (accessible depuis l'onglet
// Plus). Liste avec recherche, filtres par statut, total affiché, création,
// détail, édition et suppression (parité CRUD avec la page web).
// ═══════════════════════════════════════════════════════════════════════════

struct ExpenseNotesView: View {
    @StateObject private var vm = ResourceListViewModel<ExpenseNote>(path: "/api/expense-notes")
    @State private var search = ""
    @State private var statusFilter: String? = nil   // nil = tous
    @State private var showCreate = false
    @State private var deletingNote: ExpenseNote?
    @State private var actionError: String?

    // ─── Filtrage ──────────────────────────────────────────────────────────
    private var filtered: [ExpenseNote] {
        var notes = vm.items
        if let statusFilter {
            notes = notes.filter { $0.status == statusFilter }
        }
        guard !search.isEmpty else { return notes }
        let query = search.lowercased()
        return notes.filter {
            $0.description.lowercased().contains(query)
            || $0.reference.lowercased().contains(query)
            || $0.payerName.lowercased().contains(query)
            || $0.categoryMeta.label.lowercased().contains(query)
        }
    }

    private var filteredTotalTtc: Double {
        filtered.reduce(0) { $0 + $1.amountTtc }
    }

    var body: some View {
        ResourceStateView(
            phase: vm.phase,
            isEmpty: vm.items.isEmpty,
            emptyTitle: "Aucune note de frais",
            emptyMessage: "Touche + pour saisir tes premiers frais (carburant, repas, parking…).",
            emptyIcon: "wallet.pass",
            retry: { Task { await vm.load() } }
        ) {
            VStack(spacing: 0) {
                statusChips
                notesList
            }
        }
        .background(Theme.background)
        .navigationTitle("Notes de frais")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Rechercher une note de frais")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nouvelle note de frais")
            }
        }
        .sheet(isPresented: $showCreate) {
            ExpenseNoteFormView { _ in
                Task { await vm.load() }
            }
        }
        .confirmationDialog(
            "Supprimer cette note de frais ?",
            isPresented: Binding(
                get: { deletingNote != nil },
                set: { if !$0 { deletingNote = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Supprimer", role: .destructive) {
                if let note = deletingNote {
                    Task { await performDelete(note) }
                }
            }
            Button("Annuler", role: .cancel) { deletingNote = nil }
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
        .task { await vm.loadIfNeeded() }
    }

    // ─── Puces de filtre par statut ────────────────────────────────────────
    private var statusChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(label: "Toutes", isSelected: statusFilter == nil,
                           tint: Theme.primary) {
                    statusFilter = nil
                }
                ForEach(ExpenseNote.statuses, id: \.self) { status in
                    let meta = ExpenseNoteStatusMeta.of(status)
                    FilterChip(label: meta.label,
                               isSelected: statusFilter == status,
                               tint: meta.color) {
                        statusFilter = statusFilter == status ? nil : status
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    // ─── Liste ─────────────────────────────────────────────────────────────
    private var notesList: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                if let message = vm.phase.failureMessage {
                    InlineErrorBanner(message: message)
                }

                if !filtered.isEmpty {
                    HStack {
                        Text("\(filtered.count) note\(filtered.count > 1 ? "s" : "")")
                        Spacer()
                        Text("Total \(Format.currency(filteredTotalTtc)) TTC")
                            .fontWeight(.semibold)
                    }
                    .font(.caption)
                    .foregroundStyle(Theme.mutedForeground)
                    .padding(.horizontal, 4)
                }

                ForEach(filtered) { note in
                    NavigationLink {
                        ExpenseNoteDetailView(note: note) {
                            Task { await vm.load() }
                        }
                    } label: {
                        ExpenseNoteRow(note: note)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            deletingNote = note
                        } label: {
                            Label("Supprimer", systemImage: "trash")
                        }
                    }
                    // Balayage vers la gauche façon liste native.
                    .swipeToDelete { deletingNote = note }
                }

                if filtered.isEmpty && (!search.isEmpty || statusFilter != nil) {
                    Text(search.isEmpty
                         ? "Aucune note avec ce statut"
                         : "Aucun résultat pour « \(search) »")
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground)
                        .padding(.top, 40)
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .refreshable { await vm.load() }
    }

    private func performDelete(_ note: ExpenseNote) async {
        deletingNote = nil
        do {
            try await APIClient.shared.delete("/api/expense-notes/\(note.id)")
            await vm.load()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

// ─── Puce de filtre ───────────────────────────────────────────────────────
struct FilterChip: View {
    let label: String
    let isSelected: Bool
    var tint: Color = Theme.primary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(isSelected ? tint.opacity(0.18) : Theme.muted)
                .foregroundStyle(isSelected ? tint : Theme.mutedForeground)
                .clipShape(Capsule())
                .overlay(
                    Capsule().strokeBorder(isSelected ? tint.opacity(0.5) : Theme.border,
                                           lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

// ─── Geste « balayer pour supprimer » sur une carte hors List ─────────────
private struct SwipeToDeleteModifier: ViewModifier {
    let onDelete: () -> Void
    @State private var offset: CGFloat = 0

    private let revealWidth: CGFloat = 88

    func body(content: Content) -> some View {
        ZStack(alignment: .trailing) {
            if offset < 0 {
                Button(role: .destructive) {
                    withAnimation(.easeOut(duration: 0.2)) { offset = 0 }
                    onDelete()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "trash.fill")
                        Text("Supprimer").font(.caption2.weight(.semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(width: revealWidth - 8)
                    .frame(maxHeight: .infinity)
                    .background(Theme.destructive)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            content
                .offset(x: offset)
                .gesture(
                    DragGesture(minimumDistance: 24, coordinateSpace: .local)
                        .onChanged { value in
                            guard abs(value.translation.width) > abs(value.translation.height) else { return }
                            offset = min(0, max(-revealWidth, value.translation.width))
                        }
                        .onEnded { value in
                            withAnimation(.easeOut(duration: 0.2)) {
                                offset = value.translation.width < -revealWidth / 2 ? -revealWidth : 0
                            }
                        }
                )
        }
    }
}

extension View {
    /// Révèle un bouton « Supprimer » en balayant la carte vers la gauche
    /// (équivalent de .swipeActions, utilisable hors d'une List).
    func swipeToDelete(onDelete: @escaping () -> Void) -> some View {
        modifier(SwipeToDeleteModifier(onDelete: onDelete))
    }
}

// ─── Ligne de liste ───────────────────────────────────────────────────────
struct ExpenseNoteRow: View {
    let note: ExpenseNote

    var body: some View {
        HStack(spacing: 12) {
            IconBadge(systemName: note.categoryMeta.systemImage, size: 44,
                      tint: note.statusMeta.color)
            VStack(alignment: .leading, spacing: 4) {
                Text(note.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(note.displayReference)
                        .lineLimit(1)
                    if !note.expenseDate.isEmpty {
                        Text("· \(Format.date(note.expenseDate))")
                    }
                    Text("· \(note.payerType == "employe" && !note.payerName.isEmpty ? note.payerName : note.payerLabel)")
                        .lineLimit(1)
                }
                .font(.caption)
                .foregroundStyle(Theme.mutedForeground)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 6) {
                Text(Format.currency(note.amountTtc))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.foreground)
                HStack(spacing: 4) {
                    if note.refacturable {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.primary)
                            .accessibilityLabel("Refacturable au client")
                    }
                    ExpenseNoteStatusBadge(meta: note.statusMeta, compact: true)
                }
            }
        }
        .padding(12)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                .strokeBorder(Theme.border, lineWidth: 1)
        )
    }
}

// ─── Pastille de statut (équivalent StatusBadge avec couleur libre) ───────
struct ExpenseNoteStatusBadge: View {
    let meta: ExpenseNoteStatusMeta
    var compact: Bool = false

    var body: some View {
        Text(meta.label)
            .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
            .padding(.horizontal, compact ? 7 : 9)
            .padding(.vertical, compact ? 3 : 4)
            .background(meta.color.opacity(0.16))
            .foregroundStyle(meta.color)
            .clipShape(Capsule())
    }
}

// ─── Détail ───────────────────────────────────────────────────────────────
struct ExpenseNoteDetailView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var note: ExpenseNote
    let onChanged: () -> Void

    @State private var linkedChantier: Chantier?
    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    @State private var actionError: String?

    init(note: ExpenseNote, onChanged: @escaping () -> Void = {}) {
        _note = State(initialValue: note)
        self.onChanged = onChanged
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 10) {
                    IconBadge(systemName: note.categoryMeta.systemImage, size: 60,
                              tint: note.statusMeta.color)
                    Text(note.displayTitle)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                    HStack(spacing: 6) {
                        ExpenseNoteStatusBadge(meta: note.statusMeta)
                        TagPill(text: note.displayReference)
                        TagPill(text: note.categoryMeta.label,
                                systemImage: note.categoryMeta.systemImage)
                    }
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                SectionCard(title: "Montants") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "eurosign.circle.fill", label: "Montant TTC",
                                  value: Format.currency(note.amountTtc))
                        DetailRow(icon: "sum", label: "Montant HT",
                                  value: Format.currency(note.amountHt))
                        DetailRow(icon: "percent",
                                  label: "TVA (\(Format.trimNumber(note.vatRate)) %)",
                                  value: Format.currency(note.amountVat))
                    }
                }

                SectionCard(title: "Payeur") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "person", label: "Payé par", value: note.payerLabel)
                        if !note.payerName.isEmpty {
                            DetailRow(icon: "person.text.rectangle", label: "Nom",
                                      value: note.payerName)
                        }
                    }
                }

                SectionCard(title: "Dates") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "calendar", label: "Date de la dépense",
                                  value: Format.date(note.expenseDate))
                        if !note.reimbursedDate.isEmpty {
                            DetailRow(icon: "checkmark.seal", label: "Remboursée le",
                                      value: Format.date(note.reimbursedDate))
                        }
                    }
                }

                if note.refacturable {
                    SectionCard(title: "Refacturation") {
                        VStack(spacing: 12) {
                            DetailRow(icon: "arrow.triangle.2.circlepath",
                                      label: "Refacturable au client", value: "Oui")
                            DetailRow(icon: "percent", label: "Marge appliquée",
                                      value: "\(Format.trimNumber(note.refacturationMargePct)) %")
                        }
                    }
                }

                if let linkedChantier {
                    SectionCard(title: "Chantier") {
                        DetailRow(icon: "hammer", label: "Chantier",
                                  value: "\(linkedChantier.reference) · \(linkedChantier.title)",
                                  multiline: true)
                    }
                }

                if !note.receiptVaultDocumentId.isEmpty {
                    SectionCard(title: "Justificatif") {
                        DetailRow(icon: "lock.doc", label: "Justificatif",
                                  value: "Chiffré dans le coffre-fort")
                    }
                }

                if !note.notes.isEmpty {
                    SectionCard(title: "Notes") {
                        DetailRow(icon: "note.text", label: "Notes",
                                  value: note.notes, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(note.displayReference)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showEdit = true
                    } label: {
                        Label("Modifier", systemImage: "pencil")
                    }
                    if note.status == "brouillon" {
                        Button {
                            Task { await changeStatus("validee") }
                        } label: {
                            Label("Valider", systemImage: "checkmark.circle")
                        }
                    }
                    if note.status == "validee" && note.payerType != "carte_pro" {
                        Button {
                            Task { await markReimbursed() }
                        } label: {
                            Label("Marquer remboursée", systemImage: "checkmark.seal")
                        }
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
            ExpenseNoteFormView(editing: note) { updated in
                note = updated
                onChanged()
                Task { await resolveChantier(updated.chantierId) }
            }
        }
        .confirmationDialog(
            "Supprimer cette note de frais ?",
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
        .task { await resolveChantier(note.chantierId) }
    }

    // ─── Actions ───────────────────────────────────────────────────────────
    private struct StatusPatch: Encodable {
        var status: String
        var reimbursedDate: String?
    }

    private func changeStatus(_ status: String) async {
        do {
            let updated: ExpenseNote = try await APIClient.shared.update(
                "/api/expense-notes/\(note.id)",
                body: StatusPatch(status: status, reimbursedDate: nil)
            )
            note = updated
            onChanged()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func markReimbursed() async {
        do {
            let updated: ExpenseNote = try await APIClient.shared.update(
                "/api/expense-notes/\(note.id)",
                body: StatusPatch(status: "remboursee", reimbursedDate: Format.todayISODay())
            )
            note = updated
            onChanged()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func resolveChantier(_ id: String) async {
        guard !id.isEmpty else {
            linkedChantier = nil
            return
        }
        linkedChantier = try? await APIClient.shared.get("/api/chantiers/\(id)")
    }

    private func performDelete() async {
        do {
            try await APIClient.shared.delete("/api/expense-notes/\(note.id)")
            onChanged()
            dismiss()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
