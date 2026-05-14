import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// Format — port de packages/core/src/utils/formatters.ts
// Devise, dates, téléphone, SIRET, initiales — tout en locale fr-FR.
// ═══════════════════════════════════════════════════════════════════════════

enum Format {
    // ─── Devise ────────────────────────────────────────────────────────────
    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "EUR"
        f.locale = Locale(identifier: "fr_FR")
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    static func currency(_ value: Double) -> String {
        currencyFormatter.string(from: NSNumber(value: value)) ?? "0,00 €"
    }

    /// Devise compacte pour les KPI : "12,3 k€", "1,2 M€".
    static func currencyCompact(_ value: Double) -> String {
        let abs = Swift.abs(value)
        if abs >= 1_000_000 {
            return trimDecimal(value / 1_000_000) + " M€"
        }
        if abs >= 1_000 {
            return trimDecimal(value / 1_000) + " k€"
        }
        return currency(value)
    }

    private static func trimDecimal(_ v: Double) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 1
        return f.string(from: NSNumber(value: v)) ?? String(v)
    }

    static func trimNumber(_ value: Double) -> String {
        if value == value.rounded() { return String(Int(value)) }
        return String(value)
    }

    // ─── Dates ─────────────────────────────────────────────────────────────
    private static let isoParsers: [ISO8601DateFormatter] = {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return [withFraction, plain]
    }()

    private static let dateOnlyParser: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    private static let dateTimeParser: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    /// Tente de parser une date renvoyée par l'API (ISO, "yyyy-MM-dd",
    /// ou "yyyy-MM-dd HH:mm:ss" façon MySQL).
    static func parseDate(_ raw: String) -> Date? {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        for p in isoParsers {
            if let d = p.date(from: trimmed) { return d }
        }
        if let d = dateTimeParser.date(from: trimmed) { return d }
        if trimmed.count >= 10,
           let d = dateOnlyParser.date(from: String(trimmed.prefix(10))) {
            return d
        }
        return nil
    }

    private static let displayDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "dd/MM/yyyy"
        return f
    }()

    private static let displayLongDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "d MMMM yyyy"
        return f
    }()

    /// "dd/MM/yyyy" — renvoie "" si non parsable.
    static func date(_ raw: String) -> String {
        guard let d = parseDate(raw) else { return "" }
        return displayDate.string(from: d)
    }

    /// "d MMMM yyyy" — renvoie "" si non parsable.
    static func longDate(_ raw: String) -> String {
        guard let d = parseDate(raw) else { return "" }
        return displayLongDate.string(from: d)
    }

    // ─── Téléphone & SIRET ─────────────────────────────────────────────────
    static func phone(_ raw: String) -> String {
        let digits = raw.filter { $0.isNumber }
        guard digits.count == 10 else { return raw }
        return stride(from: 0, to: 10, by: 2)
            .map { i -> String in
                let start = digits.index(digits.startIndex, offsetBy: i)
                let end = digits.index(start, offsetBy: 2)
                return String(digits[start..<end])
            }
            .joined(separator: " ")
    }

    static func siret(_ raw: String) -> String {
        let digits = raw.filter { $0.isNumber }
        guard digits.count == 14 else { return raw }
        func slice(_ from: Int, _ to: Int) -> String {
            let s = digits.index(digits.startIndex, offsetBy: from)
            let e = digits.index(digits.startIndex, offsetBy: to)
            return String(digits[s..<e])
        }
        return "\(slice(0, 3)) \(slice(3, 6)) \(slice(6, 9)) \(slice(9, 14))"
    }

    // ─── Initiales (pour les avatars) ──────────────────────────────────────
    static func initials(_ parts: String...) -> String {
        let letters = parts
            .flatMap { $0.split(separator: " ") }
            .compactMap { $0.first }
            .prefix(2)
        let result = String(letters).uppercased()
        return result.isEmpty ? "?" : result
    }
}
