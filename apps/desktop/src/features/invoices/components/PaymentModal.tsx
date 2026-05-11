import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { useInvoicesStore } from "@/stores/invoicesStore";
import { formatEuros } from "@/features/quotes/quoteEngine";
import { PAYMENT_METHOD_META, type InvoicePaymentMethod } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// PaymentModal — Enregistrer un paiement sur une facture
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  invoiceId: string;
  invoiceReference: string;
  totalTTC: number;
  totalPaid: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({
  open, invoiceId, invoiceReference, totalTTC, totalPaid, onClose, onSuccess,
}: Props) {
  const addPayment = useInvoicesStore((s) => s.addPayment);

  const remaining = Math.max(0, totalTTC - totalPaid);

  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<InvoicePaymentMethod>("virement");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(remaining);
      setDate(new Date().toISOString().slice(0, 10));
      setMethod("virement");
      setReference("");
      setNotes("");
    }
  }, [open, remaining]);

  const handleSave = async () => {
    if (amount <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }
    if (amount > remaining + 0.01) {
      if (!confirm(`Le montant dépasse le solde restant (${formatEuros(remaining)}). Continuer ?`)) return;
    }

    setLoading(true);
    const r = await addPayment({
      invoiceId,
      amount,
      date,
      method,
      reference,
      notes,
    });
    setLoading(false);

    if (r.success) {
      toast.success("Paiement enregistré");
      onSuccess();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-lg w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>
                  <p className="text-xs text-muted-foreground">{invoiceReference}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Récap */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted text-center">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Total facture</p>
                  <p className="font-semibold text-sm tabular-nums mt-1">{formatEuros(totalTTC)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Déjà payé</p>
                  <p className="font-semibold text-sm tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                    {formatEuros(totalPaid)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Reste dû</p>
                  <p className="font-semibold text-sm tabular-nums mt-1 text-primary">
                    {formatEuros(remaining)}
                  </p>
                </div>
              </div>

              {/* Montant */}
              <div>
                <Label htmlFor="amount">Montant payé *</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="pr-8"
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                </div>
                {amount > 0 && amount < remaining && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Paiement partiel — il restera {formatEuros(remaining - amount)} à payer
                  </p>
                )}
                {amount > 0 && amount >= remaining - 0.01 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    ✓ Facture entièrement payée
                  </p>
                )}
              </div>

              {/* Date + méthode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="method">Méthode</Label>
                  <NativeSelect
                    id="method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)}
                    className="mt-1.5"
                  >
                    {Object.entries(PAYMENT_METHOD_META).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* Référence */}
              <div>
                <Label htmlFor="ref">Référence (optionnel)</Label>
                <Input
                  id="ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={method === "cheque" ? "N° du chèque" : method === "virement" ? "Réf. du virement" : "Référence"}
                  className="mt-1.5"
                />
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Informations complémentaires..."
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} loading={loading}>
                <CreditCard className="w-4 h-4" />
                Enregistrer le paiement
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
