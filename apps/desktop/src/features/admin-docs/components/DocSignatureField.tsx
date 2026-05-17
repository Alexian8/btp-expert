import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, X, Eraser, Save, CheckCircle2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SignaturePad,
  type SignaturePadRef,
} from "@/components/shared/SignaturePad";
import { getActiveSignatureService } from "../lib/signatureService";

// ═══════════════════════════════════════════════════════════════════════════
// DocSignatureField — Champ de signature réutilisable pour les CERFA.
//
// Affiche soit l'aperçu de la signature (PNG embarqué) soit un bouton
// "Signer" qui ouvre une modal avec un canvas. Compatible avec un futur
// provider externe (Yousign) via signatureService.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  label: string;
  description?: string;
  /** Data URL PNG actuelle (vide si pas encore signé). */
  value: string;
  /** Appelé avec la nouvelle data URL après validation. */
  onChange: (dataUrl: string) => void;
  /** Lecture seule (document déjà archivé/scellé). */
  disabled?: boolean;
}

export function DocSignatureField({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const service = getActiveSignatureService();
  const isCanvas = service.provider === "canvas";

  return (
    <div>
      <Label>{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5 mb-1">{description}</p>
      )}

      {value ? (
        <div className="flex items-start gap-3 p-3 border border-border rounded-md bg-muted/20">
          <img
            src={value}
            alt="Signature"
            className="max-h-20 max-w-[12rem] object-contain bg-white rounded border border-border"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Signature apposée
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isCanvas ? "Signature manuscrite locale" : `Signée via ${service.provider}`}
            </p>
          </div>
          {!disabled && (
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
              >
                <PenLine className="w-3.5 h-3.5" />
                Refaire
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange("")}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Effacer
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="w-full justify-center"
        >
          <PenLine className="w-4 h-4" />
          Signer ce document
        </Button>
      )}

      {open && (
        <CanvasSignatureModal
          title={label}
          initialDataUrl={value}
          onClose={() => setOpen(false)}
          onValidate={(dataUrl) => {
            onChange(dataUrl);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal de capture canvas ────────────────────────────────────────────────
function CanvasSignatureModal({
  title,
  initialDataUrl,
  onClose,
  onValidate,
}: {
  title: string;
  initialDataUrl?: string;
  onClose: () => void;
  onValidate: (dataUrl: string) => void;
}) {
  const padRef = useRef<SignaturePadRef>(null);
  const [empty, setEmpty] = useState(true);

  const handleClear = () => {
    padRef.current?.clear();
    setEmpty(true);
  };

  const handleValidate = () => {
    const dataUrl = padRef.current?.getDataUrl();
    if (!dataUrl) return;
    onValidate(dataUrl);
  };

  return (
    <AnimatePresence>
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
          className="bg-card border border-border rounded-lg shadow-soft-xl max-w-2xl w-full"
        >
          <div className="flex items-start justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <PenLine className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="text-xs text-muted-foreground">
                  Signez avec la souris, un trackpad ou un écran tactile.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4">
            <div
              className="flex justify-center bg-muted/20 rounded-md p-3"
              onPointerUp={() => setEmpty(padRef.current?.isEmpty() ?? true)}
            >
              <SignaturePad
                ref={padRef}
                width={560}
                height={200}
                initialDataUrl={initialDataUrl}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-muted-foreground">
                La signature sera embarquée dans le PDF généré.
              </p>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Eraser className="w-3.5 h-3.5" />
                Effacer
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleValidate} disabled={empty}>
              <Save className="w-4 h-4" />
              Valider la signature
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
