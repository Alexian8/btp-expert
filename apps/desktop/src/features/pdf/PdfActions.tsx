import { useState } from "react";
import { createPortal } from "react-dom";
import { pdf } from "@react-pdf/renderer";
import { Eye, Download, FileText, X, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// PdfActions — Boutons "Aperçu" + "Télécharger" + sélecteur de template
//
// Supporte 1 ou plusieurs templates ; le choix est persisté en localStorage.
//
// Usage simple (1 template) :
//   <PdfActions document={<QuotePdfDocument ... />} fileName="DEVIS-001.pdf" />
//
// Usage multi-templates :
//   <PdfActions
//     templates={{
//       modern:  <QuotePdfDocument quote={q} client={c} company={co} />,
//       sobre:   <QuotePdfMinimal  quote={q} client={c} company={co} />,
//     }}
//     persistKey="quote-pdf-template"
//     fileName="DEVIS-001.pdf"
//   />
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATE_LABELS: Record<string, string> = {
  modern: "Moderne (couleur)",
  sobre: "Sobre (noir & blanc)",
};

interface Props {
  /** Mode 1 template : passer le composant directement. */
  document?: React.ReactElement;
  /** Mode multi-templates : map { key: ReactElement }. */
  templates?: Record<string, React.ReactElement>;
  /** Clé localStorage pour persister le choix de template (multi only). */
  persistKey?: string;
  /** Template par défaut au 1er affichage. */
  defaultTemplate?: string;
  /** Nom du fichier au téléchargement (.pdf). */
  fileName: string;
  /** Callback optionnel après un téléchargement réussi (utile pour auto-save vault). */
  onDownloaded?: (blob: Blob) => void;
  /** Affichage compact (icônes seules) si true. */
  compact?: boolean;
}

export function PdfActions({
  document: doc,
  templates,
  persistKey,
  defaultTemplate,
  fileName,
  onDownloaded,
  compact = false,
}: Props) {
  // Choix de template (persistant si persistKey fourni)
  const templateKeys = templates ? Object.keys(templates) : [];
  const initialTemplate = (() => {
    if (!templates) return "";
    if (persistKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`btp.pdf.${persistKey}`);
        if (saved && templates[saved]) return saved;
      } catch {
        /* ignore */
      }
    }
    return defaultTemplate ?? templateKeys[0] ?? "";
  })();
  const [selectedTemplate, setSelectedTemplateState] = useState(initialTemplate);
  const setSelectedTemplate = (key: string): void => {
    setSelectedTemplateState(key);
    if (persistKey) {
      try {
        localStorage.setItem(`btp.pdf.${persistKey}`, key);
      } catch {
        /* ignore */
      }
    }
  };

  const activeDoc: React.ReactElement | null = templates
    ? templates[selectedTemplate] ?? null
    : doc ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "download" | null>(null);

  async function generateBlob(): Promise<Blob> {
    if (!activeDoc) throw new Error("Aucun template PDF disponible");
    return await pdf(activeDoc).toBlob();
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
      <div className="flex items-center gap-2 flex-wrap">
        {/* Sélecteur de template (visible uniquement si multi-templates) */}
        {templates && templateKeys.length > 1 && (
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-muted-foreground hidden md:inline" />
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-md border border-input bg-background h-9"
              title="Style du PDF"
            >
              {templateKeys.map((k) => (
                <option key={k} value={k}>
                  {TEMPLATE_LABELS[k] ?? k}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button
          variant="outline"
          size={compact ? "icon" : "default"}
          onClick={handlePreview}
          disabled={loading !== null || !activeDoc}
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
          disabled={loading !== null || !activeDoc}
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

      {/* Modal preview avec iframe PDF — Portal pour échapper au containing
          block créé par motion.div / transform de framer-motion */}
      {previewUrl &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-2 sm:p-4"
            onClick={closePreview}
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
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Télécharger</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={closePreview} title="Fermer">
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
        )}
    </>
  );
}
