// ═══════════════════════════════════════════════════════════════════════════
// Types Comptabilité (Session 13 - Mix A+C : suivi + FEC)
// ═══════════════════════════════════════════════════════════════════════════

export type ExpenseCategory =
  | "materiaux"        // matériaux de construction
  | "outillage"        // matériel et outillage
  | "carburant"        // carburant véhicules
  | "vehicule"         // entretien, réparations, location véhicules
  | "sous_traitance"   // sous-traitants
  | "loyer"            // loyer atelier/local
  | "energie"          // électricité, gaz, eau du local
  | "telecom"          // téléphone, internet
  | "assurance"        // assurances pro (décennale, RC...)
  | "frais_bancaires"  // commissions, agios
  | "honoraires"       // expert-comptable, avocat
  | "fourniture"       // fournitures de bureau, EPI
  | "repas"            // restaurant, déjeuner chantier
  | "deplacement"      // péages, parking, hôtel
  | "formation"        // formations pro
  | "logiciel"         // abonnements logiciels
  | "publicite"        // marketing, cartes de visite
  | "autre";

export type PaymentMethod =
  | "cb"               // carte bancaire
  | "virement"         // virement bancaire
  | "prelevement"      // prélèvement
  | "cheque"
  | "espece"
  | "autre";

export type ExpenseStatus =
  | "a_payer"          // facture reçue, pas encore payée
  | "payee"            // payée
  | "annulee";         // annulée

export interface Expense {
  id: string;
  reference: string;          // numéro auto DEP-2026-0001
  supplierId: string;         // lien fournisseur (optionnel "")
  supplierName: string;       // dénormalisé pour affichage
  chantierId: string;         // chantier rattaché (optionnel)

  // Montants
  amountHt: number;
  amountVat: number;          // total TVA toutes lignes
  amountTtc: number;
  vatRate: number;            // taux principal (20, 10, 5.5, 0)

  // Détails
  category: ExpenseCategory;
  description: string;        // libellé court
  notes: string;              // notes additionnelles

  // Dates
  expenseDate: string;        // date de la facture (date de l'opération)
  dueDate: string;            // date d'échéance ("" si non applicable)
  paidDate: string;           // date de paiement effective ("" si non payée)

  // Statut & paiement
  status: ExpenseStatus;
  paymentMethod: PaymentMethod;

  // Justificatif (auto vault)
  receiptVaultDocumentId: string;   // id du document vault si justificatif uploadé

  // Métadonnées
  createdAt: string;
  updatedAt: string;
}

export const EXPENSE_CATEGORY_META: Record<ExpenseCategory, {
  label: string;
  emoji: string;            // pour affichage rapide (la convention sans-emoji UI ne s'applique qu'aux composants visuels — ici c'est dans des labels textuels, mais on les évitera dans le rendu)
  pcgAccount: string;       // compte PCG associé (pour FEC)
  colorTw: string;          // classe Tailwind
}> = {
  materiaux:       { label: "Matériaux",            emoji: "",  pcgAccount: "601000", colorTw: "bg-blue-500/15 text-blue-500" },
  outillage:       { label: "Outillage",             emoji: "",  pcgAccount: "606300", colorTw: "bg-violet-500/15 text-violet-500" },
  carburant:       { label: "Carburant",             emoji: "",  pcgAccount: "606100", colorTw: "bg-amber-500/15 text-amber-500" },
  vehicule:        { label: "Véhicule",              emoji: "",  pcgAccount: "615500", colorTw: "bg-orange-500/15 text-orange-500" },
  sous_traitance:  { label: "Sous-traitance",        emoji: "",  pcgAccount: "611000", colorTw: "bg-rose-500/15 text-rose-500" },
  loyer:           { label: "Loyer",                 emoji: "",  pcgAccount: "613200", colorTw: "bg-cyan-500/15 text-cyan-500" },
  energie:         { label: "Énergie",               emoji: "",  pcgAccount: "606100", colorTw: "bg-yellow-500/15 text-yellow-500" },
  telecom:         { label: "Téléphone / Internet", emoji: "",  pcgAccount: "626000", colorTw: "bg-sky-500/15 text-sky-500" },
  assurance:       { label: "Assurances",            emoji: "",  pcgAccount: "616000", colorTw: "bg-emerald-500/15 text-emerald-500" },
  frais_bancaires: { label: "Frais bancaires",       emoji: "",  pcgAccount: "627000", colorTw: "bg-slate-500/15 text-slate-500" },
  honoraires:      { label: "Honoraires",            emoji: "",  pcgAccount: "622600", colorTw: "bg-indigo-500/15 text-indigo-500" },
  fourniture:      { label: "Fournitures",           emoji: "",  pcgAccount: "606400", colorTw: "bg-purple-500/15 text-purple-500" },
  repas:           { label: "Repas",                 emoji: "",  pcgAccount: "625100", colorTw: "bg-pink-500/15 text-pink-500" },
  deplacement:     { label: "Déplacements",          emoji: "",  pcgAccount: "625100", colorTw: "bg-teal-500/15 text-teal-500" },
  formation:       { label: "Formation",             emoji: "",  pcgAccount: "628100", colorTw: "bg-lime-500/15 text-lime-500" },
  logiciel:        { label: "Logiciels",             emoji: "",  pcgAccount: "651600", colorTw: "bg-fuchsia-500/15 text-fuchsia-500" },
  publicite:       { label: "Publicité",             emoji: "",  pcgAccount: "623000", colorTw: "bg-red-500/15 text-red-500" },
  autre:           { label: "Autre",                 emoji: "",  pcgAccount: "658000", colorTw: "bg-gray-500/15 text-gray-500" },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cb:           "Carte bancaire",
  virement:     "Virement",
  prelevement:  "Prélèvement",
  cheque:       "Chèque",
  espece:       "Espèces",
  autre:        "Autre",
};

