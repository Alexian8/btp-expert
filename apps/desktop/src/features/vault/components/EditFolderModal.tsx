import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Folder } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVaultStore } from "@/stores/vaultStore";
import {
  VAULT_FOLDER_ICONS, VAULT_FOLDER_COLORS,
  type VaultFolder,
} from "@btp/types";
import { getFolderIcon, getFolderColorClass, FOLDER_BG_TW } from "../vaultIcons";

// ═══════════════════════════════════════════════════════════════════════════
// EditFolderModal — Créer ou modifier un dossier
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  // null = création ; folder = édition
  folder: VaultFolder | null;
  parentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditFolderModal({ open, folder, parentId, onClose, onSuccess }: Props) {
  const createFolder = useVaultStore((s) => s.createFolder);
  const updateFolder = useVaultStore((s) => s.updateFolder);
  const isEditing = !!folder;

  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState("folder");
  const [colorKey, setColorKey] = useState("default");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (folder) {
        setName(folder.name);
        setIconKey(folder.iconKey);
        setColorKey(folder.colorKey);
        setDescription(folder.description || "");
      } else {
        setName("");
        setIconKey("folder");
        setColorKey("default");
        setDescription("");
      }
    }
  }, [open, folder]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setSaving(true);
    let r;
    if (folder) {
      r = await updateFolder(folder.id, { name, iconKey, colorKey, description });
    } else {
      r = await createFolder({ name, iconKey, colorKey, description, parentId });
    }
    setSaving(false);
    if (r.success) {
      toast.success(folder ? "Dossier modifié" : "Dossier créé");
      onSuccess();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const PreviewIcon = getFolderIcon(iconKey);
  const previewColorClass = getFolderColorClass(colorKey);

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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold">
                {isEditing ? "Modifier le dossier" : "Nouveau dossier"}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              {/* Aperçu */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", FOLDER_BG_TW[colorKey] || FOLDER_BG_TW.default)}>
                  <PreviewIcon className="w-5 h-5" />
                </div>
                <div className="text-sm font-medium">{name || "Nouveau dossier"}</div>
              </div>

              <div>
                <Label htmlFor="name">Nom du dossier *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Assurances 2026"
                  className="mt-1.5"
                  autoFocus
                />
              </div>

              <div>
                <Label>Icône</Label>
                <div className="grid grid-cols-6 gap-1.5 mt-1.5">
                  {VAULT_FOLDER_ICONS.map((opt) => {
                    const Icon = getFolderIcon(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setIconKey(opt.key)}
                        className={cn(
                          "aspect-square rounded-md flex items-center justify-center border transition-all",
                          iconKey === opt.key
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent text-muted-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Couleur</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {VAULT_FOLDER_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setColorKey(c.key)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        colorKey === c.key ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
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
                  placeholder="Notes sur ce dossier..."
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} loading={saving}>
                <Save className="w-4 h-4" />
                {isEditing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
