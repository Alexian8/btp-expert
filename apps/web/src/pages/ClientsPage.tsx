import { useResource } from "@/hooks/useResource";
import { ResourceList } from "@/components/ResourceList";
import { api } from "@/lib/api";
import { Mail, Phone, Building2 } from "lucide-react";
import type { Client } from "@btp/types";

export function ClientsPage() {
  const { items, isLoading, error, reload } = useResource<Client>(api.clients);

  return (
    <ResourceList
      title="Clients"
      subtitle={`${items.length} fiche${items.length > 1 ? "s" : ""}`}
      items={items}
      isLoading={isLoading}
      error={error}
      onReload={reload}
      emptyMessage="Aucun client. Synchronisé depuis le serveur o2switch."
      renderItem={(c) => {
        const cli = c as {
          id?: string | number;
          nom?: string;
          firstName?: string;
          lastName?: string;
          companyName?: string;
          email?: string;
          telephone?: string;
          phoneMobile?: string;
          siret?: string;
          city?: string;
        };
        const displayName =
          cli.nom ||
          cli.companyName ||
          `${cli.firstName ?? ""} ${cli.lastName ?? ""}`.trim() ||
          "Sans nom";
        const phone = cli.telephone || cli.phoneMobile;
        return (
          <div
            key={cli.id}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {displayName[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{displayName}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                  {cli.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {cli.email}
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {phone}
                    </span>
                  )}
                  {cli.siret && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {cli.siret}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
