import { useResource } from "@/hooks/useResource";
import { ResourceList } from "@/components/ResourceList";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@btp/core";
import { cn } from "@btp/ui";
import { Receipt } from "lucide-react";
import type { Invoice } from "@btp/types";

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  partiellement_payee: "Partiellement payée",
  "partiellement-payee": "Partiellement payée",
  en_retard: "En retard",
  "en-retard": "En retard",
  annulee: "Annulée",
};

const STATUS_STYLES: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground border-border",
  envoyee: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  payee: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  partiellement_payee: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  "partiellement-payee": "bg-amber-500/15 text-amber-500 border-amber-500/30",
  en_retard: "bg-destructive/15 text-destructive border-destructive/30",
  "en-retard": "bg-destructive/15 text-destructive border-destructive/30",
  annulee: "bg-muted text-muted-foreground border-border",
};

export function InvoicesPage() {
  // L'API serveur renvoie des Invoice modernes (schéma MySQL aligné), pas LegacyInvoice
  const { items, isLoading, error, reload } = useResource<Invoice>(api.invoices as never);

  return (
    <ResourceList
      title="Factures"
      subtitle={`${items.length} facture${items.length > 1 ? "s" : ""}`}
      items={items}
      isLoading={isLoading}
      error={error}
      onReload={reload}
      emptyMessage="Aucune facture."
      renderItem={(inv) => {
        const status = inv.status ?? "brouillon";
        const statusClass = STATUS_STYLES[status] || STATUS_STYLES.brouillon;
        return (
          <div
            key={(inv as { id: string }).id}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium font-mono text-sm">
                    {inv.reference || "Sans n°"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                      statusClass
                    )}
                  >
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
                {inv.title && (
                  <div className="text-sm text-foreground/80 mt-1 truncate">{inv.title}</div>
                )}
                {inv.issueDate && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Émise le {formatDate(inv.issueDate)}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-base tabular-nums">
                  {formatCurrency(inv.totalTTC ?? 0)}
                </div>
                {(inv.totalPaid ?? 0) > 0 && (inv.totalPaid ?? 0) < (inv.totalTTC ?? 0) && (
                  <div className="text-xs text-emerald-500">
                    Payé : {formatCurrency(inv.totalPaid ?? 0)}
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
