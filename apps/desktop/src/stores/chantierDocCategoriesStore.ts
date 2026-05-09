import { create } from "zustand";

// ═══════════════════════════════════════════════════════════════════════════
// chantierDocCategoriesStore — Catégories de documents chantier (Session 21)
// ═══════════════════════════════════════════════════════════════════════════

export interface DocCategory {
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
  categories: DocCategory[];
  loading: boolean;

  fetch: () => Promise<void>;
  create: (data: { name: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (data: { id: string; name?: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; error?: string }>;
  remove: (id: string) => Promise<{ success: boolean; reassigned?: number; error?: string }>;
  reorder: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
}

export const useDocCategoriesStore = create<State>((set, get) => ({
  categories: [],
  loading: false,

  fetch: async () => {
    if (!window.btpAPI?.chantierDocCategoriesList) return;
    set({ loading: true });
    try {
      const list = await window.btpAPI.chantierDocCategoriesList();
      set({ categories: list, loading: false });
    } catch (e) {
      console.error("[docCategories.fetch]", e);
      set({ loading: false });
    }
  },

  create: async (data) => {
    if (!window.btpAPI?.chantierDocCategoriesCreate) {
      return { success: false, error: "API non disponible" };
    }
    const r = await window.btpAPI.chantierDocCategoriesCreate(data);
    if (r.success) await get().fetch();
    return r;
  },

  update: async (data) => {
    if (!window.btpAPI?.chantierDocCategoriesUpdate) {
      return { success: false, error: "API non disponible" };
    }
    const r = await window.btpAPI.chantierDocCategoriesUpdate(data);
    if (r.success) await get().fetch();
    return r;
  },

  remove: async (id) => {
    if (!window.btpAPI?.chantierDocCategoriesDelete) {
      return { success: false, error: "API non disponible" };
    }
    const r = await window.btpAPI.chantierDocCategoriesDelete(id);
    if (r.success) await get().fetch();
    return r;
  },

  reorder: async (ids) => {
    if (!window.btpAPI?.chantierDocCategoriesReorder) {
      return { success: false, error: "API non disponible" };
    }
    // Optimistic update
    const cats = get().categories;
    const reordered = ids
      .map((id) => cats.find((c) => c.id === id))
      .filter((c): c is DocCategory => Boolean(c));
    set({ categories: reordered });

    const r = await window.btpAPI.chantierDocCategoriesReorder(ids);
    if (!r.success) await get().fetch(); // rollback si erreur
    return r;
  },
}));
