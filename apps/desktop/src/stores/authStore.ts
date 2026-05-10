import { create } from "zustand";
import type { User } from "@btp/types";
import { getDataService } from "@/lib/dataService";
import { useUsersStore } from "@/stores/usersStore";

// ═══════════════════════════════════════════════════════════════════════════
// Auth Store — gère la session utilisateur
//
// Mode web : le JWT est persisté en localStorage par le shim btpAPI.
// Au boot, restoreSession() appelle GET /api/auth/me pour récupérer le user
// si le token est encore valide — évite de re-login à chaque refresh.
//
// Mode desktop : pas de token JWT, l'utilisateur se reconnecte à chaque
// lancement (restoreSession retourne null sans erreur).
// ═══════════════════════════════════════════════════════════════════════════

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isBooting: boolean; // true tant que restoreSession() n'a pas terminé au boot
  needsSetup: boolean; // true si c'est la 1ère utilisation (pas encore d'utilisateur)

  checkSetup: () => Promise<void>;
  restoreSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  setupFirstUser: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isBooting: true,
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

  /**
   * Restauration de session au démarrage de l'app (mode web).
   * Lit le JWT en localStorage et appelle /api/auth/me pour récupérer
   * le user. Si le token est expiré/invalide, le user reste à null et
   * l'UI redirige vers /login.
   */
  restoreSession: async () => {
    try {
      const ds = getDataService();
      const user = await ds.restoreSession();
      if (user) {
        set({ user, isBooting: false });
        // Charge l'annuaire des users en mémoire (pour "Créé par X")
        void useUsersStore.getState().reload();
      } else {
        set({ isBooting: false });
      }
    } catch {
      set({ isBooting: false });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const ds = getDataService();
      const user = await ds.login(username, password);
      set({ user, isLoading: false });
      // Charge l'annuaire des users en mémoire pour afficher "Créé par"
      if (user) void useUsersStore.getState().reload();
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
    useUsersStore.getState().reset();
  },
}));
