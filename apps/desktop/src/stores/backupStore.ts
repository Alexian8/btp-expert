import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BackupFrequency, BackupRecord, DetectedCloud } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// backupStore — Configuration backup persistée dans localStorage
// ═══════════════════════════════════════════════════════════════════════════

// Session 23 : Helper pour exporter les settings de tous les stores zustand
//              dans un seul JSON pour inclusion dans le backup.
function collectSettingsJson(): string {
  // Récupère toutes les clés du localStorage qui commencent par "btp-"
  // (toutes les clés persist de zustand sont préfixées ainsi)
  const settings: Record<string, any> = {};
  if (typeof localStorage === "undefined") return "{}";

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("btp-")) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          settings[key] = JSON.parse(raw);
        }
      } catch {
        // Si pas du JSON, on stocke en string
        settings[key] = localStorage.getItem(key);
      }
    }
  }
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    keys: Object.keys(settings),
    data: settings,
  }, null, 2);
}

interface BackupState {
  // Configuration
  frequency: BackupFrequency;
  destinationPath: string;
  destinationProvider: string;
  retentionCount: number;
  includeVault: boolean;
  includeSettings: boolean;
  includeLogs: boolean;

  // Session iOS-1 + iOS-1.5 : sync OneDrive enrichie
  autoUploadToOneDrive: boolean;
  oneDriveSyncIntervalMin: number;     // 0 = jamais (sauf à la fermeture), 5/15/30/60/120
  oneDriveRetentionCount: number;      // 1, 3, 5, 10
  checkOneDriveOnStartup: boolean;     // proposer restauration au démarrage si plus récent
  requireMicrosoftLogin: boolean;      // demander mot de passe MS à l'ouverture (en plus du local)
  lastUploadedDbHash: string | null;   // pour détecter "DB inchangée"

  // État runtime
  detectedClouds: DetectedCloud[];
  backups: BackupRecord[];
  isLoading: boolean;
  lastBackupAt: string | null;
  lastOneDriveUploadAt: string | null;
  oneDriveUploadInProgress: boolean;

  // Actions config
  setFrequency: (freq: BackupFrequency) => void;
  setDestination: (path: string, provider: string) => void;
  setRetention: (count: number) => void;
  setIncludeVault: (v: boolean) => void;
  setIncludeSettings: (v: boolean) => void;
  setIncludeLogs: (v: boolean) => void;
  setAutoUploadToOneDrive: (v: boolean) => void;
  setOneDriveSyncIntervalMin: (n: number) => void;
  setOneDriveRetentionCount: (n: number) => void;
  setCheckOneDriveOnStartup: (v: boolean) => void;
  setRequireMicrosoftLogin: (v: boolean) => void;

  // Actions runtime
  detectClouds: () => Promise<void>;
  refreshBackups: () => Promise<void>;
  createBackup: (type?: "manual" | "auto") => Promise<{ success: boolean; error?: string; oneDriveUploaded?: boolean }>;
  deleteBackup: (backupPath: string) => Promise<void>;
  inspectBackup: (backupPath: string) => Promise<{ success: boolean; format?: string; manifest?: any; integrityOk?: boolean; warnings?: string[]; error?: string }>;
  restoreBackup: (backupPath: string, skipIntegrityCheck?: boolean) => Promise<{ success: boolean; error?: string }>;
  syncOnCloseConfig: () => Promise<void>;

  // Session iOS-1 + iOS-1.5
  uploadCurrentToOneDrive: () => Promise<{ success: boolean; error?: string; skipped?: boolean }>;
  applyOneDriveRetention: () => Promise<{ deleted: number }>;
  checkOneDriveAtStartup: () => Promise<{ success: boolean; hasCloudBackup?: boolean; cloudIsNewer?: boolean; latest?: any; error?: string }>;
}

const DEFAULT_STATE = {
  frequency: "on-close" as BackupFrequency,
  destinationPath: "",
  destinationProvider: "local",
  retentionCount: 10,
  includeVault: true,
  includeSettings: true,
  includeLogs: true,
  // Session iOS-1 + iOS-1.5
  autoUploadToOneDrive: false,
  oneDriveSyncIntervalMin: 30,         // 30 min par défaut
  oneDriveRetentionCount: 3,           // 3 derniers
  checkOneDriveOnStartup: true,
  requireMicrosoftLogin: false,
  lastUploadedDbHash: null as string | null,
  detectedClouds: [] as DetectedCloud[],
  backups: [] as BackupRecord[],
  isLoading: false,
  lastBackupAt: null as string | null,
  lastOneDriveUploadAt: null as string | null,
  oneDriveUploadInProgress: false,
};

