import { create } from "zustand";
import type {
  PurchaseOrder, PurchaseOrderLine, PurchaseOrderStats,
  Situation, SituationLine,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// purchaseOrdersStore — BdC + Situations (Session 15)
// ═══════════════════════════════════════════════════════════════════════════

interface State {
  purchaseOrders: PurchaseOrder[];
  situations: Situation[];
  poStats: PurchaseOrderStats;
  isLoading: boolean;

  fetchPos: (filters?: any) => Promise<void>;
  fetchPoStats: () => Promise<void>;
  getPoById: (id: string) => Promise<(PurchaseOrder & { lines: PurchaseOrderLine[] }) | null>;
  createPo: (data: Partial<PurchaseOrder> & { lines?: Partial<PurchaseOrderLine>[] }) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  updatePo: (id: string, data: Partial<PurchaseOrder> & { lines?: Partial<PurchaseOrderLine>[] }) => Promise<{ success: boolean; error?: string }>;
  removePo: (id: string) => Promise<{ success: boolean; error?: string }>;
  releasePoRetention: (id: string) => Promise<{ success: boolean; error?: string }>;

  fetchSituations: (filters?: any) => Promise<void>;
  getSituationById: (id: string) => Promise<(Situation & { lines: SituationLine[] }) | null>;
  createSituation: (data: Partial<Situation> & { lines?: Partial<SituationLine>[] }) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  updateSituation: (id: string, data: Partial<Situation> & { lines?: Partial<SituationLine>[] }) => Promise<{ success: boolean; error?: string }>;
  removeSituation: (id: string) => Promise<{ success: boolean; error?: string }>;
  markSituationPaid: (id: string, paidDate?: string) => Promise<{ success: boolean; error?: string }>;
  getPreviousCumulPcts: (poId: string) => Promise<Record<string, number>>;
}

const EMPTY_STATS: PurchaseOrderStats = {
  totalPos: 0, totalEnCours: 0, totalAmount: 0,
  pendingRetentions: 0, expiredRetentions: 0,
};

export const usePurchaseOrdersStore = create<State>((set, get) => ({
  purchaseOrders: [],
  situations: [],
  poStats: EMPTY_STATS,
  isLoading: false,

  fetchPos: async (filters) => {
    if (!window.btpAPI?.poList) return;
    set({ isLoading: true });
    const purchaseOrders = await window.btpAPI.poList(filters);
    set({ purchaseOrders, isLoading: false });
  },
  fetchPoStats: async () => {
    if (!window.btpAPI?.poGetStats) return;
    const poStats = await window.btpAPI.poGetStats();
    set({ poStats });
  },
  getPoById: async (id) => {
    if (!window.btpAPI?.poGetById) return null;
    return window.btpAPI.poGetById(id);
  },
  createPo: async (data) => {
    if (!window.btpAPI?.poCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.poCreate(data);
    if (r.success) await Promise.all([get().fetchPos(), get().fetchPoStats()]);
    return r;
  },
  updatePo: async (id, data) => {
    if (!window.btpAPI?.poUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.poUpdate(id, data);
    if (r.success) await Promise.all([get().fetchPos(), get().fetchPoStats()]);
    return r;
  },
  removePo: async (id) => {
    if (!window.btpAPI?.poDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.poDelete(id);
    if (r.success) await Promise.all([get().fetchPos(), get().fetchPoStats()]);
    return r;
  },
  releasePoRetention: async (id) => {
    if (!window.btpAPI?.poReleaseRetention) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.poReleaseRetention(id);
    if (r.success) await Promise.all([get().fetchPos(), get().fetchPoStats()]);
    return r;
  },

  fetchSituations: async (filters) => {
    if (!window.btpAPI?.situationsList) return;
    const situations = await window.btpAPI.situationsList(filters);
    set({ situations });
  },
  getSituationById: async (id) => {
    if (!window.btpAPI?.situationsGetById) return null;
    return window.btpAPI.situationsGetById(id);
  },
  createSituation: async (data) => {
    if (!window.btpAPI?.situationsCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.situationsCreate(data);
    if (r.success) await get().fetchSituations({ purchaseOrderId: data.purchaseOrderId });
    return r;
  },
  updateSituation: async (id, data) => {
    if (!window.btpAPI?.situationsUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.situationsUpdate(id, data);
    if (r.success) await get().fetchSituations();
    return r;
  },
  removeSituation: async (id) => {
    if (!window.btpAPI?.situationsDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.situationsDelete(id);
    if (r.success) await get().fetchSituations();
    return r;
  },
  markSituationPaid: async (id, paidDate) => {
    if (!window.btpAPI?.situationsMarkPaid) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.situationsMarkPaid(id, paidDate);
    if (r.success) await get().fetchSituations();
    return r;
  },
  getPreviousCumulPcts: async (poId) => {
    if (!window.btpAPI?.situationsGetPreviousCumulPcts) return {};
    return window.btpAPI.situationsGetPreviousCumulPcts(poId);
  },
}));
