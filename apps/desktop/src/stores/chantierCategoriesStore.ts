import { create } from "zustand";

// ═══════════════════════════════════════════════════════════════════════════
// chantierCategoriesStore — Catégories chantier / corps d'état (Session 22)
// ═══════════════════════════════════════════════════════════════════════════

export interface ChantierCategory {
  id: string;
  name: string;
  iconKey: string;
  colorKey: string;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface State {
  categories: ChantierCategory[];
  loading: boolean;

  fetch: () => Promise<void>;
  create: (data: { name: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (data: { id: string; name?: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; error?: string }>;
  remove: (id: string) => Promise<{ success: boolean; detached?: number; error?: string }>;
  reorder: (ids: string[]) => Promise<{ success: boolean; error?: string }>;

  // Helpers
  getById: (id: string) => ChantierCategory | undefined;
}

export const useChantierCategoriesStore = create<State>((set, get) => ({
  categories: [],
  loading: false,

  fetch: async () => {
    if (!window.btpAPI?.chantierCategoriesList) return;
    set({ loading: true });
    try {
      const list = await window.btpAPI.chantierCategoriesList();
      set({ categories: list, loading: false });
    } catch (e) {
      console.error("[chantierCategories.fetch]", e);
      set({ loading: false });
    }
  },

  create: async (data) => {
    if (!window.btpAPI?.chantierCategoriesCreate) {
      return { success: false, error: "API non disponible" };
    }
    const r = await window.btpAPI.chantierCategoriesCreate(data);
    if (r.success) await get().fetch();
    return r;
  },

  update: async (data) => {
    if (!window.btpAPI?.chantierCategoriesUpdate) {
      return { success: false, error: "API non disponible" };
    }
    const r = await window.btpAPI.chantierCategoriesUpdate(data);
    if (r.success) await get().fetch();
    return r;
  },

  remove: async (id) => {
    if (!window.btpAPI?.chantierCategoriesDelete) {
      return { success: false, error: "API non disponible" };
    }
    const r = await window.btpAPI.chantierCategoriesDelete(id);
    if (r.success) await get().fetch();
    return r;
  },

  reorder: async (ids) => {
    if (!window.btpAPI?.chantierCategoriesReorder) {
      return { success: false, error: "API non disponible" };
    }
    const cats = get().categories;
    const reordered = ids
      .map((id) => cats.find((c) => c.id === id))
      .filter((c): c is ChantierCategory => Boolean(c));
    set({ categories: reordered });

    const r = await window.btpAPI.chantierCategoriesReorder(ids);
    if (!r.success) await get().fetch();
    return r;
  },

  getById: (id) => get().categories.find((c) => c.id === id),
}));