export const useBackupStore = create<BackupState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setFrequency: (frequency) => {
        set({ frequency });
        get().syncOnCloseConfig();
      },
      setDestination: (destinationPath, destinationProvider) => {
        set({ destinationPath, destinationProvider });
        get().syncOnCloseConfig();
        get().refreshBackups();
      },
      setRetention: (retentionCount) => {
        set({ retentionCount });
        get().syncOnCloseConfig();
      },
      setIncludeVault: (includeVault) => set({ includeVault }),
      setIncludeSettings: (includeSettings) => set({ includeSettings }),
      setIncludeLogs: (includeLogs) => set({ includeLogs }),
      setAutoUploadToOneDrive: (autoUploadToOneDrive) => set({ autoUploadToOneDrive }),
      setOneDriveSyncIntervalMin: (oneDriveSyncIntervalMin) => set({ oneDriveSyncIntervalMin }),
      setOneDriveRetentionCount: (oneDriveRetentionCount) => set({ oneDriveRetentionCount }),
      setCheckOneDriveOnStartup: (checkOneDriveOnStartup) => set({ checkOneDriveOnStartup }),
      setRequireMicrosoftLogin: (requireMicrosoftLogin) => set({ requireMicrosoftLogin }),

      detectClouds: async () => {
        if (!window.btpAPI?.detectClouds) return;
        const detected = await window.btpAPI.detectClouds();
        set({ detectedClouds: detected });
      },

      refreshBackups: async () => {
        const { destinationPath } = get();
        if (!destinationPath || !window.btpAPI?.listBackups) {
          set({ backups: [] });
          return;
        }
        const backups = await window.btpAPI.listBackups({ destinationPath });
        set({ backups: backups as BackupRecord[] });
      },

      createBackup: async (type = "manual") => {
        const { destinationPath, includeVault, includeSettings, includeLogs, autoUploadToOneDrive } = get();
        if (!destinationPath) return { success: false, error: "Aucune destination configurée" };
        if (!window.btpAPI?.createBackup) return { success: false, error: "API indisponible" };

        // Session 23 : exporter les settings depuis localStorage si demandé
        const settingsJson = includeSettings ? collectSettingsJson() : undefined;

        set({ isLoading: true });
        const result = await window.btpAPI.createBackup({
          destinationPath,
          includeVault,
          includeSettings,
          includeLogs,
          settingsJson,
          type,
        });
        set({ isLoading: false });

        if (result.success) {
          set({ lastBackupAt: new Date().toISOString() });
          // Appliquer la rétention
          const { retentionCount } = get();
          if (retentionCount > 0 && window.btpAPI?.applyRetention) {
            await window.btpAPI.applyRetention({ destinationPath, keepCount: retentionCount });
          }
          await get().refreshBackups();

          // Session iOS-1 : auto-upload OneDrive pour BatiDesk Compagnon mobile
          let oneDriveUploaded = false;
          if (autoUploadToOneDrive && window.btpAPI?.msOneDriveUpload) {
            try {
              set({ oneDriveUploadInProgress: true });
              const odResult = await window.btpAPI.msOneDriveUpload({
                includeVault,
                includeSettings,
                includeLogs,
                settingsJson,
                type,
              });
              if (odResult.success) {
                set({ lastOneDriveUploadAt: new Date().toISOString() });
                oneDriveUploaded = true;
              } else {
                console.warn("[backup] Auto-upload OneDrive échoué :", odResult.error);
              }
            } catch (e) {
              console.warn("[backup] Auto-upload OneDrive exception :", e);
            } finally {
              set({ oneDriveUploadInProgress: false });
            }
          }
          return { ...result, oneDriveUploaded };
        }
        return result;
      },

      uploadCurrentToOneDrive: async () => {
        if (!window.btpAPI?.msOneDriveUpload) {
          return { success: false, error: "API OneDrive indisponible" };
        }
        const { includeVault, includeSettings, includeLogs, lastUploadedDbHash, oneDriveRetentionCount } = get();
        const settingsJson = includeSettings ? collectSettingsJson() : undefined;

        // Session iOS-1.5 : détection "DB inchangée" via SHA-256
        // Si la DB n'a pas changé depuis le dernier upload, on saute (économie bande passante).
        let currentHash: string | null = null;
        if (window.btpAPI?.getLocalDbHash) {
          try {
            const r = await window.btpAPI.getLocalDbHash();
            if (r.success && r.hash) {
              currentHash = r.hash;
              if (lastUploadedDbHash && lastUploadedDbHash === currentHash) {
                // DB inchangée, on saute l'upload
                return { success: true, skipped: true };
              }
            }
          } catch {
            // Si on n'arrive pas à hasher, on continue quand même (mieux que skip)
          }
        }

        set({ oneDriveUploadInProgress: true });
        try {
          const r = await window.btpAPI.msOneDriveUpload({
            includeVault,
            includeSettings,
            includeLogs,
            settingsJson,
            type: "manual",
          });
          if (r.success) {
            set({
              lastOneDriveUploadAt: new Date().toISOString(),
              lastUploadedDbHash: currentHash,
            });
            // Appliquer la rétention OneDrive après upload réussi
            if (oneDriveRetentionCount > 0 && window.btpAPI?.msOneDriveApplyRetention) {
              try {
                await window.btpAPI.msOneDriveApplyRetention({ keepCount: oneDriveRetentionCount });
              } catch (e) {
                console.warn("[backup] applyRetention OneDrive échoué :", e);
              }
            }
          }
          return r;
        } finally {
          set({ oneDriveUploadInProgress: false });
        }
      },

      applyOneDriveRetention: async () => {
        if (!window.btpAPI?.msOneDriveApplyRetention) return { deleted: 0 };
        const { oneDriveRetentionCount } = get();
        const r = await window.btpAPI.msOneDriveApplyRetention({ keepCount: oneDriveRetentionCount });
        return r;
      },

      checkOneDriveAtStartup: async () => {
        if (!window.btpAPI?.msOneDriveCheckLatest) {
          return { success: false, error: "API indisponible" };
        }
        return window.btpAPI.msOneDriveCheckLatest();
      },

      deleteBackup: async (backupPath) => {
        if (!window.btpAPI?.deleteBackup) return;
        await window.btpAPI.deleteBackup(backupPath);
        await get().refreshBackups();
      },

      inspectBackup: async (backupPath) => {
        if (!window.btpAPI?.inspectBackup) {
          return { success: false, error: "API indisponible" };
        }
        return window.btpAPI.inspectBackup({ backupPath });
      },

      restoreBackup: async (backupPath, skipIntegrityCheck) => {
        if (!window.btpAPI?.restoreBackup) return { success: false, error: "API indisponible" };
        return window.btpAPI.restoreBackup({ backupPath, skipIntegrityCheck });
      },

      syncOnCloseConfig: async () => {
        const { frequency, destinationPath, retentionCount } = get();
        if (!window.btpAPI?.setOnCloseBackup) return;
        await window.btpAPI.setOnCloseBackup({
          enabled: frequency === "on-close" && !!destinationPath,
          destinationPath,
          retentionCount,
        });
      },
    }),
    {
      name: "btp-backup",
      partialize: (state) => ({
        frequency: state.frequency,
        destinationPath: state.destinationPath,
        destinationProvider: state.destinationProvider,
        retentionCount: state.retentionCount,
        includeVault: state.includeVault,
        includeSettings: state.includeSettings,
        includeLogs: state.includeLogs,
        lastBackupAt: state.lastBackupAt,
      }),
    }
  )
);

