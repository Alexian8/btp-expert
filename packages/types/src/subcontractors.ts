// ═══════════════════════════════════════════════════════════════════════════
// Types Sous-traitants (Session 15)
//
// IMPORTANT - Différences avec Fournisseur :
//   - Fournisseur (S5) = vend matériaux/services (Leroy Merlin)
//   - Sous-traitant (S15) = exécute une partie de TES chantiers en ton nom
//     avec TES responsabilités vis-à-vis du client final
//   - Réglementé par la loi du 31/12/1975
// ═══════════════════════════════════════════════════════════════════════════

export type SubcontractorActivity =
  | "maconnerie"      // Maçonnerie / gros œuvre
  | "couverture"      // Couverture / zinguerie
  | "menuiserie"      // Menuiserie int/ext
  | "plomberie"       // Plomberie sanitaire
  | "electricite"     // Électricité
  | "chauffage"       // Chauffage / clim
  | "platrerie"       // Plâtrerie / isolation
  | "carrelage"       // Carrelage / faïence
  | "peinture"        // Peinture / décoration
  | "vrd"             // Voirie / réseaux divers
  | "demolition"      // Démolition
  | "etancheite"      // Étanchéité
  | "facade"          // Façade / ITE
  | "metallerie"      // Métallerie / serrurerie
  | "autre";

export interface Subcontractor {
  id: string;

  // Identité
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  contactRole: string;           // ex: "Gérant", "Conducteur de travaux"

  // Activité principale
  activity: SubcontractorActivity;
  activityNotes: string;          // détail libre des spécialités

  // Légal
  siret: string;
  rcs: string;                   // RCS / Greffe
  legalForm: string;             // SARL, EURL, SAS, EI...
  capital: string;
  tvaNumber: string;             // num TVA intracom

  // Coordonnées
  email: string;
  phone: string;
  mobile: string;
  website: string;

  // Adresse
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;

  // Coordonnées bancaires
  iban: string;
  bic: string;
  bankName: string;

  // Métadonnées
  isActive: boolean;             // sous-traitant actif ou archivé
  rating: number;                 // 0-5 étoiles
  notes: string;
  defaultVatRate: number;         // taux TVA habituel

  createdAt: string;
  updatedAt: string;
}

export const SUBCONTRACTOR_ACTIVITY_META: Record<SubcontractorActivity, {
  label: string;
  colorTw: string;
}> = {
  maconnerie:   { label: "Maçonnerie",          colorTw: "bg-stone-500/15 text-stone-500" },
  couverture:   { label: "Couverture",          colorTw: "bg-slate-500/15 text-slate-500" },
  menuiserie:   { label: "Menuiserie",          colorTw: "bg-amber-700/15 text-amber-700" },
  plomberie:    { label: "Plomberie",           colorTw: "bg-blue-500/15 text-blue-500" },
  electricite:  { label: "Électricité",         colorTw: "bg-yellow-500/15 text-yellow-500" },
  chauffage:    { label: "Chauffage",           colorTw: "bg-orange-500/15 text-orange-500" },
  platrerie:    { label: "Plâtrerie",           colorTw: "bg-neutral-500/15 text-neutral-500" },
  carrelage:    { label: "Carrelage",           colorTw: "bg-teal-500/15 text-teal-500" },
  peinture:     { label: "Peinture",            colorTw: "bg-pink-500/15 text-pink-500" },
  vrd:          { label: "VRD",                  colorTw: "bg-zinc-500/15 text-zinc-500" },
  demolition:   { label: "Démolition",          colorTw: "bg-red-500/15 text-red-500" },
  etancheite:   { label: "Étanchéité",           colorTw: "bg-cyan-500/15 text-cyan-500" },
  facade:       { label: "Façade / ITE",         colorTw: "bg-emerald-500/15 text-emerald-500" },
  metallerie:   { label: "Métallerie",           colorTw: "bg-gray-600/15 text-gray-600" },
  autre:        { label: "Autre",                colorTw: "bg-slate-500/15 text-slate-500" },
};

// ═══════════════════════════════════════════════════════════════════════════
// Attestations (URSSAF, décennale, RC, fiscale, etc.)
// ═══════════════════════════════════════════════════════════════════════════

