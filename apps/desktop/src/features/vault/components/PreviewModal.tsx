import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  formatFileSize, isImageMimeType, isPdfMimeType,
  type VaultDocumentWithTags,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// PreviewModal — Aperçu d'un document (image ou PDF)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  document: VaultDocumentWithTags | null;
  onClose: () => void;
}

export function PreviewModal({ open, document, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open || !document) return;

    setLoading(true);
    setError("");
    setPreviewUrl("");

    const fetchPreview = async () => {
      if (!window.btpAPI?.vaultGetDocumentPreviewPath) {
        setError("API non disponible");
        setLoading(false);
        return;
      }
      const r = await window.btpAPI.vaultGetDocumentPreviewPath(document.id);
      if (r.success && r.path) {
        // file:// path pour pouvoir l'afficher dans <img> ou <iframe>
        // Sur Windows, les backslashes peuvent poser problème
        const filePath = r.path.replace(/\\/g, "/");
        setPreviewUrl(`file:///${filePath}`);
      } else {
        setError(r.error || "Impossible de générer l'aperçu");
      }
      setLoading(false);
    };
    fetchPreview();
  }, [open, document?.id]);

  const handleDownload = async () => {
    if (!document || !window.btpAPI?.vaultDownloadDocument) return;
    const r = await window.btpAPI.vaultDownloadDocument(document.id);
    if (r.success) toast.success("Document téléchargé");
    else if (!r.cancelled) toast.error(r.error || "Erreur");
  };

  const handleOpenExternal = async () => {
    if (!document || !window.btpAPI?.vaultOpenDocumentExternal) return;
    const r = await window.btpAPI.vaultOpenDocumentExternal(document.id);
    if (!r.success) toast.error(r.error || "Erreur");
  };

  if (!document) return null;

  const isImage = isImageMimeType(document.mimeType);
  const isPdf = isPdfMimeType(document.mimeType);
  const isPreviewable = isImage || isPdf;

  return (
    <AnimatePresence>
      {open && (
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
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold truncate" title={document.fileName}>
                  {document.fileName}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatFileSize(document.fileSize)} · {document.mimeType}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button variant="outline" size="sm" onClick={handleOpenExternal}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir avec...
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden bg-muted/30">
              {loading && (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Déchiffrement du fichier...
                </div>
              )}

              {error && !loading && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <FileText className="w-12 h-12" />
                  <p className="text-sm text-rose-500">{error}</p>
                </div>
              )}

              {!loading && !error && previewUrl && isImage && (
                <div className="h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={previewUrl}
                    alt={document.fileName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}

              {!loading && !error && previewUrl && isPdf && (
                <iframe
                  src={previewUrl}
                  title={document.fileName}
                  className="w-full h-full border-0"
                />
              )}

              {!loading && !error && previewUrl && !isPreviewable && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
                  <FileText className="w-12 h-12" />
                  <p className="text-sm text-center max-w-md">
                    Aperçu non disponible pour ce type de fichier.
                    <br />
                    Cliquez sur "Ouvrir avec..." pour consulter avec l'application système.
                  </p>
                </div>
              )}
            </div>

            {/* Footer info */}
            {document.description && (
              <div className="p-4 border-t border-border text-sm text-muted-foreground">
                {document.description}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
