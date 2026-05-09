import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";

import { cn } from "@btp/ui";
import { formatEuro, formatPctEvolution } from "@btp/types";
import { useStatsStore } from "@/stores/statsStore";

// ═══════════════════════════════════════════════════════════════════════════
// YoYSection — Comparatif Year-over-Year
// ═══════════════════════════════════════════════════════════════════════════

type Metric = "ca" | "expenses" | "marge";

export function YoYSection() {
  const { yoyComparison, fetchYoYComparison } = useStatsStore();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [metric, setMetric] = useState<Metric>("ca");

  useEffect(() => {
    fetchYoYComparison(year);
  }, [year]);

  if (!yoyComparison) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  // Extraire valeurs selon métrique
  const data = useMemo(() => {
    if (!yoyComparison) return null;
    const extract = (key: Metric) => yoyComparison.monthly.map((m) => ({
      month: m.month,
      monthLabel: m.monthLabel.slice(0, 3),
      current: m[`${key}Current` as keyof typeof m] as number,
      previous: m[`${key}Previous` as keyof typeof m] as number,
      deltaPct: m[`${key}DeltaPct` as keyof typeof m] as number,
    }));
    return extract(metric);
  }, [yoyComparison, metric]);

  const metricMeta = {
    ca: {
      label: "CA encaissé",
      totalCurrent: yoyComparison.caTotalCurrent,
      totalPrevious: yoyComparison.caTotalPrevious,
      evolutionPct: yoyComparison.caEvolutionPct,
      colorCurrent: "bg-emerald-500",
      colorPrevious: "bg-emerald-500/40",
    },
    expenses: {
      label: "Dépenses",
      totalCurrent: yoyComparison.expensesTotalCurrent,
      totalPrevious: yoyComparison.expensesTotalPrevious,
      evolutionPct: yoyComparison.expensesEvolutionPct,
      colorCurrent: "bg-rose-500",
      colorPrevious: "bg-rose-500/40",
    },
    marge: {
      label: "Marge",
      totalCurrent: yoyComparison.margeTotalCurrent,
      totalPrevious: yoyComparison.margeTotalPrevious,
      evolutionPct: yoyComparison.margeEvolutionPct,
      colorCurrent: "bg-violet-500",
      colorPrevious: "bg-violet-500/40",
    },
  };

  const meta = metricMeta[metric];

  const maxValue = useMemo(() => {
    if (!data) return 1000;
    let max = 0;
    for (const d of data) {
      max = Math.max(max, Math.abs(d.current), Math.abs(d.previous));
    }
    return max || 1000;
  }, [data]);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Sélecteurs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Année courante</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm tabular-nums"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-muted-foreground self-end mb-2">vs {year - 1}</span>
      </div>

      {/* Onglets métriques */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["ca", "expenses", "marge"] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
              metric === m
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {metricMeta[m].label}
          </button>
        ))}
      </div>

      {/* KPI bandeau */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BigKpiCard
          label={`${meta.label} ${year}`}
          value={formatEuro(meta.totalCurrent)}
          highlight
        />
        <BigKpiCard
          label={`${meta.label} ${year - 1}`}
          value={formatEuro(meta.totalPrevious)}
        />
        <EvolutionCard
          label="Évolution"
          deltaPct={meta.evolutionPct}
          deltaAbs={meta.totalCurrent - meta.totalPrevious}
          isExpense={metric === "expenses"}
        />
      </div>

      {/* Graphique barres comparatif */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-4">{meta.label} mois par mois</h3>
        <div className="space-y-2">
          {data && data.map((d) => (
            <YoyMonthBar
              key={d.month}
              monthLabel={d.monthLabel}
              current={d.current}
              previous={d.previous}
              maxValue={maxValue}
              colorCurrent={meta.colorCurrent}
              colorPrevious={meta.colorPrevious}
              yearCurrent={year}
              yearPrevious={year - 1}
              isExpense={metric === "expenses"}
            />
          ))}
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold">Détail mois par mois</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs">
              <tr className="text-left">
                <th className="p-2 font-semibold">Mois</th>
                <th className="p-2 font-semibold text-right">CA {year}</th>
                <th className="p-2 font-semibold text-right">CA {year - 1}</th>
                <th className="p-2 font-semibold text-right">Δ CA</th>
                <th className="p-2 font-semibold text-right">Marge {year}</th>
                <th className="p-2 font-semibold text-right">Marge {year - 1}</th>
                <th className="p-2 font-semibold text-right">Δ Marge</th>
              </tr>
            </thead>
            <tbody>
              {yoyComparison.monthly.map((m) => (
                <tr key={m.month} className="border-t border-border">
                  <td className="p-2 font-medium">{m.monthLabel}</td>
                  <td className="p-2 text-right tabular-nums">{formatEuro(m.caCurrent)}</td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">{formatEuro(m.caPrevious)}</td>
                  <td className="p-2 text-right">
                    <DeltaPctBadge value={m.caDeltaPct} isExpense={false} />
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatEuro(m.margeCurrent)}</td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">{formatEuro(m.margePrevious)}</td>
                  <td className="p-2 text-right">
                    <DeltaPctBadge value={m.margeDeltaPct} isExpense={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function BigKpiCard({ label, value, highlight }: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "border rounded-lg p-4",
      highlight ? "bg-primary/5 border-primary/30" : "bg-card border-border"
    )}>
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p className={cn(
        "text-2xl font-bold tabular-nums",
        highlight && "text-primary"
      )}>
        {value}
      </p>
    </div>
  );
}

function EvolutionCard({ label, deltaPct, deltaAbs, isExpense }: {
  label: string;
  deltaPct: number;
  deltaAbs: number;
  isExpense: boolean;
}) {
  // Pour les dépenses, baisse = bonne (vert)
  const goodDirection = isExpense ? deltaPct < 0 : deltaPct > 0;
  const isFlat = Math.abs(deltaPct) < 0.5;
  const colorClass = isFlat
    ? "text-muted-foreground"
    : goodDirection
      ? "text-emerald-500"
      : "text-red-500";
  const Icon = isFlat ? Minus : (deltaPct > 0 ? TrendingUp : TrendingDown);

  return (
    <div className={cn(
      "border rounded-lg p-4",
      isFlat ? "bg-card border-border" : goodDirection ? "bg-emerald-500/5 border-emerald-500/30" : "bg-red-500/5 border-red-500/30"
    )}>
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <Icon className={cn("w-5 h-5", colorClass)} />
        <p className={cn("text-2xl font-bold tabular-nums", colorClass)}>
          {formatPctEvolution(deltaPct)}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        {deltaAbs >= 0 ? "+" : ""}{formatEuro(deltaAbs)}
      </p>
    </div>
  );
}

function YoyMonthBar({
  monthLabel, current, previous, maxValue,
  colorCurrent, colorPrevious, yearCurrent, yearPrevious, isExpense,
}: {
  monthLabel: string;
  current: number;
  previous: number;
  maxValue: number;
  colorCurrent: string;
  colorPrevious: string;
  yearCurrent: number;
  yearPrevious: number;
  isExpense: boolean;
}) {
  const widthCurrent = (current / maxValue) * 100;
  const widthPrevious = (previous / maxValue) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="grid grid-cols-12 gap-2 items-center text-xs"
    >
      <div className="col-span-1 font-medium text-muted-foreground">{monthLabel}</div>
      <div className="col-span-9 space-y-1">
        {/* Année courante */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-8 shrink-0">{yearCurrent}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, widthCurrent)}%` }}
              transition={{ duration: 0.5 }}
              className={cn("h-full rounded-sm", colorCurrent)}
            />
          </div>
          <span className="text-[10px] tabular-nums w-20 text-right shrink-0 font-semibold">
            {formatEuro(current)}
          </span>
        </div>
        {/* Année précédente */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-8 shrink-0">{yearPrevious}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, widthPrevious)}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={cn("h-full rounded-sm", colorPrevious)}
            />
          </div>
          <span className="text-[10px] tabular-nums w-20 text-right shrink-0 text-muted-foreground">
            {formatEuro(previous)}
          </span>
        </div>
      </div>
      <div className="col-span-2 text-right">
        {Math.abs(current) > 0 || Math.abs(previous) > 0 ? (
          <DeltaPctBadge
            value={previous > 0 ? +(((current - previous) / previous) * 100).toFixed(1) : (current > 0 ? 100 : 0)}
            isExpense={isExpense}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </motion.div>
  );
}

function DeltaPctBadge({ value, isExpense }: { value: number; isExpense: boolean }) {
  const isFlat = Math.abs(value) < 0.5;
  const goodDirection = isExpense ? value < 0 : value > 0;
  const colorClass = isFlat
    ? "bg-slate-500/15 text-slate-500"
    : goodDirection
      ? "bg-emerald-500/15 text-emerald-500"
      : "bg-red-500/15 text-red-500";

  return (
    <span className={cn("inline-block text-[10.5px] font-semibold px-1.5 py-0.5 rounded tabular-nums", colorClass)}>
      {formatPctEvolution(value)}
    </span>
  );
}
