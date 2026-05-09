import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVaultStore } from "@/stores/vaultStore";
import { FOLDER_BG_TW } from "../vaultIcons";

// ═══════════════════════════════════════════════════════════════════════════
// TagPicker — Composant de sélection / création de tags
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagPicker({ selectedTagIds, onChange }: Props) {
  const tags = useVaultStore((s) => s.tags);
  const createTag = useVaultStore((s) => s.createTag);

  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleTag = (id: string) => {
    if (selectedTagIds.includes(id)) {
      onChange(selectedTagIds.filter((t) => t !== id));
    } else {
      onChange([...selectedTagIds, id]);
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setLoading(true);
    const r = await createTag({ name, colorKey: "default" });
    setLoading(false);
    if (r.success && r.id) {
      onChange([...selectedTagIds, r.id]);
      if (r.alreadyExists) toast.info(`Tag "${name}" existait déjà`);
    } else {
      toast.error(r.error || "Erreur");
    }
    setNewTagName("");
    setCreating(false);
  };

  return (
    <div className="space-y-2">
      {/* Tags existants */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "inline-flex items-center text-xs font-medium px-2 py-1 rounded-md transition-all",
                selected
                  ? FOLDER_BG_TW[tag.colorKey] || FOLDER_BG_TW.default
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tag.name}
              {selected && <X className="w-3 h-3 ml-1" />}
            </button>
          );
        })}

        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="w-3 h-3 mr-0.5" />
            Nouveau tag
          </button>
        )}
      </div>

      {/* Création tag inline */}
      {creating && (
        <div className="flex items-center gap-2">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Nom du tag..."
            className="text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateTag();
              if (e.key === "Escape") { setCreating(false); setNewTagName(""); }
            }}
          />
          <Button size="sm" onClick={handleCreateTag} loading={loading}>
            Créer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewTagName(""); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
