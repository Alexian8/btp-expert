import { useState } from "react";
import {
  GripVertical, Eye, EyeOff, RotateCcw,
  LayoutDashboard, Receipt, Hammer, Users, Package, Calendar, Wallet,
  HardHat, BarChart3, Activity, FileSignature, Archive,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useSidebarPrefsStore } from "@/stores/sidebarPrefsStore";

// ═══════════════════════════════════════════════════════════════════════════
// SidebarSection — Personnalisation de la sidebar (Session 21)
// Drag&drop pour réordonner + checkbox pour masquer/afficher
// ═══════════════════════════════════════════════════════════════════════════

// Métadonnées des items (label + icône) — doit rester aligné avec DashboardLayout
const NAV_META: Record<string, { label: string; icon: any }> = {
  "dashboard":      { label: "Tableau de bord", icon: LayoutDashboard },
  "quotes":         { label: "Devis & Factures", icon: Receipt },
  "chantiers":      { label: "Chantiers", icon: Hammer },
  "clients":        { label: "Clients", icon: Users },
  "suppliers":      { label: "Fournisseurs", icon: Package },
  "calendar":       { label: "Agenda", icon: Calendar },
  "expenses":       { label: "Dépenses", icon: Receipt },
  "expense-notes":  { label: "Notes de frais", icon: Wallet },
  "subcontractors": { label: "Sous-traitants", icon: HardHat },
  "finances":       { label: "Finances", icon: BarChart3 },
  "statistics":     { label: "Statistiques", icon: Activity },
  "admin-docs":     { label: "Documents admin", icon: FileSignature },
  "vault":          { label: "Coffre-fort", icon: Archive },
};

export function SidebarSection() {
  const { order, hidden, setOrder, toggleHidden, reset } = useSidebarPrefsStore();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ─── Drag & drop handlers (HTML5 natif) ───────────────────────────────
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // Trick : on met du texte pour que Firefox accepte le drag
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };

  const handleDragLeave = () => {
    // Pas de reset ici sinon ça flicker
  };

  const handleDrop = (toIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === toIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...order];
    const [moved] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setOrder(newOrder);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold flex items-center gap-2">
            Personnaliser la sidebar
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Réorganisez les onglets avec la poignée à gauche, ou masquez ceux que vous n'utilisez pas avec l'œil à droite.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser
        </Button>
      </div>

      <div className="space-y-1">
        {order.map((id, idx) => {
          const meta = NAV_META[id];
          if (!meta) return null;
          const Icon = meta.icon;
          const isHidden = hidden.includes(id);
          const isDragging = draggedIdx === idx;
          const isDragOver = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;

          return (
            <div
              key={id}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border transition-all",
                "border-border bg-background",
                isHidden && "opacity-50 bg-muted/30",
                isDragging && "opacity-30",
                isDragOver && "border-primary border-2 bg-primary/5"
              )}
            >
              {/* Poignée drag */}
              <div
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
                title="Glisser pour réordonner"
              >
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Icône + label */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon className={cn("w-4 h-4 shrink-0", isHidden ? "text-muted-foreground" : "text-foreground")} />
                <span className={cn("text-sm truncate", isHidden && "line-through text-muted-foreground")}>
                  {meta.label}
                </span>
              </div>

              {/* Toggle visibilité */}
              <button
                onClick={() => toggleHidden(id)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isHidden
                    ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                    : "text-foreground hover:bg-accent"
                )}
                title={isHidden ? "Afficher" : "Masquer"}
              >
                {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          💡 Astuce : le tableau de bord et le coffre-fort restent toujours accessibles via la palette de recherche (Ctrl+K) même s'ils sont masqués.
        </p>
      </div>
    </div>
  );
}
