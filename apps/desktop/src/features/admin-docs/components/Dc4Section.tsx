import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Plus, Search, Building, AlertCircle,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DC4_STATUS_META, formatEuro,
  type Dc4Declaration, type Dc4Status,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { Dc4FormModal } from "./Dc4FormModal";

// ═══════════════════════════════════════════════════════════════════════════
// Dc4Section — Liste des déclarations DC4
// ═══════════════════════════════════════════════════════════════════════════

export function Dc4Section() {
  const { dc4Declarations, stats, fetchDc4 } = useAdministrativeDocsStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<Dc4Status | "">("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDc4();
  }, []);

  const filtered = useMemo(() => {
    return dc4Declarations.filter((d) => {
      if (filterStatus && d.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inRef = d.reference?.toLowerCase().includes(q);
        const inMarket = d.publicMarketReference?.toLowerCase().includes(q);
        const inAuthority = d.publicAuthorityName?.toLowerCase().includes(q);
        const inSt = d.subcontractorName?.toLowerCase().includes(q);
        if (!inRef && !inMarket && !inAuthority && !inSt) return false;
      }
      return true;
    });
  }, [dc4Declarations, search, filterStatus]);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="DC4 au total"
          value={String(stats.dc4Total)}
          icon={FileText}
          color="bg-blue-500/15 text-blue-500"
        />
        <StatCard
          label="En attente de réponse"
          value={String(stats.dc4Pending)}
          icon={AlertCircle}
          color={stats.dc4Pending > 0 ? "bg-amber-500/15 text-amber-500" : "bg-slate-500/15 text-slate-500"}
        />
        <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Loi MOP 1985</p>
          <p>Le DC4 est obligatoire pour déclarer un sous-traitant sur un marché public au pouvoir adjudicateur.</p>
        </div>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Déclarations de sous-traitance (DC4)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pour les marchés publics avec sous-traitants déclarés
            </p>
          </div>
          <Button onClick={() => { setEditingId(null); setFormOpen(true); }} size="sm">
            <Plus className="w-4 h-4" />
            Nouveau DC4
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence, marché, autorité, sous-traitant..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["", "brouillon", "envoyee", "acceptee", "refusee"] as Array<Dc4Status | "">).map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  filterStatus === s
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card border border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {s === "" ? "Tous" : DC4_STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <EmptyState onCreate={() => { setEditingId(null); setFormOpen(true); }} />
      ) : (
        <div className="space-y-2">
          {filtered.map((d, idx) => (
            <Dc4Row
              key={d.id}
              declaration={d}
              delay={Math.min(idx * 0.03, 0.3)}
              onClick={() => { setEditingId(d.id); setFormOpen(true); }}
            />
          ))}
        </div>
      )}

      <Dc4FormModal
        open={formOpen}
        declarationId={editingId}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Dc4Row({ declaration, delay, onClick }: {
  declaration: Dc4Declaration;
  delay: number;
  onClick: () => void;
}) {
  const statusMeta = DC4_STATUS_META[declaration.status];

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
          <span className="text-sm font-semibold">{declaration.reference}</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          {declaration.publicMarketReference && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 bg-muted text-muted-foreground flex items-center gap-1">
              <Building className="w-2.5 h-2.5" />
              {declaration.publicMarketReference}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          {declaration.publicAuthorityName && (<><span className="truncate">{declaration.publicAuthorityName}</span><span>·</span></>)}
          {declaration.subcontractorName && (<><span className="truncate">{declaration.subcontractorName}</span></>)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums">{formatEuro(declaration.subcontractedAmountHt)}</p>
        <p className="text-[10.5px] text-muted-foreground">HT</p>
      </div>
    </motion.div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16 bg-card border border-dashed border-border rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Aucun DC4</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        Le DC4 est obligatoire pour déclarer un sous-traitant sur un marché public.
        Il doit être accepté par le pouvoir adjudicateur avant le démarrage des travaux.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Créer un DC4
      </Button>
    </div>
  );
}
