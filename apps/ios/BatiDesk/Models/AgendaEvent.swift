import Foundation
import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// AgendaEvent — événement d'agenda. Route /api/agenda-events.
// (cf packages/types/src/agenda.ts — AgendaEvent + AGENDA_TYPE_META)
//
// Le schéma serveur a un historique double : colonnes legacy
// startDate/endDate/isAllDay ET colonnes alignées desktop startAt/endAt/allDay.
// Le décodage lit les deux (startAt prioritaire, repli sur startDate).
// Les champs Outlook (outlookEventId, outlookLastSyncAt, syncToOutlook) sont
// traités en lecture seule côté iOS : jamais renvoyés au serveur.
// ═══════════════════════════════════════════════════════════════════════════

struct AgendaEvent: Decodable, Identifiable, Equatable {
    let id: String
    var title: String
    var description: String       // notes / détails
    var type: String              // chantier | rdv | signature | intervention | autre

    // Dates ISO ("2026-04-26T09:00:00.000Z") ou "yyyy-MM-dd HH:mm:ss" (MySQL)
    var startAt: String
    var endAt: String
    var allDay: Bool

    // Liens optionnels ("" si non liés)
    var clientId: String
    var chantierId: String
    var quoteId: String
    var invoiceId: String

    // Affichage
    var location: String
    var colorOverride: String     // hex "#3b82f6", "" = couleur du type

    // Sync Microsoft Outlook — lecture seule côté iOS
    var syncToOutlook: Bool
    var outlookEventId: String
    var outlookLastSyncAt: String

    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, type
        case startAt, endAt, allDay
        // colonnes legacy du schéma serveur (repli)
        case startDate, endDate, isAllDay
        case clientId, chantierId, quoteId, invoiceId
        case location, colorOverride
        case syncToOutlook, outlookEventId, outlookLastSyncAt
        case createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.str(.id)
        title = c.str(.title)
        description = c.str(.description)
        type = c.str(.type)

        let start = c.str(.startAt)
        startAt = start.isEmpty ? c.str(.startDate) : start
        let end = c.str(.endAt)
        endAt = end.isEmpty ? c.str(.endDate) : end
        allDay = c.boolVal(.allDay) || c.boolVal(.isAllDay)

        clientId = c.str(.clientId)
        chantierId = c.str(.chantierId)
        quoteId = c.str(.quoteId)
        invoiceId = c.str(.invoiceId)
        location = c.str(.location)
        colorOverride = c.str(.colorOverride)
        syncToOutlook = c.boolVal(.syncToOutlook)
        outlookEventId = c.str(.outlookEventId)
        outlookLastSyncAt = c.str(.outlookLastSyncAt)
        createdAt = c.str(.createdAt)
        updatedAt = c.str(.updatedAt)
    }

    // ─── Dates parsées (parser tolérant de Format) ─────────────────────────
    var startDateParsed: Date? { Format.parseDate(startAt) }
    var endDateParsed: Date? { Format.parseDate(endAt) }

    var displayTitle: String {
        title.isEmpty ? "Événement sans titre" : title
    }

    /// "09h00 – 11h00" ou "Toute la journée" (cf formatEventTime côté web).
    var timeLabel: String {
        if allDay { return "Toute la journée" }
        guard let start = startDateParsed else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "HH'h'mm"
        if let end = endDateParsed, end != start {
            return "\(f.string(from: start)) – \(f.string(from: end))"
        }
        return f.string(from: start)
    }

    var typeMeta: AgendaTypeMeta { AgendaTypeMeta.forType(type) }

    /// Couleur effective : override hex valide sinon couleur du type
    /// (cf getEventColor côté web).
    var color: Color {
        if let override = AgendaTypeMeta.color(fromHex: colorOverride) {
            return override
        }
        return typeMeta.color
    }

    var isSyncedToOutlook: Bool { !outlookEventId.isEmpty }
}

// ═══════════════════════════════════════════════════════════════════════════
// AgendaTypeMeta — libellés & couleurs des types d'événement.
// Port de AGENDA_TYPE_META (packages/types/src/agenda.ts).
// ═══════════════════════════════════════════════════════════════════════════

struct AgendaTypeMeta: Equatable {
    let key: String
    let label: String
    let color: Color
    let icon: String

    /// Ordre d'affichage des types (Picker du formulaire, filtres).
    static let all: [AgendaTypeMeta] = [
        AgendaTypeMeta(key: "chantier", label: "Chantier",
                       color: color(fromHex: "#3b82f6") ?? .blue,
                       icon: "hammer.fill"),
        AgendaTypeMeta(key: "rdv", label: "Rendez-vous",
                       color: color(fromHex: "#8b5cf6") ?? .purple,
                       icon: "person.2.fill"),
        AgendaTypeMeta(key: "signature", label: "Signature",
                       color: color(fromHex: "#f59e0b") ?? .orange,
                       icon: "signature"),
        AgendaTypeMeta(key: "intervention", label: "Intervention",
                       color: color(fromHex: "#10b981") ?? .green,
                       icon: "wrench.and.screwdriver.fill"),
        AgendaTypeMeta(key: "autre", label: "Autre",
                       color: color(fromHex: "#64748b") ?? .gray,
                       icon: "calendar"),
    ]

    static func forType(_ type: String) -> AgendaTypeMeta {
        all.first(where: { $0.key == type }) ?? all[all.count - 1]
    }

    /// Parse "#rrggbb" → Color. nil si la chaîne n'est pas un hex valide.
    static func color(fromHex hex: String) -> Color? {
        let trimmed = hex.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("#"), trimmed.count == 7 else { return nil }
        let hexDigits = String(trimmed.dropFirst())
        guard hexDigits.allSatisfy({ $0.isHexDigit }) else { return nil }
        var value: UInt64 = 0
        guard Scanner(string: hexDigits).scanHexInt64(&value) else { return nil }
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        return Color(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}
