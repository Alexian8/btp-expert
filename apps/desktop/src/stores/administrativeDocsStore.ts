import { create } from "zustand";
import type {
  ReceptionReport, ReceptionReserve,
  TvaAttestation, Dc4Declaration, RgeDocument,
  AdministrativeDocsStats,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// administrativeDocsStore — Documents administratifs (Session 17)
// ═══════════════════════════════════════════════════════════════════════════

interface State {
  receptions: ReceptionReport[];
  tvaAttestations: TvaAttestation[];
  dc4Declarations: Dc4Declaration[];
  rgeDocuments: RgeDocument[];
  stats: AdministrativeDocsStats;
  isLoading: boolean;

  // PV réception
  fetchReceptions: (filters?: any) => Promise<void>;
  getReceptionById: (id: string) => Promise<(ReceptionReport & { reserves: ReceptionReserve[] }) | null>;
  createReception: (data: Partial<ReceptionReport> & { reserves?: Partial<ReceptionReserve>[] }) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  updateReception: (id: string, data: Partial<ReceptionReport> & { reserves?: Partial<ReceptionReserve>[] }) => Promise<{ success: boolean; error?: string }>;
  removeReception: (id: string) => Promise<{ success: boolean; error?: string }>;

  // TVA
  fetchTvaAttestations: (filters?: any) => Promise<void>;
  getTvaById: (id: string) => Promise<TvaAttestation | null>;
  createTvaAttestation: (data: Partial<TvaAttestation>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  updateTvaAttestation: (id: string, data: Partial<TvaAttestation>) => Promise<{ success: boolean; error?: string }>;
  removeTvaAttestation: (id: string) => Promise<{ success: boolean; error?: string }>;

  // DC4
  fetchDc4: (filters?: any) => Promise<void>;
  getDc4ById: (id: string) => Promise<Dc4Declaration | null>;
  createDc4: (data: Partial<Dc4Declaration>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  updateDc4: (id: string, data: Partial<Dc4Declaration>) => Promise<{ success: boolean; error?: string }>;
  removeDc4: (id: string) => Promise<{ success: boolean; error?: string }>;

  // RGE
  fetchRge: () => Promise<void>;
  createRge: (data: Partial<RgeDocument>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  removeRge: (id: string) => Promise<{ success: boolean; error?: string }>;

  fetchStats: () => Promise<void>;
}

const EMPTY_STATS: AdministrativeDocsStats = {
  receptionsTotal: 0, receptionsWithReserves: 0,
  tvaAttestationsTotal: 0, tvaAttestationsThisYear: 0,
  dc4Total: 0, dc4Pending: 0,
  rgeDocumentsTotal: 0,
};

export const useAdministrativeDocsStore = create<State>((set, get) => ({
  receptions: [],
  tvaAttestations: [],
  dc4Declarations: [],
  rgeDocuments: [],
  stats: EMPTY_STATS,
  isLoading: false,

  // ─── PV de réception ─────────────────────────────────────────────────
  fetchReceptions: async (filters) => {
    if (!window.btpAPI?.adminReceptionList) return;
    const receptions = await window.btpAPI.adminReceptionList(filters);
    set({ receptions });
  },
  getReceptionById: async (id) => {
    if (!window.btpAPI?.adminReceptionGetById) return null;
    return window.btpAPI.adminReceptionGetById(id);
  },
  createReception: async (data) => {
    if (!window.btpAPI?.adminReceptionCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminReceptionCreate(data);
    if (r.success) await Promise.all([get().fetchReceptions(), get().fetchStats()]);
    return r;
  },
  updateReception: async (id, data) => {
    if (!window.btpAPI?.adminReceptionUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminReceptionUpdate(id, data);
    if (r.success) await Promise.all([get().fetchReceptions(), get().fetchStats()]);
    return r;
  },
  removeReception: async (id) => {
    if (!window.btpAPI?.adminReceptionDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminReceptionDelete(id);
    if (r.success) await Promise.all([get().fetchReceptions(), get().fetchStats()]);
    return r;
  },

  // ─── Attestations TVA ────────────────────────────────────────────────
  fetchTvaAttestations: async (filters) => {
    if (!window.btpAPI?.adminTvaList) return;
    const tvaAttestations = await window.btpAPI.adminTvaList(filters);
    set({ tvaAttestations });
  },
  getTvaById: async (id) => {
    if (!window.btpAPI?.adminTvaGetById) return null;
    return window.btpAPI.adminTvaGetById(id);
  },
  createTvaAttestation: async (data) => {
    if (!window.btpAPI?.adminTvaCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminTvaCreate(data);
    if (r.success) await Promise.all([get().fetchTvaAttestations(), get().fetchStats()]);
    return r;
  },
  updateTvaAttestation: async (id, data) => {
    if (!window.btpAPI?.adminTvaUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminTvaUpdate(id, data);
    if (r.success) await Promise.all([get().fetchTvaAttestations(), get().fetchStats()]);
    return r;
  },
  removeTvaAttestation: async (id) => {
    if (!window.btpAPI?.adminTvaDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminTvaDelete(id);
    if (r.success) await Promise.all([get().fetchTvaAttestations(), get().fetchStats()]);
    return r;
  },

  // ─── DC4 ─────────────────────────────────────────────────────────────
  fetchDc4: async (filters) => {
    if (!window.btpAPI?.adminDc4List) return;
    const dc4Declarations = await window.btpAPI.adminDc4List(filters);
    set({ dc4Declarations });
  },
  getDc4ById: async (id) => {
    if (!window.btpAPI?.adminDc4GetById) return null;
    return window.btpAPI.adminDc4GetById(id);
  },
  createDc4: async (data) => {
    if (!window.btpAPI?.adminDc4Create) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminDc4Create(data);
    if (r.success) await Promise.all([get().fetchDc4(), get().fetchStats()]);
    return r;
  },
  updateDc4: async (id, data) => {
    if (!window.btpAPI?.adminDc4Update) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminDc4Update(id, data);
    if (r.success) await Promise.all([get().fetchDc4(), get().fetchStats()]);
    return r;
  },
  removeDc4: async (id) => {
    if (!window.btpAPI?.adminDc4Delete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminDc4Delete(id);
    if (r.success) await Promise.all([get().fetchDc4(), get().fetchStats()]);
    return r;
  },

  // ─── RGE ─────────────────────────────────────────────────────────────
  fetchRge: async () => {
    if (!window.btpAPI?.adminRgeList) return;
    const rgeDocuments = await window.btpAPI.adminRgeList();
    set({ rgeDocuments });
  },
  createRge: async (data) => {
    if (!window.btpAPI?.adminRgeCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminRgeCreate(data);
    if (r.success) await Promise.all([get().fetchRge(), get().fetchStats()]);
    return r;
  },
  removeRge: async (id) => {
    if (!window.btpAPI?.adminRgeDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.adminRgeDelete(id);
    if (r.success) await Promise.all([get().fetchRge(), get().fetchStats()]);
    return r;
  },

  fetchStats: async () => {
    if (!window.btpAPI?.adminGetStats) return;
    const raw = await window.btpAPI.adminGetStats();
    // Le shim web peut renvoyer {} (méthode stubbée) — on merge avec
    // EMPTY_STATS pour ne jamais propager d'undefined dans l'UI (sinon
    // String(undefined) affiche "undefined" et les soustractions donnent NaN).
    set({ stats: { ...EMPTY_STATS, ...(raw ?? {}) } });
  },
}));
