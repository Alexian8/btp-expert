import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// usePdfActions — hook qui encapsule toute la logique des actions PDF :
//   - choix du template (avec persistance localStorage)
//   - aperçu (génère un blob URL, à brancher sur un modal)
//   - téléchargement
//   - sauvegarde dans le coffre-fort
//
// Permet à plusieurs UI (boutons en barre, items de dropdown, sheet mobile…)
// de partager les mêmes handlers sans dupliquer la logique.
// ═══════════════════════════════════════════════════════════════════════════

export interface VaultContext {
  chantierId?: string;
  clientId?: string;
  quoteId?: string;
  invoiceId?: string;
  category?: string;
}

export interface UsePdfActionsOptions {
  /** Mode 1 template : passer le composant directement. */
  document?: React.ReactElement;
  /** Mode multi-templates : map { key: ReactElement }. */
  templates?: Record<string, React.ReactElement>;
  /** Clé localStorage pour persister le choix de template. */
  persistKey?: string;
  /** Template par défaut. */
  defaultTemplate?: string;
  /** Nom du fichier PDF (.pdf). */
  fileName: string;
  /** Callback optionnel après un téléchargement réussi. */
  onDownloaded?: (blob: Blob) => void;
  /** Si défini, active le bouton "coffre". */
  vaultContext?: VaultContext;
}

export interface UsePdfActionsResult {
  templateKeys: string[];
  selectedTemplate: string;
  setSelectedTemplate: (key: string) => void;
  activeDoc: React.ReactElement | null;
  loading: "preview" | "download" | "vault" | null;
  previewUrl: string | null;
  savedToVault: boolean;
  handlePreview: () => Promise<void>;
  handleDownload: () => Promise<void>;
  handleSaveToVault: () => Promise<void>;
  closePreview: () => void;
  hasVault: boolean;
}

export function usePdfActions(opts: UsePdfActionsOptions): UsePdfActionsResult {
  const { document: doc, templates, persistKey, defaultTemplate, fileName, onDownloaded, vaultContext } = opts;

  const templateKeys = templates ? Object.keys(templates) : [];
  const initial = (() => {
    if (!templates) return "";
    if (persistKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`btp.pdf.${persistKey}`);
        if (saved && templates[saved]) return saved;
      } catch {}
    }
    return defaultTemplate ?? templateKeys[0] ?? "";
  })();
  const [selectedTemplate, setSelectedTemplateState] = useState(initial);
  const setSelectedTemplate = (k: string): void => {
    setSelectedTemplateState(k);
    if (persistKey) {
      try { localStorage.setItem(`btp.pdf.${persistKey}`, k); } catch {}
    }
  };

  const activeDoc: React.ReactElement | null = templates
    ? (templates[selectedTemplate] ?? null)
    : (doc ?? null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "download" | "vault" | null>(null);
  const [savedToVault, setSavedToVault] = useState(false);

  async function generateBlob(): Promise<Blob> {
    if (!activeDoc) throw new Error("Aucun template PDF disponible");
    return await pdf(activeDoc).toBlob();
  }

  async function handlePreview(): Promise<void> {
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

  async function handleDownload(): Promise<void> {
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

  async function handleSaveToVault(): Promise<void> {
    if (loading || !vaultContext) return;
    setLoading("vault");
    try {
      const blob = await generateBlob();
      const api = window.btpAPI as
        | {
            vaultUploadDocument?: (params: {
              folderId?: string;
              file?: Blob;
              fileName?: string;
              mimeType?: string;
              description?: string;
              category?: string;
              chantierId?: string;
              clientId?: string;
              quoteId?: string;
              invoiceId?: string;
            }) => Promise<{ success: boolean; id?: string; error?: string }>;
          }
        | undefined;
      if (!api?.vaultUploadDocument) {
        toast.error("Coffre-fort indisponible");
        return;
      }
      const r = await api.vaultUploadDocument({
        file: blob,
        fileName,
        mimeType: "application/pdf",
        description: `Généré depuis BatiDesk le ${new Date().toLocaleString("fr-FR")}`,
        category: vaultContext.category ?? "generated_pdf",
        chantierId: vaultContext.chantierId,
        clientId: vaultContext.clientId,
        quoteId: vaultContext.quoteId,
        invoiceId: vaultContext.invoiceId,
      });
      if (r.success) {
        setSavedToVault(true);
        toast.success("PDF rangé dans le coffre-fort");
        setTimeout(() => setSavedToVault(false), 4000);
      } else {
        toast.error(r.error || "Échec sauvegarde");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(null);
    }
  }

  function closePreview(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  return {
    templateKeys,
    selectedTemplate,
    setSelectedTemplate,
    activeDoc,
    loading,
    previewUrl,
    savedToVault,
    handlePreview,
    handleDownload,
    handleSaveToVault,
    closePreview,
    hasVault: !!vaultContext,
  };
}

export const PDF_TEMPLATE_LABELS: Record<string, string> = {
  modern: "Moderne (couleur)",
  sobre: "Sobre (noir & blanc)",
  classique: "Classique BTP (Times serif)",
};