// ═══════════════════════════════════════════════════════════════════════════
// Timer de backup automatique (hourly, every-6h, daily)
// ═══════════════════════════════════════════════════════════════════════════
let backupTimer: ReturnType<typeof setInterval> | null = null;
let oneDriveTimer: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler() {
  const { frequency } = useBackupStore.getState();
  stopBackupScheduler();

  const intervalMs = {
    "never": 0,
    "on-close": 0,
    "hourly": 60 * 60 * 1000,
    "every-6h": 6 * 60 * 60 * 1000,
    "daily": 24 * 60 * 60 * 1000,
  }[frequency];

  if (!intervalMs) return;

  backupTimer = setInterval(() => {
    useBackupStore.getState().createBackup("auto");
  }, intervalMs);
}

export function stopBackupScheduler() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Session iOS-1.5 — Scheduler OneDrive (sync périodique)
// ═══════════════════════════════════════════════════════════════════════════

export function startOneDriveScheduler() {
  const { autoUploadToOneDrive, oneDriveSyncIntervalMin } = useBackupStore.getState();
  stopOneDriveScheduler();

  // Pas activé ou intervalle 0 (= seulement à la fermeture/manuel)
  if (!autoUploadToOneDrive || !oneDriveSyncIntervalMin || oneDriveSyncIntervalMin <= 0) return;

  const intervalMs = oneDriveSyncIntervalMin * 60 * 1000;

  oneDriveTimer = setInterval(async () => {
    try {
      const r = await useBackupStore.getState().uploadCurrentToOneDrive();
      if (r.success && !r.skipped) {
        console.log("[OneDrive scheduler] Upload périodique réussi");
      } else if (r.skipped) {
        console.log("[OneDrive scheduler] DB inchangée, upload sauté");
      }
    } catch (e) {
      console.warn("[OneDrive scheduler] erreur :", e);
    }
  }, intervalMs);

  console.log(`[OneDrive scheduler] Démarré : sync toutes les ${oneDriveSyncIntervalMin} min`);
}

export function stopOneDriveScheduler() {
  if (oneDriveTimer) {
    clearInterval(oneDriveTimer);
    oneDriveTimer = null;
  }
}

// Se réabonner au changement de fréquence (backup local)
useBackupStore.subscribe(() => {
  startBackupScheduler();
  startOneDriveScheduler();
});
