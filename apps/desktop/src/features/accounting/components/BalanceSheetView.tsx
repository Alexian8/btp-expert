import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/stores/accountingStore";
import type { BalanceSheet, BalanceSheetItem } from "@btp/types";
import { fmtMoneyAlways, listYears, CLASS_LABEL, CLASS_COLOR } from "../lib/accountingFormatters";

// ═══════════════════════════════════════════════════════════════════════════
// BalanceSheetView — Bilan comptable (Actif / Passif)
// ═══════════════════════════════════════════════════════════════════════════

export function BalanceSheetView() {
  const getBalanceSheet = useAccountingStore((s) => s.getBalanceSheet);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => listYears(new Date().getFullYear(), 5), []);

  useEffect(() => {
    setLoading(true);
    getBalanceSheet({ year }).then((r) => {
      setData(r);
      setLoading(false);
    });
  }, [year, getBalanceSheet]);

  const groupedActif = useMemo(() => groupByClass(data?.actif || []), [data]);
  const groupedPassif = useMemo(() => groupByClass(data?.passif || []), [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Bilan comptable — au 31/12/{year}</h2>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <div className="text-center text-muted-foreground py-10">Chargement…</div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total Actif</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(data.totalActif)} €</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total Passif</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(data.totalPassif)} €</div>
            </Card>
            <Card className={`p-4 ${Math.abs(data.totalActif - data.totalPassif) < 0.01 ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
              <div className="text-xs text-muted-foreground">Équilibre</div>
              <div className="text-lg font-semibold mt-1">
                {Math.abs(data.totalActif - data.totalPassif) < 0.01
                  ? "Équilibré ✓"
                  : `Écart : ${fmtMoneyAlways(Math.abs(data.totalActif - data.totalPassif))} €`}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Résultat exercice : <strong className={data.resultat >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {data.resultat >= 0 ? "+" : ""}{fmtMoneyAlways(data.resultat)} €
                </strong>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SideColumn title="ACTIF" groups={groupedActif} total={data.totalActif} />
            <SideColumn title="PASSIF" groups={groupedPassif} total={data.totalPassif} />
          </div>
        </>
      )}
    </div>
  );
}

function groupByClass(items: BalanceSheetItem[]): Record<number, BalanceSheetItem[]> {
  const g: Record<number, BalanceSheetItem[]> = {};
  for (const i of items) {
    const c = i.classe || 0;
    if (!g[c]) g[c] = [];
    g[c].push(i);
  }
  return g;
}

function SideColumn({ title, groups, total }: { title: string; groups: Record<number, BalanceSheetItem[]>; total: number }) {
  const classes = Object.keys(groups).map(Number).sort();
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm font-semibold tabular-nums">{fmtMoneyAlways(total)} €</span>
      </div>
      <div className="overflow-x-auto">
        {classes.map((classe) => {
          const items = groups[classe];
          const classTotal = items.reduce((s, i) => s + i.montant, 0);
          return (
            <div key={classe}>
              <div className="px-3 py-1.5 bg-muted/20 border-b border-border flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded ${CLASS_COLOR[classe] || "bg-muted"}`}>
                    Classe {classe}
                  </span>
                  <span className="text-muted-foreground">{CLASS_LABEL[classe] || ""}</span>
                </span>
                <span className="tabular-nums font-semibold">{fmtMoneyAlways(classTotal)} €</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((i) => (
                    <tr key={i.compteNum} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-mono text-xs w-24">{i.compteNum}</td>
                      <td className="px-3 py-1.5">{i.libelle}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoneyAlways(i.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {classes.length === 0 && (
          <div className="px-3 py-10 text-center text-muted-foreground text-sm">Aucun mouvement</div>
        )}
      </div>
    </Card>
  );
}
