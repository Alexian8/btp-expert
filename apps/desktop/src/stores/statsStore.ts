import { create } from "zustand";
import type {
  QuotePipelineStats, PaymentDelayStats, ClientPaymentDelay,
  OverdueInvoice, YoYComparison, SeasonalityData,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// statsStore — Statistiques avancées (Session 16)
// ═══════════════════════════════════════════════════════════════════════════

interface State {
  pipeline: QuotePipelineStats | null;
  paymentDelays: PaymentDelayStats | null;
  clientDelays: ClientPaymentDelay[];
  overdueInvoices: OverdueInvoice[];
  yoyComparison: YoYComparison | null;
  seasonality: SeasonalityData | null;

  isLoading: boolean;

  fetchPipeline: () => Promise<void>;
  fetchPaymentDelays: () => Promise<void>;
  fetchClientDelays: (limit?: number) => Promise<void>;
  fetchOverdueInvoices: () => Promise<void>;
  fetchYoYComparison: (year?: number) => Promise<void>;
  fetchSeasonality: () => Promise<void>;
  fetchAll: () => Promise<void>;
}

export const useStatsStore = create<State>((set, get) => ({
  pipeline: null,
  paymentDelays: null,
  clientDelays: [],
  overdueInvoices: [],
  yoyComparison: null,
  seasonality: null,
  isLoading: false,

  fetchPipeline: async () => {
    if (!window.btpAPI?.statsGetQuotePipeline) return;
    const pipeline = await window.btpAPI.statsGetQuotePipeline();
    set({ pipeline });
  },

  fetchPaymentDelays: async () => {
    if (!window.btpAPI?.statsGetPaymentDelays) return;
    const paymentDelays = await window.btpAPI.statsGetPaymentDelays();
    set({ paymentDelays });
  },

  fetchClientDelays: async (limit = 10) => {
    if (!window.btpAPI?.statsGetClientPaymentDelays) return;
    const clientDelays = await window.btpAPI.statsGetClientPaymentDelays(limit);
    set({ clientDelays });
  },

  fetchOverdueInvoices: async () => {
    if (!window.btpAPI?.statsGetOverdueInvoices) return;
    const overdueInvoices = await window.btpAPI.statsGetOverdueInvoices();
    set({ overdueInvoices });
  },

  fetchYoYComparison: async (year) => {
    if (!window.btpAPI?.statsGetYoYComparison) return;
    const yoyComparison = await window.btpAPI.statsGetYoYComparison(year);
    set({ yoyComparison });
  },

  fetchSeasonality: async () => {
    if (!window.btpAPI?.statsGetSeasonality) return;
    const seasonality = await window.btpAPI.statsGetSeasonality();
    set({ seasonality });
  },

  fetchAll: async () => {
    set({ isLoading: true });
    await Promise.all([
      get().fetchPipeline(),
      get().fetchPaymentDelays(),
      get().fetchClientDelays(10),
      get().fetchOverdueInvoices(),
      get().fetchYoYComparison(),
      get().fetchSeasonality(),
    ]);
    set({ isLoading: false });
  },
}));
