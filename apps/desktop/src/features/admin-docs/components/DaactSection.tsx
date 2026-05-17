import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Plus, Search, FileText, AlertCircle, CheckCircle2,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DAACT_PERMIT_TYPE_META, DAACT_STATUS_META,
  type DaactDeclaration, type DaactPermitType,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { DaactFormModal } from "./DaactFormModal";

// ═══════════════════════════════════════════════════════════════════════════
// DaactSection — Déclarations d'achèvement et conformité des travaux
// CERFA officiel 13408*13 — Code de l'urbanisme art. R.462-1 à R.462-9
// ═══════════════════════════════════════════════════════════════════════════

export function DaactSection() {
  const { daactDeclarations, stats, fetchDaact, fetchStats } = useAdministrativeDocsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  const [search, setSearch] = useState("");
  const [filterPermit, setFilterPermit] = useState<DaactPermitType | "">("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDaact();
    fetchChantiers();
    fetchStats();
  }, []);

  const chantierMap = useMemo(() => {
    const m = new Map<string, string>();
    chantiers.forEach((c) => m.set(c.id, `${c.reference} · ${c.title}`));
    return m;
  }, [chantiers]);

  const filtered = useMemo(() => {
    return daactDeclarations.filter((d) => {
      if (filterPermit && d.permitType !== filterPermit) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inRef = d.reference?.toLowerCase().includes(q);
        const inPermit = d.permitNumber?.toLowerCase().includes(q);
        const inDenom = d.denomination?.toLowerCase().includes(q);
        if (!inRef && !inPermit && !inDenom) return false;
      }
      return true;
    });
  }, [daactDeclarations, search, filterPermit]);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="DAACT au total"
          value={String(stats.daactTotal)}
          icon={Building2}
          color="bg-blue-500/15 text-blue-500"
        />
        <StatCard
          label="Brouillons / déposées"
          value={String(stats.daactPending)}
          icon={AlertCircle}
          color={
            stats.daactPending > 0
              ? "bg-amber-500/15 text-amber-500"
              : "bg-slate-500/15 text-slate-500"
          }
        />
        <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-semibold mb-1">CERFA 13408*13</p>
          <p>
            Délai mairie : 3 mois (5 mois pour MH, ERP/IGH). Sans contestation → conformité tacite.
          </p>
        </div>
      </div>

      {/* Header section */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Déclarations d'achèvement (DAACT)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              À transmettre à la mairie après achèvement des travaux soumis à permis
            </p>
          </div>
          <Button
            onClick={() => { setEditingId(null); setFormOpen(true); }}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle DAACT
          </Button>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence, N° permis, dénomination..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <FilterPill active={filterPermit === ""} onClick={() => setFilterPermit("")}>
              Tous
            </FilterPill>
            {(Object.keys(DAACT_PERMIT_TYPE_META) as DaactPermitType[]).map((t) => (
              <FilterPill
                key={t}
                active={filterPermit === t}
                onClick={() => setFilterPermit(t)}
              >
                {DAACT_PERMIT_TYPE_META[t].short}
              </FilterPill>
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
            <DaactRow
              key={d.id}
              declaration={d}
              chantierLabel={chantierMap.get(d.chantierId) || ""}
              delay={Math.min(idx * 0.03, 0.3)}
              onClick={() => { setEditingId(d.id); setFormOpen(true); }}
            />
          ))}
        </div>
      )}

      <DaactFormModal
        open={formOpen}
        declarationId={editingId}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}

// ─── Composants ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: typeof Building2; color: string;
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

function FilterPill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
        active
          ? "bg-primary/10 text-primary border border-primary/30"
          : "bg-card border border-border text-muted-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function DaactRow({ declaration, chantierLabel, delay, onClick }: {
  declaration: DaactDeclaration;
  chantierLabel: string;
  delay: number;
  onClick: () => void;
}) {
  const permitMeta = DAACT_PERMIT_TYPE_META[declaration.permitType];
  const statusMeta = DAACT_STATUS_META[declaration.status];
  const date = declaration.achievementDate
    ? new Date(declaration.achievementDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-soft-sm transition-all cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
        <Building2 className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold">{declaration.reference}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 shrink-0">
            {permitMeta.short}
          </span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          {declaration.vaultDocumentId && (
            <span className="text-[10px] text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-500/10 shrink-0">
              CERFA archivé
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          {declaration.permitNumber && (<><span>N° {declaration.permitNumber}</span><span>·</span></>)}
          <span>Achevé le {date}</span>
          {chantierLabel && (<><span>·</span><span className="truncate">{chantierLabel}</span></>)}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-12 bg-card border border-dashed border-border rounded-lg">
      <div className="w-14 h-14 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
        <Building2 className="w-6 h-6 text-blue-500" />
      </div>
      <h3 className="text-base font-semibold mb-1">Aucune DAACT</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        La DAACT (CERFA 13408*13) est obligatoire après l'achèvement de travaux soumis à
        permis de construire, d'aménager ou à déclaration préalable. À transmettre à la mairie.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Créer une DAACT
      </Button>
    </div>
  );
}
