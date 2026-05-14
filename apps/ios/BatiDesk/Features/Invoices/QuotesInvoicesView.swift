import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// QuotesInvoicesView — onglet « Devis & Factures ».
// Sélecteur segmenté Devis / Factures, recherche, création / édition / détail.
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
    @State private var showCreate = false

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
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel(segment == .quotes ? "Nouveau devis" : "Nouvelle facture")
            }
        }
        .sheet(isPresented: $showCreate) {
            if segment == .quotes {
                QuoteEditorView { _ in
                    Task { await quotesVM.load() }
                }
            } else {
                InvoiceEditorView { _ in
                    Task { await invoicesVM.load() }
                }
            }
        }
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
            emptyMessage: "Touche + pour créer ton premier devis.",
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
                            QuoteDetailView(quote: quote) {
                                Task { await quotesVM.load() }
                            }
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
            emptyMessage: "Touche + pour créer ta première facture.",
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
                            InvoiceDetailView(invoice: invoice) {
                                Task { await invoicesVM.load() }
                            }
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
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var clientDirectory: ClientDirectory

    @State private var quote: Quote
    let onChanged: () -> Void

    @State private var linkedClient: Client?
    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    @State private var actionError: String?

    init(quote: Quote, onChanged: @escaping () -> Void = {}) {
        _quote = State(initialValue: quote)
        self.onChanged = onChanged
    }

    private var totals: QuoteMath.Totals {
        QuoteMath.computeTotals(
            items: quote.items,
            globalDiscountMode: quote.globalDiscountMode,
            globalDiscountPercent: quote.globalDiscountPercent,
            globalDiscountAmount: quote.globalDiscountAmount
        )
    }

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

                if !quote.items.isEmpty {
                    SectionCard(title: "Lignes (\(quote.lineCount))") {
                        VStack(spacing: 12) {
                            ForEach(quote.items) { item in
                                QuoteItemRow(item: item)
                            }
                        }
                    }
                }

                SectionCard(title: "Totaux") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "sum", label: "Total HT", value: Format.currency(totals.totalHT))
                        ForEach(totals.vatLines) { line in
                            DetailRow(icon: "percent",
                                      label: "TVA \(Format.trimNumber(line.rate)) %",
                                      value: Format.currency(line.tax))
                        }
                        DetailRow(icon: "eurosign.circle.fill", label: "Total TTC",
                                  value: Format.currency(totals.totalTTC))
                    }
                }

                SectionCard(title: "Dates") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "calendar", label: "Émis le", value: Format.date(quote.issueDate))
                        DetailRow(icon: "calendar.badge.clock", label: "Valable jusqu'au",
                                  value: Format.date(quote.validUntilDate))
                        if !quote.sentAt.isEmpty {
                            DetailRow(icon: "paperplane", label: "Envoyé le", value: Format.date(quote.sentAt))
                        }
                        if !quote.acceptedAt.isEmpty {
                            DetailRow(icon: "checkmark.seal", label: "Accepté le",
                                      value: Format.date(quote.acceptedAt))
                        }
                    }
                }

                if !quote.conditionsText.isEmpty {
                    SectionCard(title: "Conditions") {
                        DetailRow(icon: "doc.plaintext", label: "Conditions de règlement",
                                  value: quote.conditionsText, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(quote.displayReference)
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
            QuoteEditorView(editing: quote) { updated in
                quote = updated
                onChanged()
                Task { await resolveClient(updated.clientId) }
            }
        }
        .confirmationDialog(
            "Supprimer ce devis ?",
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
        .task { await resolveClient(quote.clientId) }
    }

    private func resolveClient(_ id: String) async {
        if let cached = clientDirectory.client(id) {
            linkedClient = cached
        } else if !id.isEmpty {
            linkedClient = try? await APIClient.shared.get("/api/clients/\(id)")
        } else {
            linkedClient = nil
        }
    }

    private func performDelete() async {
        do {
            try await APIClient.shared.delete("/api/quotes/\(quote.id)")
            onChanged()
            dismiss()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

// ─── Détail facture ───────────────────────────────────────────────────────
struct InvoiceDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var clientDirectory: ClientDirectory

    @State private var invoice: Invoice
    let onChanged: () -> Void

    @State private var linkedClient: Client?
    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    @State private var actionError: String?

    init(invoice: Invoice, onChanged: @escaping () -> Void = {}) {
        _invoice = State(initialValue: invoice)
        self.onChanged = onChanged
    }

    private var totals: QuoteMath.Totals {
        QuoteMath.computeTotals(
            items: invoice.items,
            globalDiscountMode: invoice.globalDiscountMode,
            globalDiscountPercent: invoice.globalDiscountPercent,
            globalDiscountAmount: invoice.globalDiscountAmount
        )
    }

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

                if !invoice.items.isEmpty {
                    SectionCard(title: "Lignes (\(invoice.lineCount))") {
                        VStack(spacing: 12) {
                            ForEach(invoice.items) { item in
                                QuoteItemRow(item: item)
                            }
                        }
                    }
                }

                SectionCard(title: "Montants") {
                    VStack(spacing: 12) {
                        DetailRow(icon: "sum", label: "Total HT", value: Format.currency(totals.totalHT))
                        ForEach(totals.vatLines) { line in
                            DetailRow(icon: "percent",
                                      label: "TVA \(Format.trimNumber(line.rate)) %",
                                      value: Format.currency(line.tax))
                        }
                        DetailRow(icon: "eurosign.circle.fill", label: "Total TTC",
                                  value: Format.currency(totals.totalTTC))
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

                if !invoice.conditionsText.isEmpty {
                    SectionCard(title: "Conditions") {
                        DetailRow(icon: "doc.plaintext", label: "Conditions de règlement",
                                  value: invoice.conditionsText, multiline: true)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(invoice.displayReference)
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
            InvoiceEditorView(editing: invoice) { updated in
                invoice = updated
                onChanged()
                Task { await resolveClient(updated.clientId) }
            }
        }
        .confirmationDialog(
            "Supprimer cette facture ?",
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
        .task { await resolveClient(invoice.clientId) }
    }

    private func resolveClient(_ id: String) async {
        if let cached = clientDirectory.client(id) {
            linkedClient = cached
        } else if !id.isEmpty {
            linkedClient = try? await APIClient.shared.get("/api/clients/\(id)")
        } else {
            linkedClient = nil
        }
    }

    private func performDelete() async {
        do {
            try await APIClient.shared.delete("/api/invoices/\(invoice.id)")
            onChanged()
            dismiss()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
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
