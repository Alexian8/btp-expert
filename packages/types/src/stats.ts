// ═══════════════════════════════════════════════════════════════════════════
// Types Statistiques avancées (Session 16)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Pipeline devis ───────────────────────────────────────────────────────
export interface QuotePipelineStats {
  // Compteurs
  countBrouillon: number;
  countEnvoye: number;
  countAccepte: number;
  countRefuse: number;
  countFactured: number;        // accepté ET facturé

  // Montants HT
  amountBrouillon: number;
  amountEnvoye: number;          // valeur des devis en attente de signature
  amountAccepte: number;         // accepté mais pas encore facturé (= carnet de commandes)
  amountFactured: number;        // accepté ET déjà facturé
  amountRefuse: number;          // perdu

  // Taux de conversion (%)
  conversionEnvoyeToAccepte: number;   // signature
  conversionGlobal: number;            // de la création à l'acceptation

  // Délai moyen de signature (jours)
  avgSignatureDelayDays: number;

  // Devis "anciens" (envoyés mais sans réponse > 30 jours)
  oldEnvoyeCount: number;
  oldEnvoyeAmount: number;
}

// ─── Délais de paiement ───────────────────────────────────────────────────
export interface PaymentDelayStats {
  // Globaux
  avgPaymentDelayDays: number;        // délai moyen entre issueDate et paidAt
  avgLatenessDays: number;            // retard moyen au-delà de dueDate (positif = retard)

  // Factures actuelles
  invoicesOverdueCount: number;       // factures non payées dont dueDate dépassée
  invoicesOverdueAmount: number;      // somme TTC en retard
  invoicesPendingCount: number;       // factures envoyées non payées (in délai)
  invoicesPendingAmount: number;
}

export interface ClientPaymentDelay {
  clientId: string;
  clientName: string;
  invoicesPaidCount: number;
  avgDelayDays: number;              // délai moyen de paiement
  avgLatenessDays: number;           // retard moyen
  totalPaid: number;                  // total réglé par ce client
  worstLatenessDays: number;          // pire retard
}

export interface OverdueInvoice {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  totalTtc: number;
  totalPaid: number;
  remainingAmount: number;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;                // jours de retard depuis dueDate
}

// ─── Comparatif Year-over-Year ────────────────────────────────────────────
export interface YoYComparisonRow {
  month: number;              // 1-12
  monthLabel: string;          // "Janvier"
  caCurrent: number;           // CA encaissé année courante
  caPrevious: number;          // CA encaissé année N-1
  caDeltaPct: number;          // évolution en %
  expensesCurrent: number;
  expensesPrevious: number;
  expensesDeltaPct: number;
  margeCurrent: number;
  margePrevious: number;
  margeDeltaPct: number;
}

export interface YoYComparison {
  yearCurrent: number;
  yearPrevious: number;

  // Totaux annuels
  caTotalCurrent: number;
  caTotalPrevious: number;
  caEvolutionPct: number;

  expensesTotalCurrent: number;
  expensesTotalPrevious: number;
  expensesEvolutionPct: number;

  margeTotalCurrent: number;
  margeTotalPrevious: number;
  margeEvolutionPct: number;

  // Détail par mois
  monthly: YoYComparisonRow[];
}

// ─── Saisonnalité ─────────────────────────────────────────────────────────
export interface SeasonalityCell {
  year: number;
  month: number;            // 1-12
  ca: number;
}

export interface SeasonalityData {
  cells: SeasonalityCell[];     // toutes les cellules année×mois disponibles
  years: number[];               // années couvertes
  // Pour l'échelle de couleur
  maxCa: number;
  // Moyenne par mois sur toutes années (utile pour identifier creux/pics)
  monthlyAverage: Array<{ month: number; avgCa: number }>;
}

// ─── Helpers d'affichage ──────────────────────────────────────────────────
export function getMonthShortLabel(month: number): string {
  const labels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return labels[month - 1] || "?";
}

export function getMonthLongLabel(month: number): string {
  const labels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return labels[month - 1] || "?";
}

export function formatPctEvolution(pct: number): string {
  if (pct === 0) return "0 %";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)} %`;
}
