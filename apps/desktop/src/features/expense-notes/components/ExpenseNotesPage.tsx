import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, Filter, Search, Euro, Download,
  CheckCircle2, RefreshCw, X, ChevronDown, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EXPENSE_NOTE_CATEGORY_META, EXPENSE_NOTE_STATUS_META, EXPENSE_NOTE_PAYER_META,
  formatEuro,
  type ExpenseNote, type ExpenseNoteCategory, type ExpenseNoteStatus,
} from "@btp/types";
import { useExpenseNotesStore } from "@/stores/expenseNotesStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { ExpenseNoteEditorModal } from "./ExpenseNoteEditorModal";

// ═══════════════════════════════════════════════════════════════════════════
// ExpenseNotesPage — Page principale notes de frais (Session 14)
// ═══════════════════════════════════════════════════════════════════════════

export function ExpenseNotesPage() {
  const { notes, stats, isLoading, fetch, fetchStats, validate, markReimbursed, exportMonth } = useExpenseNotesStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ExpenseNoteStatus | "">("");
  const [filterCategory, setFilterCategory] = useState<ExpenseNoteCategory | "">("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterRefacturable, setFilterRefacturable] = useState<"" | "yes" | "no">("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorNote, setEditorNote] = useState<ExpenseNote | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch();
    fetchStats();
    fetchChantiers();
  }, []);

  const chantierMap = useMemo(() => {
    const map = new Map<string, string>();
    chantiers.forEach((c) => map.set(c.id, `${c.reference} · ${c.title}`));
    return map;
  }, [chantiers]);

  // Filtrage local
  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (filterStatus && n.status !== filterStatus) return false;
      if (filterCategory && n.category !== filterCategory) return false;
      if (filterMonth && !n.expenseDate.startsWith(filterMonth)) return false;
      if (filterRefacturable === "yes" && !n.refacturable) return false;
      if (filterRefacturable === "no" && n.refacturable) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inDesc = n.description?.toLowerCase().includes(q);
        const inRef = n.reference?.toLowerCase().includes(q);
        const inPayer = n.payerName?.toLowerCase().includes(q);
        if (!inDesc && !inRef && !inPayer) return false;
      }
      return true;
    });
  }, [notes, search, filterStatus, filterCategory, filterMonth, filterRefacturable]);

  const totalFiltered = useMemo(() =>
    filtered.reduce((s, n) => s + (n.amountTtc || 0), 0)
  , [filtered]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      if (n.expenseDate) set.add(n.expenseDate.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [notes]);

  const handleNew = () => {
    setEditorNote(null);
    setEditorOpen(true);
  };

  const handleClickRow = (note: ExpenseNote) => {
    setEditorNote(note);
    setEditorOpen(true);
  };

  const handleQuickValidate = async (note: ExpenseNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await validate(note.id);
    if (r.success) toast.success("Note validée");
    else toast.error(r.error || "Erreur");
  };

  const handleQuickReimburse = async (note: ExpenseNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await markReimbursed(note.id);
    if (r.success) toast.success("Remboursement enregistré");
    else toast.error(r.error || "Erreur");
  };

  const handleExport = async () => {
    const month = filterMonth || new Date().toISOString().slice(0, 7);
    const [year, m] = month.split("-").map(Number);
    setExporting(true);
    const r = await exportMonth(year, m);
    setExporting(false);
    if (r.success) {
      toast.success(`${r.notesCount} note${(r.notesCount || 0) > 1 ? "s" : ""} exportée${(r.notesCount || 0) > 1 ? "s" : ""}`, {
        description: "Fichier prêt pour ton expert-comptable",
      });
    } else if (!r.cancelled) {
      toast.error(r.error || "Erreur d'export");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterCategory("");
    setFilterMonth("");
    setFilterRefacturable("");
  };

  const hasFilters = search || filterStatus || filterCategory || filterMonth || filterRefacturable;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">Notes de frais</h1>
              <p className="text-xs text-muted-foreground">
                Carburant, péages, repas, parking et autres frais professionnels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleExport} loading={exporting}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            <Button onClick={handleNew} size="sm">
              <Plus className="w-4 h-4" />
              Nouvelle note
            </Button>
          </div>
        </div>

        {/* Stats résumé */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <StatCard
            label="Ce mois"
            amount={stats.totalMonth}
            count={stats.notesCount}
            color="bg-slate-500/15 text-slate-500"
            icon={Euro}
          />
          <StatCard
            label="Filtre courant"
            amount={totalFiltered}
            count={filtered.length}
            color="bg-blue-500/15 text-blue-500"
            icon={Filter}
          />
          <StatCard
            label="À rembourser"
            amount={stats.totalARembourser}
            color="bg-amber-500/15 text-amber-500"
            icon={AlertCircle}
          />
          <StatCard
            label="Refacturables"
            amount={stats.totalRefacturable}
            color="bg-violet-500/15 text-violet-500"
            icon={RefreshCw}
          />
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher description, référence, employé..."
              className="pl-9"
            />
          </div>

          <FilterDropdown
            label="Statut"
            value={filterStatus ? EXPENSE_NOTE_STATUS_META[filterStatus].label : ""}
            options={[
              { value: "", label: "Tous" },
              { value: "brouillon", label: "Brouillon" },
              { value: "validee", label: "Validées" },
              { value: "remboursee", label: "Remboursées" },
              { value: "refacturee", label: "Refacturées" },
            ]}
            onSelect={(v) => setFilterStatus(v as ExpenseNoteStatus | "")}
          />

          <FilterDropdown
            label="Catégorie"
            value={filterCategory ? EXPENSE_NOTE_CATEGORY_META[filterCategory].label : ""}
            options={[
              { value: "", label: "Toutes" },
              ...Object.entries(EXPENSE_NOTE_CATEGORY_META).map(([k, m]) => ({
                value: k, label: m.label,
              })),
            ]}
            onSelect={(v) => setFilterCategory(v as ExpenseNoteCategory | "")}
          />

          <FilterDropdown
            label="Mois"
            value={filterMonth ? formatMonthLabel(filterMonth) : ""}
            options={[
              { value: "", label: "Tous" },
              ...availableMonths.map((m) => ({ value: m, label: formatMonthLabel(m) })),
            ]}
            onSelect={(v) => setFilterMonth(v)}
          />

          <FilterDropdown
            label="Refact."
            value={filterRefacturable === "yes" ? "Oui" : filterRefacturable === "no" ? "Non" : ""}
            options={[
              { value: "", label: "Toutes" },
              { value: "yes", label: "Refacturables" },
              { value: "no", label: "Non refacturables" },
            ]}
            onSelect={(v) => setFilterRefacturable(v as "" | "yes" | "no")}
          />

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-3.5 h-3.5" />
              Effacer
            </Button>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Chargement...</div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={handleNew} hasFilters={!!hasFilters} />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((note, idx) => (
              <NoteRow
                key={note.id}
                note={note}
                chantierLabel={chantierMap.get(note.chantierId) || ""}
                delay={Math.min(idx * 0.02, 0.3)}
                onClick={() => handleClickRow(note)}
                onValidate={(e) => handleQuickValidate(note, e)}
                onReimburse={(e) => handleQuickReimburse(note, e)}
              />
            ))}
          </div>
        )}
      </div>

      <ExpenseNoteEditorModal
        open={editorOpen}
        note={editorNote}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          fetch();
          fetchStats();
        }}
      />
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, amount, count, color, icon: Icon }: {
  label: string;
  amount: number;
  count?: number;
  color: string;
  icon: any;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-bold tabular-nums truncate">{formatEuro(amount)}</p>
        {count !== undefined && (
          <p className="text-[10.5px] text-muted-foreground">{count} note{count > 1 ? "s" : ""}</p>
        )}
      </div>
    </div>
  );
}

