import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ClientsView — onglet « Clients » : liste + recherche + détail (lecture seule).
// ═══════════════════════════════════════════════════════════════════════════

struct ClientsView: View {
    @StateObject private var vm = ResourceListViewModel<Client>(path: "/api/clients")
    @State private var search = ""
    @State private var showCreate = false

    private var filtered: [Client] {
        guard !search.isEmpty else { return vm.items }
        let query = search.lowercased()
        return vm.items.filter {
            $0.displayName.lowercased().contains(query)
            || $0.email.lowercased().contains(query)
            || $0.city.lowercased().contains(query)
            || $0.phone.filter(\.isNumber).contains(query.filter(\.isNumber))
        }
    }

    var body: some View {
        ResourceStateView(
            phase: vm.phase,
            isEmpty: vm.items.isEmpty,
            emptyTitle: "Aucun client",
            emptyMessage: "Les clients créés depuis BatiDesk apparaîtront ici.",
            emptyIcon: "person.2",
            retry: { Task { await vm.load() } }
        ) {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if let message = vm.phase.failureMessage {
                        InlineErrorBanner(message: message)
                    }
                    ForEach(filtered) { client in
                        NavigationLink {
                            ClientDetailView(client: client) {
                                Task { await vm.load() }
                            }
                        } label: {
                            ClientRow(client: client)
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
        .navigationTitle("Clients")
        .searchable(text: $search, prompt: "Rechercher un client")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nouveau client")
            }
        }
        .sheet(isPresented: $showCreate) {
            ClientFormView { _ in
                Task { await vm.load() }
            }
        }
        .task { await vm.loadIfNeeded() }
    }
}

// ─── Ligne de liste ───────────────────────────────────────────────────────
struct ClientRow: View {
    let client: Client

    var body: some View {
        CardRow {
            Avatar(
                initials: client.initials,
                size: 44,
                tint: client.isPro ? Theme.primary : Theme.success
            )
        } content: {
            VStack(alignment: .leading, spacing: 4) {
                Text(client.displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    TagPill(text: client.typeLabel)
                    if !client.locationLine.isEmpty {
                        Text(client.locationLine)
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
struct ClientDetailView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var client: Client
    let onChanged: () -> Void

    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    @State private var actionError: String?

    init(client: Client, onChanged: @escaping () -> Void = {}) {
        _client = State(initialValue: client)
        self.onChanged = onChanged
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 10) {
                    Avatar(
                        initials: client.initials,
                        size: 68,
                        tint: client.isPro ? Theme.primary : Theme.success
                    )
                    Text(client.displayName)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                    TagPill(text: client.typeLabel,
                            systemImage: client.isPro ? "building.2" : "person")
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                ContactActionsBar(phone: client.phone, email: client.email)

                SectionCard(title: "Contact") {
                    VStack(spacing: 12) {
                        if client.isPro, !client.contactName.isEmpty {
                            DetailRow(icon: "person", label: "Interlocuteur", value: client.contactName)
                        }
                        DetailRow(icon: "envelope", label: "E-mail", value: client.email)
                        DetailRow(icon: "phone", label: "Mobile", value: Format.phone(client.phoneMobile))
                        if !client.phoneFixed.isEmpty {
                            DetailRow(icon: "phone.down", label: "Fixe", value: Format.phone(client.phoneFixed))
                        }
                    }
                }

                if !client.fullAddress.isEmpty {
                    SectionCard(title: "Adresse") {
                        DetailRow(icon: "mappin.and.ellipse", label: "Adresse",
                                  value: client.fullAddress, multiline: true)
                    }
                }

                if client.isPro, !client.siret.isEmpty {
                    SectionCard(title: "Informations légales") {
                        DetailRow(icon: "building.columns", label: "SIRET",
                                  value: Format.siret(client.siret))
                    }
                }

                if !client.notes.isEmpty {
                    SectionCard(title: "Notes") {
                        DetailRow(icon: "note.text", label: "Notes",
                                  value: client.notes, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(client.displayName)
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
            ClientFormView(editing: client) { updated in
                client = updated
                onChanged()
            }
        }
        .confirmationDialog(
            "Supprimer ce client ?",
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
            try await APIClient.shared.delete("/api/clients/\(client.id)")
            onChanged()
            dismiss()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
