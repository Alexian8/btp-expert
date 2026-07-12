import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// Skeleton — bloc de chargement animé (pulsation). Masque le temps de réponse.
// ═══════════════════════════════════════════════════════════════════════════
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/70", className)} />;
}

/** Lignes de tableau grises (n lignes, c colonnes). */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "w-3/4" : "w-1/2")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grille de cartes KPI vides (dashboard). */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ))}
    </div>
  );
}
