import { create } from "zustand";
import type { LibraryItem } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// libraryStore
// ═══════════════════════════════════════════════════════════════════════════

interface LibraryState {
  items: LibraryItem[];
  isLoading: boolean;

  fetch: () => Promise<void>;
  create: (data: Omit<LibraryItem, "id" | "usageCount" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (id: string, data: Partial<LibraryItem>) => Promise<{ success: boolean; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;
  incrementUsage: (id: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: [],
  isLoading: false,

  fetch: async () => {
    if (!window.btpAPI?.libraryList) return;
    set({ isLoading: true });
    try {
      const list = await window.btpAPI.libraryList();
      set({ items: list, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  create: async (data) => {
    if (!window.btpAPI?.libraryCreate) return { success: false, error: "API indisponible" };
    const r = await window.btpAPI.libraryCreate(data);
    if (r.success) await get().fetch();
    return r;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.libraryUpdate) return { success: false, error: "API indisponible" };
    const r = await window.btpAPI.libraryUpdate({ id, data });
    if (r.success) await get().fetch();
    return r;
  },

  delete: async (id) => {
    if (!window.btpAPI?.libraryDelete) return { success: false, error: "API indisponible" };
    const r = await window.btpAPI.libraryDelete(id);
    if (r.success) await get().fetch();
    return r;
  },

  incrementUsage: async (id) => {
    if (!window.btpAPI?.libraryIncrementUsage) return;
    await window.btpAPI.libraryIncrementUsage(id);
    // On ne refetch pas - juste incrément, ça peut attendre le prochain fetch
  },
}));
