import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FileText, Plus, Filter, Search, X, ChevronDown,
  AlertTriangle, CircleDollarSign, Building2, Lock,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PO_STATUS_META, formatEuro,
  type PurchaseOrder, type PurchaseOrderStatus,
} from "@btp/types";
import { usePurchaseOrdersStore } from "@/stores/purchaseOrdersStore";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";
import { useChantiersStore } from "@/stores/chantiersStore";

// ═══════════════════════════════════════════════════════════════════════════
// PurchaseOrdersPage — Liste de tous les bons de commande
// ═══════════════════════════════════════════════════════════════════════════

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { purchaseOrders, poStats, isLoading, fetchPos, fetchPoStats } = usePurchaseOrdersStore();
  const { subcontractors, fetch: fetchST } = useSubcontractorsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PurchaseOrderStatus | "">("");
  const [filterStId, setFilterStId] = useState("");
  const [filterChantierId, setFilterChantierId] = useState("");

  useEffect(() => {
    fetchPos();
    fetchPoStats();
    fetchST();
    fetchChantiers();
  }, []);

  const stMap = useMemo(() => {
    const m = new Map<string, string>();
    subcontractors.forEach((s) => m.set(s.id, s.companyName));
    return m;
  }, [subcontractors]);

  const chantierMap = useMemo(() => {
    const m = new Map<string, string>();
    chantiers.forEach((c) => m.set(c.id, `${c.reference} · ${c.title}`));
    return m;
  }, [chantiers]);

  const filtered = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (filterStatus && po.status !== filterStatus) return false;
      if (filterStId && po.subcontractorId !== filterStId) return false;
      if (filterChantierId && po.chantierId !== filterChantierId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inTitle = po.title?.toLowerCase().includes(q);
        const inRef = po.reference?.toLowerCase().includes(q);
        const inSt = po.subcontractorName?.toLowerCase().includes(q);
        if (!inTitle && !inRef && !inSt) return false;
      }
      return true;
    });
  }, [purchaseOrders, search, filterStatus, filterStId, filterChantierId]);

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterStId("");
    setFilterChantierId("");
  };

  const hasFilters = search || filterStatus || filterStId || filterChantierId;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">Bons de commande</h1>
              <p className="text-xs text-muted-foreground">
                Engagements vis-à-vis de vos sous-traitants
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate("/subcontractors")}>
              <Building2 className="w-3.5 h-3.5" />
              Sous-traitants
            </Button>
            <Button onClick={() => navigate("/purchase-orders/new")} size="sm">
              <Plus className="w-4 h-4" />
              Nouveau BdC
            </Button>
          </div>
        </div>

        {/* Stats résumé */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <StatCard
            label="BdC en cours"
            value={String(poStats.totalEnCours)}
            color="bg-amber-500/15 text-amber-500"
            icon={FileText}
          />
          <StatCard
            label="Engagement HT"
            value={formatEuro(poStats.totalAmount)}
            color="bg-blue-500/15 text-blue-500"
            icon={CircleDollarSign}
          />
          <StatCard
            label="Retenues à libérer"
            value={formatEuro(poStats.pendingRetentions)}
            color="bg-violet-500/15 text-violet-500"
            icon={Lock}
          />
          <StatCard
            label="Retenues libérables"
            value={formatEuro(poStats.expiredRetentions)}
            color={poStats.expiredRetentions > 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-slate-500/15 text-slate-500"}
            icon={AlertTriangle}
            warning={poStats.expiredRetentions > 0}
          />
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre, référence, sous-traitant..."
              className="pl-9"
            />
          </div>

          <FilterDropdown
            label="Statut"
            value={filterStatus ? PO_STATUS_META[filterStatus].label : ""}
            options={[
              { value: "", label: "Tous" },
              ...Object.entries(PO_STATUS_META).map(([k, m]) => ({ value: k, label: m.label })),
            ]}
            onSelect={(v) => setFilterStatus(v as PurchaseOrderStatus | "")}
          />

          <FilterDropdown
            label="Sous-traitant"
            value={filterStId ? (stMap.get(filterStId) || "") : ""}
            options={[
              { value: "", label: "Tous" },
              ...subcontractors.map((s) => ({ value: s.id, label: s.companyName })),
            ]}
            onSelect={(v) => setFilterStId(v)}
          />

          <FilterDropdown
            label="Chantier"
            value={filterChantierId ? (chantierMap.get(filterChantierId) || "") : ""}
            options={[
              { value: "", label: "Tous" },
              ...chantiers.map((c) => ({ value: c.id, label: `${c.reference} · ${c.title}` })),
            ]}
            onSelect={(v) => setFilterChantierId(v)}
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
          <EmptyState onCreate={() => navigate("/purchase-orders/new")} hasFilters={!!hasFilters} />
        ) : (
          <div className="space-y-2">
            {filtered.map((po, idx) => (
              <PoRow
                key={po.id}
                po={po}
                chantierLabel={chantierMap.get(po.chantierId) || ""}
                delay={Math.min(idx * 0.02, 0.3)}
                onClick={() => navigate(`/purchase-orders/${po.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon, warning }: {
  label: string;
  value: string;
  color: string;
  icon: any;
  warning?: boolean;
}) {
  return (
    <div className={cn("bg-card border rounded-lg p-3 flex items-center gap-3", warning ? "border-emerald-500/30" : "border-border")}>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── PO Row ────────────────────────────────────────────────────────────────
function PoRow({ po, chantierLabel, delay, onClick }: {
  po: PurchaseOrder;
  chantierLabel: string;
  delay: number;
  onClick: () => void;
}) {
  const statusMeta = PO_STATUS_META[po.status];
  const formattedDate = po.poDate ? new Date(po.poDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-soft-sm transition-all cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold truncate">
            {po.title || "(sans titre)"}
          </span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          {po.hasSituations && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 bg-violet-500/15 text-violet-500">
              Situations
            </span>
          )}
          {po.retentionEnabled && !po.retentionReleased && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 bg-amber-500/15 text-amber-500 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Retenue {po.retentionPct}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          <span className="font-medium">{po.reference}</span>
          <span>·</span>
          <span>{formattedDate}</span>
          <span>·</span>
          <span className="truncate">{po.subcontractorName}</span>
          {chantierLabel && (
            <>
              <span>·</span>
              <span className="truncate">{chantierLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-base font-bold tabular-nums">{formatEuro(po.totalHt)}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">TTC {formatEuro(po.totalTtc)}</p>
      </div>
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
        {isActive && <span className="ml-1 text-[11px] truncate max-w-[100px]">: {value}</span>}
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
              className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-soft-lg z-20 min-w-[200px] max-h-72 overflow-y-auto"
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
                    "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors truncate",
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
        <FileText className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        {hasFilters ? "Aucun résultat" : "Aucun bon de commande"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        {hasFilters
          ? "Modifiez vos filtres ou créez un nouveau bon de commande."
          : "Créez un bon de commande pour engager un sous-traitant sur un chantier."}
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Nouveau BdC
      </Button>
    </div>
  );
}
