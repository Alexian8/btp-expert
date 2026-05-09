import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, TrendingUp, Sparkles } from "lucide-react";

import { cn } from "@btp/ui";
import { formatEuro, getMonthShortLabel } from "@btp/types";
import { useStatsStore } from "@/stores/statsStore";

// ═══════════════════════════════════════════════════════════════════════════
// SeasonalitySection — Heatmap CA mensuel sur plusieurs années
// ═══════════════════════════════════════════════════════════════════════════

export function SeasonalitySection() {
  const { seasonality, fetchSeasonality } = useStatsStore();

  useEffect(() => {
    fetchSeasonality();
  }, []);

  if (!seasonality) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  // Construire matrice années × mois
  const matrix = useMemo(() => {
    if (!seasonality) return new Map();
    const m = new Map<string, number>();
    for (const c of seasonality.cells) {
      m.set(`${c.year}-${c.month}`, c.ca);
    }
    return m;
  }, [seasonality]);

  // Identifier le mois le plus fort/faible en moyenne
  const { bestMonth, worstMonth } = useMemo(() => {
    if (!seasonality.monthlyAverage.length) {
      return { bestMonth: null as any, worstMonth: null as any };
    }
    let best = seasonality.monthlyAverage[0];
    let worst = seasonality.monthlyAverage[0];
    for (const m of seasonality.monthlyAverage) {
      if (m.avgCa > best.avgCa) best = m;
      if (m.avgCa < worst.avgCa && m.avgCa > 0) worst = m;
    }
    return { bestMonth: best, worstMonth: worst };
  }, [seasonality]);

  if (seasonality.years.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
        <h3 className="text-sm font-semibold mb-1">Pas encore de données</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          La saisonnalité s'affichera dès qu'il y aura des factures émises.
          Plus tu auras d'historique, plus la heatmap sera révélatrice des tendances.
        </p>
      </div>
    );
  }

  const onlyOneYear = seasonality.years.length === 1;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Insights */}
      {bestMonth && worstMonth && bestMonth.month !== worstMonth.month && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InsightCard
            icon={Sparkles}
            color="bg-emerald-500/15 text-emerald-500"
            title="Meilleur mois en moyenne"
            value={getMonthLongLabelFr(bestMonth.month)}
            subtext={`${formatEuro(bestMonth.avgCa)} en moyenne`}
          />
          <InsightCard
            icon={TrendingUp}
            color="bg-blue-500/15 text-blue-500"
            title="Mois le plus calme"
            value={getMonthLongLabelFr(worstMonth.month)}
            subtext={`${formatEuro(worstMonth.avgCa)} en moyenne`}
          />
        </div>
      )}

      {onlyOneYear && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700">
          Tu n'as pour l'instant qu'une année d'historique. La heatmap deviendra plus parlante avec les années suivantes.
        </div>
      )}

      {/* Heatmap */}
      <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold">CA encaissé · Heatmap années × mois</h3>
        </div>

        <div className="min-w-[640px]">
          {/* Header mois */}
          <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mb-1">
            <div></div>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="text-[10px] text-center text-muted-foreground font-medium">
                {getMonthShortLabel(i + 1)}
              </div>
            ))}
          </div>

          {/* Lignes années */}
          {seasonality.years.slice().reverse().map((year, yIdx) => (
            <motion.div
              key={year}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: yIdx * 0.05 }}
              className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mb-1"
            >
              <div className="text-xs font-semibold tabular-nums text-muted-foreground self-center">
                {year}
              </div>
              {Array.from({ length: 12 }, (_, m) => {
                const month = m + 1;
                const ca = matrix.get(`${year}-${month}`) || 0;
                const intensity = seasonality.maxCa > 0 ? ca / seasonality.maxCa : 0;
                return (
                  <HeatmapCell
                    key={month}
                    ca={ca}
                    intensity={intensity}
                    year={year}
                    month={month}
                  />
                );
              })}
            </motion.div>
          ))}

          {/* Ligne moyenne */}
          <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mt-3 pt-3 border-t border-border">
            <div className="text-xs font-semibold text-violet-600 self-center">
              Moy.
            </div>
            {seasonality.monthlyAverage.map((m) => {
              const intensity = seasonality.maxCa > 0 ? m.avgCa / seasonality.maxCa : 0;
              return (
                <HeatmapCell
                  key={m.month}
                  ca={m.avgCa}
                  intensity={intensity}
                  year={null}
                  month={m.month}
                  isAverage
                />
              );
            })}
          </div>
        </div>

        {/* Légende */}
        <div className="flex items-center justify-end gap-2 mt-4 text-[11px] text-muted-foreground">
          <span>Moins</span>
          <div className="flex">
            {[0.1, 0.25, 0.5, 0.75, 1].map((i) => (
              <div
                key={i}
                className="w-4 h-3"
                style={{
                  backgroundColor: `rgba(139, 92, 246, ${i * 0.9})`,
                }}
              />
            ))}
          </div>
          <span>Plus</span>
        </div>
      </div>

      {/* Trim moyens */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Répartition trimestrielle moyenne</h3>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((trim) => {
            const monthsInTrim = [trim * 3 - 2, trim * 3 - 1, trim * 3];
            const avg = monthsInTrim.reduce((sum, m) => {
              const monthData = seasonality.monthlyAverage.find((x) => x.month === m);
              return sum + (monthData?.avgCa || 0);
            }, 0);
            return (
              <div key={trim} className="bg-muted/30 rounded-md p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">T{trim}</p>
                <p className="text-base font-bold tabular-nums">{formatEuro(avg)}</p>
                <p className="text-[10.5px] text-muted-foreground mt-1">CA moyen</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Cell ──────────────────────────────────────────────────────────────────
function HeatmapCell({ ca, intensity, year, month, isAverage }: {
  ca: number;
  intensity: number;
  year: number | null;
  month: number;
  isAverage?: boolean;
}) {
  const opacity = ca > 0 ? Math.max(0.1, intensity * 0.9) : 0;
  return (
    <div
      className={cn(
        "h-8 rounded text-[9px] flex items-center justify-center relative group cursor-default",
        ca === 0 && "bg-muted/30 text-muted-foreground/50",
        isAverage && "ring-1 ring-violet-500/40"
      )}
      style={{
        backgroundColor: ca > 0 ? `rgba(139, 92, 246, ${opacity})` : undefined,
        color: opacity > 0.4 ? "white" : undefined,
      }}
      title={`${year ? `${year} ` : "Moyenne "}${getMonthLongLabelFr(month)} : ${formatEuro(ca)}`}
    >
      <span className="tabular-nums font-medium">
        {ca > 0 ? formatEuroShort(ca) : "—"}
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border border-border rounded shadow-soft-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 whitespace-nowrap text-xs">
        {year ? year : "Moyenne"} · {getMonthLongLabelFr(month)}
        <br />
        <strong className="tabular-nums">{formatEuro(ca)}</strong>
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, color, title, value, subtext }: {
  icon: any;
  color: string;
  title: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-base font-bold truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtext}</p>
      </div>
    </div>
  );
}

function getMonthLongLabelFr(month: number): string {
  const labels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return labels[month - 1] || "?";
}

function formatEuroShort(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
  return amount.toFixed(0);
}
