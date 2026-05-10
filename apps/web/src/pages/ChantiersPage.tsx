import { useResource } from "@/hooks/useResource";
import { ResourceList } from "@/components/ResourceList";
import { api } from "@/lib/api";
import type { Chantier } from "@btp/types";

export function ChantiersPage() {
  const { items, isLoading, error, reload } = useResource<Chantier>(api.chantiers);

  return (
    <ResourceList
      title="Chantiers"
      items={items}
      isLoading={isLoading}
      error={error}
      onReload={reload}
      emptyMessage="Aucun chantier."
      renderItem={(c) => (
        <div key={(c as { id?: string | number }).id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {(c as { nom?: string }).nom ?? "Sans nom"}
              </div>
              {(c as { adresse?: string }).adresse && (
                <div className="text-xs text-text-muted mt-0.5 truncate">
                  {(c as { adresse?: string }).adresse}
                </div>
              )}
            </div>
            {(c as { statut?: string }).statut && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-bg-hover text-text-secondary shrink-0">
                {(c as { statut?: string }).statut}
              </span>
            )}
          </div>
        </div>
      )}
    />
  );
}
