import { create } from "zustand";
import type { Client } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// clientsStore — État Clients (non persisté, tout vient de SQLite)
// ═══════════════════════════════════════════════════════════════════════════

interface ClientsState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  getById: (id: string) => Client | undefined;
  create: (data: Omit<Client, "id" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (id: string, data: Partial<Client>) => Promise<{ success: boolean; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    if (!window.btpAPI?.clientsList) return;
    set({ isLoading: true, error: null });
    try {
      const list = await window.btpAPI.clientsList();
      set({ clients: list, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  getById: (id) => get().clients.find((c) => c.id === id),

  create: async (data) => {
    if (!window.btpAPI?.clientsCreate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.clientsCreate(data);
    if (result.success) {
      await get().fetch();
      // Création auto du dossier coffre-fort pour ce client (Session 11)
      if (result.id && window.btpAPI?.vaultEnsureClientFolder) {
        const displayName = data.type === "pro" && data.companyName
          ? data.companyName
          : `${data.firstName || ""} ${data.lastName || ""}`.trim();
        await window.btpAPI.vaultEnsureClientFolder(result.id, displayName);
      }
    }
    return result;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.clientsUpdate) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.clientsUpdate({ id, data });
    if (result.success) await get().fetch();
    return result;
  },

  delete: async (id) => {
    if (!window.btpAPI?.clientsDelete) return { success: false, error: "API indisponible" };
    const result = await window.btpAPI.clientsDelete(id);
    if (result.success) await get().fetch();
    return result;
  },
}));
