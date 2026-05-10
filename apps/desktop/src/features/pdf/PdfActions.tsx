import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Eye, Download, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// PdfActions — Boutons "Aperçu" + "Télécharger" pour un document PDF généré
// par @react-pdf/renderer.
//
// Usage :
//   <PdfActions
//     document={<QuotePdfDocument quote={quote} client={client} />}
//     fileName="DEVIS-2025-001.pdf"
//   />
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  /** Le composant PDF (élément React) à rendre. */
  document: React.ReactElement;
  /** Nom du fichier au téléchargement (.pdf). */
  fileName: string;
  /** Callback optionnel après un téléchargement réussi (utile pour auto-save vault). */
  onDownloaded?: (blob: Blob) => void;
  /** Affichage compact (icônes seules) si true. */
  compact?: boolean;
}

export function PdfActions({ document: doc, fileName, onDownloaded, compact = false }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "download" | null>(null);

  async function generateBlob(): Promise<Blob> {
    return await pdf(doc).toBlob();
  }

  async function handlePreview() {
    if (loading) return;
    setLoading("preview");
    try {
      const blob = await generateBlob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setLoading(null);
    }
  }

  async function handleDownload() {
    if (loading) return;
    setLoading("download");
    try {
      const blob = await generateBlob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      // Cleanup avec un petit délai pour laisser le download partir
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onDownloaded?.(blob);
      toast.success("PDF téléchargé");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setLoading(null);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size={compact ? "icon" : "default"}
          onClick={handlePreview}
          disabled={loading !== null}
          title="Aperçu PDF"
        >
          {loading === "preview" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
          {!compact && <span>Aperçu</span>}
        </Button>
        <Button
          size={compact ? "icon" : "default"}
          onClick={handleDownload}
          disabled={loading !== null}
          title="Télécharger PDF"
        >
          {loading === "download" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {!compact && <span>Télécharger PDF</span>}
        </Button>
      </div>

      {/* Modal preview avec iframe PDF */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-soft-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </Button>
                <Button variant="ghost" size="icon" onClick={closePreview} title="Fermer">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              title="Aperçu PDF"
              className="flex-1 w-full bg-muted/20 border-none"
            />
          </div>
        </div>
      )}
    </>
  );
}
