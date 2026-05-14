// ═══════════════════════════════════════════════════════════════════════════
// Types Factures (Session 10)
// ═══════════════════════════════════════════════════════════════════════════

import type { QuoteItem, QuoteTotals, VatRate } from "./quotes";
import { safeMeta } from "./safe-meta";

// ─── Statuts de facture ──────────────────────────────────────────────────
export type InvoiceStatus =
  | "brouillon"
  | "envoyee"
  | "partiellement-payee"
  | "payee"
  | "annulee";

// ─── Type de facture (BTP) ───────────────────────────────────────────────
export type InvoiceType =
  | "standard"    // facture classique
  | "acompte"     // facture d'acompte (ex: 30% à la commande)
  | "avoir";      // facture d'avoir (remboursement)

// ─── Paiement enregistré sur une facture ─────────────────────────────────
export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;          // montant TTC payé
  date: string;            // ISO date
  method: InvoicePaymentMethod;
  reference: string;       // num chèque, ref virement, etc.
  notes: string;
  createdAt: string;
}

export type InvoicePaymentMethod =
  | "virement"
  | "cheque"
  | "especes"
  | "carte"
  | "prelevement"
  | "autre";

export const PAYMENT_METHOD_META: Record<InvoicePaymentMethod, { label: string }> = safeMeta({
  virement:    { label: "Virement" },
  cheque:      { label: "Chèque" },
  especes:     { label: "Espèces" },
  carte:       { label: "Carte bancaire" },
  prelevement: { label: "Prélèvement" },
  autre:       { label: "Autre" },
});

// ─── Facture complète ────────────────────────────────────────────────────
export interface Invoice {
  id: string;

  // Identification
  reference: string;          // ex: "FACT-2026-0001"
  status: InvoiceStatus;
  type: InvoiceType;
  title: string;

  // Liaisons
  clientId: string;
  chantierId: string;
  fromQuoteId: string;        // si convertie depuis un devis

  // Dates
  issueDate: string;          // date d'émission
  dueDate: string;             // date d'échéance
  paymentTermsDays: number;   // 30 par défaut (stocké pour historique)
  sentAt: string;
  paidAt: string;             // date du paiement final (si status = payee)

  // Contenu (identique à la structure Quote)
  items: QuoteItem[];

  // Remise globale
  globalDiscountMode: "percent" | "amount" | "none";
  globalDiscountPercent: number;
  globalDiscountAmount: number;

  // Spécifique acompte
  acompteBasedOnQuoteId: string;     // pour facture acompte : devis source
  acomptePercent: number;             // % représentant l'acompte (ex: 30)

  // Spécifique avoir
  avoirReferenceInvoiceId: string;   // facture initiale que l'avoir annule

  // Mentions / conditions
  introText: string;
  conditionsText: string;
  footerText: string;
  internalNotes: string;

  // Snapshot entreprise
  companySnapshot: any;

  // Totaux cachés
  totalHT: number;
  totalTTC: number;
  totalPaid: number;          // somme des paiements enregistrés

  // Relances (Session 10)
  lastReminderSentAt: string;
  remindersCount: number;

  // Métadonnées
  createdAt: string;
  updatedAt: string;
}

export type InvoiceTotals = QuoteTotals & {
  totalPaid: number;
  remainingDue: number;
};

// ─── Valeur par défaut pour nouvelle facture ────────────────────────────
export const EMPTY_INVOICE: Omit<Invoice, "id" | "reference" | "createdAt" | "updatedAt"> = {
  status: "brouillon",
  type: "standard",
  title: "",
  clientId: "",
  chantierId: "",
  fromQuoteId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  paymentTermsDays: 30,
  sentAt: "",
  paidAt: "",
  items: [],
  globalDiscountMode: "none",
  globalDiscountPercent: 0,
  globalDiscountAmount: 0,
  acompteBasedOnQuoteId: "",
  acomptePercent: 0,
  avoirReferenceInvoiceId: "",
  introText: "",
  conditionsText: "Paiement à réception de facture. Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €.",
  footerText: "",
  internalNotes: "",
  companySnapshot: {},
  totalHT: 0,
  totalTTC: 0,
  totalPaid: 0,
  lastReminderSentAt: "",
  remindersCount: 0,
};

// ─── Meta statuts ────────────────────────────────────────────────────────
export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; color: string }> = safeMeta({
  brouillon:              { label: "Brouillon",              color: "slate"  },
  envoyee:                { label: "Envoyée",                color: "blue"   },
  "partiellement-payee":  { label: "Partiellement payée",    color: "amber"  },
  payee:                  { label: "Payée",                  color: "emerald"},
  annulee:                { label: "Annulée",                color: "rose"   },
});

export const INVOICE_STATUS_ORDER: InvoiceStatus[] = [
  "brouillon", "envoyee", "partiellement-payee", "payee", "annulee",
];

export const INVOICE_TYPE_META: Record<InvoiceType, { label: string; shortLabel: string; description: string }> = safeMeta({
  standard: {
    label: "Facture standard",
    shortLabel: "Standard",
    description: "Facture classique pour travaux achevés",
  },
  acompte: {
    label: "Facture d'acompte",
    shortLabel: "Acompte",
    description: "Paiement partiel anticipé (ex: 30% à la commande)",
  },
  avoir: {
    label: "Facture d'avoir",
    shortLabel: "Avoir",
    description: "Annulation ou remboursement (montants négatifs)",
  },
});

// ─── Utilitaires ─────────────────────────────────────────────────────────

/**
 * Calcule la date d'échéance à partir de la date d'émission et du nombre de jours.
 */
export function computeDueDate(issueDate: string, termsDays: number): string {
  if (!issueDate) return "";
  const d = new Date(issueDate);
  d.setDate(d.getDate() + termsDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Détermine le nouveau statut d'une facture en fonction des paiements.
 */
export function computeInvoiceStatus(
  current: InvoiceStatus,
  totalTTC: number,
  totalPaid: number,
): InvoiceStatus {
  if (current === "brouillon" || current === "annulee") return current;
  if (totalPaid >= totalTTC - 0.01) return "payee";
  if (totalPaid > 0.01) return "partiellement-payee";
  return current; // envoyee reste envoyee
}
