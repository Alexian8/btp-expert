import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useInvoicesStore } from "@/stores/invoicesStore";
import { formatEuros } from "@/features/quotes/quoteEngine";
import { formatDateFR } from "../invoiceEngine";
import { PAYMENT_METHOD_META, type Invoice, type InvoicePayment } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// PaymentsHistory — Liste des paiements d'une facture
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  invoice: Invoice;
  onAddPayment: () => void;
}

export function PaymentsHistory({ invoice, onAddPayment }: Props) {
  const fetchPayments = useInvoicesStore((s) => s.fetchPayments);
  const deletePayment = useInvoicesStore((s) => s.deletePayment);

  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const list = await fetchPayments(invoice.id);
    setPayments(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [invoice.id, invoice.totalPaid]);

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Supprimer ce paiement ?")) return;
    const r = await deletePayment(paymentId);
    if (r.success) {
      toast.success("Paiement supprimé");
      refresh();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const remaining = Math.max(0, invoice.totalTTC - invoice.totalPaid);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          Paiements ({payments.length})
        </h3>
        {remaining > 0 && (invoice.status === "envoyee" || invoice.status === "partiellement-payee") && (
          <Button variant="outline" size="sm" onClick={onAddPayment}>
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </Button>
        )}
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucun paiement enregistré
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p, idx) => {
            const methodMeta = PAYMENT_METHOD_META[p.method] || { label: p.method };
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40 group"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold tabular-nums">
                      {formatEuros(p.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {methodMeta.label}
                    </span>
                    {p.reference && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {p.reference}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateFR(p.date)}
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                  onClick={() => handleDelete(p.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
