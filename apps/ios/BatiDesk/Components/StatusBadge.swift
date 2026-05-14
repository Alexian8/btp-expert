import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// StatusBadge — pastille colorée d'un statut métier (devis, facture, chantier).
// ═══════════════════════════════════════════════════════════════════════════

struct StatusBadge: View {
    let meta: StatusMeta
    var compact: Bool = false

    var body: some View {
        Text(meta.label)
            .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
            .padding(.horizontal, compact ? 7 : 9)
            .padding(.vertical, compact ? 3 : 4)
            .background(meta.color.opacity(0.16))
            .foregroundStyle(meta.color)
            .clipShape(Capsule())
    }
}

// ─── Étiquette neutre (type de facture, catégorie fournisseur…) ───────────
struct TagPill: View {
    let text: String
    var systemImage: String? = nil

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            Text(text)
        }
        .font(.caption2.weight(.medium))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Theme.muted)
        .foregroundStyle(Theme.mutedForeground)
        .clipShape(Capsule())
    }
}
