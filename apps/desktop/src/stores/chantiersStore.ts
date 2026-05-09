import { create } from "zustand";
import type { Chantier, ChantierStatus } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// chantiersStore — État Chantiers
// ═══════════════════════════════════════════════════════════════════════════

interface ChantiersState {
  chantiers: Chantier[];
  isLoading: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  getById: (id: string) => Chantier | undefined;
  listByClient: (clientId: string) => Chantier[];
  create: (data: Omit<Chantier, "id" | "reference" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  update: (id: string, data: Partial<Chantier>) => Promise<{ success: boolean; error?: string }>;
  updateStatus: (id: string, status: ChantierStatus) => Promise<{ success: boolean; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useChantiersStore = create<ChantiersState>((set, get) => ({
  chantiers: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    if (!window.btpAPI?.chantiersList) return;
    set({ isLoading: true, error: null });
    try {
      const list = await window.btpAPI.chantiersList();
      set({ chantiers: list, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  getById: (id) => get().chantiers.find((c) => c.id === id),

  listByClient: (clientId) => get().chantiers.filter((c) => c.clientId === clientId),

  create: async (data) => {
    if (!window.btpAPI?.chantiersCreate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.chantiersCreate(data);
    if (result.success) {
      await get().fetch();
      // Création auto du dossier coffre-fort pour ce chantier (Session 11)
      if (result.id && window.btpAPI?.vaultEnsureChantierFolder) {
        const title = data.title || result.reference || "Chantier";
        await window.btpAPI.vaultEnsureChantierFolder(result.id, title, data.clientId);
      }
      // Création auto de l'événement agenda chantier (Session 12)
      // Si on a au moins une date prévisionnelle, on crée un événement durée
      if (result.id && window.btpAPI?.agendaEnsureChantierEvent && data.startDateEstimated) {
        const title = data.title || result.reference || "Chantier";
        await window.btpAPI.agendaEnsureChantierEvent({
          chantierId: result.id,
          title: `Chantier : ${title}`,
          dateStart: data.startDateEstimated,
          dateEnd: data.endDateEstimated || data.startDateEstimated,
          clientId: data.clientId || "",
          syncToOutlook: false, // par défaut pas en sync (chantier long = pollue Outlook)
        });
      }
    }
    return result;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.chantiersUpdate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.chantiersUpdate({ id, data });
    if (result.success) await get().fetch();
    return result;
  },

  updateStatus: async (id, status) => {
    if (!window.btpAPI?.chantiersUpdateStatus) return { success: false, error: "API indisponible" };
    // Optimiste : on met à jour l'état local immédiatement pour un drag & drop fluide
    set((state) => ({
      chantiers: state.chantiers.map((c) => (c.id === id ? { ...c, status } : c)),
    }));
    const result = await window.btpAPI.chantiersUpdateStatus({ id, status });
    if (!result.success) {
      // Rollback
      await get().fetch();
    }
    return result;
  },

  delete: async (id) => {
    if (!window.btpAPI?.chantiersDelete) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.chantiersDelete(id);
    if (result.success) await get().fetch();
    return result;
  },
}));