export const EXPENSE_STATUS_META: Record<ExpenseStatus, {
  label: string;
  colorTw: string;
}> = {
  a_payer:  { label: "À payer",  colorTw: "bg-amber-500/15 text-amber-500" },
  payee:    { label: "Payée",     colorTw: "bg-emerald-500/15 text-emerald-500" },
  annulee:  { label: "Annulée",   colorTw: "bg-slate-500/15 text-slate-500" },
};

// ─── Stats ────────────────────────────────────────────────────────────────
export interface FinanceStats {
  // CA (factures clients)
  caEncaisseMonth: number;          // CA encaissé ce mois
  caEncaisseYear: number;           // CA encaissé cette année
  caEnAttente: number;              // factures envoyées non payées

  // Dépenses
  expensesMonth: number;            // dépenses du mois
  expensesYear: number;             // dépenses de l'année
  expensesAPayer: number;           // dépenses à payer

  // Marge
  margeMonth: number;               // CA encaissé - dépenses du mois
  margeYear: number;                // CA encaissé - dépenses de l'année

  // TVA (cumulé année en cours)
  tvaCollectee: number;             // TVA des factures encaissées
  tvaDeductible: number;            // TVA des dépenses payées
  tvaAReverser: number;             // collectée - déductible
}

// ─── Top listings ─────────────────────────────────────────────────────────
export interface TopClient {
  clientId: string;
  clientName: string;
  totalCa: number;
  invoicesCount: number;
}

export interface TopSupplier {
  supplierId: string;
  supplierName: string;
  totalSpent: number;
  expensesCount: number;
}

export interface ChantierMargin {
  chantierId: string;
  chantierTitle: string;
  chantierReference: string;
  ca: number;                  // CA = factures émises pour ce chantier
  expenses: number;            // dépenses imputées au chantier
  marge: number;               // ca - expenses
  margePct: number;            // (marge / ca) * 100, ou 0 si ca = 0
}

// ─── Évolution mensuelle pour graph ───────────────────────────────────────
export interface MonthlyDataPoint {
  month: string;             // "2026-01", "2026-02", ...
  monthLabel: string;        // "Jan 26", "Fév 26"
  ca: number;
  expenses: number;
  marge: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
export function formatEuro(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) return "0 €";
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

export function getMonthLabel(yearMonth: string): string {
  // "2026-04" → "Avr 26"
  const [y, m] = yearMonth.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const monthIdx = parseInt(m || "1", 10) - 1;
  const yy = (y || "").slice(2);
  return `${months[monthIdx] || "?"} ${yy}`;
}
