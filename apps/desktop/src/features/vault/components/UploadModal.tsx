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
// UploadModal — Modal d'upload avec métadonnées (description, expiration, tags)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  folderId: string;
  filePaths: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadModal({ open, folderId, filePaths, onClose, onSuccess }: Props) {
  const uploadDocument = useVaultStore((s) => s.uploadDocument);
  const [description, setDescription] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleSubmit = async () => {
    if (filePaths.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: filePaths.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const sourcePath = filePaths[i];
      const fileName = sourcePath.split(/[/\\]/).pop() || `Fichier ${i + 1}`;

      const r = await uploadDocument({
        folderId,
        sourcePath,
        fileName,
        description: i === 0 ? description : "", // description sur le 1er seulement si plusieurs
        expirationDate,
        tags: selectedTagIds.map(id => ({ id })),
      });
      if (r.success) successCount++;
      else errorCount++;
      setProgress({ done: i + 1, total: filePaths.length });
    }

    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} fichier(s) ajouté(s)`);
    if (errorCount > 0) toast.error(`${errorCount} fichier(s) en erreur`);

    onSuccess();
    onClose();
    // Reset
    setDescription("");
    setExpirationDate("");
    setSelectedTagIds([]);
  };

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
                    {filePaths.length} fichier{filePaths.length > 1 ? "s" : ""} à chiffrer et stocker
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
                <div className="mt-1.5 max-h-32 overflow-y-auto bg-muted rounded-md p-2 space-y-1">
                  {filePaths.map((p, idx) => {
                    const name = p.split(/[/\\]/).pop() || `Fichier ${idx + 1}`;
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="truncate">{name}</span>
                      </div>
                    );
                  })}
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
                <Label htmlFor="expiration">Date d'expiration (pour assurances, qualifications...)</Label>
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
                  <TagPicker selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} />
                </div>
              </div>

              {uploading && (
                <div className="bg-muted rounded-md p-3 text-center text-xs text-muted-foreground">
                  Chiffrement et stockage : {progress.done} / {progress.total}
                  <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose} disabled={uploading}>Annuler</Button>
              <Button onClick={handleSubmit} loading={uploading}>
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
