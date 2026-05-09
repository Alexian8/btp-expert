import { create } from "zustand";

// ═══════════════════════════════════════════════════════════════════════════
// microsoftStore — État de la connexion Microsoft (OneDrive / Outlook / Cal)
// Non persisté : les tokens sont gérés côté Electron avec safeStorage
// ═══════════════════════════════════════════════════════════════════════════

export interface MsProfile {
  name: string;
  email: string;
  id: string;
}

export interface MsQuota {
  used: number;
  total: number;
  remaining: number;
}

interface MicrosoftState {
  profile: MsProfile | null;
  quota: MsQuota | null;
  isConnecting: boolean;
  isConnected: boolean;

  login: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshQuota: () => Promise<void>;
}

export const useMicrosoftStore = create<MicrosoftState>((set, get) => ({
  profile: null,
  quota: null,
  isConnecting: false,
  isConnected: false,

  login: async () => {
    if (!window.btpAPI?.msLogin) {
      return { success: false, error: "API Microsoft indisponible" };
    }
    set({ isConnecting: true });
    const result = await window.btpAPI.msLogin();
    set({ isConnecting: false });
    if (result.success && result.profile) {
      set({
        profile: result.profile,
        isConnected: true,
      });
      get().refreshQuota();
      return { success: true };
    }
    return { success: false, error: result.error };
  },

  logout: async () => {
    if (!window.btpAPI?.msLogout) return;
    await window.btpAPI.msLogout();
    set({ profile: null, quota: null, isConnected: false });
  },

  checkSession: async () => {
    if (!window.btpAPI?.msGetAccount) return;
    try {
      const profile = await window.btpAPI.msGetAccount();
      if (profile) {
        set({ profile, isConnected: true });
        get().refreshQuota();
      } else {
        set({ profile: null, isConnected: false });
      }
    } catch {
      set({ profile: null, isConnected: false });
    }
  },

  refreshQuota: async () => {
    if (!window.btpAPI?.msGetQuota) return;
    try {
      const quota = await window.btpAPI.msGetQuota();
      set({ quota });
    } catch {
      set({ quota: null });
    }
  },
}));

// ─── Helper : formater les octets ────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} To`;
}
