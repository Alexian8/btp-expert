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
      const [data, settings] = await Promise.all([
        window.btpAPI.companyGet(),
        window.btpAPI.getSettings?.() ?? Promise.resolve({}),
      ]);
      // Merge des paramètres PDF dans le profil entreprise : les composants
      // PDF (@react-pdf/renderer) reçoivent désormais pdfLogoSizeMm,
      // pdfCompanyNameSize, pdfAccentColor, pdfFont, etc. via la prop company.
      const sExt = (settings || {}) as Record<string, unknown>;
      const pdfFields: Record<string, unknown> = {};
      for (const k of [
        "pdfLogoSizeMm",
        "pdfCompanyNameSize",
        "pdfStampSizeMm",
        "pdfSignatureSizeMm",
        "pdfAccentColor",
        "pdfFooterText",
        "pdfFont",
        "pdfStyle",
        "pdfQuoteStyle",
        "pdfShowLogoInHeader",
        "pdfShowCompanyAddress",
        "pdfIbanShown",
      ]) {
        if (sExt[k] !== undefined) pdfFields[k] = sExt[k];
      }
      set({
        company: { ...(data || {}), ...pdfFields },
        isLoading: false,
      });
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
