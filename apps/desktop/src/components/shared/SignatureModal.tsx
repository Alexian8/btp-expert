import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eraser, PenLine, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad, type SignaturePadRef } from "@/components/shared/SignaturePad";

// ═══════════════════════════════════════════════════════════════════════════
// SignatureModal — Capture de signature pour PV ouverture/réception
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  kind: "start" | "end";
  defaultSignerName?: string;
  onClose: () => void;
  onValidate: (data: { signerName: string; signerRole: string; signatureDataUrl: string; notes: string }) => Promise<void>;
}

export function SignatureModal({ open, kind, defaultSignerName = "", onClose, onValidate }: Props) {
  const padRef = useRef<SignaturePadRef>(null);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerRole, setSignerRole] = useState("Maître d'ouvrage");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleClear = () => {
    padRef.current?.clear();
  };

  const handleValidate = async () => {
    if (!signerName.trim()) {
      toast.error("Le nom du signataire est requis");
      return;
    }
    const dataUrl = padRef.current?.getDataUrl();
    if (!dataUrl) {
      toast.error("Veuillez apposer votre signature avant de valider");
      return;
    }
    setSaving(true);
    try {
      await onValidate({
        signerName: signerName.trim(),
        signerRole: signerRole.trim(),
        signatureDataUrl: dataUrl,
        notes: notes.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const title = kind === "start" ? "Signature du PV d'ouverture" : "Signature du PV de réception";
  const description = kind === "start"
    ? "Le client signe pour confirmer l'ouverture du chantier et valider les conditions"
    : "Le client signe pour réceptionner les travaux et valider leur bonne exécution";

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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-2xl w-full max-h-[95vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <PenLine className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nom du signataire *</Label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="M. Jean Dupont"
                  />
                </div>
                <div>
                  <Label>Fonction</Label>
                  <Input
                    value={signerRole}
                    onChange={(e) => setSignerRole(e.target.value)}
                    placeholder="Maître d'ouvrage"
                  />
                </div>
              </div>

              <div>
                <Label>
                  Signature *
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    (souris, trackpad ou écran tactile)
                  </span>
                </Label>
                <div className="mt-1 flex justify-center bg-muted/20 rounded-md p-3">
                  <SignaturePad ref={padRef} width={560} height={200} />
                </div>
                <div className="flex justify-end mt-2">
                  <Button variant="outline" size="sm" onClick={handleClear}>
                    <Eraser className="w-3.5 h-3.5" />
                    Effacer
                  </Button>
                </div>
              </div>

              <div>
                <Label>Notes / Réserves</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Réserves éventuelles, commentaires..."
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleValidate} loading={saving}>
                <Save className="w-4 h-4" />
                Valider la signature
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
