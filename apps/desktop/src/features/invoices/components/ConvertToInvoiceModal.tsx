import { useState } from "react";
import { motion } from "framer-motion";
import { Receipt, Percent, RotateCcw, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { SideDrawer } from "@/components/shared/SideDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@btp/ui";
import { useInvoicesStore } from "@/stores/invoicesStore";
import type { Quote } from "@btp/types";
import { INVOICE_TYPE_META } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// ConvertToInvoiceModal — Modal pour convertir un devis en facture
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  quote: Quote | null | undefined;
  onClose: () => void;
  onSuccess: (invoiceId: string, reference: string) => void;
}

type ConvertType = "standard" | "acompte" | "avoir";

export function ConvertToInvoiceModal({ open, quote, onClose, onSuccess }: Props) {
  const convertFromQuote = useInvoicesStore((s) => s.convertFromQuote);
  const [type, setType] = useState<ConvertType>("standard");
  const [acomptePercent, setAcomptePercent] = useState<number>(30);
  const [loading, setLoading] = useState(false);

  if (!quote) return null;

  const handleConvert = async () => {
    setLoading(true);
    const r = await convertFromQuote(quote.id, {
      type,
      acomptePercent: type === "acompte" ? acomptePercent : undefined,
    });
    setLoading(false);

    if (r.success && r.invoice) {
      toast.success(`Facture ${r.invoice.reference} créée`);
      onSuccess(r.invoice.id, r.invoice.reference);
      onClose();
    } else {
      toast.error(r.error || "Erreur lors de la conversion");
    }
  };

  const options: Array<{ value: ConvertType; icon: any; color: string }> = [
    { value: "standard", icon: Receipt,   color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { value: "acompte",  icon: Percent,   color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { value: "avoir",    icon: RotateCcw, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ];

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Annuler</Button>
      <Button onClick={handleConvert} loading={loading}>
        <Receipt className="w-4 h-4" />
        Créer la facture
      </Button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      widthClass="max-w-xl"
      title="Convertir en facture"
      subtitle={`Depuis ${quote.reference} · ${quote.title || "Sans titre"}`}
      footer={footer}
    >
            {/* Body */}
            <div className="p-5 space-y-5">
              {/* Type selector */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Type de facture</Label>
                <div className="grid grid-cols-1 gap-2">
                  {options.map((opt) => {
                    const meta = INVOICE_TYPE_META[opt.value];
                    const Icon = opt.icon;
                    const selected = type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-border/80 hover:bg-accent/50"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", opt.color)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{meta.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center",
                          selected ? "border-primary bg-primary" : "border-border"
                        )}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Acompte % input */}
              {type === "acompte" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <Label htmlFor="acompte-percent">Pourcentage de l'acompte</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      id="acompte-percent"
                      type="number"
                      min="1"
                      max="99"
                      value={acomptePercent}
                      onChange={(e) => setAcomptePercent(Number(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      (standard BTP : 30 %)
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Info */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-xs">
                <FileText className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <div className="space-y-1">
                  {type === "standard" && (
                    <p>
                      Une facture sera créée avec <strong>les mêmes lignes que le devis</strong>,
                      statut "Brouillon". Le devis reste intact et sera lié à cette facture.
                    </p>
                  )}
                  {type === "acompte" && (
                    <p>
                      Une facture d'acompte de <strong>{acomptePercent} %</strong> sera créée
                      avec une ligne forfaitaire. Le devis restera accessible pour facturer le solde plus tard.
                    </p>
                  )}
                  {type === "avoir" && (
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p>
                        Un avoir avec <strong>montants négatifs</strong> sera créé. À utiliser
                        pour annuler ou rembourser une facture déjà émise.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
    </SideDrawer>
  );
}
