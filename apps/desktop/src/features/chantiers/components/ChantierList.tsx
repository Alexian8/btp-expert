import { motion } from "framer-motion";
import { Eye, Pencil, Trash2, Hammer } from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useClientsStore } from "@/stores/clientsStore";
import { CategoryBadge } from "./CategoryBadge";
import { CHANTIER_STATUS_META, type Chantier } from "@btp/types";
import { CHANTIER_STATUS_ICON } from "../statusIcons";

// ═══════════════════════════════════════════════════════════════════════════
// ChantierList — Vue table classique
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  chantiers: Chantier[];
  onView: (c: Chantier) => void;
  onEdit: (c: Chantier) => void;
  onDelete: (id: string) => void;
}

export function ChantierList({ chantiers, onView, onEdit, onDelete }: Props) {
  const { getById } = useClientsStore();

  if (chantiers.length === 0) {
    return (
      <div className="p-12 text-center bg-card border border-dashed border-border rounded-lg">
        <Hammer className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Aucun chantier ne correspond aux filtres</p>
      </div>
    );
  }

  const clientName = (clientId: string) => {
    const c = getById(clientId);
    if (!c) return "—";
    return c.type === "pro" && c.companyName
      ? c.companyName
      : `${c.firstName} ${c.lastName}`.trim() || "—";
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return iso; }
  };

  const formatEuros = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Réf.</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Titre</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Client</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Statut</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Ville</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Début</th>
              <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Budget HT</th>
              <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chantiers.map((c, idx) => {
              const meta = CHANTIER_STATUS_META[c.status];
              const StatusIcon = CHANTIER_STATUS_ICON[c.status];
              return (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                  onClick={() => onView(c)}
                  className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {c.reference}
                  </td>
                  <td className="px-4 py-3 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{c.title || "Sans titre"}</p>
                      <CategoryBadge categoryId={c.categoryId} size="xs" />
                    </div>
                    {c.nature && <p className="text-xs text-muted-foreground truncate">{c.nature}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                    {clientName(c.clientId)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded",
                      meta.color === "slate"   && "bg-slate-400/20 text-slate-600 dark:text-slate-200",
                      meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                      meta.color === "amber"   && "bg-amber-500/15 text-amber-500",
                      meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                      meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.startDateEstimated)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {c.budgetEstimatedHT > 0 ? formatEuros(c.budgetEstimatedHT) : "—"}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(c)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(c.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
