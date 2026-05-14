import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// QuotesInvoicesView — onglet « Devis & Factures ».
// Sélecteur segmenté Devis / Factures, recherche, et écrans de détail.
// ═══════════════════════════════════════════════════════════════════════════

struct QuotesInvoicesView: View {
    enum Segment: String, CaseIterable, Identifiable {
        case quotes = "Devis"
        case invoices = "Factures"
        var id: String { rawValue }
    }

    @EnvironmentObject private var clientDirectory: ClientDirectory
    @StateObject private var quotesVM = ResourceListViewModel<Quote>(path: "/api/quotes")
    @StateObject private var invoicesVM = ResourceListViewModel<Invoice>(path: "/api/invoices")
    @State private var segment: Segment = .quotes
    @State private var search = ""

    var body: some View {
        VStack(spacing: 0) {
            Picker("Type de document", selection: $segment) {
                ForEach(Segment.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 10)

            switch segment {
            case .quotes:   quotesList
            case .invoices: invoicesList
            }
        }
        .background(Theme.background)
        .navigationTitle("Devis & Factures")
        .searchable(text: $search,
                    prompt: segment == .quotes ? "Rechercher un devis" : "Rechercher une facture")
        .task {
            await clientDirectory.loadIfNeeded()
            await quotesVM.loadIfNeeded()
            await invoicesVM.loadIfNeeded()
        }
    }

    // ─── Liste des devis ───────────────────────────────────────────────────
    private var filteredQuotes: [Quote] {
        guard !search.isEmpty else { return quotesVM.items }
        let query = search.lowercased()
        return quotesVM.items.filter {
            $0.displayTitle.lowercased().contains(query)
            || $0.reference.lowercased().contains(query)
            || (clientDirectory.name(for: $0.clientId)?.lowercased().contains(query) ?? false)
        }
    }

    private var quotesList: some View {
        ResourceStateView(
            phase: quotesVM.phase,
            isEmpty: quotesVM.items.isEmpty,
            emptyTitle: "Aucun devis",
            emptyMessage: "Les devis créés depuis BatiDesk apparaîtront ici.",
            emptyIcon: "doc.text",
            retry: { Task { await quotesVM.load() } }
        ) {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if let message = quotesVM.phase.failureMessage {
                        InlineErrorBanner(message: message)
                    }
                    ForEach(filteredQuotes) { quote in
                        NavigationLink {
                            QuoteDetailView(quote: quote)
                        } label: {
                            QuoteRow(quote: quote, clientName: clientDirectory.name(for: quote.clientId))
                        }
                        .buttonStyle(.plain)
                    }
                    if filteredQuotes.isEmpty && !search.isEmpty {
                        Text("Aucun résultat pour « \(search) »")
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground)
                            .padding(.top, 40)
                    }
                }
                .padding(16)
            }
            .background(Theme.background)
            .refreshable { await quotesVM.load() }
        }
    }

    // ─── Liste des factures ────────────────────────────────────────────────
    private var filteredInvoices: [Invoice] {
        guard !search.isEmpty else { return invoicesVM.items }
        let query = search.lowercased()
        return invoicesVM.items.filter {
            $0.displayTitle.lowercased().contains(query)
            || $0.reference.lowercased().contains(query)
            || (clientDirectory.name(for: $0.clientId)?.lowercased().contains(query) ?? false)
        }
    }

    private var invoicesList: some View {
        ResourceStateView(
            phase: invoicesVM.phase,
            isEmpty: invoicesVM.items.isEmpty,
            emptyTitle: "Aucune facture",
            emptyMessage: "Les factures créées depuis BatiDesk apparaîtront ici.",
            emptyIcon: "doc.plaintext",
            retry: { Task { await invoicesVM.load() } }
        ) {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if let message = invoicesVM.phase.failureMessage {
                        InlineErrorBanner(message: message)
                    }
                    ForEach(filteredInvoices) { invoice in
                        NavigationLink {
                            InvoiceDetailView(invoice: invoice)
                        } label: {
                            InvoiceRow(invoice: invoice, clientName: clientDirectory.name(for: invoice.clientId))
                        }
                        .buttonStyle(.plain)
                    }
                    if filteredInvoices.isEmpty && !search.isEmpty {
                        Text("Aucun résultat pour « \(search) »")
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground)
                            .padding(.top, 40)
                    }
                }
                .padding(16)
            }
            .background(Theme.background)
            .refreshable { await invoicesVM.load() }
        }
    }
}

// ─── Lignes de liste ──────────────────────────────────────────────────────
struct QuoteRow: View {
    let quote: Quote
    var clientName: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            IconBadge(systemName: "doc.text.fill", size: 44, tint: quote.statusMeta.color)
            VStack(alignment: .leading, spacing: 4) {
                Text(clientName ?? quote.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(quote.displayReference)
                        .lineLimit(1)
                    if !quote.issueDate.isEmpty {
                        Text("· \(Format.date(quote.issueDate))")
                    }
                }
                .font(.caption)
                .foregroundStyle(Theme.mutedForeground)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 6) {
                Text(Format.currency(quote.totalTTC))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.foreground)
                StatusBadge(meta: quote.statusMeta, compact: true)
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

struct InvoiceRow: View {
    let invoice: Invoice
    var clientName: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            IconBadge(systemName: "doc.plaintext.fill", size: 44, tint: invoice.statusMeta.color)
            VStack(alignment: .leading, spacing: 4) {
                Text(clientName ?? invoice.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(invoice.displayReference)
                        .lineLimit(1)
                    if !invoice.issueDate.isEmpty {
                        Text("· \(Format.date(invoice.issueDate))")
                    }
                    if invoice.isOverdue {
                        Text("· En retard")
                            .foregroundStyle(Theme.destructive)
                    }
                }
                .font(.caption)
                .foregroundStyle(Theme.mutedForeground)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 6) {
                Text(Format.currency(invoice.totalTTC))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.foreground)
                StatusBadge(meta: invoice.statusMeta, compact: true)
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

// ─── Détail devis ─────────────────────────────────────────────────────────
struct QuoteDetailView: View {
    let quote: Quote

