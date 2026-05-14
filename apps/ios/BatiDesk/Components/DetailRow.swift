import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// DetailRow & SectionCard — briques des écrans de détail (lecture seule).
// ═══════════════════════════════════════════════════════════════════════════

struct DetailRow: View {
    let icon: String
    let label: String
    let value: String
    var multiline: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(Theme.mutedForeground)
                Text(value.isEmpty ? "—" : value)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(multiline ? nil : 1)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.mutedForeground)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}

// ─── Ligne "carte" générique pour les listes (chevron + contenu) ──────────
struct CardRow<Leading: View, Content: View>: View {
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var content: () -> Content

    var body: some View {
        HStack(spacing: 12) {
            leading()
            content()
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.mutedForeground)
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
