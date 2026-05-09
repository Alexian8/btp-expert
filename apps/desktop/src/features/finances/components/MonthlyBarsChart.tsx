import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { MonthlyDataPoint } from "@btp/types";
import { formatEuro, getMonthLabel } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// MonthlyBarsChart — Graphique en barres SVG (CA vs Dépenses sur 12 mois)
// Pas de dépendance externe, juste SVG natif
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  data: MonthlyDataPoint[];
}

export function MonthlyBarsChart({ data }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const enriched = useMemo(() => data.map((d) => ({
    ...d,
    monthLabelShort: getMonthLabel(d.month),
  })), [data]);

  const maxValue = useMemo(() => {
    let max = 0;
    for (const p of enriched) {
      max = Math.max(max, p.ca, p.expenses);
    }
    return max || 1000; // évite division par 0
  }, [enriched]);

  // Dimensions
  const width = 800;
  const height = 280;
  const padding = { top: 16, right: 16, bottom: 36, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const barGroupW = chartW / Math.max(enriched.length, 1);
  const barW = Math.min(20, (barGroupW - 8) / 2);

  // Échelle Y : 5 ticks
  const ySteps = 5;
  const yTicks = Array.from({ length: ySteps + 1 }, (_, i) => (maxValue * i) / ySteps);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Lignes de grille */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartH - (tick / maxValue) * chartH;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray={i === 0 ? "0" : "2,2"}
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize="9"
              >
                {tick === 0 ? "0" : `${Math.round(tick / 1000)}k`}
              </text>
            </g>
          );
        })}

        {/* Barres */}
        {enriched.map((point, idx) => {
          const groupX = padding.left + idx * barGroupW;
          const caH = (point.ca / maxValue) * chartH;
          const expH = (point.expenses / maxValue) * chartH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={point.month}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Hover overlay */}
              <rect
                x={groupX}
                y={padding.top}
                width={barGroupW}
                height={chartH}
                fill={isHovered ? "currentColor" : "transparent"}
                opacity={isHovered ? 0.04 : 0}
              />

              {/* Barre CA (encaissé) */}
              <motion.rect
                x={groupX + barGroupW / 2 - barW - 1}
                y={padding.top + chartH - caH}
                width={barW}
                height={caH}
                fill="#10b981"
                rx={2}
                initial={{ height: 0, y: padding.top + chartH }}
                animate={{ height: caH, y: padding.top + chartH - caH }}
                transition={{ duration: 0.4, delay: idx * 0.03 }}
                opacity={isHovered ? 1 : 0.85}
              />

              {/* Barre Dépenses */}
              <motion.rect
                x={groupX + barGroupW / 2 + 1}
                y={padding.top + chartH - expH}
                width={barW}
                height={expH}
                fill="#f43f5e"
                rx={2}
                initial={{ height: 0, y: padding.top + chartH }}
                animate={{ height: expH, y: padding.top + chartH - expH }}
                transition={{ duration: 0.4, delay: idx * 0.03 + 0.05 }}
                opacity={isHovered ? 1 : 0.85}
              />

              {/* Label mois */}
              <text
                x={groupX + barGroupW / 2}
                y={height - padding.bottom + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
                fontWeight={isHovered ? 600 : 400}
              >
                {point.monthLabelShort}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredIdx !== null && enriched[hoveredIdx] && (
        <div className="absolute top-2 right-2 bg-card border border-border rounded-md shadow-soft-lg p-2.5 text-xs space-y-1 pointer-events-none">
          <div className="font-semibold">{enriched[hoveredIdx].monthLabelShort}</div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-muted-foreground">CA :</span>
            <span className="font-semibold tabular-nums">{formatEuro(enriched[hoveredIdx].ca)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span className="text-muted-foreground">Dépenses :</span>
            <span className="font-semibold tabular-nums">{formatEuro(enriched[hoveredIdx].expenses)}</span>
          </div>
          <div className="pt-1 border-t border-border flex items-center gap-2">
            <span className="text-muted-foreground">Marge :</span>
            <span className={`font-semibold tabular-nums ${enriched[hoveredIdx].marge >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {formatEuro(enriched[hoveredIdx].marge)}
            </span>
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground">CA encaissé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-rose-500" />
          <span className="text-muted-foreground">Dépenses</span>
        </div>
      </div>
    </div>
  );
}
