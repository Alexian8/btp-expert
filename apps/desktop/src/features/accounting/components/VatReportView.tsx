import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Receipt, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountingStore } from "@/stores/accountingStore";
import type { VatReport } from "@btp/types";
import { fmtMoneyAlways, listYears } from "../lib/accountingFormatters";

// ═══════════════════════════════════════════════════════════════════════════
// VatReportView — Suivi de la TVA (à reverser / à recevoir).
//
// Calcule sur la période choisie :
//   - TVA collectée (sur les ventes du journal VE)
//   - TVA déductible (sur les achats du journal AC + immo)
//   - TVA à décaisser ou crédit de TVA à reporter
//   - Détail par taux (20%, 10%, 5.5%, 2.1%)
//
// Préfigure la déclaration CA3.
// ═══════════════════════════════════════════════════════════════════════════

type PeriodMode = "month" | "quarter" | "year";

export function VatReportView() {
  const getVatReport = useAccountingStore((s) => s.getVatReport);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mode, setMode] = useState<PeriodMode>("quarter");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const [report, setReport] = useState<VatReport | null>(null);
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => listYears(now.getFullYear(), 5), [now]);

  const periodKey = useMemo(() => {
    if (mode === "month") return `${year}-${String(month).padStart(2, "0")}`;
    if (mode === "quarter") return `${year}-Q${quarter}`;
    return `${year}`;
  }, [mode, year, month, quarter]);

  useEffect(() => {
    setLoading(true);
    getVatReport(periodKey).then((r) => {
      setReport(r);
      setLoading(false);
    });
  }, [periodKey, getVatReport]);

  const monthLabels = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  return (
    <div className="space-y-4">
      {/* Sélecteur période */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Période :</span>
          <div className="flex gap-1">
            {(["month", "quarter", "year"] as PeriodMode[]).map((m) => (
              <Button
                key={m}
                variant={mode === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(m)}
              >
                {m === "month" ? "Mois" : m === "quarter" ? "Trimestre" : "Année"}
              </Button>
            ))}
          </div>

          {mode === "month" && (
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-muted/50 px-3 text-sm"
            >
              {monthLabels.map((label, i) => (
                <option key={i} value={i + 1}>{label}</option>
              ))}
            </select>
          )}
          {mode === "quarter" && (
            <select
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-muted/50 px-3 text-sm"
            >
              <option value={1}>T1 (jan–mar)</option>
              <option value={2}>T2 (avr–juin)</option>
              <option value={3}>T3 (juil–sep)</option>
              <option value={4}>T4 (oct–déc)</option>
            </select>
          )}

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-muted/50 px-3 text-sm"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {report && (
            <span className="text-xs text-muted-foreground ml-auto">
              {report.dateFrom} → {report.dateTo}
            </span>
          )}
        </div>
      </Card>

      {loading && <div className="text-center py-10 text-muted-foreground">Calcul en cours…</div>}

      {!loading && report && (
        <>
          {/* Synthèse */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">TVA collectée</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {fmtMoneyAlways(report.tvaCollectee)} €
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Compte 445710 (ventes)
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">TVA déductible</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {fmtMoneyAlways(report.tvaDeductible)} €
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Biens/services : {fmtMoneyAlways(report.tvaDeductibleBiens)} € · Immo : {fmtMoneyAlways(report.tvaDeductibleImmo)} €
              </div>
            </Card>

            {report.tvaADecaisser >= 0 ? (
              <Card className="p-4 bg-amber-500/5 border-amber-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">TVA à reverser</span>
                  <Receipt className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-semibold tabular-nums text-amber-600">
                  {fmtMoneyAlways(report.tvaADecaisser)} €
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  À déclarer (CA3 - compte 44551)
                </div>
              </Card>
            ) : (
              <Card className="p-4 bg-emerald-500/5 border-emerald-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Crédit TVA</span>
                  <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">
                  {fmtMoneyAlways(report.creditTvaAReporter)} €
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  À reporter sur la prochaine déclaration
                </div>
              </Card>
            )}
          </div>

          {/* Formule */}
          <Card className="p-4 bg-muted/30">
            <div className="text-xs text-muted-foreground mb-2">Calcul</div>
            <div className="font-mono text-sm flex items-center gap-2 flex-wrap">
              <span>TVA collectée</span>
              <span className="text-muted-foreground">−</span>
              <span>TVA déductible</span>
              <span className="text-muted-foreground">=</span>
              <span>TVA à reverser</span>
            </div>
            <div className="font-mono text-base mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-emerald-600">{fmtMoneyAlways(report.tvaCollectee)} €</span>
              <span className="text-muted-foreground">−</span>
              <span className="text-rose-600">{fmtMoneyAlways(report.tvaDeductible)} €</span>
              <span className="text-muted-foreground">=</span>
              <span className={report.tvaADecaisser >= 0 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
                {report.tvaADecaisser >= 0
                  ? `${fmtMoneyAlways(report.tvaADecaisser)} € à payer`
                  : `${fmtMoneyAlways(report.creditTvaAReporter)} € crédit`}
              </span>
            </div>
          </Card>

          {/* Détail par taux */}
          {report.byRate.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                <h3 className="font-semibold text-sm">Détail par taux de TVA</h3>
                <p className="text-xs text-muted-foreground">Basé sur les ventes de la période</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Taux</th>
                      <th className="px-3 py-2 text-right">Base HT</th>
                      <th className="px-3 py-2 text-right">TVA</th>
                      <th className="px-3 py-2 text-right">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byRate.map((r) => (
                      <tr key={r.rate} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 font-semibold">{r.rate} %</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoneyAlways(r.base)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoneyAlways(r.tva)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoneyAlways(r.base + r.tva)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtMoneyAlways(report.byRate.reduce((s, r) => s + r.base, 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtMoneyAlways(report.byRate.reduce((s, r) => s + r.tva, 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtMoneyAlways(report.byRate.reduce((s, r) => s + r.base + r.tva, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* Note */}
          <Card className="p-4 bg-muted/20">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Ce rapport est calculé à partir des écritures comptables des journaux VE
                (ventes) et AC (achats) sur la période sélectionnée. Pour préparer
                votre déclaration CA3, utilisez ces montants comme base. Une fois la
                TVA déclarée et payée, saisissez une OD pour la solder du compte
                445710 vers 445510 (TVA à décaisser) puis 512000 (banque).
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
