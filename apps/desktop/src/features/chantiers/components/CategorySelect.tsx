import { useEffect, useState } from "react";
import { ChevronDown, Tag, X } from "lucide-react";

import { cn } from "@btp/ui";
import { useChantierCategoriesStore } from "@/stores/chantierCategoriesStore";
import { getChantierCatIcon, getChantierCatColor } from "./chantierCategoryMeta";

// ═══════════════════════════════════════════════════════════════════════════
// CategorySelect — Sélecteur de catégorie chantier (Session 22)
// Dropdown léger réutilisable dans les formulaires + lignes de devis
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  value: string | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  /** Si true, affiche un mini-bouton avec juste l'icône (utile sur lignes devis) */
  compact?: boolean;
  className?: string;
}

export function CategorySelect({
  value, onChange, placeholder = "Choisir une catégorie",
  size = "md", compact = false, className,
}: Props) {
  const { categories, fetch } = useChantierCategoriesStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (categories.length === 0) fetch();
  }, []);

  const selected = value ? categories.find((c) => c.id === value) : undefined;

  const SelectedIcon = selected ? getChantierCatIcon(selected.iconKey) : Tag;
  const selectedColor = selected ? getChantierCatColor(selected.colorKey) : null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border transition-colors",
          compact
            ? "h-8 px-2"
            : size === "sm"
              ? "h-8 px-2.5 text-xs w-full"
              : "h-9 px-3 text-sm w-full",
          selected
            ? cn(selectedColor!.bg, selectedColor!.text, selectedColor!.border)
            : "border-input bg-background text-muted-foreground hover:bg-accent"
        )}
      >
        <SelectedIcon className={cn(compact || size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4", "shrink-0")} />
        {!compact && (
          <span className="flex-1 truncate text-left font-medium">
            {selected ? selected.name : placeholder}
          </span>
        )}
        {!compact && <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-soft-lg py-1 min-w-[200px] max-h-[280px] overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent text-muted-foreground"
              >
                <X className="w-3 h-3" />
                Aucune catégorie
              </button>
            )}
            {categories.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                Aucune catégorie disponible
              </div>
            )}
            {categories.map((cat) => {
              const Icon = getChantierCatIcon(cat.iconKey);
              const color = getChantierCatColor(cat.colorKey);
              const isSelected = cat.id === value;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { onChange(cat.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                    isSelected ? "bg-accent" : "hover:bg-accent"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center shrink-0",
                    color.bg, color.text
                  )}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <span className="flex-1 truncate">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
