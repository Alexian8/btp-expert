import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// AgendaView — écran « Agenda » (accessible depuis l'onglet Plus).
//
// Liste mobile-first groupée par jour (« Aujourd'hui », « Demain », puis
// dates), filtre période (à venir / passés / tous) + filtre par type,
// pastille colorée par type d'événement, swipe-to-delete, pull-to-refresh,
// bouton + → feuille de création. Équivalent iOS de /calendar (web).
// ═══════════════════════════════════════════════════════════════════════════

struct AgendaView: View {
    @StateObject private var vm = ResourceListViewModel<AgendaEvent>(path: "/api/agenda-events")

    @State private var search = ""
    @State private var scope: AgendaScope = .upcoming
    @State private var typeFilter: String? = nil     // nil = tous les types
    @State private var showCreate = false
    @State private var editingEvent: AgendaEvent?
    @State private var actionError: String?

    enum AgendaScope: String, CaseIterable {
        case upcoming, past, all

        var label: String {
            switch self {
            case .upcoming: return "À venir"
            case .past:     return "Passés"
            case .all:      return "Tous"
            }
        }
    }

    // ─── Filtrage ──────────────────────────────────────────────────────────
    private var filtered: [AgendaEvent] {
        let startOfToday = Calendar.current.startOfDay(for: Date())
        return vm.items.filter { event in
            if let typeFilter, event.type != typeFilter { return false }
            let day = eventDay(event)
            switch scope {
            case .upcoming:
                guard day >= startOfToday else { return false }
            case .past:
                guard day < startOfToday else { return false }
            case .all:
                break
            }
            guard !search.isEmpty else { return true }
            let query = search.lowercased()
            return event.title.lowercased().contains(query)
                || event.location.lowercased().contains(query)
                || event.description.lowercased().contains(query)
        }
    }

    /// Jour (minuit local) de début d'un événement — clé de regroupement.
    private func eventDay(_ event: AgendaEvent) -> Date {
        Calendar.current.startOfDay(for: event.startDateParsed ?? .distantPast)
    }

    /// Sections triées : chronologique pour « à venir », antichronologique
    /// pour « passés » (le plus récent d'abord).
    private var sections: [(day: Date, events: [AgendaEvent])] {
        let grouped = Dictionary(grouping: filtered, by: eventDay)
        let days = grouped.keys.sorted(by: scope == .past ? (>) : (<))
        return days.map { day in
            let events = (grouped[day] ?? []).sorted {
                ($0.startDateParsed ?? .distantPast) < ($1.startDateParsed ?? .distantPast)
            }
            return (day, events)
        }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "EEEE d MMMM yyyy"
        return f
    }()

    private func dayLabel(_ day: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(day) { return "Aujourd'hui" }
        if calendar.isDateInTomorrow(day) { return "Demain" }
        if calendar.isDateInYesterday(day) { return "Hier" }
        if day == Calendar.current.startOfDay(for: .distantPast) { return "Sans date" }
        return Self.dayFormatter.string(from: day).capitalized
    }

    // ─── Vue ───────────────────────────────────────────────────────────────
    var body: some View {
        ResourceStateView(
            phase: vm.phase,
            isEmpty: vm.items.isEmpty,
            emptyTitle: "Aucun événement",
            emptyMessage: "Planifiez vos rendez-vous, interventions et signatures avec le bouton +.",
            emptyIcon: "calendar",
            retry: { Task { await vm.load() } }
        ) {
            List {
                if let message = vm.phase.failureMessage {
                    Section {
                        InlineErrorBanner(message: message)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                if sections.isEmpty {
                    Section {
                        Text(emptyFilterMessage)
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 24)
                            .listRowBackground(Color.clear)
                    }
                } else {
                    ForEach(sections, id: \.day) { section in
                        Section {
                            ForEach(section.events) { event in
                                Button {
                                    editingEvent = event
                                } label: {
                                    AgendaEventRow(event: event)
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Theme.card)
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await performDelete(event) }
                                    } label: {
                                        Label("Supprimer", systemImage: "trash")
                                    }
                                }
                            }
                        } header: {
                            Text(dayLabel(section.day))
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(
                                    Calendar.current.isDateInToday(section.day)
                                        ? Theme.primary : Theme.mutedForeground
                                )
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .refreshable { await vm.load() }
        }
        .background(Theme.background)
        .navigationTitle("Agenda")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Rechercher un événement")
        .safeAreaInset(edge: .top, spacing: 0) {
            Picker("Période", selection: $scope) {
                ForEach(AgendaScope.allCases, id: \.self) { s in
                    Text(s.label).tag(s)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Theme.background)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                typeFilterMenu
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nouvel événement")
            }
        }
        .sheet(isPresented: $showCreate) {
            EventFormView {
                Task { await vm.load() }
            }
        }
        .sheet(item: $editingEvent) { event in
            EventFormView(editing: event) {
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

    private var emptyFilterMessage: String {
        if !search.isEmpty { return "Aucun résultat pour « \(search) »" }
        switch scope {
        case .upcoming: return "Aucun événement à venir"
        case .past:     return "Aucun événement passé"
        case .all:      return "Aucun événement"
        }
    }

    // ─── Menu de filtre par type ───────────────────────────────────────────
    private var typeFilterMenu: some View {
        Menu {
            Button {
                typeFilter = nil
            } label: {
                if typeFilter == nil {
                    Label("Tous les types", systemImage: "checkmark")
                } else {
                    Text("Tous les types")
                }
            }
            Divider()
            ForEach(AgendaTypeMeta.all, id: \.key) { meta in
                Button {
                    typeFilter = (typeFilter == meta.key) ? nil : meta.key
                } label: {
                    if typeFilter == meta.key {
                        Label(meta.label, systemImage: "checkmark")
                    } else {
                        Text(meta.label)
                    }
                }
            }
        } label: {
            Image(systemName: typeFilter == nil
                  ? "line.3.horizontal.decrease.circle"
                  : "line.3.horizontal.decrease.circle.fill")
        }
        .accessibilityLabel("Filtrer par type")
    }

    // ─── Suppression ───────────────────────────────────────────────────────
    private func performDelete(_ event: AgendaEvent) async {
        do {
            try await APIClient.shared.delete("/api/agenda-events/\(event.id)")
            await vm.load()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

// ─── Ligne d'événement ─────────────────────────────────────────────────────
struct AgendaEventRow: View {
    let event: AgendaEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Barre colorée par type (ou couleur personnalisée)
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(event.color)
                .frame(width: 4)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(event.color)
                        .frame(width: 8, height: 8)
                    Text(event.timeLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.mutedForeground)
                    Spacer(minLength: 0)
                    if event.isSyncedToOutlook {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.caption2)
                            .foregroundStyle(Theme.mutedForeground)
                            .accessibilityLabel("Synchronisé avec Outlook")
                    }
                }
                Text(event.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
                HStack(spacing: 6) {
                    TagPill(text: event.typeMeta.label,
                            systemImage: event.typeMeta.icon)
                    if !event.location.isEmpty {
                        HStack(spacing: 3) {
                            Image(systemName: "mappin.and.ellipse")
                            Text(event.location)
                                .lineLimit(1)
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.mutedForeground)
                    }
                }
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}
