import { createPortal } from "react-dom";
import { FileText, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// PdfPreviewPortal — modal d'aperçu PDF (iframe plein écran).
// Rendu via React Portal pour échapper aux containing blocks créés par
// framer-motion / transform. À monter une seule fois dans la page consommatrice.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  previewUrl: string | null;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}

export function PdfPreviewPortal({ previewUrl, fileName, onClose, onDownload }: Props) {
  if (!previewUrl) return null;
  return createPortal(
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-soft-xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Télécharger</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="Fermer">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <iframe
          src={previewUrl}
          title="Aperçu PDF"
          className="flex-1 w-full border-none bg-white"
          style={{ minHeight: 0 }}
        />
      </div>
    </div>,
    document.body
  );
}