export type AttestationType =
  | "urssaf"            // Attestation vigilance URSSAF (semestrielle)
  | "fiscale"            // Attestation régularité fiscale
  | "decennale"          // Assurance décennale
  | "rc_pro"             // RC professionnelle
  | "qualibat"           // Certification Qualibat
  | "rge"                // Reconnu Garant Environnement
  | "kbis"               // Extrait Kbis (3 mois)
  | "list_salaries"      // Liste nominative salariés étrangers
  | "vigilance_etranger" // Attestation vigilance étranger (détachement)
  | "autre";

export interface SubcontractorAttestation {
  id: string;
  subcontractorId: string;

  type: AttestationType;
  customLabel: string;          // si type=autre
  reference: string;             // numéro / référence du document
  issuedDate: string;            // date d'émission
  expirationDate: string;        // date d'expiration

  // Lien coffre-fort
  vaultDocumentId: string;       // doc chiffré dans le coffre

  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const ATTESTATION_TYPE_META: Record<AttestationType, {
  label: string;
  defaultDurationMonths: number;  // durée de validité par défaut
  required: boolean;              // requise par la loi
  colorTw: string;
}> = {
  urssaf:              { label: "Attestation URSSAF",            defaultDurationMonths: 6,  required: true,  colorTw: "bg-emerald-500/15 text-emerald-500" },
  fiscale:             { label: "Régularité fiscale",            defaultDurationMonths: 12, required: true,  colorTw: "bg-blue-500/15 text-blue-500" },
  decennale:           { label: "Assurance décennale",            defaultDurationMonths: 12, required: true,  colorTw: "bg-violet-500/15 text-violet-500" },
  rc_pro:              { label: "RC professionnelle",             defaultDurationMonths: 12, required: true,  colorTw: "bg-indigo-500/15 text-indigo-500" },
  qualibat:            { label: "Qualibat",                       defaultDurationMonths: 48, required: false, colorTw: "bg-amber-500/15 text-amber-500" },
  rge:                  { label: "RGE",                            defaultDurationMonths: 48, required: false, colorTw: "bg-green-500/15 text-green-500" },
  kbis:                 { label: "Extrait Kbis",                   defaultDurationMonths: 3,  required: true,  colorTw: "bg-orange-500/15 text-orange-500" },
  list_salaries:        { label: "Liste salariés étrangers",      defaultDurationMonths: 6,  required: false, colorTw: "bg-pink-500/15 text-pink-500" },
  vigilance_etranger:   { label: "Vigilance étrangers",            defaultDurationMonths: 6,  required: false, colorTw: "bg-rose-500/15 text-rose-500" },
  autre:                { label: "Autre",                           defaultDurationMonths: 12, required: false, colorTw: "bg-slate-500/15 text-slate-500" },
};

// ─── Statut d'une attestation (calculé) ───────────────────────────────────
export type AttestationStatus = "valide" | "expire_bientot" | "expiree";

export function getAttestationStatus(expirationDate: string, warningDays = 30): AttestationStatus {
  if (!expirationDate) return "valide";
  try {
    const exp = new Date(expirationDate);
    const now = new Date();
    const daysLeft = Math.floor((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft < 0) return "expiree";
    if (daysLeft <= warningDays) return "expire_bientot";
    return "valide";
  } catch {
    return "valide";
  }
}

export const ATTESTATION_STATUS_META: Record<AttestationStatus, {
  label: string;
  colorTw: string;
}> = {
  valide:          { label: "Valide",         colorTw: "bg-emerald-500/15 text-emerald-500" },
  expire_bientot:  { label: "Expire bientôt", colorTw: "bg-amber-500/15 text-amber-500" },
  expiree:         { label: "EXPIRÉE",        colorTw: "bg-red-500/15 text-red-500" },
};

// ═══════════════════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════════════════

export interface SubcontractorStats {
  totalActive: number;
  totalArchived: number;
  attestationsExpired: number;
  attestationsExpiringSoon: number;
  totalContractsAmount: number;       // total HT BdC en cours
  pendingPayments: number;             // situations validées non payées
}
