import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Receipt, Plus, Search, Wallet, Building2, User, Paperclip,
  Landmark, ChevronDown,
} from "lucide-react";
import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EXPENSE_CATEGORY_META, EXPENSE_NOTE_CATEGORY_META, EXPENSE_STATUS_META, formatEuro,
  type Expense, type ExpenseNote,
} from "@btp/types";
import { useExpensesStore } from "@/stores/expensesStore";
import { useExpenseNotesStore } from "@/stores/expenseNotesStore";
import { ExpenseEditorModal } from "./ExpenseEditorModal";
import { ExpenseNoteEditorModal } from "@/features/expense-notes/components/ExpenseNoteEditorModal";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// ═══════════════════════════════════════════════════════════════════════════
// ExpensesHubPage — Dépenses & frais unifiés
//   Regroupe en une seule vue les dépenses fournisseurs et les notes de frais.
//   Chaque ligne porte un badge de type. La création propose le type.
//   Tout est relié à la comptabilité ; le champ « transaction » prépare le
//   rapprochement bancaire Qonto.
// ═══════════════════════════════════════════════════════════════════════════

type Kind = "fournisseur" | "note_frais";
type Row =
  | ({ _kind: "fournisseur" } & Expense)
  | ({ _kind: "note_frais" } & ExpenseNote);

const NOTE_STATUS_LABEL: Record<string, { label: string; tw: string }> = {
  brouillon:  { label: "Brouillon",  tw: "bg-slate-400/20 text-slate-600 dark:text-slate-200" },
  validee:    { label: "Validée",     tw: "bg-blue-500/15 text-blue-500" },
  remboursee: { label: "Remboursée",  tw: "bg-emerald-500/15 text-emerald-500" },
  refacturee: { label: "Refacturée",  tw: "bg-violet-500/15 text-violet-500" },
};

export function ExpensesHubPage() {
  const { expenses, fetch: fetchExpenses } = useExpensesStore();
  const { notes, fetch: fetchNotes } = useExpenseNotesStore();

  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<Kind | "">("");
  const [expenseEditor, setExpenseEditor] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [noteEditor, setNoteEditor] = useState<{ open: boolean; note: ExpenseNote | null }>({ open: false, note: null });

  useEffect(() => { fetchExpenses(); fetchNotes(); }, []);

  const refresh = () => { fetchExpenses(); fetchNotes(); };

  const rows: Row[] = useMemo(() => {
    const a: Row[] = expenses.map((e) => ({ _kind: "fournisseur" as const, ...e }));
    const b: Row[] = notes.map((n) => ({ _kind: "note_frais" as const, ...n }));
    const all = [...a, ...b];
    // Tri par date décroissante
    all.sort((x, y) => (y.expenseDate || "").localeCompare(x.expenseDate || ""));
    return all;
  }, [expenses, notes]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterKind && r._kind !== filterKind) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const who = r._kind === "fournisseur" ? (r as Expense).supplierName : (r as ExpenseNote).payerName;
        const hay = [r.reference, r.description, who, (r as Expense).supplierInvoiceNumber]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, filterKind]);

  const totalFournisseur = expenses.reduce((s, e) => s + (e.amountTtc || 0), 0);
  const totalNotes = notes.reduce((s, n) => s + (n.amountTtc || 0), 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Dépenses &amp; frais</h1>
              <p className="text-xs text-muted-foreground">
                Achats fournisseurs et notes de frais — reliés à la comptabilité
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4" /> Nouvelle <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem onClick={() => setExpenseEditor({ open: true, expense: null })}>
                <Building2 className="w-4 h-4" />
                <span>Dépense fournisseur</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNoteEditor({ open: true, note: null })}>
                <User className="w-4 h-4" />
                <span>Note de frais</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="w-3.5 h-3.5" /> Dépenses fournisseurs</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{formatEuro(totalFournisseur)}</div>
            <div className="text-[11px] text-muted-foreground">{expenses.length} dépense{expenses.length > 1 ? "s" : ""}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="w-3.5 h-3.5" /> Notes de frais</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{formatEuro(totalNotes)}</div>
            <div className="text-[11px] text-muted-foreground">{notes.length} note{notes.length > 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (réf, fournisseur, n° facture…)" className="pl-9" />
          </div>
          <div className="flex gap-1">
            {([["", "Tout"], ["fournisseur", "Fournisseurs"], ["note_frais", "Notes de frais"]] as [Kind | "", string][]).map(([k, label]) => (
              <Button key={k} variant={filterKind === k ? "default" : "outline"} size="sm" onClick={() => setFilterKind(k)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Réf.</th>
                  <th className="px-3 py-2 text-left">Tiers / Payeur</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-center">Justif.</th>
                  <th className="px-3 py-2 text-center">Banque</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-right">Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                    Aucune dépense ni note de frais. Cliquez sur « Nouvelle » pour commencer.
                  </td></tr>
                )}
                {filtered.map((r) => {
                  const isExp = r._kind === "fournisseur";
                  // Les deux types ont des jeux de catégories différents (péage,
                  // hôtel… n'existent qu'en note de frais) → meta adaptée au type.
                  const cat = isExp
                    ? EXPENSE_CATEGORY_META[(r as Expense).category]
                    : EXPENSE_NOTE_CATEGORY_META[(r as ExpenseNote).category];
                  const who = isExp ? (r as Expense).supplierName : (r as ExpenseNote).payerName;
                  const statusMeta = isExp
                    ? EXPENSE_STATUS_META[(r as Expense).status]
                    : NOTE_STATUS_LABEL[(r as ExpenseNote).status];
                  return (
                    <motion.tr
                      key={`${r._kind}-${r.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => isExp
                        ? setExpenseEditor({ open: true, expense: r as Expense })
                        : setNoteEditor({ open: true, note: r as ExpenseNote })}
                    >
                      <td className="px-3 py-2">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                          isExp ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/15 text-violet-500",
                        )}>
                          {isExp ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {isExp ? "Fournisseur" : "Note de frais"}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.expenseDate}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.reference || "—"}</td>
                      <td className="px-3 py-2">{who || "—"}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate">
                        {r.description || "—"}
                        {cat && <span className={cn("ml-1.5 text-[10px] px-1 py-0.5 rounded", cat.colorTw)}>{cat.label}</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.receiptVaultDocumentId
                          ? <Paperclip className="w-3.5 h-3.5 text-emerald-500 inline" />
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.bankTransactionId
                          ? <Landmark className="w-3.5 h-3.5 text-emerald-500 inline" />
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {statusMeta && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                            isExp ? (statusMeta as { colorTw: string }).colorTw : (statusMeta as { tw: string }).tw)}>
                            {statusMeta.label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatEuro(r.amountTtc || 0)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ExpenseEditorModal
        open={expenseEditor.open}
        expense={expenseEditor.expense}
        onClose={() => setExpenseEditor({ open: false, expense: null })}
        onSaved={() => { setExpenseEditor({ open: false, expense: null }); refresh(); }}
      />
      <ExpenseNoteEditorModal
        open={noteEditor.open}
        note={noteEditor.note}
        onClose={() => setNoteEditor({ open: false, note: null })}
        onSaved={() => { setNoteEditor({ open: false, note: null }); refresh(); }}
      />
    </div>
  );
}
