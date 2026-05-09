import { create } from "zustand";
import type {
  FinanceStats, MonthlyDataPoint,
  TopClient, TopSupplier, ChantierMargin,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// financeStore — Stats financières (Session 13)
// ═══════════════════════════════════════════════════════════════════════════

interface FinanceState {
  stats: FinanceStats;
  monthly: MonthlyDataPoint[];
  topClients: TopClient[];
  topSuppliers: TopSupplier[];
  chantierMargins: ChantierMargin[];
  isLoading: boolean;

  fetchAll: () => Promise<void>;
  exportFEC: (year: number) => Promise<{ success: boolean; path?: string; cancelled?: boolean; invoicesCount?: number; expensesCount?: number; lineCount?: number; error?: string }>;
}

const EMPTY_STATS: FinanceStats = {
  caEncaisseMonth: 0, caEncaisseYear: 0, caEnAttente: 0,
  expensesMonth: 0, expensesYear: 0, expensesAPayer: 0,
  margeMonth: 0, margeYear: 0,
  tvaCollectee: 0, tvaDeductible: 0, tvaAReverser: 0,
};

export const useFinanceStore = create<FinanceState>((set) => ({
  stats: EMPTY_STATS,
  monthly: [],
  topClients: [],
  topSuppliers: [],
  chantierMargins: [],
  isLoading: false,

  fetchAll: async () => {
    if (!window.btpAPI) return;
    set({ isLoading: true });
    try {
      const [stats, monthly, topClients, topSuppliers, chantierMargins] = await Promise.all([
        window.btpAPI.accountingGetFinanceStats?.() ?? EMPTY_STATS,
        window.btpAPI.accountingGetMonthlyEvolution?.(12) ?? [],
        window.btpAPI.accountingGetTopClients?.(5) ?? [],
        window.btpAPI.accountingGetTopSuppliers?.(5) ?? [],
        window.btpAPI.accountingGetChantierMargins?.() ?? [],
      ]);
      set({ stats, monthly, topClients, topSuppliers, chantierMargins, isLoading: false });
    } catch (e) {
      console.error("[financeStore] fetchAll", e);
      set({ isLoading: false });
    }
  },

  exportFEC: async (year) => {
    if (!window.btpAPI?.accountingExportFEC) return { success: false, error: "API non disponible" };
    return window.btpAPI.accountingExportFEC(year);
  },
}));
