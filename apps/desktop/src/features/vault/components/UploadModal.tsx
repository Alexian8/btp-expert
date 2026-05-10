import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Tag as TagIcon, Calendar as CalendarIcon, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVaultStore } from "@/stores/vaultStore";
import { TagPicker } from "./TagPicker";

// ═══════════════════════════════════════════════════════════════════════════
// UploadModal — Modal d'upload de fichiers (web-native)
//
// Reçoit des File[] natifs depuis VaultPage (drag-drop ou input file).
// Pour chaque fichier : POST /api/vault/upload avec le blob en body.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  folderId: string;
  files: File[];
  onClose: () => void;
  onSuccess: () => void;
  /** Liens automatiques (utilisé quand on upload depuis un chantier/client). */
  context?: {
    chantierId?: string;
    clientId?: string;
    quoteId?: string;
    invoiceId?: string;
    category?: string;
  };
}

export function UploadModal({ open, folderId, files, onClose, onSuccess, context }: Props) {
  const uploadDocument = useVaultStore((s) => s.uploadDocument);
  const [description, setDescription] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleSubmit = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: files.length });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const r = await uploadDocument({
        folderId,
        file,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        description: i === 0 ? description : "",
        expirationDate,
        tags: selectedTagIds.map((id) => ({ id })),
        ...(context ?? {}),
      });
      if (r.success) successCount++;
      else {
        errorCount++;
        if (r.error) errors.push(`${file.name}: ${r.error}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} fichier(s) ajouté(s) au coffre-fort`);
    if (errorCount > 0) {
      toast.error(`${errorCount} fichier(s) en erreur`, {
        description: errors[0]?.slice(0, 200),
      });
    }

    onSuccess();
    onClose();
    setDescription("");
    setExpirationDate("");
    setSelectedTagIds([]);
  };

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <AnimatePresence>
      {open && (
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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Ajouter au coffre-fort</h2>
                  <p className="text-xs text-muted-foreground">
                    {files.length} fichier{files.length > 1 ? "s" : ""} · {fmtSize(totalSize)}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} disabled={uploading}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Liste fichiers */}
              <div>
                <Label className="text-xs">Fichiers sélectionnés</Label>
                <div className="mt-1.5 max-h-40 overflow-y-auto bg-muted rounded-md p-2 space-y-1">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground tabular-nums">{fmtSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="desc">Description (optionnel)</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Notes pour retrouver facilement ce document..."
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="expiration">
                  Date d'expiration (assurances, qualifications, attestations…)
                </Label>
                <div className="relative mt-1.5">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="expiration"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-1.5">
                  <TagIcon className="w-3.5 h-3.5" />
                  Tags (mots-clés pour la recherche)
                </Label>
                <div className="mt-1.5">
                  <TagPicker
                    selectedTagIds={selectedTagIds}
                    onChange={setSelectedTagIds}
                  />
                </div>
              </div>

              {uploading && (
                <div className="bg-muted rounded-md p-3 text-center text-xs text-muted-foreground">
                  Upload en cours : {progress.done} / {progress.total}
                  <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose} disabled={uploading}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} loading={uploading} disabled={files.length === 0}>
                <Upload className="w-4 h-4" />
                Ajouter au coffre-fort
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
