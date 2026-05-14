import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// FormComponents — briques réutilisables des écrans de création / édition.
// ═══════════════════════════════════════════════════════════════════════════

/// Ligne de date optionnelle : un Toggle + un DatePicker. Écrit une chaîne
/// "yyyy-MM-dd" dans le binding (ou "" quand la date n'est pas définie) —
/// format attendu par le backend pour les colonnes date des chantiers.
struct OptionalDateRow: View {
    let label: String
    @Binding var dateString: String

    @State private var isEnabled: Bool
    @State private var date: Date

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    init(label: String, dateString: Binding<String>) {
        self.label = label
        _dateString = dateString
        let parsed = Format.parseDate(dateString.wrappedValue)
        _isEnabled = State(initialValue: parsed != nil)
        _date = State(initialValue: parsed ?? Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(label, isOn: $isEnabled)
            if isEnabled {
                DatePicker(label, selection: $date, displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .labelsHidden()
            }
        }
        .onChange(of: isEnabled) { _, enabled in
            dateString = enabled ? Self.formatter.string(from: date) : ""
        }
        .onChange(of: date) { _, newValue in
            if isEnabled { dateString = Self.formatter.string(from: newValue) }
        }
    }
}

/// Affiche un message d'erreur de formulaire dans une section dédiée.
struct FormErrorRow: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
        }
        .font(.footnote)
        .foregroundStyle(Theme.destructive)
    }
}

extension Format {
    /// Parse un nombre saisi par l'utilisateur ("1 234,50" → 1234.5).
    static func parseUserNumber(_ text: String) -> Double {
        let cleaned = text
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: "")
            .replacingOccurrences(of: ",", with: ".")
        return Double(cleaned) ?? 0
    }

    /// Texte d'édition d'un montant (sans symbole, séparateur point).
    static func numberInputText(_ value: Double) -> String {
        value == 0 ? "" : trimNumber(value)
    }
}