// ─── Note Row ──────────────────────────────────────────────────────────────
function NoteRow({ note, chantierLabel, delay, onClick, onValidate, onReimburse }: {
  note: ExpenseNote;
  chantierLabel: string;
  delay: number;
  onClick: () => void;
  onValidate: (e: React.MouseEvent) => void;
  onReimburse: (e: React.MouseEvent) => void;
}) {
  const catMeta = EXPENSE_NOTE_CATEGORY_META[note.category];
  const statusMeta = EXPENSE_NOTE_STATUS_META[note.status];
  const payerMeta = EXPENSE_NOTE_PAYER_META[note.payerType];
  const formattedDate = new Date(note.expenseDate).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-soft-sm transition-all cursor-pointer"
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", catMeta.colorTw)}>
        <Wallet className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold truncate">
            {note.description || "(sans description)"}
          </span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", catMeta.colorTw)}>
            {catMeta.label}
          </span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          {note.refacturable && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 bg-violet-500/15 text-violet-500 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" />
              Refact.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          <span className="font-medium">{note.reference}</span>
          <span>·</span>
          <span>{formattedDate}</span>
          <span>·</span>
          <span>{payerMeta.label}{note.payerName ? ` (${note.payerName})` : ""}</span>
          {chantierLabel && (
            <>
              <span>·</span>
              <span className="truncate">{chantierLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-base font-bold tabular-nums">{formatEuro(note.amountTtc)}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">HT {formatEuro(note.amountHt)}</p>
      </div>

      {note.status === "brouillon" && (
        <Button
          variant="outline"
          size="sm"
          onClick={onValidate}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Valider
        </Button>
      )}
      {note.status === "validee" && note.payerType !== "carte_pro" && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReimburse}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Rembourser
        </Button>
      )}
    </motion.div>
  );
}

// ─── Filter dropdown ──────────────────────────────────────────────────────
function FilterDropdown({ label, value, options, onSelect }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = !!value;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className={cn(isActive && "border-primary text-primary")}
      >
        <Filter className="w-3.5 h-3.5" />
        {label}
        {isActive && <span className="ml-1 text-[11px]">: {value}</span>}
        <ChevronDown className="w-3 h-3 ml-1" />
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-soft-lg z-20 min-w-[180px] max-h-72 overflow-y-auto"
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors",
                    !opt.value && !value && "bg-primary/10 text-primary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ onCreate, hasFilters }: { onCreate: () => void; hasFilters: boolean }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Wallet className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        {hasFilters ? "Aucun résultat" : "Aucune note de frais"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        {hasFilters
          ? "Essaye de modifier tes filtres ou créer une nouvelle note."
          : "Saisis tes frais professionnels du quotidien : carburant, repas, péages, parking..."}
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Nouvelle note
      </Button>
    </div>
  );
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const monthIdx = parseInt(m || "1", 10) - 1;
  return `${months[monthIdx] || "?"} ${y}`;
}
