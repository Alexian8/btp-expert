import { useResource } from "@/hooks/useResource";
import { ResourceList } from "@/components/ResourceList";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@btp/core";
import type { LegacyInvoice } from "@btp/types";

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  partiellement_payee: "Partiellement payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

export function InvoicesPage() {
  const { items, isLoading, error, reload } = useResource<LegacyInvoice>(api.invoices);

  return (
    <ResourceList
      title="Factures"
      items={items}
      isLoading={isLoading}
      error={error}
      onReload={reload}
      emptyMessage="Aucune facture."
      renderItem={(inv) => (
        <div key={(inv as { id?: string | number }).id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium font-mono text-sm">
                  {(inv as { reference?: string }).reference || "Sans n°"}
                </span>
                {(inv as { status?: string }).status && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-bg-hover text-text-secondary">
                    {STATUS_LABELS[(inv as { status?: string }).status!] ?? (inv as { status?: string }).status}
                  </span>
                )}
              </div>
              {(inv as { title?: string }).title && (
                <div className="text-xs text-text-muted mt-0.5 truncate">
                  {(inv as { title?: string }).title}
                </div>
              )}
              {(inv as { issueDate?: string }).issueDate && (
                <div className="text-xs text-text-muted">
                  Émise le {formatDate((inv as { issueDate?: string }).issueDate)}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-base">
                {formatCurrency((inv as { totalTTC?: number }).totalTTC ?? 0)}
              </div>
              {((inv as { totalPaid?: number }).totalPaid ?? 0) > 0 && (
                <div className="text-xs text-text-muted">
                  Payé : {formatCurrency((inv as { totalPaid?: number }).totalPaid ?? 0)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    />
  );
}
