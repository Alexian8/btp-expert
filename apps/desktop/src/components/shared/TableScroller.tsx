import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// TableScroller — enveloppe un tableau en défilement horizontal (mobile) avec
// une ombre en dégradé sur les bords indiquant qu'un scroll est disponible.
// ═══════════════════════════════════════════════════════════════════════════
export function TableScroller({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto scroll-shadow-x rounded-lg", className)}>
      {children}
    </div>
  );
}
