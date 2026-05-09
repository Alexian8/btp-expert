import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, FileText, ArrowRight, Hammer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";

// ═══════════════════════════════════════════════════════════════════════════
// ConvertQuoteToPoModal — Conversion devis → BdC sous-traitant (Session 20)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  quoteId: string | null;
  quoteReference: string;
  onClose: () => void;
}

export function ConvertQuoteToPoModal({ open, quoteId, quoteReference, onClose }: Props) {
  const navigate = useNavigate();
  const { subcontractors, fetch: fetchST } = useSubcontractorsStore();
  const [subcontractorId, setSubcontractorId] = useState("");
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchST();
    setSubcontractorId("");
  }, [open]);

  const handleConvert = async () => {
    if (!quoteId) return;
    if (!subcontractorId) {
      toast.error("Sélectionnez un sous-traitant");
      return;
    }
    if (!window.btpAPI) { toast.error("API non disponible"); return; }

    setConverting(true);
    try {
      const r = await window.btpAPI.quotesConvertToPo({ quoteId, subcontractorId });
      if (r.success && r.id) {
        toast.success(r.reference ? `Bon de commande créé (${r.reference})` : "BdC créé");
        onClose();
        navigate(`/purchase-orders/${r.id}`);
      } else {
        toast.error(r.error || "Erreur lors de la conversion");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setConverting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <Hammer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Convertir en bon de commande</h2>
                  <p className="text-xs text-muted-foreground">À partir du devis {quoteReference}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-xs">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">{quoteReference}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Nouveau BdC</span>
              </div>

              <div>
                <Label>Sous-traitant *</Label>
                <select
                  value={subcontractorId}
                  onChange={(e) => setSubcontractorId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  autoFocus
                >
                  <option value="">— Sélectionnez le sous-traitant —</option>
                  {subcontractors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName}
                    </option>
                  ))}
                </select>
                {subcontractors.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Aucun sous-traitant. Créez-en un d'abord dans la page Sous-traitants.
                  </p>
                )}
              </div>

              <div className="bg-blue-500/5 border border-blue-500/30 rounded-md p-2.5 text-[11px] text-muted-foreground">
                <p>
                  <strong className="text-foreground">Que se passe-t-il :</strong> un nouveau bon de commande est créé en brouillon avec
                  les lignes du devis (les sections sont ignorées). Le devis original n'est pas modifié.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleConvert} loading={converting} disabled={!subcontractorId}>
                <Hammer className="w-4 h-4" />
                Créer le BdC
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
