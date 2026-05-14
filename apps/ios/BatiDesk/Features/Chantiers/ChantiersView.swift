import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ChantiersView — onglet « Chantiers » : liste + recherche + filtre statut.
// ═══════════════════════════════════════════════════════════════════════════

struct ChantiersView: View {
    @EnvironmentObject private var clientDirectory: ClientDirectory
    @StateObject private var vm = ResourceListViewModel<Chantier>(path: "/api/chantiers")
    @State private var search = ""
    @State private var statusFilter: String = "tous"

    private let statuses: [(id: String, label: String)] = [
        ("tous", "Tous"),
        ("en-cours", "En cours"),
        ("prospect", "Prospects"),
        ("termine", "Terminés"),
        ("annule", "Annulés"),
    ]

    private var filtered: [Chantier] {
        vm.items.filter { chantier in
            let matchesStatus = statusFilter == "tous" || chantier.status == statusFilter
            guard matchesStatus else { return false }
            guard !search.isEmpty else { return true }
            let query = search.lowercased()
            return chantier.displayTitle.lowercased().contains(query)
                || chantier.reference.lowercased().contains(query)
                || chantier.city.lowercased().contains(query)
                || (clientDirectory.name(for: chantier.clientId)?.lowercased().contains(query) ?? false)
        }
    }

    var body: some View {
        ResourceStateView(
            phase: vm.phase,
            isEmpty: vm.items.isEmpty,
            emptyTitle: "Aucun chantier",
            emptyMessage: "Les chantiers créés depuis BatiDesk apparaîtront ici.",
            emptyIcon: "hammer",
            retry: { Task { await vm.load() } }
        ) {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if let message = vm.phase.failureMessage {
                        InlineErrorBanner(message: message)
                    }
                    statusPicker
                    ForEach(filtered) { chantier in
                        NavigationLink {
                            ChantierDetailView(chantier: chantier)
                        } label: {
                            ChantierRow(
                                chantier: chantier,
                                clientName: clientDirectory.name(for: chantier.clientId)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    if filtered.isEmpty {
                        Text(search.isEmpty ? "Aucun chantier dans ce filtre" : "Aucun résultat pour « \(search) »")
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
        .background(Theme.background)
        .navigationTitle("Chantiers")
        .searchable(text: $search, prompt: "Rechercher un chantier")
        .task {
            await vm.loadIfNeeded()
            await clientDirectory.loadIfNeeded()
        }
    }

    private var statusPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(statuses, id: \.id) { entry in
                    let isSelected = statusFilter == entry.id
                    Button {
                        statusFilter = entry.id
                    } label: {
                        Text(entry.label)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(isSelected ? Theme.primary : Theme.muted)
                            .foregroundStyle(isSelected ? Theme.primaryForeground : Theme.mutedForeground)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// ─── Ligne de liste ───────────────────────────────────────────────────────
struct ChantierRow: View {
    let chantier: Chantier
    var clientName: String? = nil

    var body: some View {
        CardRow {
            IconBadge(systemName: "hammer.fill", size: 44, tint: chantier.statusMeta.color)
        } content: {
            VStack(alignment: .leading, spacing: 4) {
                Text(chantier.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    StatusBadge(meta: chantier.statusMeta, compact: true)
                    if let clientName, !clientName.isEmpty {
                        Text(clientName)
                            .font(.caption)
                            .foregroundStyle(Theme.mutedForeground)
                            .lineLimit(1)
                    } else if !chantier.locationLine.isEmpty {
                        Text(chantier.locationLine)
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
struct ChantierDetailView: View {
    let chantier: Chantier

    @EnvironmentObject private var clientDirectory: ClientDirectory
    @State private var linkedClient: Client?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 10) {
                    IconBadge(systemName: "hammer.fill", size: 60, tint: chantier.statusMeta.color)
                    Text(chantier.displayTitle)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                    HStack(spacing: 6) {
                        StatusBadge(meta: chantier.statusMeta)
                        if !chantier.reference.isEmpty {
                            TagPill(text: chantier.reference)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                if let client = linkedClient {
                    SectionCard(title: "Client") {
                        NavigationLink {
                            ClientDetailView(client: client)
                        } label: {
                            HStack(spacing: 12) {
                                Avatar(initials: client.initials, size: 40,
                                       tint: client.isPro ? Theme.primary : Theme.success)
                                Text(client.displayName)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.foreground)
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.mutedForeground)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                if !chantier.fullAddress.isEmpty {
                    SectionCard(title: "Lieu du chantier") {
                        DetailRow(icon: "mappin.and.ellipse", label: "Adresse",
                                  value: chantier.fullAddress, multiline: true)
                    }
                }

                SectionCard(title: "Planning") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "calendar", label: "Début prévu",
                                  value: Format.date(chantier.startDateEstimated))
                        DetailRow(icon: "calendar.badge.checkmark", label: "Fin prévue",
                                  value: Format.date(chantier.endDateEstimated))
                    }
                }

                if chantier.budgetEstimatedTTC > 0 || chantier.budgetEstimatedHT > 0 {
                    SectionCard(title: "Budget estimé") {
                        VStack(spacing: 12) {
                            DetailRow(icon: "eurosign.circle", label: "Budget HT",
                                      value: Format.currency(chantier.budgetEstimatedHT))
                            DetailRow(icon: "eurosign.circle.fill", label: "Budget TTC",
                                      value: Format.currency(chantier.budgetEstimatedTTC))
                        }
                    }
                }

                if !chantier.nature.isEmpty || !chantier.description.isEmpty {
                    SectionCard(title: "Détails") {
                        VStack(spacing: 12) {
                            if !chantier.nature.isEmpty {
                                DetailRow(icon: "wrench.and.screwdriver", label: "Nature",
                                          value: chantier.nature, multiline: true)
                            }
                            if !chantier.description.isEmpty {
                                DetailRow(icon: "text.alignleft", label: "Description",
                                          value: chantier.description, multiline: true)
                            }
                        }
                    }
                }

                if !chantier.notes.isEmpty {
                    SectionCard(title: "Notes") {
                        DetailRow(icon: "note.text", label: "Notes",
                                  value: chantier.notes, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Chantier")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let cached = clientDirectory.client(chantier.clientId) {
                linkedClient = cached
            } else if !chantier.clientId.isEmpty {
                linkedClient = try? await APIClient.shared.get("/api/clients/\(chantier.clientId)")
            }
        }
    }
}
