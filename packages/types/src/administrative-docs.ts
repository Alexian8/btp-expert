// ═══════════════════════════════════════════════════════════════════════════
// Types Documents administratifs BTP (Session 17)
//
// Couvre :
//   - PV de réception de chantier (norme NF P 03-001)
//   - Attestations TVA 10% et 5.5% (CERFA 1300-SD ou modèle libre)
//   - DC4 - Déclaration de sous-traitance (marchés publics)
//   - Documents RGE / MaPrimeRénov' (préparation 2026)
// ═══════════════════════════════════════════════════════════════════════════

import { safeMeta } from "./safe-meta";

// ═══════════════════════════════════════════════════════════════════════════
// PV DE RÉCEPTION DE CHANTIER
// ═══════════════════════════════════════════════════════════════════════════

export type ReceptionStatus =
  | "brouillon"
  | "signe"              // signé par les deux parties
  | "annule";

export type ReceptionType =
  | "sans_reserves"      // réception conforme
  | "avec_reserves"      // réserves émises (à lever)
  | "refusee";           // réception refusée

export interface ReceptionReserve {
  id: string;
  reportId: string;
  description: string;
  location: string;          // ex: "Chambre 1, mur Est"
  category: string;          // ex: "finition", "défaut", "non-conforme"
  toBeFixedBefore: string;   // date limite levée
  fixed: boolean;
  fixedDate: string;
  sortOrder: number;
}

export interface ReceptionReport {
  id: string;
  reference: string;             // PV-2026-0001

  // Liens
  chantierId: string;
  clientId: string;
  clientName: string;            // dénormalisé

  // Type
  receptionType: ReceptionType;

  // Dates
  receptionDate: string;         // date de la réception
  guaranteeStartDate: string;    // début garantie décennale (généralement = receptionDate)

  // Localisation
  location: string;              // adresse précise du chantier

  // Présents
  ownerPresent: string;          // nom du maître d'ouvrage présent
  contractorPresent: string;     // nom de l'entreprise présent

  // Description travaux
  worksDescription: string;       // résumé des travaux réceptionnés

  // Observations
  observations: string;
  retentionAmount: number;       // montant de garantie retenue
  retentionReleaseDate: string;  // date prévue libération

  // Signatures
  ownerSigned: boolean;
  ownerSignedDate: string;
  contractorSigned: boolean;
  contractorSignedDate: string;

  // Document
  status: ReceptionStatus;
  vaultDocumentId: string;       // PDF signé chiffré

  createdAt: string;
  updatedAt: string;
}

export const RECEPTION_TYPE_META: Record<ReceptionType, {
  label: string;
  colorTw: string;
  description: string;
}> = safeMeta({
  sans_reserves: {
    label: "Sans réserves",
    colorTw: "bg-emerald-500/15 text-emerald-500",
    description: "Réception conforme, garantie décennale active",
  },
  avec_reserves: {
    label: "Avec réserves",
    colorTw: "bg-amber-500/15 text-amber-500",
    description: "Réserves à lever dans le délai imparti",
  },
  refusee: {
    label: "Refusée",
    colorTw: "bg-red-500/15 text-red-500",
    description: "Travaux non réceptionnés",
  },
});

export const RECEPTION_STATUS_META: Record<ReceptionStatus, { label: string; colorTw: string }> = safeMeta({
  brouillon: { label: "Brouillon", colorTw: "bg-slate-500/15 text-slate-500" },
  signe:     { label: "Signé",      colorTw: "bg-emerald-500/15 text-emerald-500" },
  annule:    { label: "Annulé",     colorTw: "bg-red-500/15 text-red-500" },
});

// ═══════════════════════════════════════════════════════════════════════════
// ATTESTATIONS TVA RÉDUITE
// ═══════════════════════════════════════════════════════════════════════════

export type TvaAttestationType =
  | "simplifiee"            // modèle libre (signé client)
  | "cerfa_1300";           // CERFA 1300-SD officiel

export type TvaRate = 5.5 | 10;

export type TvaAttestationCategory =
  | "amelioration_qualite"  // amélioration, transformation, aménagement, entretien (10%)
  | "renovation_energetique" // travaux d'isolation, équipements éco (5.5%)
  | "construction_neuf"      // ne s'applique pas, pour exclusion
  | "autre";

