import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientTagsStore } from "@/stores/clientTagsStore";
import { CLIENT_TAG_COLORS, CLIENT_TAG_COLOR_KEYS } from "@/lib/clientHelpers";
import type { ClientTag } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// ClientTagsManager — CRUD des étiquettes clients personnalisables (admin).
// Créer / renommer / choisir la couleur / supprimer. Partagé via settings.
// ═══════════════════════════════════════════════════════════════════════════

function slugId(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `tag-${Math.random().toString(36).slice(2, 7)}`
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ClientTagsManager({ open, onClose }: Props) {
  const { tags, load, save } = useClientTagsStore();
  const [draft, setDraft] = useState<ClientTag[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (open) setDraft(tags.map((t) => ({ ...t })));
  }, [open, tags]);

  const addTag = (): void => {
    const label = newLabel.trim();
    if (!label) return;
    const id = slugId(label);
    if (draft.some((t) => t.id === id)) {
      toast.error("Une étiquette porte déjà ce nom");
      return;
    }
    setDraft((d) => [...d, { id, label, color: newColor }]);
    setNewLabel("");
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    const ok = await save(draft);
    setSaving(false);
    if (ok) {
      toast.success("Étiquettes enregistrées");
      onClose();
    } else {
      toast.error("Échec de l'enregistrement");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-lg w-full max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Tags className="w-5 h-5 text-primary" />
                Étiquettes clients
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose} disabled={saving}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Liste éditable */}
              <div className="space-y-2">
                {draft.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune étiquette. Ajoutez-en une ci-dessous.</p>
                )}
                {draft.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <ColorPicker
                      value={t.color}
                      onChange={(color) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, color } : x)))}
                    />
                    <Input
                      value={t.label}
                      onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Ajout */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <ColorPicker value={newColor} onChange={setNewColor} />
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()}
                  placeholder="Nouvelle étiquette…"
                  className="flex-1"
                />
                <Button variant="outline" onClick={addTag} disabled={!newLabel.trim()}>
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
              <Button onClick={() => void handleSave()} loading={saving}>Enregistrer</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn("w-9 h-9 rounded-md border border-border flex items-center justify-center shrink-0")}
        title="Couleur"
      >
        <span className={cn("w-4 h-4 rounded-full", CLIENT_TAG_COLORS[value]?.dot ?? "bg-slate-400")} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 p-2 grid grid-cols-4 gap-1.5 rounded-md border border-border bg-popover shadow-soft-lg">
          {CLIENT_TAG_COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c);
                setOpen(false);
              }}
              className={cn(
                "w-6 h-6 rounded-full border-2",
                CLIENT_TAG_COLORS[c]?.dot,
                value === c ? "border-foreground" : "border-transparent"
              )}
              title={CLIENT_TAG_COLORS[c]?.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
