import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hammer, Plus, LayoutGrid, Search, List } from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useClientsStore } from "@/stores/clientsStore";
import { CHANTIER_STATUS_META, CHANTIER_STATUS_ORDER, type Chantier, type ChantierStatus } from "@btp/types";
import { CHANTIER_STATUS_ICON } from "../statusIcons";
import { ChantierFormModal } from "./ChantierFormModal";
import { ChantierKanban } from "./ChantierKanban";
import { ChantierList } from "./ChantierList";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ═══════════════════════════════════════════════════════════════════════════
// ChantiersPage — Page principale avec toggle Kanban/Liste
// ═══════════════════════════════════════════════════════════════════════════

type ViewMode = "kanban" | "list";

export function ChantiersPage() {
  const navigate = useNavigate();
  const { chantiers, fetch, delete: deleteChantier } = useChantiersStore();
  const { fetch: fetchClients } = useClientsStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ChantierStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Chantier | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch();
    fetchClients();
  }, []);

  // ─── Filtrage + recherche ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chantiers.filter((c) => {
      if (viewMode === "list" && filterStatus !== "all" && c.status !== filterStatus) return false;
      if (q) {
        const haystack = [
          c.title, c.reference, c.nature, c.description,
          c.city, c.postalCode, c.addressLine1,
          ...(c.tags || []),
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [chantiers, search, filterStatus, viewMode]);

  // ─── Stats ─────────────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<ChantierStatus, number> = { prospect: 0, "en-cours": 0, termine: 0, annule: 0 };
    for (const c of chantiers) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [chantiers]);

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleView = (c: Chantier) => {
    navigate(`/chantiers/${c.id}`);
  };

  const handleEdit = (c: Chantier) => {
    setEditing(c);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteChantier(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Hammer className="w-6 h-6" /> Chantiers
          </h1>
          <p className="text-muted-foreground mt-1">
            {chantiers.length} chantier{chantiers.length > 1 ? "s" : ""} au total
            {" · "}
            <span className="text-primary font-medium">
              {statusCounts["en-cours"]} en cours
            </span>
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4" />
          Nouveau chantier
        </Button>
      </div>

      {/* Stats cards par statut */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {CHANTIER_STATUS_ORDER.map((s) => {
          const meta = CHANTIER_STATUS_META[s];
          const Icon = CHANTIER_STATUS_ICON[s];
          const isActive = s === "en-cours" && statusCounts[s] > 0;
          return (
            <div
              key={s}
              className={cn(
                "bg-card border border-border rounded-lg p-3 flex items-center gap-3 transition-colors",
                isActive && "border-primary/40 bg-primary/5"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                meta.color === "slate"   && "bg-slate-500/10 text-slate-500",
                meta.color === "blue"    && "bg-blue-500/10 text-blue-500",
                meta.color === "amber"   && "bg-amber-500/10 text-amber-500",
                meta.color === "emerald" && "bg-emerald-500/10 text-emerald-500",
                meta.color === "rose"    && "bg-rose-500/10 text-rose-500",
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{meta.label}</p>
                <p className="text-xl font-bold tabular-nums">{statusCounts[s]}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (titre, référence, adresse, tag...)"
            className="pl-9"
          />
        </div>

        {viewMode === "list" && (
          <NativeSelect
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-auto min-w-[140px]"
          >
            <option value="all">Tous statuts</option>
            {CHANTIER_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{CHANTIER_STATUS_META[s].label}</option>
            ))}
          </NativeSelect>
        )}

        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5",
              viewMode === "kanban" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
            title="Vue Kanban"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5",
              viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
            title="Vue liste"
          >
            <List className="w-3.5 h-3.5" />
            Liste
          </button>
        </div>
      </div>

      {/* Vue */}
      {chantiers.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : viewMode === "kanban" ? (
        <ChantierKanban
          chantiers={filtered}
          onView={handleView}
        />
      ) : (
        <ChantierList
          chantiers={filtered}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={(id) => setConfirmDeleteId(id)}
        />
      )}

      {/* Modales */}
      <ChantierFormModal
        open={formOpen}
        chantier={editing}
        onClose={() => setFormOpen(false)}
      />
      <ConfirmDialog
        open={!!confirmDeleteId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer ce chantier ?"
        description="Cette action est irréversible. Les photos et données du chantier seront perdues."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="p-16 text-center bg-card border border-dashed border-border rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Hammer className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Aucun chantier pour l'instant</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        Créez votre premier chantier pour commencer à suivre vos projets. Vous pourrez associer des clients, ajouter des photos et des devis.
      </p>
      <Button onClick={onNew}>
        <Plus className="w-4 h-4" />
        Créer mon premier chantier
      </Button>
    </div>
  );
}
