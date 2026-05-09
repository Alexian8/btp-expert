// ═══════════════════════════════════════════════════════════════════════════
// Types Coffre-fort (Session 11)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Dossier ──────────────────────────────────────────────────────────────
export interface VaultFolder {
  id: string;
  parentId: string;        // "" si racine
  name: string;
  iconKey: string;         // "folder" | "shield" | "users" | "hammer" | etc.
  colorKey: string;        // "default" | "blue" | "amber" | etc.

  // Liaison automatique (folder de client/chantier)
  clientId: string;        // si dossier = "Documents de [Client]"
  chantierId: string;      // si dossier = "Documents de [Chantier]"

  // Métadonnées
  description: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Document ─────────────────────────────────────────────────────────────
export interface VaultDocumentV2 {
  id: string;
  folderId: string;        // dossier où il est rangé
  fileName: string;        // nom affiché à l'utilisateur
  originalFileName: string;// nom du fichier d'origine

  // Contenu
  storagePath: string;     // chemin relatif dans userData/vault/
  isEncrypted: boolean;
  iv: string;              // initialization vector (base64) si chiffré
  fileSize: number;        // taille en octets (avant chiffrement)
  mimeType: string;
  fileHash: string;        // SHA256 du fichier original (intégrité)

  // Recherche plein texte
  extractedText: string;   // texte extrait du PDF (vide pour images, etc.)

  // Métadonnées
  description: string;
  expirationDate: string;  // pour assurances qui expirent (ISO date, vide si N/A)

  // Corbeille
  deletedAt: string;       // "" si pas supprimé, ISO date si dans la corbeille

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ─── Tag ──────────────────────────────────────────────────────────────────
export interface VaultTag {
  id: string;
  name: string;            // "Décennale", "Assurance", "Plan"
  colorKey: string;        // "default" | "blue" | etc.
  createdAt: string;
}

// ─── Document avec ses tags hydratés ─────────────────────────────────────
export interface VaultDocumentWithTags extends VaultDocumentV2 {
  tags: VaultTag[];
}

// ─── Statistiques ────────────────────────────────────────────────────────
export interface VaultStats {
  totalDocuments: number;
  totalFolders: number;
  totalSize: number;          // octets
  trashCount: number;
  expiringIn30Days: number;   // documents qui expirent dans les 30 jours
}

// ─── Métadonnées icons/couleurs (UI) ─────────────────────────────────────
export const VAULT_FOLDER_ICONS: Array<{ key: string; lucideIcon: string }> = [
  { key: "folder",    lucideIcon: "Folder"     },
  { key: "shield",    lucideIcon: "Shield"     },  // Assurances
  { key: "award",     lucideIcon: "Award"      },  // Qualifications
  { key: "users",     lucideIcon: "Users"      },  // Clients
  { key: "hammer",    lucideIcon: "Hammer"     },  // Chantiers
  { key: "fileText",  lucideIcon: "FileText"   },  // Administratif
  { key: "image",     lucideIcon: "Image"      },  // Photos
  { key: "package",   lucideIcon: "Package"    },  // Fournisseurs / produits
  { key: "calendar",  lucideIcon: "Calendar"   },  // Planning
  { key: "lock",      lucideIcon: "Lock"       },  // Confidentiel
  { key: "star",      lucideIcon: "Star"       },  // Favoris
];

export const VAULT_FOLDER_COLORS: Array<{ key: string; hex: string; tw: string }> = [
  { key: "default", hex: "#64748b", tw: "text-slate-500" },
  { key: "blue",    hex: "#3b82f6", tw: "text-blue-500" },
  { key: "violet",  hex: "#8b5cf6", tw: "text-violet-500" },
  { key: "emerald", hex: "#10b981", tw: "text-emerald-500" },
  { key: "amber",   hex: "#f59e0b", tw: "text-amber-500" },
  { key: "rose",    hex: "#f43f5e", tw: "text-rose-500" },
];

export const VAULT_TAG_COLORS = VAULT_FOLDER_COLORS;

// ─── Constantes ──────────────────────────────────────────────────────────
export const VAULT_TRASH_RETENTION_DAYS = 30;
export const VAULT_FILE_SIZE_WARNING = 500 * 1024 * 1024; // 500 MB

// ─── Helpers ─────────────────────────────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 octet";
  const k = 1024;
  const units = ["octets", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + units[i];
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export function isPreviewableMimeType(mimeType: string): boolean {
  return isImageMimeType(mimeType) || isPdfMimeType(mimeType);
}

export function isExpiringSoon(expirationDate: string, daysAhead = 30): boolean {
  if (!expirationDate) return false;
  const exp = new Date(expirationDate).getTime();
  const now = Date.now();
  const ahead = now + daysAhead * 24 * 60 * 60 * 1000;
  return exp >= now && exp <= ahead;
}

export function isExpired(expirationDate: string): boolean {
  if (!expirationDate) return false;
  return new Date(expirationDate).getTime() < Date.now();
}
