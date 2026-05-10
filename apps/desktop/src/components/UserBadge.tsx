import { useUsersStore } from "@/stores/usersStore";
import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// UserBadge — Affiche un utilisateur (avatar + nom) dans une cellule de liste
//
// Lit l'annuaire en mémoire via useUsersStore. Si l'id est absent ou
// inconnu, affiche un placeholder discret "—".
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  userId: number | string | null | undefined;
  /** Si "compact", n'affiche que l'avatar + tooltip avec le nom. */
  variant?: "compact" | "full";
  className?: string;
}

export function UserBadge({ userId, variant = "full", className }: Props) {
  const fullName = useUsersStore((s) => s.fullName);
  const initial = useUsersStore((s) => s.initial);
  const get = useUsersStore((s) => s.get);

  if (userId == null || userId === "") {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }

  const name = fullName(userId);
  const ini = initial(userId);
  const u = get(userId);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-medium shrink-0",
          className
        )}
        title={name}
      >
        {ini}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <div
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-medium shrink-0"
        title={u?.role}
      >
        {ini}
      </div>
      <span className="text-xs truncate">{name}</span>
    </div>
  );
}
