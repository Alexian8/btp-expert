import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// PdfPreviewModal — Modal d'aperçu de PDF générique (réutilisable)
// Affiche un PDF depuis un chemin local en utilisant l'iframe Chromium intégré.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  pdfPath: string | null;     // chemin absolu vers le PDF
  title: string;              // ex: "DEVIS-2026-0001"
  subtitle?: string;          // ex: "Devis sans titre"
  onClose: () => void;
  onDownload?: () => void;    // si fourni, affiche un bouton "Télécharger"
}

export function PdfPreviewModal({ open, pdfPath, title, subtitle, onClose, onDownload }: Props) {
  // Convertir le chemin Windows en file:// URL pour l'iframe
  const fileUrl = pdfPath
    ? `file:///${pdfPath.replace(/\\/g, "/")}`
    : "";

  const handleOpenExternal = async () => {
    if (!pdfPath) return;
    // Ouvrir avec l'app système par défaut (Edge, Adobe, etc.)
    if (window.btpAPI?.quotesOpenPdfExternal) {
      const r = await window.btpAPI.quotesOpenPdfExternal(pdfPath);
      if (!r?.success) toast.error("Impossible d'ouvrir le fichier");
    }
  };

  return (
    <AnimatePresence>
      {open && pdfPath && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl w-full max-w-5xl h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold truncate">{title}</h2>
                  {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button variant="outline" size="sm" onClick={handleOpenExternal}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir avec...
                </Button>
                {onDownload && (
                  <Button variant="outline" size="sm" onClick={onDownload}>
                    <Download className="w-3.5 h-3.5" />
                    Télécharger
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* PDF iframe */}
            <div className="flex-1 overflow-hidden bg-muted/30">
              <iframe
                src={fileUrl}
                title={title}
                className="w-full h-full border-0"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
