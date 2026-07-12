import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// SubcontractorsView — écran « Sous-traitants » (accessible depuis l'onglet
// Plus). Liste + détail + CRUD complet via /api/subcontractors.
//
// ℹ️ Les attestations (URSSAF, décennale…) n'ont pas encore de route REST
// côté serveur (stubs dans le shim web) : elles ne sont donc pas affichées
// ici — à ajouter quand la route existera.
// ═══════════════════════════════════════════════════════════════════════════

struct SubcontractorsView: View {
    @StateObject private var vm = ResourceListViewModel<Subcontractor>(path: "/api/subcontractors")
    @State private var search = ""
    @State private var showCreate = false

    private var filtered: [Subcontractor] {
        guard !search.isEmpty else { return vm.items }
        let query = search.lowercased()
        return vm.items.filter {
            $0.displayName.lowercased().contains(query)
            || $0.contactName.lowercased().contains(query)
            || $0.email.lowercased().contains(query)
            || $0.city.lowercased().contains(query)
            || $0.activityLabel.lowercased().contains(query)
        }
    }

    var body: some View {
        ResourceStateView(
            phase: vm.phase,
            isEmpty: vm.items.isEmpty,
            emptyTitle: "Aucun sous-traitant",
            emptyMessage: "Les sous-traitants créés depuis BatiDesk apparaîtront ici.",
            emptyIcon: "person.3",
            retry: { Task { await vm.load() } }
        ) {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if let message = vm.phase.failureMessage {
                        InlineErrorBanner(message: message)
                    }
                    ForEach(filtered) { subcontractor in
                        NavigationLink {
                            SubcontractorDetailView(subcontractor: subcontractor) {
                                Task { await vm.load() }
                            }
                        } label: {
                            SubcontractorRow(subcontractor: subcontractor)
                        }
                        .buttonStyle(.plain)
                    }
                    if filtered.isEmpty && !search.isEmpty {
                        Text("Aucun résultat pour « \(search) »")
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground)
                            .padding(.top, 48)
                    }
                }
                .padding(16)
            }
            .background(Theme.background)
            .refreshable { await vm.load() }
        }
        .background(Theme.background)
        .navigationTitle("Sous-traitants")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Rechercher un sous-traitant")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nouveau sous-traitant")
            }
        }
        .sheet(isPresented: $showCreate) {
            SubcontractorFormView { _ in
                Task { await vm.load() }
            }
        }
        .task { await vm.loadIfNeeded() }
    }
}

// ─── Ligne de liste ───────────────────────────────────────────────────────
struct SubcontractorRow: View {
    let subcontractor: Subcontractor

    var body: some View {
        CardRow {
            Avatar(initials: subcontractor.initials, size: 44, tint: Theme.primary)
        } content: {
            VStack(alignment: .leading, spacing: 4) {
                Text(subcontractor.displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if !subcontractor.activityLabel.isEmpty {
                        TagPill(text: subcontractor.activityLabel, systemImage: "hammer")
                    }
                    if !subcontractor.locationLine.isEmpty {
                        Text(subcontractor.locationLine)
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
struct SubcontractorDetailView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var subcontractor: Subcontractor
    let onChanged: () -> Void

    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    @State private var actionError: String?

    init(subcontractor: Subcontractor, onChanged: @escaping () -> Void = {}) {
        _subcontractor = State(initialValue: subcontractor)
        self.onChanged = onChanged
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 10) {
                    Avatar(initials: subcontractor.initials, size: 68, tint: Theme.primary)
                    Text(subcontractor.displayName)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                    if !subcontractor.activityLabel.isEmpty {
                        TagPill(text: subcontractor.activityLabel, systemImage: "hammer")
                    }
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                ContactActionsBar(phone: subcontractor.phone, email: subcontractor.email)

                SectionCard(title: "Contact") {
                    VStack(spacing: 12) {
                        if !subcontractor.contactName.isEmpty {
                            DetailRow(icon: "person", label: "Interlocuteur", value: subcontractor.contactName)
                        }
                        DetailRow(icon: "envelope", label: "E-mail", value: subcontractor.email)
                        DetailRow(icon: "phone", label: "Mobile", value: Format.phone(subcontractor.phoneMobile))
                        if !subcontractor.phoneFixed.isEmpty {
                            DetailRow(icon: "phone.down", label: "Fixe", value: Format.phone(subcontractor.phoneFixed))
                        }
                    }
                }

                if !subcontractor.addressLine1.isEmpty || !subcontractor.city.isEmpty {
                    SectionCard(title: "Adresse") {
                        DetailRow(
                            icon: "mappin.and.ellipse",
                            label: "Adresse",
                            value: [subcontractor.addressLine1,
                                    subcontractor.addressLine2,
                                    subcontractor.locationLine]
                                .filter { !$0.isEmpty }
                                .joined(separator: "\n"),
                            multiline: true
                        )
                    }
                }

                if !subcontractor.siret.isEmpty || !subcontractor.siren.isEmpty || !subcontractor.tvaIntracom.isEmpty {
                    SectionCard(title: "Informations légales") {
                        VStack(spacing: 12) {
                            if !subcontractor.siret.isEmpty {
                                DetailRow(icon: "building.columns", label: "SIRET",
                                          value: Format.siret(subcontractor.siret))
                            }
                            if !subcontractor.siren.isEmpty {
                                DetailRow(icon: "number", label: "SIREN", value: subcontractor.siren)
                            }
                            if !subcontractor.tvaIntracom.isEmpty {
                                DetailRow(icon: "eurosign", label: "TVA intracom.",
                                          value: subcontractor.tvaIntracom)
                            }
                        }
                    }
                }

                SectionCard(title: "Conditions") {
                    VStack(spacing: 12) {
                        DetailRow(
                            icon: "percent",
                            label: "TVA",
                            value: subcontractor.isVatExempt
                                ? "Autoliquidation (exonéré)"
                                : "\(Format.trimNumber(subcontractor.vatRate)) %"
                        )
                        DetailRow(icon: "lock.shield", label: "Retenue de garantie",
                                  value: "\(Format.trimNumber(subcontractor.retentionRate)) %")
                        DetailRow(icon: "calendar.badge.clock", label: "Délai de paiement",
                                  value: "\(subcontractor.paymentTermsDays) jours")
                    }
                }

                if !subcontractor.iban.isEmpty || !subcontractor.bic.isEmpty {
                    SectionCard(title: "Coordonnées bancaires") {
                        VStack(spacing: 12) {
                            if !subcontractor.iban.isEmpty {
                                DetailRow(icon: "creditcard", label: "IBAN", value: subcontractor.iban)
                            }
                            if !subcontractor.bic.isEmpty {
                                DetailRow(icon: "building.2", label: "BIC", value: subcontractor.bic)
                            }
                        }
                    }
                }

                if !subcontractor.notes.isEmpty {
                    SectionCard(title: "Notes") {
                        DetailRow(icon: "note.text", label: "Notes",
                                  value: subcontractor.notes, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(subcontractor.displayName)
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
            SubcontractorFormView(editing: subcontractor) { updated in
                subcontractor = updated
                onChanged()
            }
        }
        .confirmationDialog(
            "Supprimer ce sous-traitant ?",
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

    private func performDelete() async {
        do {
            try await APIClient.shared.delete("/api/subcontractors/\(subcontractor.id)")
            onChanged()
            dismiss()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
