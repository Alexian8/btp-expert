import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, Plus, Filter, Search, Euro,
  CheckCircle2, AlertCircle, X, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EXPENSE_CATEGORY_META, EXPENSE_STATUS_META, formatEuro,
  type Expense, type ExpenseCategory, type ExpenseStatus,
} from "@btp/types";
import { useExpensesStore } from "@/stores/expensesStore";
import { ExpenseEditorModal } from "./ExpenseEditorModal";

// ═══════════════════════════════════════════════════════════════════════════
// ExpensesPage — Page principale de gestion des dépenses
// ═══════════════════════════════════════════════════════════════════════════

export function ExpensesPage() {
  const { expenses, isLoading, fetch, markPaid } = useExpensesStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | "">("");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "">("");
  const [filterMonth, setFilterMonth] = useState<string>(""); // "2026-04"

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorExpense, setEditorExpense] = useState<Expense | null>(null);

  useEffect(() => {
    fetch();
  }, []);

  // Filtrage local
  const filtered = useMemo(() => {
    return expenses.filter((exp) => {
      if (filterStatus && exp.status !== filterStatus) return false;
      if (filterCategory && exp.category !== filterCategory) return false;
      if (filterMonth && !exp.expenseDate.startsWith(filterMonth)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inSupplier = exp.supplierName?.toLowerCase().includes(q);
        const inDesc = exp.description?.toLowerCase().includes(q);
        const inRef = exp.reference?.toLowerCase().includes(q);
        if (!inSupplier && !inDesc && !inRef) return false;
      }
      return true;
    });
  }, [expenses, search, filterStatus, filterCategory, filterMonth]);

  // Stats résumé
  const totalsByStatus = useMemo(() => {
    let aPayer = 0;
    let payees = 0;
    for (const exp of filtered) {
      if (exp.status === "a_payer") aPayer += exp.amountTtc;
      if (exp.status === "payee") payees += exp.amountTtc;
    }
    return { aPayer, payees, total: aPayer + payees };
  }, [filtered]);

  // Mois disponibles pour le filtre
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.expenseDate) set.add(e.expenseDate.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const handleNew = () => {
    setEditorExpense(null);
    setEditorOpen(true);
  };

  const handleClickRow = (expense: Expense) => {
    setEditorExpense(expense);
    setEditorOpen(true);
  };

  const handleQuickPaid = async (expense: Expense, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await markPaid(expense.id);
    if (r.success) toast.success("Marqué payée");
    else toast.error(r.error || "Erreur");
  };

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterCategory("");
    setFilterMonth("");
  };

  const hasFilters = search || filterStatus || filterCategory || filterMonth;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">Dépenses</h1>
              <p className="text-xs text-muted-foreground">
                Saisie de tes factures fournisseurs et frais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={handleNew} size="sm">
              <Plus className="w-4 h-4" />
              Nouvelle dépense
            </Button>
          </div>
        </div>

        {/* Stats résumé */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatCard
            label="Total filtré"
            amount={totalsByStatus.total}
            count={filtered.length}
            color="bg-slate-500/15 text-slate-500"
            icon={Euro}
          />
          <StatCard
            label="À payer"
            amount={totalsByStatus.aPayer}
            color="bg-amber-500/15 text-amber-500"
            icon={AlertCircle}
          />
          <StatCard
            label="Payées"
            amount={totalsByStatus.payees}
            color="bg-emerald-500/15 text-emerald-500"
            icon={CheckCircle2}
          />
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par fournisseur, description, référence..."
              className="pl-9"
            />
          </div>

          {/* Filter Statut */}
          <FilterDropdown
            label="Statut"
            value={filterStatus ? EXPENSE_STATUS_META[filterStatus].label : ""}
            options={[
              { value: "", label: "Tous" },
              { value: "a_payer", label: "À payer" },
              { value: "payee", label: "Payées" },
              { value: "annulee", label: "Annulées" },
            ]}
            onSelect={(v) => setFilterStatus(v as ExpenseStatus | "")}
          />

          {/* Filter Catégorie */}
          <FilterDropdown
            label="Catégorie"
            value={filterCategory ? EXPENSE_CATEGORY_META[filterCategory].label : ""}
            options={[
              { value: "", label: "Toutes" },
              ...Object.entries(EXPENSE_CATEGORY_META).map(([k, m]) => ({
                value: k,
                label: m.label,
              })),
            ]}
            onSelect={(v) => setFilterCategory(v as ExpenseCategory | "")}
          />

          {/* Filter Mois */}
          <FilterDropdown
            label="Mois"
            value={filterMonth ? formatMonthLabel(filterMonth) : ""}
            options={[
              { value: "", label: "Tous" },
              ...availableMonths.map((m) => ({ value: m, label: formatMonthLabel(m) })),
            ]}
            onSelect={(v) => setFilterMonth(v)}
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
            {filtered.map((expense, idx) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                delay={Math.min(idx * 0.02, 0.3)}
                onClick={() => handleClickRow(expense)}
                onMarkPaid={(e) => handleQuickPaid(expense, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal éditeur */}
      <ExpenseEditorModal
        open={editorOpen}
        expense={editorExpense}
        onClose={() => setEditorOpen(false)}
        onSaved={() => fetch()}
      />
    </div>
  );
}

// ─── Stat card en haut ────────────────────────────────────────────────────
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
          <p className="text-[10.5px] text-muted-foreground">{count} dépense{count > 1 ? "s" : ""}</p>
        )}
      </div>
    </div>
  );
}

// ─── Ligne de dépense ─────────────────────────────────────────────────────
function ExpenseRow({ expense, delay, onClick, onMarkPaid }: {
  expense: Expense;
  delay: number;
  onClick: () => void;
  onMarkPaid: (e: React.MouseEvent) => void;
}) {
  const catMeta = EXPENSE_CATEGORY_META[expense.category];
  const statusMeta = EXPENSE_STATUS_META[expense.status];
  const formattedDate = new Date(expense.expenseDate).toLocaleDateString("fr-FR", {
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
      {/* Icône catégorie */}
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", catMeta.colorTw)}>
        <Receipt className="w-4 h-4" />
      </div>

      {/* Info principale */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold truncate">
            {expense.supplierName || "Fournisseur inconnu"}
          </span>
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
            catMeta.colorTw
          )}>
            {catMeta.label}
          </span>
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
            statusMeta.colorTw
          )}>
            {statusMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          <span className="font-medium">{expense.reference}</span>
          <span>·</span>
          <span>{formattedDate}</span>
          {expense.description && (
            <>
              <span>·</span>
              <span className="truncate">{expense.description}</span>
            </>
          )}
        </div>
      </div>

      {/* Montants */}
      <div className="text-right shrink-0">
        <p className="text-base font-bold tabular-nums">
          {formatEuro(expense.amountTtc)}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          HT {formatEuro(expense.amountHt)}
        </p>
      </div>

      {/* Action rapide payer */}
      {expense.status === "a_payer" && (
        <Button
          variant="outline"
          size="sm"
          onClick={onMarkPaid}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Payer
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
        <Receipt className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        {hasFilters ? "Aucun résultat" : "Aucune dépense"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        {hasFilters
          ? "Essaye de modifier tes filtres ou créer une nouvelle dépense."
          : "Commence par saisir tes factures fournisseurs et frais professionnels."}
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Nouvelle dépense
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
