import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  HardHat, Plus, Filter, Search, X, ChevronDown,
  AlertTriangle, ShieldCheck, FileWarning, Star,
  Building2, Phone, Mail, Archive,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SUBCONTRACTOR_ACTIVITY_META, formatEuro,
  type Subcontractor, type SubcontractorActivity,
} from "@btp/types";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";
import { SubcontractorFormModal } from "./SubcontractorFormModal";

// ═══════════════════════════════════════════════════════════════════════════
// SubcontractorsPage — Page principale sous-traitants
// ═══════════════════════════════════════════════════════════════════════════

export function SubcontractorsPage() {
  const navigate = useNavigate();
  const { subcontractors, stats, isLoading, fetch, fetchStats, fetchExpiringAttestations, expiringAttestations } = useSubcontractorsStore();

  const [search, setSearch] = useState("");
  const [filterActivity, setFilterActivity] = useState<SubcontractorActivity | "">("");
  const [showArchived, setShowArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formSubcontractor, setFormSubcontractor] = useState<Subcontractor | null>(null);

  useEffect(() => {
    fetch();
    fetchStats();
    fetchExpiringAttestations(30);
  }, []);

  const filtered = useMemo(() => {
    return subcontractors.filter((s) => {
      if (!showArchived && !s.isActive) return false;
      if (filterActivity && s.activity !== filterActivity) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inCompany = s.companyName?.toLowerCase().includes(q);
        const inContact = `${s.contactFirstName} ${s.contactLastName}`.toLowerCase().includes(q);
        const inCity = s.city?.toLowerCase().includes(q);
        if (!inCompany && !inContact && !inCity) return false;
      }
      return true;
    });
  }, [subcontractors, search, filterActivity, showArchived]);

  // Map sous-traitant id → attestations expirant
  const expiringByStId = useMemo(() => {
    const map = new Map<string, { expired: number; soon: number }>();
    for (const att of expiringAttestations) {
      const cur = map.get(att.subcontractorId) || { expired: 0, soon: 0 };
      if (att.isExpired) cur.expired++;
      else cur.soon++;
      map.set(att.subcontractorId, cur);
    }
    return map;
  }, [expiringAttestations]);

  const handleNew = () => {
    setFormSubcontractor(null);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterActivity("");
    setShowArchived(false);
  };

  const hasFilters = search || filterActivity || showArchived;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
              <HardHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">Sous-traitants</h1>
              <p className="text-xs text-muted-foreground">
                Gestion des sous-traitants, attestations URSSAF et bons de commande
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate("/purchase-orders")}>
              <Building2 className="w-3.5 h-3.5" />
              Bons de commande
            </Button>
            <Button onClick={handleNew} size="sm">
              <Plus className="w-4 h-4" />
              Nouveau sous-traitant
            </Button>
          </div>
        </div>

        {/* Stats résumé */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <StatCard
            label="Sous-traitants actifs"
            value={String(stats.totalActive)}
            color="bg-emerald-500/15 text-emerald-500"
            icon={ShieldCheck}
          />
          <StatCard
            label="Attestations expirées"
            value={String(stats.attestationsExpired)}
            color={stats.attestationsExpired > 0 ? "bg-red-500/15 text-red-500" : "bg-slate-500/15 text-slate-500"}
            icon={FileWarning}
            warning={stats.attestationsExpired > 0}
          />
          <StatCard
            label="Expirent sous 30j"
            value={String(stats.attestationsExpiringSoon)}
            color={stats.attestationsExpiringSoon > 0 ? "bg-amber-500/15 text-amber-500" : "bg-slate-500/15 text-slate-500"}
            icon={AlertTriangle}
          />
          <StatCard
            label="Engagement HT"
            value={formatEuro(stats.totalContractsAmount)}
            color="bg-violet-500/15 text-violet-500"
            icon={Building2}
          />
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, contact, ville..."
              className="pl-9"
            />
          </div>

          <FilterDropdown
            label="Activité"
            value={filterActivity ? SUBCONTRACTOR_ACTIVITY_META[filterActivity].label : ""}
            options={[
              { value: "", label: "Toutes" },
              ...Object.entries(SUBCONTRACTOR_ACTIVITY_META).map(([k, m]) => ({
                value: k, label: m.label,
              })),
            ]}
            onSelect={(v) => setFilterActivity(v as SubcontractorActivity | "")}
          />

          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-3.5 h-3.5" />
            Inclure archivés
          </Button>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((st, idx) => (
              <SubcontractorCard
                key={st.id}
                st={st}
                expiringInfo={expiringByStId.get(st.id)}
                delay={Math.min(idx * 0.03, 0.3)}
                onClick={() => navigate(`/subcontractors/${st.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <SubcontractorFormModal
        open={formOpen}
        subcontractor={formSubcontractor}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetch()}
      />
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
    <div className={cn("bg-card border rounded-lg p-3 flex items-center gap-3", warning ? "border-red-500/30" : "border-border")}>
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

// ─── Subcontractor card ────────────────────────────────────────────────────
function SubcontractorCard({ st, expiringInfo, delay, onClick }: {
  st: Subcontractor;
  expiringInfo?: { expired: number; soon: number };
  delay: number;
  onClick: () => void;
}) {
  const activityMeta = SUBCONTRACTOR_ACTIVITY_META[st.activity];
  const hasExpired = (expiringInfo?.expired || 0) > 0;
  const hasSoon = (expiringInfo?.soon || 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={cn(
        "bg-card border rounded-lg p-4 cursor-pointer transition-all hover:shadow-soft-md hover:border-primary/50",
        !st.isActive && "opacity-60",
        hasExpired ? "border-red-500/40" : "border-border"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
            {st.companyName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate">{st.companyName}</h3>
            {(st.contactFirstName || st.contactLastName) && (
              <p className="text-xs text-muted-foreground truncate">
                {st.contactFirstName} {st.contactLastName}
              </p>
            )}
          </div>
        </div>
        {st.rating > 0 && (
          <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-xs font-semibold tabular-nums">{st.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        <span className={cn("text-[10.5px] font-medium px-1.5 py-0.5 rounded", activityMeta.colorTw)}>
          {activityMeta.label}
        </span>
        {!st.isActive && (
          <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-500">
            Archivé
          </span>
        )}
        {hasExpired && (
          <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 flex items-center gap-1">
            <FileWarning className="w-2.5 h-2.5" />
            {expiringInfo!.expired} expirée{expiringInfo!.expired > 1 ? "s" : ""}
          </span>
        )}
        {hasSoon && !hasExpired && (
          <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            {expiringInfo!.soon} bientôt
          </span>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {st.phone && (
          <div className="flex items-center gap-1.5 truncate">
            <Phone className="w-3 h-3 shrink-0" />
            <span className="truncate">{st.phone}</span>
          </div>
        )}
        {st.email && (
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{st.email}</span>
          </div>
        )}
        {st.city && (
          <div className="text-[11px] truncate">
            {st.postalCode} {st.city}
          </div>
        )}
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
        <HardHat className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        {hasFilters ? "Aucun résultat" : "Aucun sous-traitant"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        {hasFilters
          ? "Essaye de modifier tes filtres ou créer un nouveau sous-traitant."
          : "Référence tes sous-traitants pour gérer leurs attestations URSSAF, décennale, et leurs bons de commande."}
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Nouveau sous-traitant
      </Button>
    </div>
  );
}
