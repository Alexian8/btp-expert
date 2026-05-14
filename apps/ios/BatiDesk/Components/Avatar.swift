import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// Avatar — pastille d'initiales (clients, fournisseurs, utilisateur).
// ═══════════════════════════════════════════════════════════════════════════

struct Avatar: View {
    let initials: String
    var size: CGFloat = 44
    var tint: Color = Theme.primary

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.15))
            .clipShape(Circle())
    }
}

// ─── Pastille icône (en-tête de section, lignes de liste) ─────────────────
struct IconBadge: View {
    let systemName: String
    var size: CGFloat = 40
    var tint: Color = Theme.primary

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    }
}
