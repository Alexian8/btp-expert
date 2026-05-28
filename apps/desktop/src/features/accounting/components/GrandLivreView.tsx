import { useEffect, useMemo, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/stores/accountingStore";
import type { Account, GrandLivre } from "@btp/types";
import { fmtDate, fmtMoneyAlways, listYears, CLASS_COLOR } from "../lib/accountingFormatters";

// ═══════════════════════════════════════════════════════════════════════════
// GrandLivreView — Consultation par compte avec solde progressif
// ═══════════════════════════════════════════════════════════════════════════

export function GrandLivreView() {
  const fetchAccounts = useAccountingStore((s) => s.fetchAccounts);
  const accounts = useAccountingStore((s) => s.accounts);
  const getGrandLivre = useAccountingStore((s) => s.getGrandLivre);

  const [selectedCompte, setSelectedCompte] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [query, setQuery] = useState("");
  const [data, setData] = useState<GrandLivre | null>(null);
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => listYears(new Date().getFullYear(), 5), []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  useEffect(() => {
    if (!selectedCompte) return;
    setLoading(true);
    getGrandLivre({ compteNum: selectedCompte, year }).then((r) => {
      setData(r);
      setLoading(false);
    });
  }, [selectedCompte, year, getGrandLivre]);

  const filtered = useMemo(() => {
    if (!query) return accounts;
    const q = query.toLowerCase();
    return accounts.filter((a) =>
      a.numero.toLowerCase().includes(q) || a.libelle.toLowerCase().includes(q)
    );
  }, [query, accounts]);

  if (selectedCompte && data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedCompte(""); setData(null); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Compte</div>
            <div className="text-lg font-semibold">
              <span className="font-mono">{selectedCompte}</span>
              <span className="ml-2 text-muted-foreground font-normal">
                {accounts.find((a) => a.numero === selectedCompte)?.libelle}
              </span>
            </div>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-md border border-border bg-muted/50 px-3 text-sm"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total Débit</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(data.totals.debit)} €</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total Crédit</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(data.totals.credit)} €</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Solde</div>
            <div className={`text-2xl font-semibold tabular-nums mt-1 ${data.totals.solde >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmtMoneyAlways(Math.abs(data.totals.solde))} € {data.totals.solde >= 0 ? "(D)" : "(C)"}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Journal</th>
                  <th className="px-3 py-2 text-left">N°</th>
                  <th className="px-3 py-2 text-left">Pièce</th>
                  <th className="px-3 py-2 text-left">Libellé</th>
                  <th className="px-3 py-2 text-center">Lettrage</th>
                  <th className="px-3 py-2 text-right">Débit</th>
                  <th className="px-3 py-2 text-right">Crédit</th>
                  <th className="px-3 py-2 text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Chargement…</td></tr>
                )}
                {!loading && data.lines.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Aucun mouvement sur ce compte</td></tr>
                )}
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(l.date)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.journalCode}</td>
                    <td className="px-3 py-2 font-mono text-xs">#{l.entryNumero}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.pieceRef || "—"}</td>
                    <td className="px-3 py-2">{l.libelle || l.entryLibelle}</td>
                    <td className="px-3 py-2 text-center">
                      {l.lettrage ? (
                        <span className="inline-block px-1 py-0.5 text-[10px] font-mono bg-emerald-500/15 text-emerald-600 rounded">
                          {l.lettrage}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.debit > 0 ? fmtMoneyAlways(l.debit) : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.credit > 0 ? fmtMoneyAlways(l.credit) : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoneyAlways(l.soldeProgressif)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // Liste des comptes pour sélection
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un compte (n° ou libellé)…"
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">N°</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-left">Classe</th>
                <th className="px-3 py-2 text-center">Type</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a: Account) => (
                <tr
                  key={a.numero}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedCompte(a.numero)}
                >
                  <td className="px-3 py-2 font-mono font-semibold">{a.numero}</td>
                  <td className="px-3 py-2">{a.libelle}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${CLASS_COLOR[a.classe] || "bg-muted"}`}>
                      Classe {a.classe}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-muted-foreground">{a.type}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">Aucun compte trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
