import { create } from "zustand";
import type { User } from "@btp/types";
import { api, clearToken, getToken } from "@/lib/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  init: async () => {
    set({ isLoading: true });
    if (!getToken()) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }
    try {
      const user = await api.getCurrentUser();
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch {
      clearToken();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const user = await api.login(username, password);
      if (!user) {
        set({ isLoading: false });
        return { ok: false, error: "Identifiants invalides" };
      }
      set({ user, isAuthenticated: true, isLoading: false });
      return { ok: true };
    } catch (e) {
      set({ isLoading: false });
      return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" };
    }
  },

  logout: () => {
    clearToken();
    set({ user: null, isAuthenticated: false });
  },
}));

// Listener global : si l'API renvoie 401, on déconnecte le store
if (typeof window !== "undefined") {
  window.addEventListener("btp:auth-required", () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });
}
