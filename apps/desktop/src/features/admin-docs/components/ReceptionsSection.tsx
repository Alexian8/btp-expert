import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck, Plus, Search, AlertTriangle, CheckCircle2,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RECEPTION_TYPE_META, RECEPTION_STATUS_META,
  type ReceptionReport, type ReceptionType,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { ReceptionFormModal } from "./ReceptionFormModal";

// ═══════════════════════════════════════════════════════════════════════════
// ReceptionsSection — Liste des PV de réception
// ═══════════════════════════════════════════════════════════════════════════

export function ReceptionsSection() {
  const { receptions, stats, fetchReceptions, fetchStats } = useAdministrativeDocsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ReceptionType | "">("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReceptions();
    fetchChantiers();
    fetchStats();
  }, []);

  const chantierMap = useMemo(() => {
    const m = new Map<string, string>();
    chantiers.forEach((c) => m.set(c.id, `${c.reference} · ${c.title}`));
    return m;
  }, [chantiers]);

  const filtered = useMemo(() => {
    return receptions.filter((r) => {
      if (filterType && r.receptionType !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inRef = r.reference?.toLowerCase().includes(q);
        const inClient = r.clientName?.toLowerCase().includes(q);
        const inLoc = r.location?.toLowerCase().includes(q);
        if (!inRef && !inClient && !inLoc) return false;
      }
      return true;
    });
  }, [receptions, search, filterType]);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="PV signés au total"
          value={String(stats.receptionsTotal)}
          icon={CheckCircle2}
          color="bg-emerald-500/15 text-emerald-500"
        />
        <StatCard
          label="Avec réserves"
          value={String(stats.receptionsWithReserves)}
          icon={AlertTriangle}
          color={stats.receptionsWithReserves > 0 ? "bg-amber-500/15 text-amber-500" : "bg-slate-500/15 text-slate-500"}
        />
        <StatCard
          label="Sans réserves"
          value={String(stats.receptionsTotal - stats.receptionsWithReserves)}
          icon={CheckCircle2}
          color="bg-blue-500/15 text-blue-500"
        />
      </div>

      {/* Header section */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-500" />
              PV de réception de chantier
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Norme NF P 03-001 · Démarrage de la garantie décennale
            </p>
          </div>
          <Button onClick={() => { setEditingId(null); setFormOpen(true); }} size="sm">
            <Plus className="w-4 h-4" />
            Nouveau PV
          </Button>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence, client, lieu..."
              className="pl-9"
            />
          </div>

          {/* Filtres type */}
          <div className="flex items-center gap-1">
            {(["", "sans_reserves", "avec_reserves", "refusee"] as Array<ReceptionType | "">).map((t) => (
              <button
                key={t || "all"}
                type="button"
                onClick={() => setFilterType(t)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  filterType === t
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card border border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {t === "" ? "Tous" : RECEPTION_TYPE_META[t].label}
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
          {filtered.map((r, idx) => (
            <ReceptionRow
              key={r.id}
              report={r}
              chantierLabel={chantierMap.get(r.chantierId) || ""}
              delay={Math.min(idx * 0.03, 0.3)}
              onClick={() => { setEditingId(r.id); setFormOpen(true); }}
            />
          ))}
        </div>
      )}

      <ReceptionFormModal
        open={formOpen}
        reportId={editingId}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────
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

// ─── ReceptionRow ──────────────────────────────────────────────────────────
function ReceptionRow({ report, chantierLabel, delay, onClick }: {
  report: ReceptionReport;
  chantierLabel: string;
  delay: number;
  onClick: () => void;
}) {
  const typeMeta = RECEPTION_TYPE_META[report.receptionType];
  const statusMeta = RECEPTION_STATUS_META[report.status];
  const formattedDate = report.receptionDate
    ? new Date(report.receptionDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-soft-sm transition-all cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
        <ClipboardCheck className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold">{report.reference}</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", typeMeta.colorTw)}>
            {typeMeta.label}
          </span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          {report.vaultDocumentId && (
            <span className="text-[10px] text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-500/10 shrink-0">
              PDF chiffré
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          <span>{formattedDate}</span>
          {report.clientName && (<><span>·</span><span className="truncate">{report.clientName}</span></>)}
          {chantierLabel && (<><span>·</span><span className="truncate">{chantierLabel}</span></>)}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16 bg-card border border-dashed border-border rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <ClipboardCheck className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Aucun PV de réception</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        Le PV de réception formalise la livraison du chantier au client et déclenche la garantie décennale.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Créer un PV de réception
      </Button>
    </div>
  );
}