export type LogementType =
  | "residence_principale"
  | "residence_secondaire"
  | "logement_loue"           // mis en location
  | "ehpad"                   // établissement médico-social
  | "autre";

export type TvaAttestationStatus =
  | "brouillon"
  | "signee"                  // signée par le client
  | "archivee";               // > 5 ans

export interface TvaAttestation {
  id: string;
  reference: string;           // ATT-2026-0001

  // Type
  attestationType: TvaAttestationType;
  tvaRate: TvaRate;

  // Liens
  chantierId: string;
  clientId: string;
  clientName: string;

  // Logement
  logementType: LogementType;
  logementBuiltOver2Years: boolean;     // condition obligatoire
  logementYearOfConstruction: string;
  logementAddress: string;

  // Maître d'ouvrage (= client)
  ownerCivilite: "M." | "Mme" | "M. et Mme" | "";
  ownerLastName: string;
  ownerFirstName: string;
  ownerEmail: string;
  ownerPhone: string;

  // Travaux
  category: TvaAttestationCategory;
  worksDescription: string;
  worksStartDate: string;
  worksEndDate: string;
  totalAmountHt: number;
  invoiceReference: string;             // facture associée si déjà émise

  // Engagement client
  clientCommitments: string[];          // engagements cochés (textes pré-remplis)

  // Signature
  signedDate: string;
  signedLocation: string;

  // Document
  status: TvaAttestationStatus;
  vaultDocumentId: string;

  createdAt: string;
  updatedAt: string;
}

export const TVA_RATE_META: Record<string, {
  label: string;
  description: string;
  colorTw: string;
}> = safeMeta({
  "5.5": {
    label: "TVA 5,5%",
    description: "Travaux d'amélioration de la qualité énergétique",
    colorTw: "bg-emerald-500/15 text-emerald-500",
  },
  "10": {
    label: "TVA 10%",
    description: "Travaux d'amélioration, transformation, aménagement, entretien",
    colorTw: "bg-blue-500/15 text-blue-500",
  },
});

export const LOGEMENT_TYPE_META: Record<LogementType, { label: string }> = safeMeta({
  residence_principale:   { label: "Résidence principale" },
  residence_secondaire:   { label: "Résidence secondaire" },
  logement_loue:           { label: "Logement loué" },
  ehpad:                   { label: "EHPAD / médico-social" },
  autre:                   { label: "Autre" },
});

export const TVA_ATTESTATION_STATUS_META: Record<TvaAttestationStatus, { label: string; colorTw: string }> = safeMeta({
  brouillon:  { label: "Brouillon", colorTw: "bg-slate-500/15 text-slate-500" },
  signee:     { label: "Signée",     colorTw: "bg-emerald-500/15 text-emerald-500" },
  archivee:   { label: "Archivée",   colorTw: "bg-blue-500/15 text-blue-500" },
});

// Engagements pré-remplis selon le taux TVA
export const TVA_5_5_COMMITMENTS = [
  "Le logement est achevé depuis plus de 2 ans à la date de début des travaux",
  "Le logement est affecté à l'habitation",
  "Les travaux portent sur des matériaux et équipements éligibles au taux de 5,5%",
  "Je m'engage à conserver cette attestation et la facture pendant 5 ans",
];

export const TVA_10_COMMITMENTS = [
  "Le logement est achevé depuis plus de 2 ans à la date de début des travaux",
  "Le logement est affecté à l'habitation",
  "Les travaux ne concourent pas à la production d'un immeuble neuf",
  "Les travaux n'augmentent pas la surface de plancher de plus de 10%",
  "Je m'engage à conserver cette attestation et la facture pendant 5 ans",
];

// ═══════════════════════════════════════════════════════════════════════════
// DC4 - DÉCLARATION DE SOUS-TRAITANCE (marchés publics)
// ═══════════════════════════════════════════════════════════════════════════

export type Dc4Status =
  | "brouillon"
  | "envoyee"               // envoyée au pouvoir adjudicateur
  | "acceptee"              // acceptée
  | "refusee";

