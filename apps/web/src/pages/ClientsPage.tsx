import { useResource } from "@/hooks/useResource";
import { ResourceList } from "@/components/ResourceList";
import { api } from "@/lib/api";
import type { Client } from "@btp/types";

export function ClientsPage() {
  const { items, isLoading, error, reload } = useResource<Client>(api.clients);

  return (
    <ResourceList
      title="Clients"
      items={items}
      isLoading={isLoading}
      error={error}
      onReload={reload}
      emptyMessage="Aucun client. La liste se synchronise depuis le serveur o2switch."
      renderItem={(c) => (
        <div key={(c as { id?: string | number }).id} className="card">
          <div className="font-medium">
            {(c as { nom?: string }).nom ||
              `${(c as { firstName?: string }).firstName ?? ""} ${(c as { lastName?: string }).lastName ?? ""}`.trim() ||
              "Sans nom"}
          </div>
          {(c as { email?: string }).email && (
            <div className="text-xs text-text-muted mt-0.5">{(c as { email?: string }).email}</div>
          )}
          {(c as { siret?: string }).siret && (
            <div className="text-xs text-text-muted">SIRET {(c as { siret?: string }).siret}</div>
          )}
        </div>
      )}
    />
  );
}
