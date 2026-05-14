import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// SuppliersView — écran « Fournisseurs » (accessible depuis l'onglet Plus).
// ═══════════════════════════════════════════════════════════════════════════

struct SuppliersView: View {
    @StateObject private var vm = ResourceListViewModel<Supplier>(path: "/api/suppliers")
    @State private var search = ""

    private var filtered: [Supplier] {
        guard !search.isEmpty else { return vm.items }
        let query = search.lowercased()
        return vm.items.filter {
            $0.displayName.lowercased().contains(query)
            || $0.email.lowercased().contains(query)
            || $0.city.lowercased().contains(query)
            || $0.category.lowercased().contains(query)
        }
    }

    var body: some View {
        ResourceStateView(
            phase: vm.phase,
            isEmpty: vm.items.isEmpty,
            emptyTitle: "Aucun fournisseur",
            emptyMessage: "Les fournisseurs créés depuis BatiDesk apparaîtront ici.",
            emptyIcon: "shippingbox",
            retry: { Task { await vm.load() } }
        ) {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if let message = vm.phase.failureMessage {
                        InlineErrorBanner(message: message)
                    }
                    ForEach(filtered) { supplier in
                        NavigationLink {
                            SupplierDetailView(supplier: supplier)
                        } label: {
                            SupplierRow(supplier: supplier)
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
        .navigationTitle("Fournisseurs")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Rechercher un fournisseur")
        .task { await vm.loadIfNeeded() }
    }
}

// ─── Ligne de liste ───────────────────────────────────────────────────────
struct SupplierRow: View {
    let supplier: Supplier

    var body: some View {
        CardRow {
            Avatar(initials: supplier.initials, size: 44, tint: Theme.warning)
        } content: {
            VStack(alignment: .leading, spacing: 4) {
                Text(supplier.displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if !supplier.category.isEmpty {
                        TagPill(text: supplier.category)
                    }
                    if !supplier.locationLine.isEmpty {
                        Text(supplier.locationLine)
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
struct SupplierDetailView: View {
    let supplier: Supplier

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 10) {
                    Avatar(initials: supplier.initials, size: 68, tint: Theme.warning)
                    Text(supplier.displayName)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                    if !supplier.category.isEmpty {
                        TagPill(text: supplier.category, systemImage: "shippingbox")
                    }
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                ContactActionsBar(phone: supplier.phone, email: supplier.email)

                SectionCard(title: "Contact") {
                    VStack(spacing: 12) {
                        if !supplier.contactName.isEmpty {
                            DetailRow(icon: "person", label: "Interlocuteur", value: supplier.contactName)
                        }
                        DetailRow(icon: "envelope", label: "E-mail", value: supplier.email)
                        DetailRow(icon: "phone", label: "Mobile", value: Format.phone(supplier.phoneMobile))
                        if !supplier.phoneFixed.isEmpty {
                            DetailRow(icon: "phone.down", label: "Fixe", value: Format.phone(supplier.phoneFixed))
                        }
                        if !supplier.website.isEmpty {
                            DetailRow(icon: "globe", label: "Site web", value: supplier.website)
                        }
                    }
                }

                if !supplier.addressLine1.isEmpty || !supplier.city.isEmpty {
                    SectionCard(title: "Adresse") {
                        DetailRow(
                            icon: "mappin.and.ellipse",
                            label: "Adresse",
                            value: [supplier.addressLine1, supplier.locationLine]
                                .filter { !$0.isEmpty }
                                .joined(separator: "\n"),
                            multiline: true
                        )
                    }
                }

                if !supplier.siret.isEmpty {
                    SectionCard(title: "Informations légales") {
                        DetailRow(icon: "building.columns", label: "SIRET",
                                  value: Format.siret(supplier.siret))
                    }
                }

                if !supplier.notes.isEmpty {
                    SectionCard(title: "Notes") {
                        DetailRow(icon: "note.text", label: "Notes",
                                  value: supplier.notes, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(supplier.displayName)
        .navigationBarTitleDisplayMode(.inline)
    }
}
