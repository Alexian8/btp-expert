import { cn } from "@btp/ui";
import { useChantierCategoriesStore } from "@/stores/chantierCategoriesStore";
import { getChantierCatIcon, getChantierCatColor } from "./chantierCategoryMeta";

// ═══════════════════════════════════════════════════════════════════════════
// CategoryBadge — Badge visuel d'une catégorie chantier (Session 22)
// Utilisé partout : fiche chantier, listes, lignes devis...
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  categoryId: string | undefined | null;
  size?: "xs" | "sm" | "md";
  /** Si true, affiche un placeholder discret quand pas de catégorie */
  showEmpty?: boolean;
  className?: string;
}

export function CategoryBadge({ categoryId, size = "sm", showEmpty = false, className }: Props) {
  const getById = useChantierCategoriesStore((s) => s.getById);
  const cat = categoryId ? getById(categoryId) : undefined;

  if (!cat) {
    if (!showEmpty) return null;
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded text-muted-foreground/60",
        size === "xs" && "text-[9px] px-1 py-0",
        size === "sm" && "text-[10px] px-1.5 py-0.5",
        size === "md" && "text-xs px-2 py-1",
        className
      )}>
        —
      </span>
    );
  }

  const Icon = getChantierCatIcon(cat.iconKey);
  const color = getChantierCatColor(cat.colorKey);

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded font-medium border",
      color.bg, color.text, color.border,
      size === "xs" && "text-[9px] px-1 py-0 gap-0.5",
      size === "sm" && "text-[10px] px-1.5 py-0.5",
      size === "md" && "text-xs px-2 py-1",
      className
    )}>
      <Icon className={cn(
        size === "xs" && "w-2 h-2",
        size === "sm" && "w-2.5 h-2.5",
        size === "md" && "w-3 h-3",
      )} />
      {cat.name}
    </span>
  );
}
