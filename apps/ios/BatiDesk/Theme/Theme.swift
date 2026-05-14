import SwiftUI
import UIKit

// ═══════════════════════════════════════════════════════════════════════════
// Theme — port des design tokens de apps/desktop/src/styles/globals.css
//
// Chaque token a une valeur claire + sombre (HSL, comme dans le CSS).
// Les couleurs se résolvent automatiquement selon l'apparence système.
// ═══════════════════════════════════════════════════════════════════════════

extension Color {
    /// Construit une couleur depuis HSL (comme les variables CSS du projet).
    /// hue 0..360, saturation/lightness 0..1.
    init(hslH hue: Double, s: Double, l: Double) {
        let c = (1 - abs(2 * l - 1)) * s
        let hp = hue / 60
        let x = c * (1 - abs(hp.truncatingRemainder(dividingBy: 2) - 1))
        var r = 0.0, g = 0.0, b = 0.0
        switch hp {
        case 0..<1: (r, g, b) = (c, x, 0)
        case 1..<2: (r, g, b) = (x, c, 0)
        case 2..<3: (r, g, b) = (0, c, x)
        case 3..<4: (r, g, b) = (0, x, c)
        case 4..<5: (r, g, b) = (x, 0, c)
        default:    (r, g, b) = (c, 0, x)
        }
        let m = l - c / 2
        self.init(.sRGB, red: r + m, green: g + m, blue: b + m, opacity: 1)
    }
}

private func adaptive(_ light: Color, _ dark: Color) -> Color {
    let l = UIColor(light)
    let d = UIColor(dark)
    return Color(UIColor { $0.userInterfaceStyle == .dark ? d : l })
}

enum Theme {
    // ─── Surfaces & texte ──────────────────────────────────────────────────
    static let background      = adaptive(Color(hslH: 0,   s: 0,    l: 1),    Color(hslH: 222, s: 0.47, l: 0.06))
    static let foreground      = adaptive(Color(hslH: 222, s: 0.47, l: 0.11), Color(hslH: 210, s: 0.40, l: 0.98))
    static let card            = adaptive(Color(hslH: 0,   s: 0,    l: 1),    Color(hslH: 222, s: 0.47, l: 0.08))
    static let cardForeground  = foreground
    static let muted           = adaptive(Color(hslH: 210, s: 0.40, l: 0.96), Color(hslH: 217, s: 0.33, l: 0.14))
    static let mutedForeground = adaptive(Color(hslH: 215, s: 0.16, l: 0.47), Color(hslH: 215, s: 0.20, l: 0.65))
    static let accent          = adaptive(Color(hslH: 210, s: 0.40, l: 0.96), Color(hslH: 217, s: 0.33, l: 0.17))
    static let border          = adaptive(Color(hslH: 214, s: 0.32, l: 0.91), Color(hslH: 217, s: 0.33, l: 0.17))

    // ─── Couleur d'accent (bleu par défaut) ────────────────────────────────
    static let primary           = adaptive(Color(hslH: 217, s: 0.91, l: 0.60), Color(hslH: 217, s: 0.91, l: 0.65))
    static let primaryForeground = adaptive(Color(hslH: 0,   s: 0,    l: 1),    Color(hslH: 222, s: 0.47, l: 0.11))

    // ─── Couleurs sémantiques ──────────────────────────────────────────────
    static let destructive = adaptive(Color(hslH: 0,   s: 0.84, l: 0.60), Color(hslH: 0,   s: 0.63, l: 0.45))
    static let success     = adaptive(Color(hslH: 142, s: 0.71, l: 0.45), Color(hslH: 142, s: 0.71, l: 0.45))
    static let warning     = adaptive(Color(hslH: 38,  s: 0.92, l: 0.50), Color(hslH: 38,  s: 0.92, l: 0.55))

    // ─── Rayons (cf --radius dans globals.css) ─────────────────────────────
    static let cardRadius: CGFloat = 14
    static let controlRadius: CGFloat = 10

    /// Couleur d'un statut métier (slate / blue / emerald / amber / rose),
    /// telle qu'utilisée par les *_STATUS_META côté web.
    static func statusColor(_ name: String) -> Color {
        switch name {
        case "blue":    return primary
        case "emerald": return success
        case "amber":   return warning
        case "rose":    return destructive
        case "slate":   return mutedForeground
        default:        return mutedForeground
        }
    }
}

// ─── Petites aides de style réutilisables ─────────────────────────────────
extension View {
    /// Conteneur "carte" : fond card + bordure douce + coins arrondis.
    func cardSurface(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
    }

    /// Ombre subtile façon Linear/Shadcn.
    func softShadow() -> some View {
        shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: 2)
    }
}
