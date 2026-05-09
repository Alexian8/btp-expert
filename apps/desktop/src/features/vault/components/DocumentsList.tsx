import { motion } from "framer-motion";
import {
  FileText, Image as ImageIcon, FileSpreadsheet, FileType,
  File as FileIcon, Eye, Download, MoreVertical, Trash2,
  Tag as TagIcon, Calendar, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVaultStore } from "@/stores/vaultStore";
import { formatFileSize, type VaultDocumentWithTags, isImageMimeType, isPdfMimeType, isExpiringSoon, isExpired } from "@btp/types";
import { FOLDER_BG_TW } from "../vaultIcons";

// ═══════════════════════════════════════════════════════════════════════════
// DocumentsList — Liste des documents (cards format)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  documents: VaultDocumentWithTags[];
  isLoading: boolean;
  onPreview: (doc: VaultDocumentWithTags) => void;
  onEdit: (doc: VaultDocumentWithTags) => void;
}

export function DocumentsList({ documents, isLoading, onPreview, onEdit }: Props) {
  const trashDocument = useVaultStore((s) => s.trashDocument);

  const handleDownload = async (doc: VaultDocumentWithTags) => {
    if (!window.btpAPI?.vaultDownloadDocument) return;
    const r = await window.btpAPI.vaultDownloadDocument(doc.id);
    if (r.success) toast.success("Document téléchargé");
    else if (!r.cancelled) toast.error(r.error || "Erreur");
  };

  const handleOpenExternal = async (doc: VaultDocumentWithTags) => {
    if (!window.btpAPI?.vaultOpenDocumentExternal) return;
    const r = await window.btpAPI.vaultOpenDocumentExternal(doc.id);
    if (!r.success) toast.error(r.error || "Erreur");
  };

  const handleTrash = async (doc: VaultDocumentWithTags) => {
    if (!confirm(`Mettre "${doc.fileName}" dans la corbeille ?\n\n(Restaurable pendant 30 jours)`)) return;
    const r = await trashDocument(doc.id);
    if (r.success) {
      toast.success("Document mis dans la corbeille");
      // Le store fetchStats() est appelé automatiquement, mais il faut aussi refetch les docs
      const folderId = doc.folderId;
      await useVaultStore.getState().fetchDocuments(folderId);
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Chargement...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">Aucun document ici</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Glissez-déposez des fichiers ou cliquez sur le bouton "Ajouter" en haut à droite.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {documents.map((doc, idx) => (
        <motion.div
          key={doc.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(idx * 0.02, 0.3) }}
          onClick={() => onPreview(doc)}
          className="group bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3">
            <FileIconView mimeType={doc.mimeType} />

            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate" title={doc.fileName}>
                {doc.fileName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}
              </p>

              {doc.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
              )}

              {/* Tags */}
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {doc.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag.id}
                      className={cn(
                        "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded",
                        FOLDER_BG_TW[tag.colorKey] || FOLDER_BG_TW.default
                      )}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {doc.tags.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 4}</span>
                  )}
                </div>
              )}

              {/* Date d'expiration */}
              {doc.expirationDate && (
                <div className={cn(
                  "flex items-center gap-1 mt-2 text-[11px]",
                  isExpired(doc.expirationDate) && "text-rose-500 font-medium",
                  isExpiringSoon(doc.expirationDate) && !isExpired(doc.expirationDate) && "text-amber-500 font-medium",
                  !isExpiringSoon(doc.expirationDate) && !isExpired(doc.expirationDate) && "text-muted-foreground"
                )}>
                  {(isExpired(doc.expirationDate) || isExpiringSoon(doc.expirationDate))
                    ? <AlertCircle className="w-3 h-3" />
                    : <Calendar className="w-3 h-3" />}
                  Expire le {formatDate(doc.expirationDate)}
                </div>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(doc); }}>
                  <Eye className="w-3.5 h-3.5" />
                  Aperçu
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenExternal(doc); }}>
                  <FileIcon className="w-3.5 h-3.5" />
                  Ouvrir avec...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}>
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(doc); }}>
                  <TagIcon className="w-3.5 h-3.5" />
                  Modifier (tags, infos)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTrash(doc); }} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                  Mettre dans la corbeille
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function FileIconView({ mimeType }: { mimeType: string }) {
  let Icon = FileIcon;
  let bg = "bg-slate-500/15 text-slate-500";
  if (isImageMimeType(mimeType)) { Icon = ImageIcon; bg = "bg-emerald-500/15 text-emerald-500"; }
  else if (isPdfMimeType(mimeType)) { Icon = FileText; bg = "bg-rose-500/15 text-rose-500"; }
  else if (mimeType.includes("word") || mimeType.includes("text")) { Icon = FileType; bg = "bg-blue-500/15 text-blue-500"; }
  else if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) { Icon = FileSpreadsheet; bg = "bg-emerald-500/15 text-emerald-500"; }
  return (
    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", bg)}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return iso; }
}
