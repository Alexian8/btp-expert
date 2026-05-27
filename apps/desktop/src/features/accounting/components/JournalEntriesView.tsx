import { Fragment, useEffect, useMemo, useState } from "react";
import { Search, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/stores/accountingStore";
import type { JournalEntry, Journal } from "@btp/types";
import { JOURNAL_LABEL } from "@btp/types";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { fmtDate, fmtMoneyAlways, listYears } from "../lib/accountingFormatters";
import { ManualEntryModal } from "./ManualEntryModal";

// ═══════════════════════════════════════════════════════════════════════════
// JournalEntriesView — Livre journal
// ═══════════════════════════════════════════════════════════════════════════

export function JournalEntriesView() {
  const listEntries = useAccountingStore((s) => s.listEntries);
  const deleteEntry = useAccountingStore((s) => s.deleteEntry);
  const fetchJournals = useAccountingStore((s) => s.fetchJournals);
  const journals = useAccountingStore((s) => s.journals);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterJournal, setFilterJournal] = useState<string>("");
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [showManualModal, setShowManualModal] = useState(false);
  const [toDelete, setToDelete] = useState<JournalEntry | null>(null);

  const years = useMemo(() => listYears(new Date().getFullYear(), 5), []);

  const refresh = async () => {
    setLoading(true);
    const r = await listEntries({
      journalCode: filterJournal || undefined,
      year: filterYear,
      search: search || undefined,
      limit: 500,
    });
    setEntries(r);
    setLoading(false);
  };

  useEffect(() => { fetchJournals(); }, [fetchJournals]);
  useEffect(() => { refresh(); }, [filterJournal, filterYear]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refresh();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const r = await deleteEntry(toDelete.id);
    if (r.success) {
      toast.success("Écriture supprimée");
      setToDelete(null);
      refresh();
    } else {
      toast.error(r.error || "Suppression impossible");
    }
  };

  const totalDebit = entries.reduce((s, e) => s + (e.lines?.reduce((ss, l) => ss + l.debit, 0) || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.lines?.reduce((ss, l) => ss + l.credit, 0) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (libellé, n° pièce)…"
            className="pl-9"
          />
        </form>

        <select
          value={filterJournal}
          onChange={(e) => setFilterJournal(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Tous les journaux</option>
          {journals.map((j: Journal) => (
            <option key={j.code} value={j.code}>{j.code} — {j.libelle}</option>
          ))}
        </select>

        <select
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <Button variant="outline" onClick={() => setShowManualModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Saisir OD
        </Button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Écritures</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{entries.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Débit</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(totalDebit)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Crédit</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoneyAlways(totalCredit)} €</div>
        </Card>
      </div>

      {/* Liste */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Journal</th>
                <th className="px-3 py-2 text-left">N°</th>
                <th className="px-3 py-2 text-left">Pièce</th>
                <th className="px-3 py-2 text-left">Compte</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-right">Débit</th>
                <th className="px-3 py-2 text-right">Crédit</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Chargement…</td></tr>
              )}
              {!loading && entries.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Aucune écriture pour les filtres sélectionnés</td></tr>
              )}
              {entries.map((e) => (
                <EntryRows key={e.id} entry={e} onDelete={() => setToDelete(e)} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ManualEntryModal
        open={showManualModal}
        onClose={() => setShowManualModal(false)}
        onCreated={() => { setShowManualModal(false); refresh(); }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Supprimer cette écriture ?"
        description={toDelete && (
          <span>
            Écriture {toDelete.journalCode} n°{toDelete.numero} du {fmtDate(toDelete.date)} — {toDelete.libelle}.
            {toDelete.sourceType !== "manual" && (
              <span className="block mt-2 text-amber-600 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Cette écriture a été générée automatiquement. Modifiez la source (facture/dépense) pour la régénérer correctement.</span>
              </span>
            )}
          </span>
        )}
        destructive
        confirmLabel="Supprimer"
      />
    </div>
  );
}

function EntryRows({ entry, onDelete }: { entry: JournalEntry; onDelete: () => void }) {
  const lines = entry.lines || [];
  const journalLabel = JOURNAL_LABEL[entry.journalCode] || entry.journalCode;
  const totalLines = lines.length;

  return (
    <Fragment>
      {lines.map((line, idx) => (
        <tr key={line.id} className={cn(
          "border-t border-border",
          idx === 0 ? "border-t-2 border-t-border" : "",
          "hover:bg-muted/30 transition-colors",
        )}>
          {idx === 0 ? (
            <>
              <td className="px-3 py-2 whitespace-nowrap" rowSpan={totalLines}>{fmtDate(entry.date)}</td>
              <td className="px-3 py-2 whitespace-nowrap" rowSpan={totalLines}>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted">
                  {entry.journalCode}
                </span>
                <span className="ml-1.5 text-muted-foreground text-xs">{journalLabel}</span>
              </td>
              <td className="px-3 py-2 font-mono text-xs" rowSpan={totalLines}>#{entry.numero}</td>
              <td className="px-3 py-2 font-mono text-xs" rowSpan={totalLines}>{entry.pieceRef || "—"}</td>
            </>
          ) : null}
          <td className="px-3 py-2">
            <span className="font-mono text-xs font-semibold">{line.compteNum}</span>
            {line.compAuxNum && line.compAuxNum !== line.compteNum && (
              <span className="font-mono text-xs text-muted-foreground ml-1">/ {line.compAuxNum}</span>
            )}
            {line.compAuxLib && (
              <span className="block text-xs text-muted-foreground">{line.compAuxLib}</span>
            )}
          </td>
          <td className="px-3 py-2">
            <span className="text-sm">{line.libelle || entry.libelle}</span>
            {line.lettrage && (
              <span className="ml-2 inline-block px-1 py-0.5 text-[10px] font-mono bg-emerald-500/15 text-emerald-600 rounded">
                {line.lettrage}
              </span>
            )}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {line.debit > 0 ? fmtMoneyAlways(line.debit) : ""}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {line.credit > 0 ? fmtMoneyAlways(line.credit) : ""}
          </td>
          {idx === 0 ? (
            <td className="px-2 py-2 align-top" rowSpan={totalLines}>
              {entry.sourceType === "manual" ? (
                <button
                  onClick={onDelete}
                  className="p-1 rounded hover:bg-destructive/15 hover:text-destructive transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground" title={`Source : ${entry.sourceType}`}>auto</span>
              )}
            </td>
          ) : null}
        </tr>
      ))}
    </Fragment>
  );
}
