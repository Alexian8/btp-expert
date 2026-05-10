import { useResource } from "@/hooks/useResource";
import { ResourceList } from "@/components/ResourceList";
import { api } from "@/lib/api";
import { MapPin, Hammer } from "lucide-react";
import { cn } from "@btp/ui";
import type { Chantier } from "@btp/types";

const STATUS_STYLES: Record<string, string> = {
  prospect: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  "en-cours": "bg-amber-500/15 text-amber-500 border-amber-500/30",
  termine: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  abandonne: "bg-muted text-muted-foreground border-border",
};

export function ChantiersPage() {
  const { items, isLoading, error, reload } = useResource<Chantier>(api.chantiers);

  return (
    <ResourceList
      title="Chantiers"
      subtitle={`${items.length} chantier${items.length > 1 ? "s" : ""}`}
      items={items}
      isLoading={isLoading}
      error={error}
      onReload={reload}
      emptyMessage="Aucun chantier."
      renderItem={(c) => {
        const ch = c as {
          id?: string | number;
          nom?: string;
          adresse?: string;
          statut?: string;
          status?: string;
          priorite?: string;
        };
        const statusKey = ch.statut || ch.status || "";
        const statusClass = STATUS_STYLES[statusKey] || "bg-muted text-muted-foreground border-border";
        return (
          <div
            key={ch.id}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Hammer className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-medium truncate">{ch.nom ?? "Sans nom"}</div>
                  {statusKey && (
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                        statusClass
                      )}
                    >
                      {statusKey}
                    </span>
                  )}
                </div>
                {ch.adresse && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {ch.adresse}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
