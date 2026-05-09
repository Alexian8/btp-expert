import { create } from "zustand";
import type { ExpenseNote, ExpenseNoteStats } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// expenseNotesStore — Store Zustand pour les notes de frais (Session 14)
// ═══════════════════════════════════════════════════════════════════════════

interface ExpenseNotesState {
  notes: ExpenseNote[];
  stats: ExpenseNoteStats;
  isLoading: boolean;

  fetch: (filters?: any) => Promise<void>;
  fetchStats: () => Promise<void>;
  getById: (id: string) => Promise<ExpenseNote | null>;
  create: (data: Partial<ExpenseNote>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  update: (id: string, data: Partial<ExpenseNote>) => Promise<{ success: boolean; error?: string }>;
  remove: (id: string) => Promise<{ success: boolean; error?: string }>;
  validate: (id: string) => Promise<{ success: boolean; error?: string }>;
  markReimbursed: (id: string, date?: string) => Promise<{ success: boolean; error?: string }>;
  exportMonth: (year: number, month: number) => Promise<{ success: boolean; path?: string; cancelled?: boolean; notesCount?: number; error?: string }>;
}

const EMPTY_STATS: ExpenseNoteStats = {
  totalMonth: 0,
  totalRefacturable: 0,
  totalARembourser: 0,
  notesCount: 0,
};

export const useExpenseNotesStore = create<ExpenseNotesState>((set, get) => ({
  notes: [],
  stats: EMPTY_STATS,
  isLoading: false,

  fetch: async (filters) => {
    if (!window.btpAPI?.expenseNotesList) return;
    set({ isLoading: true });
    const notes = await window.btpAPI.expenseNotesList(filters);
    set({ notes, isLoading: false });
  },

  fetchStats: async () => {
    if (!window.btpAPI?.expenseNotesGetStats) return;
    const stats = await window.btpAPI.expenseNotesGetStats();
    set({ stats });
  },

  getById: async (id) => {
    if (!window.btpAPI?.expenseNotesGetById) return null;
    return window.btpAPI.expenseNotesGetById(id);
  },

  create: async (data) => {
    if (!window.btpAPI?.expenseNotesCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.expenseNotesCreate(data);
    if (r.success) {
      await Promise.all([get().fetch(), get().fetchStats()]);
    }
    return r;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.expenseNotesUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.expenseNotesUpdate(id, data);
    if (r.success) {
      await Promise.all([get().fetch(), get().fetchStats()]);
    }
    return r;
  },

  remove: async (id) => {
    if (!window.btpAPI?.expenseNotesDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.expenseNotesDelete(id);
    if (r.success) {
      await Promise.all([get().fetch(), get().fetchStats()]);
    }
    return r;
  },

  validate: async (id) => {
    if (!window.btpAPI?.expenseNotesValidate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.expenseNotesValidate(id);
    if (r.success) {
      await Promise.all([get().fetch(), get().fetchStats()]);
    }
    return r;
  },

  markReimbursed: async (id, date) => {
    if (!window.btpAPI?.expenseNotesMarkReimbursed) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.expenseNotesMarkReimbursed(id, date);
    if (r.success) {
      await Promise.all([get().fetch(), get().fetchStats()]);
    }
    return r;
  },

  exportMonth: async (year, month) => {
    if (!window.btpAPI?.expenseNotesExportMonth) return { success: false, error: "API non disponible" };
    return window.btpAPI.expenseNotesExportMonth(year, month);
  },
}));
