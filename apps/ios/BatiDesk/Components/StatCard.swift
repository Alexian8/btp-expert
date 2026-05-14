import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// StatCard — carte KPI du tableau de bord (port des cartes KPI de la web app).
// ═══════════════════════════════════════════════════════════════════════════

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    var tint: Color = Theme.primary
    var caption: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                IconBadge(systemName: icon, size: 36, tint: tint)
                Spacer(minLength: 0)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(Theme.mutedForeground)
                    .lineLimit(2)
            }
            if let caption {
                Text(caption)
                    .font(.caption2)
                    .foregroundStyle(Theme.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(padding: 14)
    }
}

// ─── Bandeau d'alerte cliquable (factures en retard, devis sans réponse…) ──
struct AlertBanner: View {
    enum Level { case danger, warning, info

        var tint: Color {
            switch self {
            case .danger:  return Theme.destructive
            case .warning: return Theme.warning
            case .info:    return Theme.primary
            }
        }
    }

    let level: Level
    let icon: String
    let title: String
    let subtitle: String
    var showsChevron: Bool = true

    var body: some View {
        HStack(spacing: 12) {
            IconBadge(systemName: icon, size: 38, tint: level.tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(Theme.mutedForeground)
            }
            Spacer(minLength: 0)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.mutedForeground)
            }
        }
        .padding(14)
        .background(level.tint.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                .strokeBorder(level.tint.opacity(0.3), lineWidth: 1)
        )
    }
}
