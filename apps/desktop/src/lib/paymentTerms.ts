// ═══════════════════════════════════════════════════════════════════════════
// paymentTerms.ts — Conditions de règlement préfaites (Session 20)
// ═══════════════════════════════════════════════════════════════════════════

export interface PaymentTermPreset {
  id: string;
  label: string;
  days: number;          // délai en jours (négatif = comptant ou à réception)
  description: string;
}

export const PAYMENT_TERM_PRESETS: PaymentTermPreset[] = [
  {
    id: "comptant",
    label: "Comptant",
    days: 0,
    description: "Paiement à la livraison ou à la signature",
  },
  {
    id: "reception",
    label: "À réception",
    days: 0,
    description: "Paiement immédiat à réception de la facture",
  },
  {
    id: "15j",
    label: "15 jours",
    days: 15,
    description: "Paiement sous 15 jours à compter de l'émission",
  },
  {
    id: "30j",
    label: "30 jours",
    days: 30,
    description: "Délai légal par défaut (30 jours nets)",
  },
  {
    id: "30j-fin-mois",
    label: "30 jours fin de mois",
    days: 45, // approximation : 30j + ~15j moyenne pour aller au prochain fin de mois
    description: "30 jours puis fin de mois (le 15 du mois suivant en moyenne)",
  },
  {
    id: "45j",
    label: "45 jours",
    days: 45,
    description: "Délai courant en BTP secteur public",
  },
  {
    id: "60j",
    label: "60 jours",
    days: 60,
    description: "Délai max légal entre professionnels (Loi LME)",
  },
  {
    id: "custom",
    label: "Personnalisé",
    days: -1,    // sentinelle = utiliser une valeur custom
    description: "Saisir un délai personnalisé en jours",
  },
];

/**
 * Trouve le preset correspondant à un nombre de jours, ou "custom" si aucun match.
 */
export function findPresetByDays(days: number): PaymentTermPreset {
  // Match strict sur les valeurs courantes
  const exactMatch = PAYMENT_TERM_PRESETS.find((p) => p.days === days && p.id !== "custom");
  if (exactMatch) return exactMatch;
  return PAYMENT_TERM_PRESETS[PAYMENT_TERM_PRESETS.length - 1]; // custom
}
