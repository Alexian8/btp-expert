import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  AlertCircle,
  Calendar,
  Eye,
  Image as ImageIcon,
  File as FileIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useVaultStore } from "@/stores/vaultStore";
import type { VaultDocumentWithTags } from "@btp/types";
import { formatFileSize } from "@btp/types";
import { UploadModal } from "./UploadModal";

// ═══════════════════════════════════════════════════════════════════════════
// InlineDocumentsSection — Section "Documents" embarquée dans une page
// (Chantier, Client, Sous-traitant…). Affiche la liste des documents liés
// à l'entité + bouton upload + drag-drop.
//
// Filtrage automatique côté serveur : les documents listés sont uniquement
// ceux liés à l'entité via chantierId / clientId / quoteId / invoiceId.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  /** Filtre serveur : un seul de ces 4 doit être défini. */
  chantierId?: string;
  clientId?: string;
  quoteId?: string;
  invoiceId?: string;
  /** Catégorie par défaut au upload. */
  defaultCategory?: string;
  /** Titre de la section (défaut : "Documents"). */
  title?: string;
  /** Description courte (défaut : auto). */
  description?: string;
  /** Permet la suppression (par défaut true). */
  allowDelete?: boolean;
}

export function InlineDocumentsSection({
  chantierId,
  clientId,
  quoteId,
  invoiceId,
  defaultCategory = "upload",
  title = "Documents",
  description,
  allowDelete = true,
}: Props) {
  const [documents, setDocuments] = useState<VaultDocumentWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);

  const trashDocument = useVaultStore((s) => s.trashDocument);

  // Charge les documents liés à l'entité
  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await window.btpAPI?.vaultListDocuments?.({
        chantierId,
        clientId,
        quoteId,
        invoiceId,
      });
      setDocuments(Array.isArray(list) ? (list as VaultDocumentWithTags[]) : []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId, clientId, quoteId, invoiceId]);

  const handleClickAdd = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadFiles(files);
    setUploadOpen(true);
  };

  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    setUploadFiles(files);
    setUploadOpen(true);
  };

  const handleDownload = async (doc: VaultDocumentWithTags): Promise<void> => {
    if (!window.btpAPI?.vaultDownloadDocument) return;
    const r = await window.btpAPI.vaultDownloadDocument(doc.id);
    if (!r.success) toast.error(r.error || "Erreur de téléchargement");
  };

  const handleTrash = async (doc: VaultDocumentWithTags): Promise<void> => {
    if (!confirm(`Mettre à la corbeille "${doc.fileName}" ?`)) return;
    const r = await trashDocument(doc.id);
    if (r.success) {
      toast.success("Document mis à la corbeille");
      await refresh();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleOpen = (doc: VaultDocumentWithTags): void => {
    // Ouvre l'aperçu dans un nouvel onglet via la route preview
    const token = (() => {
      try {
        return localStorage.getItem("btp.web.token");
      } catch {
        return null;
      }
    })();
    if (token) {
      // On fetch en blob et ouvre via URL.createObjectURL (header Auth requis)
      void (async () => {
        try {
          const res = await fetch(
            `/api/vault/documents/${encodeURIComponent(doc.id)}/preview`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) {
            toast.error("Impossible d'ouvrir l'aperçu");
            return;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank", "noopener,noreferrer");
          // Cleanup après 30s pour laisser le temps de l'afficher
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erreur");
        }
      })();
    }
  };

  const inferredDescription =
    description ??
    (chantierId
      ? "Documents liés à ce chantier (plans, photos, contrats…)"
      : clientId
        ? "Documents liés à ce client (devis signés, échanges…)"
        : "Pièces jointes");

  const context = {
    chantierId,
    clientId,
    quoteId,
    invoiceId,
    category: defaultCategory,
  };

  // Pour l'upload : si un chantier/client est lié, on essaie d'utiliser
  // son dossier vault automatique. Sinon racine.
  const folderId = ""; // racine — peut être améliorée plus tard avec auto-folder

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">
              {title}{" "}
              {documents.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({documents.length})
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">{inferredDescription}</p>
          </div>
        </div>
        <Button size="sm" onClick={handleClickAdd}>
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Uploader</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Zone drag-drop + liste */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-md transition-colors",
          isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5"
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 rounded-md pointer-events-none">
            <div className="text-sm font-medium text-primary flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Lâchez pour uploader
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Chargement…
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-md">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p>Aucun document pour l'instant</p>
            <p className="mt-1">
              <button
                onClick={handleClickAdd}
                className="text-primary hover:underline"
              >
                Cliquez pour uploader
              </button>
              {" "}ou glissez-déposez des fichiers ici
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc, idx) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                index={idx}
                onOpen={() => handleOpen(doc)}
                onDownload={() => handleDownload(doc)}
                onTrash={allowDelete ? () => handleTrash(doc) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <UploadModal
        open={uploadOpen}
        folderId={folderId}
        files={uploadFiles}
        onClose={() => {
          setUploadOpen(false);
          setUploadFiles([]);
        }}
        onSuccess={() => void refresh()}
        context={context}
      />
    </div>
  );
}

function DocumentRow({
  doc,
  index,
  onOpen,
  onDownload,
  onTrash,
}: {
  doc: VaultDocumentWithTags;
  index: number;
  onOpen: () => void;
  onDownload: () => void;
  onTrash?: () => void;
}) {
  const isImage = doc.mimeType?.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";
  const Icon = isImage ? ImageIcon : isPdf ? FileText : FileIcon;

  // Expiration warning
  const expWarning = (() => {
    if (!doc.expirationDate) return null;
    try {
      const d = new Date(doc.expirationDate).getTime();
      const now = Date.now();
      const diff = d - now;
      if (diff < 0) return "expired";
      if (diff < 30 * 86400_000) return "soon";
      return null;
    } catch {
      return null;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-accent/40 transition-colors"
    >
      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{doc.fileName}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span>{formatFileSize(doc.fileSize)}</span>
          {doc.expirationDate && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5",
                expWarning === "expired" && "text-rose-500 font-medium",
                expWarning === "soon" && "text-amber-500 font-medium"
              )}
            >
              <Calendar className="w-3 h-3" />
              {expWarning === "expired"
                ? "Expiré"
                : `Expire le ${new Date(doc.expirationDate).toLocaleDateString("fr-FR")}`}
            </span>
          )}
          {doc.description && (
            <span className="truncate hidden sm:inline">· {doc.description}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpen}
          className="h-7 w-7"
          title="Aperçu"
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDownload}
          className="h-7 w-7"
          title="Télécharger"
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
        {onTrash && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onTrash}
            className="h-7 w-7"
            title="Mettre à la corbeille"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
