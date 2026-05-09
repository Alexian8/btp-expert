import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Calendar, User as UserIcon, Building2, Euro, Zap } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useClientsStore } from "@/stores/clientsStore";
import {
  CHANTIER_STATUS_META,
  CHANTIER_STATUS_ORDER,
  type Chantier,
  type ChantierStatus,
} from "@btp/types";
import { CHANTIER_STATUS_ICON } from "../statusIcons";

// ═══════════════════════════════════════════════════════════════════════════
// ChantierKanban — Vue Kanban avec drag & drop HTML5
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  chantiers: Chantier[];
  onView: (c: Chantier) => void;
}

export function ChantierKanban({ chantiers, onView }: Props) {
  const { updateStatus } = useChantiersStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<ChantierStatus | null>(null);

  const grouped: Record<ChantierStatus, Chantier[]> = {
    prospect: [],
    "en-cours": [],
    termine: [],
    annule: [],
  };
  for (const c of chantiers) {
    grouped[c.status].push(c);
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setHoveredStatus(null);
  };

  const handleDragOver = (e: React.DragEvent, status: ChantierStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoveredStatus !== status) setHoveredStatus(status);
  };

  const handleDrop = async (e: React.DragEvent, status: ChantierStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setHoveredStatus(null);
    setDraggingId(null);
    if (!id) return;

    const chantier = chantiers.find((c) => c.id === id);
    if (!chantier || chantier.status === status) return;

    const result = await updateStatus(id, status);
    if (result.success) {
      toast.success(`Statut mis à jour : ${CHANTIER_STATUS_META[status].label}`);
    } else {
      toast.error(result.error || "Erreur lors du changement de statut");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto pb-4">
      {CHANTIER_STATUS_ORDER.map((status) => {
        const meta = CHANTIER_STATUS_META[status];
        const Icon = CHANTIER_STATUS_ICON[status];
        const items = grouped[status];
        const isHovered = hoveredStatus === status;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={() => setHoveredStatus(null)}
            onDrop={(e) => handleDrop(e, status)}
            className={cn(
              "bg-muted/40 rounded-lg p-2 min-h-[400px] flex flex-col transition-colors",
              isHovered && "bg-primary/5 ring-2 ring-primary/30"
            )}
          >
            {/* Header colonne */}
            <div className="flex items-center justify-between px-2 py-2 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded flex items-center justify-center",
                  meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                  meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                  meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                  meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm font-semibold">{meta.label}</p>
              </div>
              <span className="text-xs font-semibold text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded tabular-nums">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto px-1 pt-1">
              {items.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground italic">
                  Glissez un chantier ici
                </div>
              ) : (
                items.map((c) => (
                  <ChantierCard
                    key={c.id}
                    chantier={c}
                    onView={onView}
                    isDragging={draggingId === c.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Carte d'un chantier ─────────────────────────────────────────────────
interface CardProps {
  chantier: Chantier;
  onView: (c: Chantier) => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

function ChantierCard({ chantier, onView, isDragging, onDragStart, onDragEnd }: CardProps) {
  const { getById } = useClientsStore();
  const client = getById(chantier.clientId);
  const displayClient = client
    ? (client.type === "pro" && client.companyName
      ? client.companyName
      : `${client.firstName} ${client.lastName}`.trim())
    : "—";

  return (
    <motion.div
      layout
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, chantier.id)}
      onDragEnd={onDragEnd}
      onClick={() => onView(chantier)}
      className={cn(
        "bg-card border border-border rounded-md p-3 cursor-grab active:cursor-grabbing hover:shadow-soft-md transition-all",
        isDragging && "opacity-40 scale-95"
      )}
    >
      {/* Ref + priorité */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground">{chantier.reference}</span>
        {chantier.priority === "high" && (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium">
            <Zap className="w-2.5 h-2.5" />
            Urgent
          </span>
        )}
      </div>

      {/* Titre */}
      <p className="text-sm font-semibold leading-tight mb-2 line-clamp-2">
        {chantier.title || "Sans titre"}
      </p>

      {/* Client */}
      {client && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          {client.type === "pro" ? (
            <Building2 className="w-3 h-3 shrink-0" />
          ) : (
            <UserIcon className="w-3 h-3 shrink-0" />
          )}
          <span className="truncate">{displayClient}</span>
        </div>
      )}

      {/* Localisation */}
      {(chantier.city || chantier.addressLine1) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{chantier.city || chantier.addressLine1}</span>
        </div>
      )}

      {/* Date début */}
      {chantier.startDateEstimated && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{formatShortDate(chantier.startDateEstimated)}</span>
        </div>
      )}

      {/* Budget */}
      {chantier.budgetEstimatedHT > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-medium mt-2 pt-2 border-t border-border">
          <Euro className="w-3 h-3 shrink-0 text-muted-foreground" />
          <span>{formatEuros(chantier.budgetEstimatedHT)} HT</span>
        </div>
      )}

      {/* Tags */}
      {chantier.tags && chantier.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {chantier.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {t}
            </span>
          ))}
          {chantier.tags.length > 3 && (
            <span className="text-[10px] px-1 py-0.5 text-muted-foreground">+{chantier.tags.length - 3}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short",
    });
  } catch { return iso; }
}

function formatEuros(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}
