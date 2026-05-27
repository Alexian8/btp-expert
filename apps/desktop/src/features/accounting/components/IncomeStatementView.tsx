import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/stores/accountingStore";
import type { IncomeStatement } from "@btp/types";
import { fmtMoneyAlways, listYears } from "../lib/accountingFormatters";

// ═══════════════════════════════════════════════════════════════════════════
// IncomeStatementView — Compte de résultat (Produits - Charges)
// ═══════════════════════════════════════════════════════════════════════════

export function IncomeStatementView() {
  const getIncomeStatement = useAccountingStore((s) => s.getIncomeStatement);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => listYears(new Date().getFullYear(), 5), []);

  useEffect(() => {
    setLoading(true);
    getIncomeStatement({ year }).then((r) => {
      setData(r);
      setLoading(false);
    });
  }, [year, getIncomeStatement]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Compte de résultat — exercice {year}</h2>
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
              <div className="text-xs text-muted-foreground">Total Produits</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-emerald-600">
                {fmtMoneyAlways(data.totalProduits)} €
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total Charges</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-rose-600">
                {fmtMoneyAlways(data.totalCharges)} €
              </div>
            </Card>
            <Card className={`p-4 ${data.resultat >= 0 ? "bg-emerald-500/5 border-emerald-500/30" : "bg-rose-500/5 border-rose-500/30"}`}>
              <div className="text-xs text-muted-foreground">Résultat de l'exercice</div>
              <div className={`text-2xl font-semibold tabular-nums mt-1 ${data.resultat >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {data.resultat >= 0 ? "+" : ""}{fmtMoneyAlways(data.resultat)} €
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {data.resultat >= 0 ? "Bénéfice" : "Perte"}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ColumnCard title="Produits (Classe 7)" items={data.produits} total={data.totalProduits} variant="positive" />
            <ColumnCard title="Charges (Classe 6)" items={data.charges} total={data.totalCharges} variant="negative" />
          </div>
        </>
      )}
    </div>
  );
}

function ColumnCard({
  title,
  items,
  total,
  variant,
}: {
  title: string;
  items: { compteNum: string; libelle: string; montant: number }[];
  total: number;
  variant: "positive" | "negative";
}) {
  const color = variant === "positive" ? "text-emerald-600" : "text-rose-600";
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">N°</th>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Aucun mouvement</td></tr>
            )}
            {items.map((i) => (
              <tr key={i.compteNum} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2 font-mono text-xs font-semibold">{i.compteNum}</td>
                <td className="px-3 py-2">{i.libelle}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${color}`}>{fmtMoneyAlways(i.montant)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-right">Total</td>
              <td className={`px-3 py-2 text-right tabular-nums ${color}`}>{fmtMoneyAlways(total)} €</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
