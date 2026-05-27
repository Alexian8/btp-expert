import type { Quote, QuoteItem, QuoteTotals, VatRate } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// quoteEngine — Calculs HT/TVA/TTC pour un devis
// Toujours recalculé, jamais stocké (sauf le total final pour affichage liste)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Ligne seule : HT brut + remise → HT net ─────────────────────────────
export function calculateLineHT(line: QuoteItem): {
  bruthT: number;      // brut HT (qté × PU)
  discount: number;    // remise en €
  netHT: number;       // HT net après remise
} {
  if (line.kind !== "line") return { bruthT: 0, discount: 0, netHT: 0 };

  const brut = (line.quantity || 0) * (line.unitPriceHT || 0);
  let discount = 0;
  if (line.discountMode === "percent" && line.discountPercent > 0) {
    discount = brut * (line.discountPercent / 100);
  } else if (line.discountMode === "amount" && line.discountAmount > 0) {
    discount = Math.min(line.discountAmount, brut);
  }
  const net = Math.max(0, brut - discount);
  return {
    bruthT: round2(brut),
    discount: round2(discount),
    netHT: round2(net),
  };
}

// ─── Ligne seule : TVA + TTC ─────────────────────────────────────────────
export function calculateLineTTC(line: QuoteItem): {
  netHT: number;
  vat: number;
  ttc: number;
} {
  const { netHT } = calculateLineHT(line);
  const vat = netHT * (line.vatRate / 100);
  return {
    netHT,
    vat: round2(vat),
    ttc: round2(netHT + vat),
  };
}

// ─── Totaux d'un devis complet ───────────────────────────────────────────
export function computeQuoteTotals(quote: Pick<Quote, "items" | "globalDiscountMode" | "globalDiscountPercent" | "globalDiscountAmount">): QuoteTotals {
  // Initialiser le détail TVA
  const vatDetail: Record<VatRate, { base: number; tax: number }> = {
    0:   { base: 0, tax: 0 },
    5.5: { base: 0, tax: 0 },
    10:  { base: 0, tax: 0 },
    20:  { base: 0, tax: 0 },
  };

  let subtotalBeforeDiscountHT = 0;
  let totalLineDiscounts = 0;
  let subtotalAfterLineDiscountsHT = 0;

  // 1) Somme des lignes (ignorer sections)
  for (const item of quote.items) {
    if (item.kind !== "line") continue;
    const { bruthT, discount, netHT } = calculateLineHT(item);
    subtotalBeforeDiscountHT += bruthT;
    totalLineDiscounts += discount;
    subtotalAfterLineDiscountsHT += netHT;
  }

  // 2) Remise globale (sur le sous-total après remises lignes)
  let globalDiscount = 0;
  if (quote.globalDiscountMode === "percent" && quote.globalDiscountPercent > 0) {
    globalDiscount = subtotalAfterLineDiscountsHT * (quote.globalDiscountPercent / 100);
  } else if (quote.globalDiscountMode === "amount" && quote.globalDiscountAmount > 0) {
    globalDiscount = Math.min(quote.globalDiscountAmount, subtotalAfterLineDiscountsHT);
  }
  const totalHT = Math.max(0, subtotalAfterLineDiscountsHT - globalDiscount);

  // 3) Recalculer TVA au prorata après remise globale
  // Facteur = totalHT / subtotalAfterLineDiscountsHT
  const ratio = subtotalAfterLineDiscountsHT > 0
    ? totalHT / subtotalAfterLineDiscountsHT
    : 0;

  for (const item of quote.items) {
    if (item.kind !== "line") continue;
    const { netHT } = calculateLineHT(item);
    const basePostDiscount = netHT * ratio;
    vatDetail[item.vatRate].base += basePostDiscount;
    vatDetail[item.vatRate].tax += basePostDiscount * (item.vatRate / 100);
  }

  // Arrondis finaux
  for (const rate of [0, 5.5, 10, 20] as VatRate[]) {
    vatDetail[rate].base = round2(vatDetail[rate].base);
    vatDetail[rate].tax = round2(vatDetail[rate].tax);
  }

  const totalVAT = round2(
    vatDetail[0].tax + vatDetail[5.5].tax + vatDetail[10].tax + vatDetail[20].tax
  );
  const totalTTC = round2(totalHT + totalVAT);

  return {
    subtotalBeforeDiscountHT: round2(subtotalBeforeDiscountHT),
    totalLineDiscounts: round2(totalLineDiscounts),
    subtotalAfterLineDiscountsHT: round2(subtotalAfterLineDiscountsHT),
    globalDiscount: round2(globalDiscount),
    totalHT: round2(totalHT),
    vatDetail,
    totalVAT,
    totalTTC,
  };
}

// ─── Utilitaire : arrondi à 2 décimales (banker's rounding évité) ────────
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Format euros ────────────────────────────────────────────────────────
// toLocaleString("fr-FR") produit un espace insécable étroite (U+202F NNBSP)
// entre les milliers. Helvetica (la police par défaut de @react-pdf/renderer)
// ne contient pas ce glyphe et affiche `/` ou un autre caractère de fallback
// dans les PDF. On normalise donc toutes les variantes d'espaces insécables
// (U+202F, U+00A0, U+2009) vers un espace ASCII compatible toutes polices.
function normalizeSpaces(s: string): string {
  return s.replace(/[   ]/g, " ");
}

export function formatEuros(v: number, decimals = 2): string {
  const formatted = v.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return normalizeSpaces(formatted) + " €";
}

// ─── Format % ────────────────────────────────────────────────────────────
export function formatPercent(v: number): string {
  const formatted = v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return normalizeSpaces(formatted) + " %";
}
