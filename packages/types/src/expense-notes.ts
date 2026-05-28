// ═══════════════════════════════════════════════════════════════════════════
// Types Notes de frais (Session 14)
//
// DIFFÉRENCE avec les "expenses" (Session 13) :
//   - expenses = factures fournisseurs (Leroy Merlin, etc.) avec TVA détaillée
//   - expense_notes = petits frais du quotidien (carburant, repas, parking)
//     payés par le dirigeant ou un employé
// ═══════════════════════════════════════════════════════════════════════════

import { safeMeta } from "./safe-meta";

export type ExpenseNoteCategory =
  | "carburant"        // Carburant véhicule
  | "peage"            // Péage autoroute
  | "parking"          // Parking, stationnement
  | "repas"            // Repas chantier, déjeuner client
  | "hotel"            // Hôtel déplacement
  | "transport"        // Train, taxi, uber
  | "fourniture"       // Petites fournitures
  | "epi"              // Équipement protection individuelle
  | "outillage_petit"  // Petit outillage acheté en magasin
  | "telecom"          // Téléphone (forfait perso pro)
  | "abonnement"       // Abonnements pro
  | "cadeau"           // Cadeau client
  | "autre";

export type ExpenseNoteStatus =
  | "brouillon"        // En cours de saisie, modifiable
  | "validee"          // Validée, prête à être remboursée
  | "remboursee"       // Remboursée à l'employé/dirigeant
  | "refacturee";      // Refacturée au client (intégrée dans une facture)

export type ExpenseNotePayer =
  | "dirigeant"        // Le patron (toi)
  | "employe"          // Un employé
  | "carte_pro";       // Carte bancaire pro (déjà sur compte pro)

export interface ExpenseNote {
  id: string;
  reference: string;          // NDF-2026-0001
  payerType: ExpenseNotePayer;
  payerName: string;          // si employé : son nom (libre)

  // Lien chantier (obligatoire si refacturable)
  chantierId: string;

  // Montants
  amountTtc: number;
  amountHt: number;           // calculé selon vatRate
  vatRate: number;            // 20, 10, 5.5, 0
  amountVat: number;

  // Détails
  category: ExpenseNoteCategory;
  description: string;        // ex: "Café avec client Dupont"
  notes: string;

  // Dates
  expenseDate: string;        // date de la dépense

  // Refacturation client
  refacturable: boolean;
  refacturationMargePct: number;  // marge appliquée si refacturable (0 = au prix coûtant)

  // Statut
  status: ExpenseNoteStatus;
  reimbursedDate: string;     // date remboursement à l'employé/dirigeant
  refacturedInvoiceId: string; // id de la facture où elle a été refacturée

  // Justificatif
  receiptVaultDocumentId: string;

  // Session 31 — paiement & rapprochement bancaire
  paymentMethod?: string;           // personnel / cb / virement / especes...
  bankTransactionId?: string;       // id transaction bancaire (Qonto)
  supplierInvoiceNumber?: string;   // n° du justificatif / facture

  // Métadonnées
  createdAt: string;
  updatedAt: string;
}

// ─── Métadonnées catégories ───────────────────────────────────────────────
export const EXPENSE_NOTE_CATEGORY_META: Record<ExpenseNoteCategory, {
  label: string;
  defaultVatRate: number;       // taux TVA par défaut pour cette catégorie
  colorTw: string;
}> = safeMeta({
  carburant:       { label: "Carburant",        defaultVatRate: 20,  colorTw: "bg-amber-500/15 text-amber-500" },
  peage:           { label: "Péage",             defaultVatRate: 20,  colorTw: "bg-orange-500/15 text-orange-500" },
  parking:         { label: "Parking",           defaultVatRate: 20,  colorTw: "bg-yellow-500/15 text-yellow-500" },
  repas:           { label: "Repas",             defaultVatRate: 10,  colorTw: "bg-pink-500/15 text-pink-500" },
  hotel:           { label: "Hôtel",             defaultVatRate: 10,  colorTw: "bg-indigo-500/15 text-indigo-500" },
  transport:       { label: "Transport",         defaultVatRate: 10,  colorTw: "bg-teal-500/15 text-teal-500" },
  fourniture:      { label: "Fournitures",       defaultVatRate: 20,  colorTw: "bg-purple-500/15 text-purple-500" },
  epi:             { label: "EPI",               defaultVatRate: 20,  colorTw: "bg-emerald-500/15 text-emerald-500" },
  outillage_petit: { label: "Petit outillage",   defaultVatRate: 20,  colorTw: "bg-violet-500/15 text-violet-500" },
  telecom:         { label: "Téléphone",         defaultVatRate: 20,  colorTw: "bg-sky-500/15 text-sky-500" },
  abonnement:      { label: "Abonnement",        defaultVatRate: 20,  colorTw: "bg-cyan-500/15 text-cyan-500" },
  cadeau:           { label: "Cadeau client",     defaultVatRate: 20,  colorTw: "bg-rose-500/15 text-rose-500" },
  autre:           { label: "Autre",             defaultVatRate: 20,  colorTw: "bg-slate-500/15 text-slate-500" },
});

export const EXPENSE_NOTE_STATUS_META: Record<ExpenseNoteStatus, {
  label: string;
  colorTw: string;
}> = safeMeta({
  brouillon:    { label: "Brouillon",     colorTw: "bg-slate-500/15 text-slate-500" },
  validee:      { label: "Validée",       colorTw: "bg-blue-500/15 text-blue-500" },
  remboursee:   { label: "Remboursée",    colorTw: "bg-emerald-500/15 text-emerald-500" },
  refacturee:   { label: "Refacturée",    colorTw: "bg-violet-500/15 text-violet-500" },
});

export const EXPENSE_NOTE_PAYER_META: Record<ExpenseNotePayer, {
  label: string;
}> = safeMeta({
  dirigeant:   { label: "Dirigeant" },
  employe:     { label: "Employé" },
  carte_pro:   { label: "Carte pro" },
});

// ─── Stats ────────────────────────────────────────────────────────────────
export interface ExpenseNoteStats {
  totalMonth: number;           // Total des notes du mois
  totalRefacturable: number;    // En attente de refacturation
  totalARembourser: number;     // En attente de remboursement
  notesCount: number;
}
