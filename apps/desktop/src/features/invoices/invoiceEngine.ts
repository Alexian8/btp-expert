import type { Invoice, InvoicePayment, InvoiceTotals } from "@btp/types";
import { computeQuoteTotals, formatEuros } from "@/features/quotes/quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// invoiceEngine — Calculs spécifiques factures (réutilise quoteEngine)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcule les totaux d'une facture : HT, TVA, TTC, + montant payé, + reste dû.
 */
export function computeInvoiceTotals(invoice: Invoice, payments: InvoicePayment[] = []): InvoiceTotals {
  const baseTotals = computeQuoteTotals({
    items: invoice.items,
    globalDiscountMode: invoice.globalDiscountMode,
    globalDiscountPercent: invoice.globalDiscountPercent,
    globalDiscountAmount: invoice.globalDiscountAmount,
  } as any);

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remainingDue = Math.max(0, baseTotals.totalTTC - totalPaid);

  return {
    ...baseTotals,
    totalPaid,
    remainingDue,
  };
}

export { formatEuros };

/**
 * Formatte une date ISO en français (JJ/MM/AAAA).
 */
export function formatDateFR(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("fr-FR");
  } catch {
    return isoDate;
  }
}

/**
 * Nombre de jours entre deux dates (positif si à > à).
 */
export function daysBetween(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 0;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * Indique si une facture est en retard de paiement (dueDate < aujourd'hui + pas payée).
 */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === "payee" || invoice.status === "brouillon" || invoice.status === "annulee") return false;
  if (!invoice.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return invoice.dueDate < today;
}

/**
 * Nombre de jours de retard (0 si pas en retard).
 */
export function daysOverdue(invoice: Invoice): number {
  if (!isInvoiceOverdue(invoice)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return daysBetween(invoice.dueDate, today);
}
