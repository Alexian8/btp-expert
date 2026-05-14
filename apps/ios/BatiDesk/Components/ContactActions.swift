import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// ContactActionsBar — boutons d'action rapide (appeler / SMS / e-mail).
// Pensé pour un usage terrain : un artisan sur chantier veut joindre vite.
// ═══════════════════════════════════════════════════════════════════════════

struct ContactActionsBar: View {
    var phone: String = ""
    var email: String = ""

    private var phoneURL: URL? {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        guard digits.count >= 6 else { return nil }
        return URL(string: "tel://\(digits)")
    }

    private var smsURL: URL? {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        guard digits.count >= 6 else { return nil }
        return URL(string: "sms:\(digits)")
    }

    private var emailURL: URL? {
        guard email.contains("@") else { return nil }
        return URL(string: "mailto:\(email)")
    }

    var body: some View {
        if phoneURL != nil || emailURL != nil {
            HStack(spacing: 10) {
                if let phoneURL {
                    actionButton(title: "Appeler", icon: "phone.fill", url: phoneURL)
                }
                if let smsURL {
                    actionButton(title: "SMS", icon: "message.fill", url: smsURL)
                }
                if let emailURL {
                    actionButton(title: "E-mail", icon: "envelope.fill", url: emailURL)
                }
            }
        }
    }

    private func actionButton(title: String, icon: String, url: URL) -> some View {
        Link(destination: url) {
            VStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                Text(title)
                    .font(.caption2.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(Theme.primary.opacity(0.14))
            .foregroundStyle(Theme.primary)
            .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
        }
    }
}
