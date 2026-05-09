import { create } from "zustand";
import type { Supplier } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// suppliersStore — État Fournisseurs
// ═══════════════════════════════════════════════════════════════════════════

interface SuppliersState {
  suppliers: Supplier[];
  isLoading: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  getById: (id: string) => Supplier | undefined;
  create: (data: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (id: string, data: Partial<Supplier>) => Promise<{ success: boolean; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useSuppliersStore = create<SuppliersState>((set, get) => ({
  suppliers: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    if (!window.btpAPI?.suppliersList) return;
    set({ isLoading: true, error: null });
    try {
      const list = await window.btpAPI.suppliersList();
      set({ suppliers: list, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  getById: (id) => get().suppliers.find((s) => s.id === id),

  create: async (data) => {
    if (!window.btpAPI?.suppliersCreate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.suppliersCreate(data);
    if (result.success) await get().fetch();
    return result;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.suppliersUpdate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.suppliersUpdate({ id, data });
    if (result.success) await get().fetch();
    return result;
  },

  delete: async (id) => {
    if (!window.btpAPI?.suppliersDelete) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.suppliersDelete(id);
    if (result.success) await get().fetch();
    return result;
  },
}));