    @EnvironmentObject private var clientDirectory: ClientDirectory
    @State private var linkedClient: Client?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 10) {
                    IconBadge(systemName: "doc.text.fill", size: 60, tint: quote.statusMeta.color)
                    Text(quote.displayTitle)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                    HStack(spacing: 6) {
                        StatusBadge(meta: quote.statusMeta)
                        TagPill(text: quote.displayReference)
                    }
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                LinkedClientCard(client: linkedClient)

                SectionCard(title: "Montants") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "sum", label: "Total HT", value: Format.currency(quote.totalHT))
                        DetailRow(icon: "eurosign.circle.fill", label: "Total TTC",
                                  value: Format.currency(quote.totalTTC))
                    }
                }

                SectionCard(title: "Dates") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "calendar", label: "Émis le", value: Format.date(quote.issueDate))
                        DetailRow(icon: "calendar.badge.clock", label: "Valable jusqu'au",
                                  value: Format.date(quote.validUntil))
                        if !quote.sentAt.isEmpty {
                            DetailRow(icon: "paperplane", label: "Envoyé le", value: Format.date(quote.sentAt))
                        }
                        if !quote.acceptedAt.isEmpty {
                            DetailRow(icon: "checkmark.seal", label: "Accepté le",
                                      value: Format.date(quote.acceptedAt))
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(quote.displayReference)
        .navigationBarTitleDisplayMode(.inline)
        .task { await resolveClient(quote.clientId) }
    }

    private func resolveClient(_ id: String) async {
        if let cached = clientDirectory.client(id) {
            linkedClient = cached
        } else if !id.isEmpty {
            linkedClient = try? await APIClient.shared.get("/api/clients/\(id)")
        }
    }
}

// ─── Détail facture ───────────────────────────────────────────────────────
struct InvoiceDetailView: View {
    let invoice: Invoice

    @EnvironmentObject private var clientDirectory: ClientDirectory
    @State private var linkedClient: Client?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 10) {
                    IconBadge(systemName: "doc.plaintext.fill", size: 60, tint: invoice.statusMeta.color)
                    Text(invoice.displayTitle)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                    HStack(spacing: 6) {
                        StatusBadge(meta: invoice.statusMeta)
                        TagPill(text: invoice.displayReference)
                        TagPill(text: invoice.typeLabel)
                    }
                }
                .frame(maxWidth: .infinity)
                .cardSurface()

                if invoice.isOverdue {
                    InlineErrorBanner(message: "Facture en retard de paiement — échéance dépassée.")
                }

                LinkedClientCard(client: linkedClient)

                SectionCard(title: "Montants") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "sum", label: "Total HT", value: Format.currency(invoice.totalHT))
                        DetailRow(icon: "eurosign.circle.fill", label: "Total TTC",
                                  value: Format.currency(invoice.totalTTC))
                        DetailRow(icon: "checkmark.circle", label: "Déjà payé",
                                  value: Format.currency(invoice.totalPaid))
                        DetailRow(icon: "exclamationmark.circle", label: "Reste dû",
                                  value: Format.currency(invoice.remainingDue))
                    }
                }

                SectionCard(title: "Dates") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "calendar", label: "Émise le", value: Format.date(invoice.issueDate))
                        DetailRow(icon: "calendar.badge.exclamationmark", label: "Échéance",
                                  value: Format.date(invoice.dueDate))
                        if !invoice.paidAt.isEmpty {
                            DetailRow(icon: "checkmark.seal", label: "Payée le",
                                      value: Format.date(invoice.paidAt))
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(invoice.displayReference)
        .navigationBarTitleDisplayMode(.inline)
        .task { await resolveClient(invoice.clientId) }
    }

    private func resolveClient(_ id: String) async {
        if let cached = clientDirectory.client(id) {
            linkedClient = cached
        } else if !id.isEmpty {
            linkedClient = try? await APIClient.shared.get("/api/clients/\(id)")
        }
    }
}

// ─── Carte « client lié » réutilisée par les détails devis / factures ─────
struct LinkedClientCard: View {
    let client: Client?

    var body: some View {
        if let client {
            SectionCard(title: "Client") {
                NavigationLink {
                    ClientDetailView(client: client)
                } label: {
                    HStack(spacing: 12) {
                        Avatar(initials: client.initials, size: 40,
                               tint: client.isPro ? Theme.primary : Theme.success)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(client.displayName)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.foreground)
                            if !client.locationLine.isEmpty {
                                Text(client.locationLine)
                                    .font(.caption)
                                    .foregroundStyle(Theme.mutedForeground)
                            }
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.mutedForeground)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}
