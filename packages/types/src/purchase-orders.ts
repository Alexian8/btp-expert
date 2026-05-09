// ═══════════════════════════════════════════════════════════════════════════
// Types Bons de commande + Situations de travaux (Session 15)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Statut BdC ───────────────────────────────────────────────────────────
export type PurchaseOrderStatus =
  | "brouillon"          // En cours de saisie
  | "envoye"             // Envoyé au sous-traitant pour signature
  | "signe"              // Signé / accepté par le ST
  | "en_cours"           // Travaux en cours d'exécution
  | "termine"            // Travaux terminés (= 100%)
  | "solde"              // Décompte général soldé (retenue libérée)
  | "annule";

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  designation: string;          // libellé de la prestation
  quantity: number;
  unit: string;                  // ml, m², m³, h, forfait, ens...
  unitPriceHt: number;
  totalHt: number;               // quantity * unitPriceHt (calculé)
  vatRate: number;               // 20, 10, 5.5, 0
  notes: string;
  sortOrder: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;             // BC-2026-0001

  // Liens
  subcontractorId: string;
  subcontractorName: string;     // dénormalisé pour affichage
  chantierId: string;            // chantier rattaché (obligatoire)

  // Dates
  poDate: string;                // date du bon de commande
  startDate: string;             // début prévu travaux
  endDate: string;               // fin prévue travaux
  signedDate: string;            // date signature ST

  // Description globale
  title: string;                 // intitulé court
  description: string;           // description détaillée

  // Montants (calculés depuis les lignes)
  totalHt: number;
  totalVat: number;
  totalTtc: number;

  // Retenue de garantie
  retentionEnabled: boolean;
  retentionPct: number;          // 5% par défaut
  retentionAmount: number;        // calculé : totalTtc * retentionPct/100
  retentionReleaseDate: string;  // date prévue libération (généralement +1 an après réception)
  retentionReleased: boolean;

  // Mode de facturation
  hasSituations: boolean;         // si false → facture unique en fin

  // Conditions
  paymentDelay: number;           // délai de paiement en jours (30/45/60)
  cautionRequired: boolean;       // caution bancaire obligatoire (>600€HT et privé)
  cautionReceived: boolean;
  cautionVaultDocumentId: string;

  // Documents joints
  vaultDocumentId: string;        // BdC signé scanné

  // Statut
  status: PurchaseOrderStatus;
  notes: string;

  createdAt: string;
  updatedAt: string;
}

export const PO_STATUS_META: Record<PurchaseOrderStatus, {
  label: string;
  colorTw: string;
}> = {
  brouillon: { label: "Brouillon",  colorTw: "bg-slate-500/15 text-slate-500" },
  envoye:    { label: "Envoyé",      colorTw: "bg-blue-500/15 text-blue-500" },
  signe:     { label: "Signé",        colorTw: "bg-violet-500/15 text-violet-500" },
  en_cours:  { label: "En cours",     colorTw: "bg-amber-500/15 text-amber-500" },
  termine:   { label: "Terminé",      colorTw: "bg-emerald-500/15 text-emerald-500" },
  solde:     { label: "Soldé",        colorTw: "bg-green-700/15 text-green-700" },
  annule:    { label: "Annulé",       colorTw: "bg-red-500/15 text-red-500" },
};

// ═══════════════════════════════════════════════════════════════════════════
// Situations de travaux (factures intermédiaires d'avancement)
// ═══════════════════════════════════════════════════════════════════════════

export type SituationStatus =
  | "brouillon"
  | "validee"             // Validée et envoyée à l'expert-compt
  | "payee"
  | "annulee";

export interface SituationLine {
  id: string;
  situationId: string;
  poLineId: string;              // ligne du BdC d'origine
  designation: string;            // recopié du BdC
  totalHt: number;                // total HT du BdC (recopié)
  cumulPctPrevious: number;       // % cumulé des situations précédentes
  cumulPctNow: number;             // % cumulé après cette situation
  newPct: number;                 // = cumulPctNow - cumulPctPrevious
  newAmountHt: number;            // = totalHt * newPct / 100
  vatRate: number;
  sortOrder: number;
}

export interface Situation {
  id: string;
  reference: string;              // SIT-2026-0001
  number: number;                 // n° de situation pour ce BdC (1, 2, 3...)

  // Liens
  purchaseOrderId: string;
  subcontractorId: string;
  subcontractorName: string;
  chantierId: string;
  poReference: string;             // référence BdC pour affichage

  // Dates
  situationDate: string;
  paidDate: string;

  // Montants (calculés depuis les lignes)
  totalHt: number;                // travaux exécutés cette période
  totalVat: number;
  totalTtc: number;

  // Retenue de garantie de cette situation
  retentionAmount: number;         // = totalTtc * retentionPct/100
  netToPay: number;                // = totalTtc - retentionAmount

  // Avancement global (en %)
  globalAdvancementPct: number;   // % cumulé après cette situation

  // Statut
  status: SituationStatus;
  notes: string;

  // Document généré
  vaultDocumentId: string;

  createdAt: string;
  updatedAt: string;
}

export const SITUATION_STATUS_META: Record<SituationStatus, {
  label: string;
  colorTw: string;
}> = {
  brouillon: { label: "Brouillon", colorTw: "bg-slate-500/15 text-slate-500" },
  validee:   { label: "Validée",    colorTw: "bg-blue-500/15 text-blue-500" },
  payee:     { label: "Payée",      colorTw: "bg-emerald-500/15 text-emerald-500" },
  annulee:   { label: "Annulée",    colorTw: "bg-red-500/15 text-red-500" },
};

// ─── Stats ────────────────────────────────────────────────────────────────
export interface PurchaseOrderStats {
  totalPos: number;
  totalEnCours: number;
  totalAmount: number;          // total HT tous BdC actifs
  pendingRetentions: number;    // retenues à libérer
  expiredRetentions: number;    // retenues libérables (date dépassée)
}
