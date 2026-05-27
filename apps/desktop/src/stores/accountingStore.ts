import { create } from "zustand";
import type {
  AccountingSettings,
  Account,
  Journal,
  JournalEntry,
  JournalLine,
  GrandLivre,
  BalanceRow,
  IncomeStatement,
  BalanceSheet,
  RegenerateResult,
  AccountingMode,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// accountingStore — Comptabilité partie double (Session 30)
//   Plan comptable, journaux, écritures, livre journal, grand livre, balance,
//   compte de résultat, bilan.
// ═══════════════════════════════════════════════════════════════════════════

interface AccountingState {
  settings: AccountingSettings | null;
  accounts: Account[];
  journals: Journal[];
  isLoadingSettings: boolean;
  isLoadingAccounts: boolean;
  isLoadingJournals: boolean;
  isRegenerating: boolean;

  fetchSettings: () => Promise<AccountingSettings | null>;
  setMode: (mode: Exclude<AccountingMode, "">) => Promise<{ success: boolean; error?: string }>;
  updateSettings: (patch: Partial<AccountingSettings>) => Promise<{ success: boolean; error?: string }>;

  fetchAccounts: (filters?: { classe?: number; search?: string }) => Promise<Account[]>;
  createAccount: (data: Partial<Account>) => Promise<{ success: boolean; numero?: string; error?: string }>;
  updateAccount: (numero: string, data: Partial<Account>) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: (numero: string) => Promise<{ success: boolean; error?: string }>;

  fetchJournals: () => Promise<Journal[]>;

  listEntries: (filters?: { journalCode?: string; year?: number; dateFrom?: string; dateTo?: string; search?: string; limit?: number }) => Promise<JournalEntry[]>;
  getEntry: (entryId: string) => Promise<JournalEntry | null>;
  createManualEntry: (data: { journalCode: string; date: string; libelle: string; pieceRef?: string; pieceDate?: string; lines: Partial<JournalLine>[] }) => Promise<{ success: boolean; id?: string; numero?: number; error?: string }>;
  deleteEntry: (entryId: string) => Promise<{ success: boolean; error?: string }>;

  regenerateAll: () => Promise<RegenerateResult>;
  autoLettrer: (compteAuxNum?: string) => Promise<{ success: boolean; error?: string }>;
  setLettrage: (lineIds: string[], code: string) => Promise<{ success: boolean; error?: string }>;

  getGrandLivre: (params: { compteNum: string; year?: number; dateFrom?: string; dateTo?: string }) => Promise<GrandLivre>;
  getBalance: (params?: { year?: number; dateFrom?: string; dateTo?: string }) => Promise<BalanceRow[]>;
  getIncomeStatement: (params?: { year?: number; dateFrom?: string; dateTo?: string }) => Promise<IncomeStatement>;
  getBalanceSheet: (params?: { year?: number; asOfDate?: string }) => Promise<BalanceSheet>;
}

const EMPTY_GRAND_LIVRE: GrandLivre = { compteNum: "", lines: [], totals: { debit: 0, credit: 0, solde: 0 } };
const EMPTY_INCOME: IncomeStatement = { charges: [], produits: [], totalCharges: 0, totalProduits: 0, resultat: 0 };
const EMPTY_BALANCE_SHEET: BalanceSheet = { actif: [], passif: [], totalActif: 0, totalPassif: 0, resultat: 0 };
const EMPTY_REGEN: RegenerateResult = { success: false, invoices: 0, expenses: 0, invoicePayments: 0, expensePayments: 0, errors: [] };

export const useAccountingStore = create<AccountingState>((set, get) => ({
  settings: null,
  accounts: [],
  journals: [],
  isLoadingSettings: false,
  isLoadingAccounts: false,
  isLoadingJournals: false,
  isRegenerating: false,

  fetchSettings: async () => {
    if (!window.btpAPI?.accountingGetSettings) return null;
    set({ isLoadingSettings: true });
    try {
      const s = await window.btpAPI.accountingGetSettings();
      set({ settings: s, isLoadingSettings: false });
      return s;
    } catch (e) {
      console.error("[accountingStore] fetchSettings", e);
      set({ isLoadingSettings: false });
      return null;
    }
  },

  setMode: async (mode) => {
    if (!window.btpAPI?.accountingUpdateSettings) return { success: false, error: "API non disponible" };
    const res = await window.btpAPI.accountingUpdateSettings({ mode });
    if (res.success) await get().fetchSettings();
    return res;
  },

  updateSettings: async (patch) => {
    if (!window.btpAPI?.accountingUpdateSettings) return { success: false, error: "API non disponible" };
    const res = await window.btpAPI.accountingUpdateSettings(patch);
    if (res.success) await get().fetchSettings();
    return res;
  },

  fetchAccounts: async (filters) => {
    if (!window.btpAPI?.accountingListAccounts) return [];
    set({ isLoadingAccounts: true });
    try {
      const accounts = await window.btpAPI.accountingListAccounts(filters);
      const arr = Array.isArray(accounts) ? accounts : [];
      set({ accounts: arr, isLoadingAccounts: false });
      return arr;
    } catch (e) {
      console.error("[accountingStore] fetchAccounts", e);
      set({ isLoadingAccounts: false });
      return [];
    }
  },

  createAccount: async (data) => {
    if (!window.btpAPI?.accountingCreateAccount) return { success: false, error: "API non disponible" };
    const res = await window.btpAPI.accountingCreateAccount(data);
    if (res.success) await get().fetchAccounts();
    return res;
  },

  updateAccount: async (numero, data) => {
    if (!window.btpAPI?.accountingUpdateAccount) return { success: false, error: "API non disponible" };
    const res = await window.btpAPI.accountingUpdateAccount(numero, data);
    if (res.success) await get().fetchAccounts();
    return res;
  },

  deleteAccount: async (numero) => {
    if (!window.btpAPI?.accountingDeleteAccount) return { success: false, error: "API non disponible" };
    const res = await window.btpAPI.accountingDeleteAccount(numero);
    if (res.success) await get().fetchAccounts();
    return res;
  },

  fetchJournals: async () => {
    if (!window.btpAPI?.accountingListJournals) return [];
    set({ isLoadingJournals: true });
    try {
      const journals = await window.btpAPI.accountingListJournals();
      const arr = Array.isArray(journals) ? journals : [];
      set({ journals: arr, isLoadingJournals: false });
      return arr;
    } catch (e) {
      console.error("[accountingStore] fetchJournals", e);
      set({ isLoadingJournals: false });
      return [];
    }
  },

  listEntries: async (filters) => {
    if (!window.btpAPI?.accountingListEntries) return [];
    try {
      const r = await window.btpAPI.accountingListEntries(filters);
      return Array.isArray(r) ? r : [];
    } catch (e) {
      console.error("[accountingStore] listEntries", e);
      return [];
    }
  },

  getEntry: async (entryId) => {
    if (!window.btpAPI?.accountingGetEntry) return null;
    try { return await window.btpAPI.accountingGetEntry(entryId); }
    catch { return null; }
  },

  createManualEntry: async (data) => {
    if (!window.btpAPI?.accountingCreateManualEntry) return { success: false, error: "API non disponible" };
    return window.btpAPI.accountingCreateManualEntry(data);
  },

  deleteEntry: async (entryId) => {
    if (!window.btpAPI?.accountingDeleteEntry) return { success: false, error: "API non disponible" };
    return window.btpAPI.accountingDeleteEntry(entryId);
  },

  regenerateAll: async () => {
    if (!window.btpAPI?.accountingRegenerateAllEntries) return EMPTY_REGEN;
    set({ isRegenerating: true });
    try {
      const r = await window.btpAPI.accountingRegenerateAllEntries();
      set({ isRegenerating: false });
      return r;
    } catch (e) {
      console.error("[accountingStore] regenerateAll", e);
      set({ isRegenerating: false });
      return EMPTY_REGEN;
    }
  },

  autoLettrer: async (compteAuxNum) => {
    if (!window.btpAPI?.accountingAutoLettrer) return { success: false, error: "API non disponible" };
    return window.btpAPI.accountingAutoLettrer(compteAuxNum);
  },

  setLettrage: async (lineIds, code) => {
    if (!window.btpAPI?.accountingSetLettrage) return { success: false, error: "API non disponible" };
    return window.btpAPI.accountingSetLettrage(lineIds, code);
  },

  getGrandLivre: async (params) => {
    if (!window.btpAPI?.accountingGetGrandLivre) return { ...EMPTY_GRAND_LIVRE, compteNum: params.compteNum };
    try { return await window.btpAPI.accountingGetGrandLivre(params); }
    catch (e) {
      console.error("[accountingStore] getGrandLivre", e);
      return { ...EMPTY_GRAND_LIVRE, compteNum: params.compteNum };
    }
  },

  getBalance: async (params) => {
    if (!window.btpAPI?.accountingGetBalance) return [];
    try {
      const r = await window.btpAPI.accountingGetBalance(params);
      return Array.isArray(r) ? r : [];
    } catch (e) {
      console.error("[accountingStore] getBalance", e);
      return [];
    }
  },

  getIncomeStatement: async (params) => {
    if (!window.btpAPI?.accountingGetIncomeStatement) return EMPTY_INCOME;
    try { return await window.btpAPI.accountingGetIncomeStatement(params); }
    catch { return EMPTY_INCOME; }
  },

  getBalanceSheet: async (params) => {
    if (!window.btpAPI?.accountingGetBalanceSheet) return EMPTY_BALANCE_SHEET;
    try { return await window.btpAPI.accountingGetBalanceSheet(params); }
    catch { return EMPTY_BALANCE_SHEET; }
  },
}));
