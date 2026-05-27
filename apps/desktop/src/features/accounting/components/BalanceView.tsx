import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAccountingStore } from "@/stores/accountingStore";
import type { BalanceRow } from "@btp/types";
import { fmtMoneyAlways, listYears, CLASS_LABEL, CLASS_COLOR } from "../lib/accountingFormatters";

// ═══════════════════════════════════════════════════════════════════════════
// BalanceView — Balance générale (Σ débit, Σ crédit, solde par compte)
// ═══════════════════════════════════════════════════════════════════════════

export function BalanceView() {
  const getBalance = useAccountingStore((s) => s.getBalance);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const years = useMemo(() => listYears(new Date().getFullYear(), 5), []);

  useEffect(() => {
    setLoading(true);
    getBalance({ year }).then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, [year, getBalance]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.compteNum.toLowerCase().includes(q) ||
      (r.compteLibelle || "").toLowerCase().includes(q) ||
      (r.compAuxLib || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const groupedByClass = useMemo(() => {
    const groups: Record<number, BalanceRow[]> = {};
    for (const r of filtered) {
      const c = r.classe || 0;
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    }
    return groups;
  }, [filtered]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        debit: acc.debit + (r.totalDebit || 0),
        credit: acc.credit + (r.totalCredit || 0),
      }),
      { debit: 0, credit: 0 }
    );
  }, [filtered]);

  const classes = Object.keys(groupedByClass).map(Number).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer par n° ou libellé…"
          className="flex-1 min-w-[200px] max-w-md"
        />
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Comptes mouvementés</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{filtered.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Débit</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(totals.debit)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Crédit</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(totals.credit)} €</div>
        </Card>
      </div>

      {loading && <div className="text-center text-muted-foreground py-10">Chargement…</div>}

      {!loading && classes.map((classe) => {
        const items = groupedByClass[classe];
        const classDebit = items.reduce((s, r) => s + (r.totalDebit || 0), 0);
        const classCredit = items.reduce((s, r) => s + (r.totalCredit || 0), 0);
        const classSolde = classDebit - classCredit;
        return (
          <Card key={classe} className="overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${CLASS_COLOR[classe] || "bg-muted"}`}>
                  Classe {classe}
                </span>
                <span className="font-semibold text-sm">{CLASS_LABEL[classe] || ""}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Solde : <strong className={classSolde >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {fmtMoneyAlways(Math.abs(classSolde))} € {classSolde >= 0 ? "(D)" : "(C)"}
                </strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">N°</th>
                    <th className="px-3 py-2 text-left">Libellé</th>
                    <th className="px-3 py-2 text-right">Total Débit</th>
                    <th className="px-3 py-2 text-right">Total Crédit</th>
                    <th className="px-3 py-2 text-right">Solde Débiteur</th>
                    <th className="px-3 py-2 text-right">Solde Créditeur</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.compteNum + "_" + r.compAuxNum} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">
                        {r.compteNum}
                        {r.compAuxNum && r.compAuxNum !== r.compteNum && (
                          <div className="text-muted-foreground font-normal">/ {r.compAuxNum}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.compteLibelle}
                        {r.compAuxLib && (
                          <div className="text-xs text-muted-foreground">{r.compAuxLib}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoneyAlways(r.totalDebit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoneyAlways(r.totalCredit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.solde > 0 ? fmtMoneyAlways(r.solde) : ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.solde < 0 ? fmtMoneyAlways(-r.solde) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
