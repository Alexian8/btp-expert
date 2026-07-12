import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// EventFormView — création / édition d'un événement d'agenda (feuille modale).
//
// Équivalent iOS de EventEditorModal.tsx (web). Les dates sont envoyées en
// ISO 8601 UTC dans startAt/endAt, et recopiées dans les colonnes legacy
// startDate/endDate/isAllDay (NOT NULL côté MySQL). Les champs Outlook ne
// sont jamais envoyés (lecture seule côté iOS).
// ═══════════════════════════════════════════════════════════════════════════

struct AgendaEventDraft: Encodable {
    var id = ""
    var title = ""
    var description = ""
    var type = "rdv"
    var startAt = ""
    var endAt = ""
    var allDay = false
    var clientId = ""
    var chantierId = ""
    var location = ""
    var colorOverride = ""
    // Colonnes legacy du schéma serveur (startDate est NOT NULL)
    var startDate = ""
    var endDate = ""
    var isAllDay = false
}

struct EventFormView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var clientDirectory: ClientDirectory

    private let editingId: String?
    let onSaved: () -> Void

    @State private var title: String
    @State private var type: String
    @State private var allDay: Bool
    @State private var startDate: Date
    @State private var endDate: Date
    @State private var clientId: String
    @State private var chantierId: String
    @State private var location: String
    @State private var notes: String
    @State private var colorOverride: String

    @State private var isSaving = false
    @State private var errorMessage: String?

    @StateObject private var chantiersVM =
        ResourceListViewModel<Chantier>(path: "/api/chantiers")

    /// Sérialiseur ISO 8601 UTC (format stocké par le desktop / le serveur).
    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    init(editing event: AgendaEvent? = nil,
         defaultDate: Date = Date(),
         onSaved: @escaping () -> Void) {
        self.editingId = event?.id
        self.onSaved = onSaved

        if let event {
            let start = event.startDateParsed ?? Date()
            let end = event.endDateParsed ?? start.addingTimeInterval(3600)
            _title = State(initialValue: event.title)
            _type = State(initialValue: event.type.isEmpty ? "rdv" : event.type)
            _allDay = State(initialValue: event.allDay)
            _startDate = State(initialValue: start)
            _endDate = State(initialValue: max(end, start))
            _clientId = State(initialValue: event.clientId)
            _chantierId = State(initialValue: event.chantierId)
            _location = State(initialValue: event.location)
            _notes = State(initialValue: event.description)
            _colorOverride = State(initialValue: event.colorOverride)
        } else {
            // Nouveau : prochaine heure ronde du jour choisi, durée 1 h.
            let calendar = Calendar.current
            var start = calendar.date(
                bySettingHour: calendar.component(.hour, from: Date()),
                minute: 0, second: 0, of: defaultDate
            ) ?? defaultDate
            start = start.addingTimeInterval(3600)
            _title = State(initialValue: "")
            _type = State(initialValue: "rdv")
            _allDay = State(initialValue: false)
            _startDate = State(initialValue: start)
            _endDate = State(initialValue: start.addingTimeInterval(3600))
            _clientId = State(initialValue: "")
            _chantierId = State(initialValue: "")
            _location = State(initialValue: "")
            _notes = State(initialValue: "")
            _colorOverride = State(initialValue: "")
        }
    }

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && endDate >= startDate
    }

    private var dateComponents: DatePickerComponents {
        allDay ? [.date] : [.date, .hourAndMinute]
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Événement") {
                    TextField("Titre", text: $title)
                    Picker("Type", selection: $type) {
                        ForEach(AgendaTypeMeta.all, id: \.key) { meta in
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(meta.color)
                                    .frame(width: 10, height: 10)
                                Text(meta.label)
                            }
                            .tag(meta.key)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Dates") {
                    Toggle("Journée entière", isOn: $allDay)
                    DatePicker("Début", selection: $startDate,
                               displayedComponents: dateComponents)
                    DatePicker("Fin", selection: $endDate,
                               in: startDate...,
                               displayedComponents: dateComponents)
                }
                .listRowBackground(Theme.card)

                Section("Liens") {
                    Picker("Chantier", selection: $chantierId) {
                        Text("Aucun chantier").tag("")
                        ForEach(chantiersVM.items) { chantier in
                            Text(chantier.displayTitle).tag(chantier.id)
                        }
                    }
                    Picker("Client", selection: $clientId) {
                        Text("Aucun client").tag("")
                        ForEach(clientDirectory.allClientsSorted) { client in
                            Text(client.displayName).tag(client.id)
                        }
                    }
                }
                .listRowBackground(Theme.card)

                Section("Lieu") {
                    TextField("Adresse / lieu", text: $location)
                }
                .listRowBackground(Theme.card)

                Section("Notes") {
                    TextField("Détails, consignes…", text: $notes, axis: .vertical)
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
            .navigationTitle(editingId == nil ? "Nouvel événement" : "Modifier l'événement")
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
            .onChange(of: startDate) { _, newValue in
                if endDate < newValue { endDate = newValue.addingTimeInterval(3600) }
            }
            .task {
                await clientDirectory.loadIfNeeded()
                await chantiersVM.loadIfNeeded()
            }
        }
    }

    // ─── Sérialisation des dates ───────────────────────────────────────────
    /// En journée entière : début 00:00:00 → fin 23:59:59 (parité desktop).
    private func buildDraft() -> AgendaEventDraft {
        let calendar = Calendar.current
        let effectiveStart: Date
        let effectiveEnd: Date
        if allDay {
            effectiveStart = calendar.startOfDay(for: startDate)
            let endOfDay = calendar.date(
                bySettingHour: 23, minute: 59, second: 59,
                of: max(endDate, startDate)
            )
            effectiveEnd = endOfDay ?? max(endDate, startDate)
        } else {
            effectiveStart = startDate
            effectiveEnd = max(endDate, startDate)
        }

        var draft = AgendaEventDraft()
        draft.title = title.trimmingCharacters(in: .whitespaces)
        draft.description = notes
        draft.type = type
        draft.startAt = Self.isoFormatter.string(from: effectiveStart)
        draft.endAt = Self.isoFormatter.string(from: effectiveEnd)
        draft.allDay = allDay
        draft.clientId = clientId
        draft.chantierId = chantierId
        draft.location = location
        draft.colorOverride = colorOverride
        // Miroir legacy (startDate est NOT NULL côté MySQL)
        draft.startDate = draft.startAt
        draft.endDate = draft.endAt
        draft.isAllDay = allDay
        return draft
    }

    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        var draft = buildDraft()
        do {
            if let editingId {
                let _: AgendaEvent = try await APIClient.shared
                    .update("/api/agenda-events/\(editingId)", body: draft)
            } else {
                draft.id = APIClient.newID()
                let _: AgendaEvent = try await APIClient.shared
                    .create("/api/agenda-events", body: draft)
            }
            onSaved()
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
