// ═══════════════════════════════════════════════════════════════════════════
// Types Devis (Session 8)
// ═══════════════════════════════════════════════════════════════════════════

import { safeMeta } from "./safe-meta";

export type QuoteStatus = "brouillon" | "envoye" | "accepte" | "refuse";

export type VatRate = 0 | 5.5 | 10 | 20;

export const VAT_RATES: Array<{ value: VatRate; label: string; context?: string }> = [
  { value: 20,  label: "20 %",   context: "Taux normal" },
  { value: 10,  label: "10 %",   context: "Rénovation logements > 2 ans" },
  { value: 5.5, label: "5,5 %",  context: "Amélioration énergétique" },
  { value: 0,   label: "0 %",    context: "Autoliquidation / Hors taxe" },
];

// ─── Type d'item : ligne normale OU section/chapitre ─────────────────────
export type QuoteItemKind = "line" | "section";

// ─── Type Pose/Fourniture (Session 20) ───────────────────────────────────
// "" = non spécifié, "P" = Pose seule, "F" = Fourniture seule, "PF" = Pose + Fourniture
export type LineWorkType = "" | "P" | "F" | "PF";

export const LINE_WORK_TYPE_META: Record<LineWorkType, { label: string; longLabel: string }> = safeMeta({
  "": { label: "—", longLabel: "Non spécifié" },
  "P": { label: "P", longLabel: "Pose" },
  "F": { label: "F", longLabel: "Fourniture" },
  "PF": { label: "PF", longLabel: "Pose et fourniture" },
});

export interface QuoteItem {
  id: string;
  kind: QuoteItemKind;

  // Pour les sections : seul le title compte
  title: string;

  // Pour les lignes
  description: string;    // désignation détaillée (multilignes possibles)
  quantity: number;       // quantité
  unit: string;           // "u", "m²", "ml", "h", "jour", "forfait"...
  unitPriceHT: number;    // prix unitaire HT
  vatRate: VatRate;       // taux TVA
  lineType?: LineWorkType; // Pose / Fourniture / Pose+Fourniture (Session 20)
  categoryId?: string;    // Catégorie chantier / corps d'état (Session 22)

  // Remise par ligne (optionnelle)
  discountPercent: number;  // 0 si pas de remise
  discountAmount: number;   // remise en € (alternative au %)
  discountMode: "percent" | "amount" | "none";
}

export const EMPTY_QUOTE_LINE: Omit<QuoteItem, "id"> = {
  kind: "line",
  title: "",
  description: "",
  quantity: 1,
  unit: "u",
  unitPriceHT: 0,
  vatRate: 20,
  lineType: "",
  discountPercent: 0,
  discountAmount: 0,
  discountMode: "none",
};

export const EMPTY_QUOTE_SECTION: Omit<QuoteItem, "id"> = {
  kind: "section",
  title: "Nouveau chapitre",
  description: "",
  quantity: 0,
  unit: "",
  unitPriceHT: 0,
  vatRate: 20,
  discountPercent: 0,
  discountAmount: 0,
  discountMode: "none",
};

// ─── Devis complet ──────────────────────────────────────────────────────
export interface Quote {
  id: string;

  // Identification
  reference: string;          // ex: "DEVIS-2026-0001"
  status: QuoteStatus;
  title: string;              // titre court du devis

  // Liaisons
  clientId: string;           // client OBLIGATOIRE
  chantierId: string;         // chantier OPTIONNEL

  // Dates
  issueDate: string;          // date d'émission (ISO)
  validUntil: string;         // date de validité
  acceptedAt: string;         // date d'acceptation (si status = accepte)
  sentAt: string;             // date d'envoi (si status = envoye)

  // Contenu
  items: QuoteItem[];

  // Remise globale
  globalDiscountMode: "percent" | "amount" | "none";
  globalDiscountPercent: number;
  globalDiscountAmount: number;

  // Mentions / conditions
  introText: string;          // intro avant les lignes
  conditionsText: string;     // CGV / conditions de règlement
  footerText: string;         // mentions légales auto ajoutées

  // Notes internes (pas imprimées)
  internalNotes: string;

  // Type Pose/Fourniture par défaut pour les nouvelles lignes (Session 20)
  defaultLineType?: LineWorkType;

  // Snapshot entreprise au moment du devis (pour historique stable)
  companySnapshot: any;

  // Métadonnées
  createdAt: string;
  updatedAt: string;

  // Totaux cachés (recalculés mais stockés pour requête rapide sur la liste)
  totalHT: number;
  totalTTC: number;
}

// ─── Totaux calculés (jamais stockés, toujours recalculés) ───────────────
export interface QuoteTotals {
  subtotalBeforeDiscountHT: number;   // avant remises ligne
  totalLineDiscounts: number;          // somme des remises de lignes
  subtotalAfterLineDiscountsHT: number; // après remises lignes
  globalDiscount: number;              // remise globale en €
  totalHT: number;                     // total HT net final
  vatDetail: Record<VatRate, { base: number; tax: number }>;
  totalVAT: number;
  totalTTC: number;
}

export const EMPTY_QUOTE: Omit<Quote, "id" | "reference" | "createdAt" | "updatedAt"> = {
  status: "brouillon",
  title: "",
  clientId: "",
  chantierId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  validUntil: "",
  acceptedAt: "",
  sentAt: "",
  items: [],
  globalDiscountMode: "none",
  globalDiscountPercent: 0,
  globalDiscountAmount: 0,
  introText: "",
  conditionsText: "Devis gratuit valable 30 jours. Acompte de 30 % à la commande.",
  footerText: "",
  internalNotes: "",
  defaultLineType: "",
  companySnapshot: {},
  totalHT: 0,
  totalTTC: 0,
};

// ─── Meta statuts ───────────────────────────────────────────────────────
export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; color: string }> = safeMeta({
  brouillon: { label: "Brouillon", color: "slate"   },
  envoye:    { label: "Envoyé",    color: "blue"    },
  accepte:   { label: "Accepté",   color: "emerald" },
  refuse:    { label: "Refusé",    color: "rose"    },
});

export const QUOTE_STATUS_ORDER: QuoteStatus[] = ["brouillon", "envoye", "accepte", "refuse"];

// ─── Unités les plus courantes ──────────────────────────────────────────
export const QUOTE_UNITS = [
  "u", "forfait", "m²", "m³", "ml", "m", "kg", "l",
  "h", "jour", "semaine", "mois", "%",
];

// ═══════════════════════════════════════════════════════════════════════════
// Bibliothèque de prestations
// ═══════════════════════════════════════════════════════════════════════════

export interface LibraryItem {
  id: string;
  category: string;          // "Plomberie", "Maçonnerie", "Peinture"...
  title: string;             // nom court
  description: string;       // descriptif complet multiligne
  unit: string;
  unitPriceHT: number;
  vatRate: VatRate;
  usageCount: number;        // nombre d'utilisations (pour tri)
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_LIBRARY_ITEM: Omit<LibraryItem, "id" | "createdAt" | "updatedAt"> = {
  category: "",
  title: "",
  description: "",
  unit: "u",
  unitPriceHT: 0,
  vatRate: 20,
  usageCount: 0,
};

export const LIBRARY_CATEGORIES = [
  "Maçonnerie", "Plomberie", "Électricité", "Peinture", "Carrelage",
  "Menuiserie", "Toiture", "Isolation", "Plâtrerie", "Sol souple",
  "Démolition", "Terrassement", "Autres",
];
