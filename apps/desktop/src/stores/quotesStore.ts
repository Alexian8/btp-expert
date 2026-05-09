import { create } from "zustand";
import type { Quote, QuoteStatus } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// quotesStore
// ═══════════════════════════════════════════════════════════════════════════

interface QuotesState {
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  getById: (id: string) => Quote | undefined;
  listByClient: (clientId: string) => Quote[];
  listByChantier: (chantierId: string) => Quote[];
  create: (data: Omit<Quote, "id" | "reference" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  update: (id: string, data: Partial<Quote>) => Promise<{ success: boolean; error?: string }>;
  updateStatus: (id: string, status: QuoteStatus) => Promise<{ success: boolean; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useQuotesStore = create<QuotesState>((set, get) => ({
  quotes: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    if (!window.btpAPI?.quotesList) return;
    set({ isLoading: true, error: null });
    try {
      const list = await window.btpAPI.quotesList();
      set({ quotes: list, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  getById: (id) => get().quotes.find((q) => q.id === id),
  listByClient: (clientId) => get().quotes.filter((q) => q.clientId === clientId),
  listByChantier: (chantierId) => get().quotes.filter((q) => q.chantierId === chantierId),

  create: async (data) => {
    if (!window.btpAPI?.quotesCreate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.quotesCreate(data);
    if (result.success) await get().fetch();
    return result;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.quotesUpdate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.quotesUpdate({ id, data });
    if (result.success) await get().fetch();
    return result;
  },

  updateStatus: async (id, status) => {
    if (!window.btpAPI?.quotesUpdateStatus) return { success: false, error: "API indisponible" };
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === id ? { ...q, status } : q)),
    }));
    const result = await window.btpAPI.quotesUpdateStatus({ id, status });
    if (!result.success) await get().fetch();
    return result;
  },

  delete: async (id) => {
    if (!window.btpAPI?.quotesDelete) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.quotesDelete(id);
    if (result.success) await get().fetch();
    return result;
  },
}));
