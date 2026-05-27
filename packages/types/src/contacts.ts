// ═══════════════════════════════════════════════════════════════════════════
// Types Clients & Fournisseurs (Session 4)
// ═══════════════════════════════════════════════════════════════════════════

export type ContactType = "particulier" | "pro";

export type Civility = "M." | "Mme" | "M. et Mme" | "Mlle" | "Société" | "";

// ─── Client ──────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  type: ContactType;

  // Identité
  civility: Civility;
  firstName: string; // prénom (particulier) OU prénom interlocuteur (pro)
  lastName: string;  // nom (particulier) OU nom interlocuteur (pro)
  companyName: string; // raison sociale (pro uniquement)

  // Contact
  email: string;
  phoneMobile: string;
  phoneFixed: string;

  // Adresse principale
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;

  // Adresse de facturation (si différente)
  billingAddressSame: boolean;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingPostalCode: string;
  billingCity: string;
  billingCountry: string;

  // Pro only
  siret: string;
  siren: string;
  tvaIntracom: string;
  legalForm: string;
  apeCode: string;
  apeLabel: string;

  // Metadata
  tags: string[];         // ex: ["VIP", "Prospect"]
  source: string;         // ex: "Bouche à oreille", "Google", "Référencement"
  notes: string;
  firstContactAt: string; // ISO date
  // Compte auxiliaire client (Session 30 — compta partie double).
  // Format 411xxx, auto-attribué à la 1ère écriture comptable du client.
  accountNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Fournisseur (Supplier) ──────────────────────────────────────────────
export interface Supplier {
  id: string;

  // Identité
  companyName: string;
  contactFirstName: string; // interlocuteur principal
  contactLastName: string;

  // Contact
  email: string;
  phoneMobile: string;
  phoneFixed: string;
  website: string;

  // Adresse
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;

  // Légal
  siret: string;
  siren: string;
  tvaIntracom: string;
  legalForm: string;
  apeCode: string;
  apeLabel: string;

  // Spécifique fournisseur
  category: string;          // "Matériaux", "Outillage", "Sous-traitant", "Services", "Autre"
  iban: string;              // pour virement
  bic: string;
  paymentTermsDays: number;  // 30 = net 30, 45, 60, etc.
  paymentMethod: string;     // "Virement", "Chèque", "Prélèvement"

  // Metadata
  tags: string[];
  notes: string;
  // Compte auxiliaire fournisseur (Session 30 — compta partie double).
  // Format 401xxx, auto-attribué à la 1ère écriture comptable.
  accountNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Configuration entreprise (l'utilisateur lui-même) ───────────────────
export interface CompanyProfile {
  // Identité
  companyName: string;
  tradingName: string; // nom commercial si différent
  legalForm: string;

  // Légal
  siret: string;
  siren: string;
  tvaIntracom: string;
  tvaApplicable: boolean;  // false = micro-entreprise non assujetti
  apeCode: string;
  apeLabel: string;
  rcs: string; // numéro RCS si applicable

  // Dirigeant (pour documents officiels)
  leaderFirstName: string;
  leaderLastName: string;
  leaderRole: string; // "Gérant", "Président", etc.

  // Coordonnées
  email: string;
  phoneMobile: string;
  phoneFixed: string;
  website: string;

  // Adresse siège
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;

  // Bancaire (pour factures)
  iban: string;
  bic: string;
  bankName: string;

  // Assurances BTP (obligatoires)
  decennaleCompany: string;
  decennaleContract: string;
  decennaleZone: string;      // zone géographique
  decennaleActivities: string; // activités couvertes
  rcProCompany: string;
  rcProContract: string;

  // Visuel
  logoPath: string; // chemin local du logo

  createdAt: string;
  updatedAt: string;
}

// ─── Empty templates ─────────────────────────────────────────────────────
export const EMPTY_CLIENT: Omit<Client, "id" | "createdAt" | "updatedAt"> = {
  type: "particulier",
  civility: "M.",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phoneMobile: "",
  phoneFixed: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "France",
  billingAddressSame: true,
  billingAddressLine1: "",
  billingAddressLine2: "",
  billingPostalCode: "",
  billingCity: "",
  billingCountry: "France",
  siret: "",
  siren: "",
  tvaIntracom: "",
  legalForm: "",
  apeCode: "",
  apeLabel: "",
  tags: [],
  source: "",
  notes: "",
  firstContactAt: "",
};

export const EMPTY_SUPPLIER: Omit<Supplier, "id" | "createdAt" | "updatedAt"> = {
  companyName: "",
  contactFirstName: "",
  contactLastName: "",
  email: "",
  phoneMobile: "",
  phoneFixed: "",
  website: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "France",
  siret: "",
  siren: "",
  tvaIntracom: "",
  legalForm: "",
  apeCode: "",
  apeLabel: "",
  category: "Matériaux",
  iban: "",
  bic: "",
  paymentTermsDays: 30,
  paymentMethod: "Virement",
  tags: [],
  notes: "",
};

export const SUPPLIER_CATEGORIES = [
  "Matériaux",
  "Outillage",
  "Sous-traitant",
  "Services",
  "Transport",
  "Location",
  "Énergie",
  "Télécom",
  "Autre",
];
