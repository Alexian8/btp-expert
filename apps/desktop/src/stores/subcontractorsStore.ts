import { create } from "zustand";
import type {
  Subcontractor, SubcontractorAttestation, SubcontractorStats,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// subcontractorsStore — Store pour sous-traitants + attestations
// ═══════════════════════════════════════════════════════════════════════════

interface State {
  subcontractors: Subcontractor[];
  attestations: SubcontractorAttestation[];
  expiringAttestations: Array<SubcontractorAttestation & { companyName: string; isExpired: boolean }>;
  stats: SubcontractorStats;
  isLoading: boolean;

  fetch: (filters?: any) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchExpiringAttestations: (daysAhead?: number) => Promise<void>;
  getById: (id: string) => Promise<Subcontractor | null>;

  create: (data: Partial<Subcontractor>) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (id: string, data: Partial<Subcontractor>) => Promise<{ success: boolean; error?: string }>;
  remove: (id: string) => Promise<{ success: boolean; error?: string }>;

  fetchAttestations: (subcontractorId?: string) => Promise<void>;
  createAttestation: (data: Partial<SubcontractorAttestation>) => Promise<{ success: boolean; id?: string; error?: string }>;
  updateAttestation: (id: string, data: Partial<SubcontractorAttestation>) => Promise<{ success: boolean; error?: string }>;
  removeAttestation: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const EMPTY_STATS: SubcontractorStats = {
  totalActive: 0, totalArchived: 0,
  attestationsExpired: 0, attestationsExpiringSoon: 0,
  totalContractsAmount: 0, pendingPayments: 0,
};

export const useSubcontractorsStore = create<State>((set, get) => ({
  subcontractors: [],
  attestations: [],
  expiringAttestations: [],
  stats: EMPTY_STATS,
  isLoading: false,

  fetch: async (filters) => {
    if (!window.btpAPI?.subcontractorsList) return;
    set({ isLoading: true });
    const subcontractors = await window.btpAPI.subcontractorsList(filters);
    set({ subcontractors, isLoading: false });
  },
  fetchStats: async () => {
    if (!window.btpAPI?.subcontractorsGetStats) return;
    const stats = await window.btpAPI.subcontractorsGetStats();
    set({ stats });
  },
  fetchExpiringAttestations: async (daysAhead = 30) => {
    if (!window.btpAPI?.subcontractorsListExpiringAttestations) return;
    const expiringAttestations = await window.btpAPI.subcontractorsListExpiringAttestations(daysAhead);
    set({ expiringAttestations });
  },
  getById: async (id) => {
    if (!window.btpAPI?.subcontractorsGetById) return null;
    return window.btpAPI.subcontractorsGetById(id);
  },
  create: async (data) => {
    if (!window.btpAPI?.subcontractorsCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.subcontractorsCreate(data);
    if (r.success) await Promise.all([get().fetch(), get().fetchStats()]);
    return r;
  },
  update: async (id, data) => {
    if (!window.btpAPI?.subcontractorsUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.subcontractorsUpdate(id, data);
    if (r.success) await Promise.all([get().fetch(), get().fetchStats()]);
    return r;
  },
  remove: async (id) => {
    if (!window.btpAPI?.subcontractorsDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.subcontractorsDelete(id);
    if (r.success) await Promise.all([get().fetch(), get().fetchStats()]);
    return r;
  },

  fetchAttestations: async (subcontractorId) => {
    if (!window.btpAPI?.subcontractorsListAttestations) return;
    const attestations = await window.btpAPI.subcontractorsListAttestations(subcontractorId);
    set({ attestations });
  },
  createAttestation: async (data) => {
    if (!window.btpAPI?.subcontractorsCreateAttestation) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.subcontractorsCreateAttestation(data);
    if (r.success) {
      await Promise.all([
        get().fetchAttestations(data.subcontractorId),
        get().fetchStats(),
        get().fetchExpiringAttestations(30),
      ]);
    }
    return r;
  },
  updateAttestation: async (id, data) => {
    if (!window.btpAPI?.subcontractorsUpdateAttestation) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.subcontractorsUpdateAttestation(id, data);
    if (r.success) {
      await Promise.all([
        get().fetchAttestations(),
        get().fetchStats(),
        get().fetchExpiringAttestations(30),
      ]);
    }
    return r;
  },
  removeAttestation: async (id) => {
    if (!window.btpAPI?.subcontractorsDeleteAttestation) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.subcontractorsDeleteAttestation(id);
    if (r.success) {
      await Promise.all([
        get().fetchAttestations(),
        get().fetchStats(),
        get().fetchExpiringAttestations(30),
      ]);
    }
    return r;
  },
}));
