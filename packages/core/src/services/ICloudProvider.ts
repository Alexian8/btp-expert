// ═══════════════════════════════════════════════════════════════════════════
// ICloudProvider — Interface abstraite pour les fournisseurs cloud
//
// Cette interface permet de brancher différents providers sans changer
// le code métier :
//   - LocalFolderProvider (dossier local, éventuellement synchronisé
//     par OneDrive/iCloud/Dropbox côté OS)
//   - MicrosoftGraphProvider (OAuth + API Graph pour OneDrive/Outlook)
//   - GoogleDriveProvider (futur)
//   - AppleICloudProvider (futur, nécessite Mac)
// ═══════════════════════════════════════════════════════════════════════════

export type CloudProviderKind =
  | "local"
  | "onedrive-local"
  | "icloud-local"
  | "dropbox-local"
  | "gdrive-local"
  | "microsoft-graph"
  | "google-drive"
  | "apple-icloud";

export interface CloudFile {
  name: string;
  size: number;
  modifiedAt: string;
  path: string;
}

export interface CloudProviderInfo {
  kind: CloudProviderKind;
  label: string;
  icon: string; // emoji ou nom d'icône
  connected: boolean;
  connectedAs?: string; // ex: "alexian@outlook.com"
  requiresAuth: boolean; // true pour OAuth, false pour local
}

export interface ICloudProvider {
  getInfo(): CloudProviderInfo;

  // Connexion (pour les OAuth providers, no-op pour les locaux)
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;

  // Opérations
  upload(localPath: string, remoteName: string): Promise<CloudFile>;
  download(remoteName: string, localPath: string): Promise<void>;
  list(): Promise<CloudFile[]>;
  delete(remoteName: string): Promise<void>;

  // Espace disponible (si exposable par le provider)
  getQuota?(): Promise<{ used: number; total: number } | null>;
}
