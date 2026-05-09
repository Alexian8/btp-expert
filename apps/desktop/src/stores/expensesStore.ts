import { create } from "zustand";
import type { Expense } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// expensesStore — Store Zustand pour les dépenses (Session 13)
// ═══════════════════════════════════════════════════════════════════════════

interface ExpensesState {
  expenses: Expense[];
  isLoading: boolean;

  fetch: (filters?: any) => Promise<void>;
  getById: (id: string) => Promise<Expense | null>;
  create: (data: Partial<Expense>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
  update: (id: string, data: Partial<Expense>) => Promise<{ success: boolean; error?: string }>;
  remove: (id: string) => Promise<{ success: boolean; error?: string }>;
  markPaid: (id: string, paidDate?: string, paymentMethod?: string) => Promise<{ success: boolean; error?: string }>;
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expenses: [],
  isLoading: false,

  fetch: async (filters) => {
    if (!window.btpAPI?.accountingListExpenses) return;
    set({ isLoading: true });
    const expenses = await window.btpAPI.accountingListExpenses(filters);
    set({ expenses, isLoading: false });
  },

  getById: async (id) => {
    if (!window.btpAPI?.accountingGetExpenseById) return null;
    return window.btpAPI.accountingGetExpenseById(id);
  },

  create: async (data) => {
    if (!window.btpAPI?.accountingCreateExpense) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.accountingCreateExpense(data);
    if (r.success) await get().fetch();
    return r;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.accountingUpdateExpense) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.accountingUpdateExpense(id, data);
    if (r.success) await get().fetch();
    return r;
  },

  remove: async (id) => {
    if (!window.btpAPI?.accountingDeleteExpense) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.accountingDeleteExpense(id);
    if (r.success) await get().fetch();
    return r;
  },

  markPaid: async (id, paidDate, paymentMethod) => {
    if (!window.btpAPI?.accountingMarkExpensePaid) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.accountingMarkExpensePaid(id, paidDate, paymentMethod);
    if (r.success) await get().fetch();
    return r;
  },
}));
