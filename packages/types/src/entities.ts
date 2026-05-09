// ═══════════════════════════════════════════════════════════════════════════
// Types métier BTP — modèles de données fondamentaux
// ═══════════════════════════════════════════════════════════════════════════
//
// NOTE v16 (Session 4) :
//   Les interfaces Client et Fournisseur initiales (calquées sur v15)
//   sont renommées en *Legacy* pour éviter les conflits avec les nouveaux
//   types complets définis dans ./contacts.ts.
//   Les types "Legacy" seront utilisés uniquement pour la migration v15→v16
//   (session 19). Le reste de l'app utilise les types modernes de contacts.ts.
// ═══════════════════════════════════════════════════════════════════════════

export interface ClientLegacy {
  id: number;
  civilite?: "M." | "Mme" | "";
  nom: string;
  prenom?: string;
  entreprise?: string;
  adresse?: string;
  codePostal?: string;
  commune?: string;
  tel?: string;
  email?: string;
  createdAt?: string;
}

export interface FournisseurLegacy {
  id: number;
  nom: string;
  siret?: string;
  adresse?: string;
  tel?: string;
  email?: string;
  iban?: string;
  createdAt?: string;
}

export interface ChantierLegacy {
  id: number;
  nom: string;
  clientId: number;
  adresse?: string;
  codePostal?: string;
  commune?: string;
  nature?: string;
  status?: "Prospect" | "En cours" | "Terminé" | "Annulé";
  dateDebut?: string;
  dateFin?: string;
  budget?: number;
  signature?: string;
  createdAt?: string;
}

export interface InvoiceLine {
  id: string;
  designation: string;
  unite?: string;
  qte: number;
  puHT: number;
  tva: number;
  remise?: number;
}

// ─── Types legacy (v15) — renommés pour éviter conflit avec invoices.ts (Session 10) ───
export type LegacyInvoiceType = "Devis" | "Facture" | "Avoir";
export type LegacyInvoiceStatus = "Brouillon" | "Envoyé" | "Accepté" | "Refusé" | "Payé" | "En retard";

export interface LegacyInvoice {
  id: string;
  type: LegacyInvoiceType;
  clientId: number;
  chantierId?: number;
  date: string;
  echeance?: string;
  status: LegacyInvoiceStatus;
  objet?: string;
  lignes: InvoiceLine[] | string;
  remiseGlobale?: number;
  acompte?: number;
  acompteLabel?: string;
  conditionsPaiement?: string;
  includeCGV?: boolean;
  montantHT?: number;
  montantTVA?: number;
  montantTTC?: number;
  signature?: string;
  createdAt?: string;
}

export interface LegacyVaultDocument {
  id: number;
  nom: string;
  categorie: string;
  chantierId?: number;
  chiffre: number;
  iv?: string;
  path: string;
  taille?: number;
  createdAt?: string;
}

export interface CGVClause {
  id: number;
  titre: string;
  categorie?: string;
  contenu: string;
  ordre?: number;
  favori?: number;
  createdAt?: string;
}

export interface ChantierClause {
  id: number;
  chantierId: number;
  clauseId?: number;
  customTitle?: string;
  customContent?: string;
  ordre?: number;
}

export interface User {
  id: number;
  username: string;
  role?: "admin" | "user";
  createdAt?: string;
}
