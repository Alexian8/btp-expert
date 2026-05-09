// ═══════════════════════════════════════════════════════════════════════════
// Types Backup & Cloud (Session 3)
// ═══════════════════════════════════════════════════════════════════════════

export type BackupFrequency =
  | "never"
  | "hourly"
  | "every-6h"
  | "daily"
  | "on-close";

export interface BackupConfig {
  frequency: BackupFrequency;
  destinationPath: string;
  destinationProvider: string; // "local" | "onedrive-local" | ...
  retentionCount: number; // garder les N derniers backups
  includeVault: boolean;
  includeSettings: boolean;
  includeLogs: boolean;
}

export interface BackupRecord {
  id: string;
  path: string;
  size: number;
  createdAt: string;
  type: "manual" | "auto" | "on-close";
  version: string;
}

export interface DetectedCloud {
  kind: string; // "onedrive-local" | "icloud-local" | ...
  label: string;
  path: string;
  available: boolean;
}