export interface Dc4Declaration {
  id: string;
  reference: string;            // DC4-2026-0001

  // Liens
  purchaseOrderId: string;       // BdC sous-traitant lié
  subcontractorId: string;
  subcontractorName: string;
  chantierId: string;

  // Marché public
  publicMarketReference: string;  // n° de marché
  publicMarketObject: string;     // objet du marché
  publicAuthorityName: string;    // pouvoir adjudicateur (mairie, etc.)
  publicAuthorityAddress: string;

  // Sous-traitance déclarée
  subcontractedWorksDescription: string;
  subcontractedAmountHt: number;
  subcontractedAmountTtc: number;
  subcontractedDuration: string;     // ex: "3 mois"

  // Conditions de paiement
  paymentMethod: string;             // ex: "Paiement direct par le maître d'ouvrage"
  paymentDelay: number;              // jours

  // Caution / garantie
  cautionType: string;               // ex: "Caution bancaire", "Aucune"
  cautionRequired: boolean;
  cautionReceived: boolean;

  // Signature
  signedDate: string;
  signedLocation: string;

  // Document
  status: Dc4Status;
  vaultDocumentId: string;

  createdAt: string;
  updatedAt: string;
}

export const DC4_STATUS_META: Record<Dc4Status, { label: string; colorTw: string }> = safeMeta({
  brouillon: { label: "Brouillon", colorTw: "bg-slate-500/15 text-slate-500" },
  envoyee:   { label: "Envoyée",   colorTw: "bg-blue-500/15 text-blue-500" },
  acceptee:  { label: "Acceptée",  colorTw: "bg-emerald-500/15 text-emerald-500" },
  refusee:   { label: "Refusée",   colorTw: "bg-red-500/15 text-red-500" },
});

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTS RGE / MaPrimeRénov' (préparation 2026)
// ═══════════════════════════════════════════════════════════════════════════

export type RgeDocumentType =
  | "qualification"           // certificat de qualification (Qualibat, Qualibois…)
  | "devis_rge"               // devis avec mentions RGE obligatoires
  | "facture_rge"             // facture avec mentions
  | "attestation_rge"         // attestation de fin de travaux RGE
  | "fiche_technique"         // fiche technique équipement
  | "autre";

export interface RgeDocument {
  id: string;
  reference: string;

  type: RgeDocumentType;
  chantierId: string;
  clientId: string;
  clientName: string;

  rgeQualification: string;     // Qualibat, Qualibois...
  rgeQualificationNumber: string;
  rgeValidUntil: string;        // ISO date — date de fin de validité

  worksDescription: string;
  totalAmountTtc: number;
  primeRenovExpected: number;   // estimation aide MaPrimeRénov'
  primeRenovActual: number;     // montant effectivement versé

  notes: string;
  vaultDocumentId: string;

  createdAt: string;
  updatedAt: string;
}

export const RGE_DOCUMENT_TYPE_META: Record<RgeDocumentType, { label: string }> = safeMeta({
  qualification:    { label: "Qualification RGE" },
  devis_rge:        { label: "Devis RGE" },
  facture_rge:      { label: "Facture RGE" },
  attestation_rge:  { label: "Attestation fin de travaux RGE" },
  fiche_technique:  { label: "Fiche technique" },
  autre:            { label: "Autre" },
});

/** Référentiel des qualifications RGE reconnues par France Rénov'. */
export const RGE_QUALIFICATIONS = [
  "Qualibat RGE",
  "Qualifelec RGE",
  "Qualibois",
  "QualiPV",
  "QualiSol",
  "Qualipac",
  "Chauffage+",
  "Ventilation+",
  "Autre",
] as const;
export type RgeQualification = (typeof RGE_QUALIFICATIONS)[number];

// ═══════════════════════════════════════════════════════════════════════════
// Stats globales
// ═══════════════════════════════════════════════════════════════════════════

export interface AdministrativeDocsStats {
  receptionsTotal: number;
  receptionsWithReserves: number;
  tvaAttestationsTotal: number;
  tvaAttestationsThisYear: number;
  dc4Total: number;
  dc4Pending: number;            // envoyées en attente de réponse
  rgeDocumentsTotal: number;
}
