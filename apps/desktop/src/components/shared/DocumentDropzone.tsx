import { useState, useRef, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// DocumentDropzone — Zone de drop de fichiers (drag & drop Windows → app)
//
// Accepte :
//   - Drag depuis l'explorateur Windows/Mac (n'importe quel fichier)
//   - Clic pour ouvrir le dialog Electron (fallback)
//
// Electron expose le path natif via `file.path`, on l'envoie au backend
// qui copie le fichier dans le userData.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  chantierId: string;
  category?: string;
  onUploaded: (docs: any[]) => void;
  compact?: boolean;
}

export function DocumentDropzone({ chantierId, category = "Autre", onUploaded, compact = false }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dragCounter = useRef(0);

  // ─── Drag events ─────────────────────────────────────────────────────
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;

    if (!window.btpAPI?.chantierDocsAdd) {
      toast.error("API indisponible");
      return;
    }

    setUploading(true);
    const uploaded: any[] = [];
    for (const file of files) {
      // Dans Electron, File.path est le chemin système complet
      const sourcePath = (file as any).path;
      if (!sourcePath) {
        toast.error(`Impossible de lire le chemin du fichier : ${file.name}`);
        continue;
      }
      const result = await window.btpAPI.chantierDocsAdd({
        chantierId,
        sourcePath,
        originalName: file.name,
        mimeType: file.type,
        category,
      });
      if (result.success && result.document) {
        uploaded.push(result.document);
      } else {
        toast.error(`${file.name} : ${result.error || "Échec"}`);
      }
    }
    setUploading(false);
    if (uploaded.length > 0) {
      toast.success(
        uploaded.length === 1
          ? `Document ajouté : ${uploaded[0].name}`
          : `${uploaded.length} documents ajoutés`
      );
      onUploaded(uploaded);
    }
  };

  // ─── Fallback : dialog natif ─────────────────────────────────────────
  const handleClickUpload = async () => {
    if (!window.btpAPI?.chantierDocsUploadViaDialog) return;
    setUploading(true);
    const result = await window.btpAPI.chantierDocsUploadViaDialog({ chantierId, category });
    setUploading(false);
    if (result.success && result.documents && result.documents.length > 0) {
      toast.success(
        result.documents.length === 1
          ? `Document ajouté`
          : `${result.documents.length} documents ajoutés`
      );
      onUploaded(result.documents);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-all",
        dragging
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/40",
        compact ? "p-4" : "p-8",
      )}
    >
      <div className="text-center">
        <div className={cn(
          "mx-auto rounded-full flex items-center justify-center mb-3 transition-colors",
          dragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
          compact ? "w-10 h-10" : "w-14 h-14"
        )}>
          {uploading ? (
            <Loader2 className={cn(compact ? "w-5 h-5" : "w-6 h-6", "animate-spin")} />
          ) : (
            <Upload className={compact ? "w-5 h-5" : "w-6 h-6"} />
          )}
        </div>

        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          {uploading
            ? "Envoi en cours..."
            : dragging
            ? "Déposez vos fichiers ici"
            : "Glissez-déposez vos fichiers"}
        </p>

        {!compact && !uploading && (
          <>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, images, Word, Excel, ZIP... Tout format accepté
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClickUpload}
              className="mt-3"
            >
              <FileText className="w-3.5 h-3.5" />
              ou cliquez pour parcourir
            </Button>
          </>
        )}

        {compact && !uploading && (
          <button
            type="button"
            onClick={handleClickUpload}
            className="text-xs text-primary hover:underline mt-1"
          >
            ou parcourir
          </button>
        )}
      </div>

      {/* Overlay visuel quand on drag sur la zone */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-lg pointer-events-none ring-2 ring-primary ring-offset-2 ring-offset-background"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
