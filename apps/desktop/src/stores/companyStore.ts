import { create } from "zustand";
import type { CompanyProfile } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// companyStore — Profil de l'entreprise utilisatrice (singleton)
// ═══════════════════════════════════════════════════════════════════════════

interface CompanyState {
  company: Partial<CompanyProfile>;
  isLoading: boolean;

  fetch: () => Promise<void>;
  update: (patch: Partial<CompanyProfile>) => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  company: {},
  isLoading: false,

  fetch: async () => {
    if (!window.btpAPI?.companyGet) return;
    set({ isLoading: true });
    try {
      const data = await window.btpAPI.companyGet();
      set({ company: data || {}, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  update: async (patch) => {
    if (!window.btpAPI?.companyUpdate) return;
    const merged = await window.btpAPI.companyUpdate(patch);
    if (merged && !merged.error) {
      set({ company: merged });
    }
  },
}));
