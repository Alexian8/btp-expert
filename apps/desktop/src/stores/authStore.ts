import { create } from "zustand";
import type { User } from "@btp/types";
import { getDataService } from "@/lib/dataService";

// ═══════════════════════════════════════════════════════════════════════════
// Auth Store — gère la session utilisateur
// Pas de persistance (l'utilisateur doit se reconnecter à chaque lancement)
// ═══════════════════════════════════════════════════════════════════════════

interface AuthState {
  user: User | null;
  isLoading: boolean;
  needsSetup: boolean; // true si c'est la 1ère utilisation (pas encore d'utilisateur)

  checkSetup: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  setupFirstUser: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  needsSetup: false,

  checkSetup: async () => {
    set({ isLoading: true });
    try {
      const ds = getDataService();
      const needsSetup = await ds.needsFirstUser();
      set({ needsSetup, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const ds = getDataService();
      const user = await ds.login(username, password);
      set({ user, isLoading: false });
      return !!user;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  setupFirstUser: async (username, password) => {
    set({ isLoading: true });
    try {
      const ds = getDataService();
      const user = await ds.createFirstUser(username, password);
      set({ user, needsSetup: false, isLoading: false });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  logout: async () => {
    const ds = getDataService();
    await ds.logout();
    set({ user: null });
  },
}));
