// ═══════════════════════════════════════════════════════════════════════════
// Types Chantiers (Session 6 + Session 7)
// ═══════════════════════════════════════════════════════════════════════════

import { safeMeta } from "./safe-meta";

export type ChantierStatus = "prospect" | "en-cours" | "termine" | "annule";

export type ChantierPriority = "low" | "normal" | "high";

export interface ChantierPhoto {
  id: string;
  path: string;        // chemin local absolu
  caption: string;
  createdAt: string;
}

// ─── Session 7 : Événements timeline ─────────────────────────────────────
export type ChantierEventKind =
  | "created"         // chantier créé
  | "status-changed"  // statut changé
  | "note"            // note manuelle ajoutée
  | "document-added"  // document uploadé
  | "document-removed"// document supprimé
  | "photo-added"     // photo ajoutée
  | "signed-start"    // PV d'ouverture signé
  | "signed-end";     // PV de réception signé

export interface ChantierEvent {
  id: string;
  chantierId: string;
  kind: ChantierEventKind;
  title: string;
  description?: string;
  meta?: Record<string, any>;  // ex: { from: "prospect", to: "en-cours" }
  createdAt: string;
  createdBy: string;
}

// ─── Session 7 : Documents attachés ──────────────────────────────────────
export interface ChantierDocument {
  id: string;
  chantierId: string;
  name: string;          // nom de fichier affiché (ex: "Devis client.pdf")
  path: string;          // chemin local absolu
  size: number;          // bytes
  mimeType: string;      // ex: "application/pdf"
  category: string;      // "Devis", "Photo", "Plan", "Autre"
  notes?: string;
  createdAt: string;
}

export const DOCUMENT_CATEGORIES = [
  "Devis", "Facture", "Plan", "Photo", "Contrat", "Attestation", "Permis", "Autre",
];

// ─── Session 7 : Signatures PV ───────────────────────────────────────────
export interface ChantierSignature {
  id: string;
  chantierId: string;
  kind: "start" | "end";          // PV ouverture / réception
  signerName: string;              // nom du signataire (client)
  signerRole: string;              // "Maître d'ouvrage", "Représentant", ...
  signatureDataUrl: string;        // data URL (image PNG base64)
  notes?: string;
  signedAt: string;
}

export interface Chantier {
  id: string;

  // Identification
  reference: string;
  title: string;
  status: ChantierStatus;
  priority: ChantierPriority;

  // Liaisons
  clientId: string;

  // Lieu
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;

  // Nature
  nature: string;
  description: string;

  // Planning
  startDateEstimated: string;
  endDateEstimated: string;
  startDateActual: string;
  endDateActual: string;

  // Finances
  budgetEstimatedHT: number;
  budgetEstimatedTTC: number;

  // Photos
  photos: ChantierPhoto[];

  // Tags
  tags: string[];

  // Catégorie poste / corps d'état (Session 22)
  categoryId?: string;

  // Notes
  notes: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────
export const CHANTIER_STATUS_META: Record<ChantierStatus, { label: string; color: string }> = safeMeta({
  // Sémantique terrain (Kanban coloré) : prospect bleu-gris · en cours
  // orange · terminé vert · annulé rouge
  "prospect":  { label: "Prospect",  color: "slate"    },
  "en-cours":  { label: "En cours",  color: "amber"    },
  "termine":   { label: "Terminé",   color: "emerald"  },
  "annule":    { label: "Annulé",    color: "rose"     },
});

export const CHANTIER_STATUS_ORDER: ChantierStatus[] = ["prospect", "en-cours", "termine", "annule"];

export const CHANTIER_PRIORITY_META: Record<ChantierPriority, { label: string; color: string }> = safeMeta({
  "low":    { label: "Basse",  color: "slate" },
  "normal": { label: "Normale", color: "blue" },
  "high":   { label: "Haute",  color: "amber" },
});

export const COMMON_CHANTIER_TAGS = [
  "Rénovation", "Neuf", "Extension", "Toiture", "Plomberie",
  "Électricité", "Peinture", "Carrelage", "Maçonnerie", "Isolation",
  "Menuiserie", "Urgent", "Gros œuvre", "Second œuvre", "Garantie",
];

// ─── Empty template ──────────────────────────────────────────────────────
export const EMPTY_CHANTIER: Omit<Chantier, "id" | "reference" | "createdAt" | "updatedAt"> = {
  title: "",
  status: "prospect",
  priority: "normal",
  clientId: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "France",
  nature: "",
  description: "",
  startDateEstimated: "",
  endDateEstimated: "",
  startDateActual: "",
  endDateActual: "",
  budgetEstimatedHT: 0,
  budgetEstimatedTTC: 0,
  photos: [],
  tags: [],
  categoryId: "",
  notes: "",
};
