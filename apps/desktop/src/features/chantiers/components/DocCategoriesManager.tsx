import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Pencil, Trash2, GripVertical, Check, Lock,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocCategoriesStore, type DocCategory } from "@/stores/chantierDocCategoriesStore";
import { ICON_OPTIONS, COLOR_OPTIONS, getIcon, getColor } from "./docCategoryMeta";

// ═══════════════════════════════════════════════════════════════════════════
// DocCategoriesManager — Gestion des catégories docs chantier (Session 21)
// CRUD complet avec drag&drop, icône et couleur
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DocCategoriesManager({ open, onClose }: Props) {
  const { categories, fetch, create, update, remove, reorder } = useDocCategoriesStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  // ─── Drag & drop ───────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };
  const handleDrop = (toIdx: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === toIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...categories];
    const [moved] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    await reorder(newOrder.map((c) => c.id));
    setDraggedIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold">Catégories de documents</h2>
                <p className="text-xs text-muted-foreground">
                  {categories.length} catégorie{categories.length > 1 ? "s" : ""} · glisser pour réordonner
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  draggable={editingId !== cat.id}
                  onDragStart={handleDragStart(idx)}
                  onDragOver={handleDragOver(idx)}
                  onDrop={handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "border rounded-lg transition-all",
                    draggedIdx === idx && "opacity-30",
                    dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx && "border-primary border-2"
                  )}
                >
                  {editingId === cat.id ? (
                    <CategoryEditor
                      category={cat}
                      onCancel={() => setEditingId(null)}
                      onSave={async (data) => {
                        const r = await update({ id: cat.id, ...data });
                        if (r.success) {
                          toast.success("Catégorie mise à jour");
                          setEditingId(null);
                        } else {
                          toast.error(r.error || "Erreur");
                        }
                      }}
                    />
                  ) : (
                    <CategoryRow
                      category={cat}
                      onEdit={() => setEditingId(cat.id)}
                      onDelete={async () => {
                        const r = await remove(cat.id);
                        if (r.success) {
                          if (r.reassigned && r.reassigned > 0) {
                            toast.success(`Catégorie supprimée. ${r.reassigned} document(s) reclassé(s) en "Autre".`);
                          } else {
                            toast.success("Catégorie supprimée");
                          }
                        } else {
                          toast.error(r.error || "Erreur");
                        }
                      }}
                    />
                  )}
                </div>
              ))}

              {creating ? (
                <div className="border border-dashed border-primary rounded-lg">
                  <CategoryEditor
                    category={{ id: "", name: "", iconKey: "file", colorKey: "slate" } as any}
                    isNew
                    onCancel={() => setCreating(false)}
                    onSave={async (data) => {
                      const r = await create(data);
                      if (r.success) {
                        toast.success("Catégorie créée");
                        setCreating(false);
                      } else {
                        toast.error(r.error || "Erreur");
                      }
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nouvelle catégorie
                </button>
              )}
            </div>

            <div className="p-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
              <p>
                💡 Les catégories par défaut peuvent être renommées et supprimées. Les documents existants seront automatiquement reclassés en "Autre".
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Row affichage normal ──────────────────────────────────────────────────
function CategoryRow({
  category, onEdit, onDelete,
}: {
  category: DocCategory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const Icon = getIcon(category.iconKey);
  const color = getColor(category.colorKey);

  return (
    <div className="flex items-center gap-3 p-2.5">
      <div className="cursor-grab active:cursor-grabbing text-muted-foreground p-1">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
        color.bg, color.text
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium flex items-center gap-2">
          {category.name}
          {category.isSystem && (
            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Par défaut
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Modifier"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirmDel) onDelete();
            else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); }
          }}
          className={cn(
            "p-1.5 rounded transition-colors",
            confirmDel
              ? "bg-red-500/15 text-red-600"
              : "text-muted-foreground hover:bg-accent hover:text-destructive"
          )}
          title={confirmDel ? "Confirmer ?" : "Supprimer"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Editor (création + édition) ───────────────────────────────────────────
function CategoryEditor({
  category, isNew, onCancel, onSave,
}: {
  category: DocCategory;
  isNew?: boolean;
  onCancel: () => void;
  onSave: (data: { name: string; iconKey: string; colorKey: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [iconKey, setIconKey] = useState(category.iconKey || "file");
  const [colorKey, setColorKey] = useState(category.colorKey || "slate");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), iconKey, colorKey });
    setSaving(false);
  };

  const PreviewIcon = getIcon(iconKey);
  const previewColor = getColor(colorKey);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          previewColor.bg, previewColor.text
        )}>
          <PreviewIcon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Nom</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Contrat, Métré, Devis fournisseur..."
            className="mt-1 h-8"
            autoFocus
          />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Icône</Label>
        <div className="grid grid-cols-10 gap-1.5">
          {ICON_OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            return (
              <button
                key={opt.key}
                onClick={() => setIconKey(opt.key)}
                title={opt.label}
                className={cn(
                  "aspect-square rounded-md border flex items-center justify-center transition-all",
                  iconKey === opt.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-accent text-muted-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Couleur</Label>
        <div className="grid grid-cols-10 gap-1.5">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setColorKey(opt.key)}
              title={opt.label}
              className={cn(
                "aspect-square rounded-md border-2 flex items-center justify-center transition-all",
                opt.bg,
                colorKey === opt.key ? opt.border + " ring-2 ring-offset-1 ring-foreground/30" : "border-transparent"
              )}
            >
              {colorKey === opt.key && <Check className={cn("w-3 h-3", opt.text)} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        <Button size="sm" onClick={handleSave} loading={saving}>
          {isNew ? "Créer" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
