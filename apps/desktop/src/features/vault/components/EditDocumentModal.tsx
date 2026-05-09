import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Tag as TagIcon, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVaultStore } from "@/stores/vaultStore";
import { TagPicker } from "./TagPicker";
import type { VaultDocumentWithTags } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// EditDocumentModal — Modifier les métadonnées d'un document
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  document: VaultDocumentWithTags | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditDocumentModal({ open, document, onClose, onSuccess }: Props) {
  const updateDocument = useVaultStore((s) => s.updateDocument);
  const setDocumentTags = useVaultStore((s) => s.setDocumentTags);

  const [fileName, setFileName] = useState("");
  const [description, setDescription] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && document) {
      setFileName(document.fileName || "");
      setDescription(document.description || "");
      setExpirationDate(document.expirationDate || "");
      setSelectedTagIds((document.tags || []).map((t) => t.id));
    }
  }, [open, document?.id]);

  if (!document) return null;

  const handleSave = async () => {
    setSaving(true);
    const r1 = await updateDocument(document.id, {
      fileName,
      description,
      expirationDate,
    });
    const r2 = await setDocumentTags(document.id, selectedTagIds);
    setSaving(false);

    if (r1.success && r2.success) {
      toast.success("Document mis à jour");
      onSuccess();
      onClose();
    } else {
      toast.error(r1.error || r2.error || "Erreur");
    }
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
              <h2 className="text-lg font-semibold">Modifier le document</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <Label htmlFor="filename">Nom affiché</Label>
                <Input
                  id="filename"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nom original : {document.originalFileName}
                </p>
              </div>

              <div>
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="expiration">Date d'expiration</Label>
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
                  Tags
                </Label>
                <div className="mt-1.5">
                  <TagPicker selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} loading={saving}>
                <Save className="w-4 h-4" />
                Enregistrer
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
