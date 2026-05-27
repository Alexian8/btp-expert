// ═══════════════════════════════════════════════════════════════════════════
// Helpers d'affichage pour la compta partie double
// ═══════════════════════════════════════════════════════════════════════════

export function fmtMoney(n: number, opts: { showZero?: boolean; signed?: boolean } = {}): string {
  if (!opts.showZero && (n === 0 || !Number.isFinite(n))) return "";
  const abs = Math.abs(n);
  const str = abs.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (opts.signed && n < 0) return `-${str}`;
  return str;
}

export function fmtMoneyAlways(n: number): string {
  return (n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
}

export function fmtDateShort(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}

export const CLASS_LABEL: Record<number, string> = {
  1: "Capitaux",
  2: "Immobilisations",
  3: "Stocks",
  4: "Tiers",
  5: "Financier",
  6: "Charges",
  7: "Produits",
};

export const CLASS_COLOR: Record<number, string> = {
  1: "bg-purple-500/15 text-purple-500",
  2: "bg-blue-500/15 text-blue-500",
  3: "bg-cyan-500/15 text-cyan-500",
  4: "bg-amber-500/15 text-amber-500",
  5: "bg-emerald-500/15 text-emerald-500",
  6: "bg-rose-500/15 text-rose-500",
  7: "bg-teal-500/15 text-teal-500",
};

export function listYears(currentYear: number, back = 5): number[] {
  const years: number[] = [];
  for (let i = 0; i < back; i++) years.push(currentYear - i);
  return years;
}
