import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Pencil, BookOpen, X, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useLibraryStore } from "@/stores/libraryStore";
import { SettingsSectionWrapper } from "./SettingsPage";
import {
  LIBRARY_CATEGORIES, VAT_RATES, QUOTE_UNITS,
  EMPTY_LIBRARY_ITEM, type LibraryItem, type VatRate,
} from "@btp/types";
import { formatEuros } from "@/features/quotes/quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// LibrarySection — Gestion de la bibliothèque de prestations récurrentes
// ═══════════════════════════════════════════════════════════════════════════

export function LibrarySection() {
  const { items, fetch, create, update, delete: deleteItem } = useLibraryStore();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => { fetch(); }, []);

  const filtered = items.filter((it) => {
    if (categoryFilter !== "all" && it.category !== categoryFilter) return false;
    if (search.trim()) {
      const hay = `${it.title} ${it.description} ${it.category}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (it: LibraryItem) => {
    setEditing(it);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    await deleteItem(confirmDel);
    setConfirmDel(null);
    toast.success("Prestation supprimée");
  };

  return (
    <div className="space-y-6">
      <SettingsSectionWrapper
        title="Bibliothèque de prestations"
        description="Stockez vos prestations récurrentes pour les insérer rapidement dans vos devis (gain de temps énorme)."
      >
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9"
            />
          </div>
          <NativeSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-auto min-w-[160px]"
          >
            <option value="all">Toutes catégories</option>
            {LIBRARY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </NativeSelect>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4" />
            Nouvelle prestation
          </Button>
        </div>

        {/* Liste */}
        {items.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-lg">
            <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Aucune prestation pour l'instant</p>
            <Button onClick={handleNew} size="sm">
              <Plus className="w-3.5 h-3.5" />
              Ajouter ma première prestation
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune prestation ne correspond aux filtres.
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((it) => (
              <div
                key={it.id}
                className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-medium">{it.title}</p>
                    {it.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {it.category}
                      </span>
                    )}
                    {it.usageCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        · utilisée {it.usageCount} fois
                      </span>
                    )}
                  </div>
                  {it.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatEuros(it.unitPriceHT)}</p>
                  <p className="text-[10px] text-muted-foreground">/ {it.unit} · TVA {it.vatRate}%</p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(it)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirmDel(it.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSectionWrapper>

      <LibraryFormModal
        open={formOpen}
        item={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onCancel={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title="Supprimer cette prestation ?"
        description="Elle disparaîtra de la bibliothèque mais ne touchera pas les devis déjà créés."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

// ─── Modal de création/édition ──────────────────────────────────────────
function LibraryFormModal({
  open, item, onClose,
}: {
  open: boolean;
  item: LibraryItem | null;
  onClose: () => void;
}) {
  const { create, update } = useLibraryStore();
  const [data, setData] = useState({ ...EMPTY_LIBRARY_ITEM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (item) {
        const { id, usageCount, createdAt, updatedAt, ...rest } = item;
        setData({ ...EMPTY_LIBRARY_ITEM, ...rest });
      } else {
        setData({ ...EMPTY_LIBRARY_ITEM });
      }
    }
  }, [open, item]);

  const update_ = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const handleSave = async () => {
    if (!data.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    setSaving(true);
    const r = item ? await update(item.id, data) : await create(data);
    setSaving(false);
    if (r.success) {
      toast.success(item ? "Prestation mise à jour" : "Prestation créée");
      onClose();
    } else {
      toast.error(r.error || "Erreur");
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
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                {item ? "Modifier la prestation" : "Nouvelle prestation"}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <Label>Titre *</Label>
                <Input
                  value={data.title}
                  onChange={(e) => update_("title", e.target.value)}
                  placeholder="Ex: Pose carrelage 30×30"
                />
              </div>
              <div>
                <Label>Catégorie</Label>
                <NativeSelect
                  value={data.category}
                  onChange={(e) => update_("category", e.target.value)}
                >
                  <option value="">— Aucune —</option>
                  {LIBRARY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Description détaillée</Label>
                <Textarea
                  value={data.description}
                  onChange={(e) => update_("description", e.target.value)}
                  rows={3}
                  placeholder="Fournitures comprises : carrelage, colle, joints. Pose droite ou en diagonale."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Unité</Label>
                  <NativeSelect
                    value={data.unit}
                    onChange={(e) => update_("unit", e.target.value)}
                  >
                    {QUOTE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </NativeSelect>
                </div>
                <div>
                  <Label>Prix HT</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.unitPriceHT || ""}
                    onChange={(e) => update_("unitPriceHT", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>TVA</Label>
                  <NativeSelect
                    value={String(data.vatRate)}
                    onChange={(e) => update_("vatRate", Number(e.target.value) as VatRate)}
                  >
                    {VAT_RATES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </NativeSelect>
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
