import { create } from "zustand";
import type { Invoice, InvoiceStatus, InvoicePayment, InvoiceType } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// invoicesStore (Session 10)
// ═══════════════════════════════════════════════════════════════════════════

interface InvoicesState {
  invoices: Invoice[];
  payments: InvoicePayment[]; // chargés à la demande par facture
  isLoading: boolean;
  error: string | null;

  // CRUD factures
  fetch: () => Promise<void>;
  getById: (id: string) => Invoice | undefined;
  listByClient: (clientId: string) => Invoice[];
  listByChantier: (chantierId: string) => Invoice[];
  listByQuote: (quoteId: string) => Invoice[];

  create: (data: Omit<Invoice, "id" | "reference" | "createdAt" | "updatedAt">) => Promise<{
    success: boolean;
    id?: string;
    reference?: string;
    error?: string;
  }>;
  update: (id: string, data: Partial<Invoice>) => Promise<{ success: boolean; error?: string }>;
  updateStatus: (id: string, status: InvoiceStatus) => Promise<{ success: boolean; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Conversion devis → facture
  convertFromQuote: (
    quoteId: string,
    options: { type: InvoiceType; acomptePercent?: number },
  ) => Promise<{ success: boolean; invoice?: Invoice; error?: string }>;

  // Paiements
  fetchPayments: (invoiceId: string) => Promise<InvoicePayment[]>;
  addPayment: (payment: Omit<InvoicePayment, "id" | "createdAt">) => Promise<{ success: boolean; error?: string }>;
  deletePayment: (paymentId: string) => Promise<{ success: boolean; error?: string }>;

  // Relances
  markReminderSent: (invoiceId: string) => Promise<{ success: boolean; error?: string }>;
}

export const useInvoicesStore = create<InvoicesState>((set, get) => ({
  invoices: [],
  payments: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    if (!window.btpAPI?.invoicesList) return;
    set({ isLoading: true, error: null });
    try {
      const list = await window.btpAPI.invoicesList();
      set({ invoices: list, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  getById: (id) => get().invoices.find((i) => i.id === id),
  listByClient: (clientId) => get().invoices.filter((i) => i.clientId === clientId),
  listByChantier: (chantierId) => get().invoices.filter((i) => i.chantierId === chantierId),
  listByQuote: (quoteId) => get().invoices.filter((i) => i.fromQuoteId === quoteId || i.acompteBasedOnQuoteId === quoteId),

  create: async (data) => {
    if (!window.btpAPI?.invoicesCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesCreate(data);
    if (r.success) await get().fetch();
    return r;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.invoicesUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesUpdate(id, data);
    if (r.success) await get().fetch();
    return r;
  },

  updateStatus: async (id, status) => {
    if (!window.btpAPI?.invoicesUpdateStatus) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesUpdateStatus(id, status);
    if (r.success) await get().fetch();
    return r;
  },

  delete: async (id) => {
    if (!window.btpAPI?.invoicesDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesDelete(id);
    if (r.success) await get().fetch();
    return r;
  },

  convertFromQuote: async (quoteId, options) => {
    if (!window.btpAPI?.invoicesConvertFromQuote) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesConvertFromQuote(quoteId, options);
    if (r.success) await get().fetch();
    return r;
  },

  fetchPayments: async (invoiceId) => {
    if (!window.btpAPI?.invoicesListPayments) return [];
    return await window.btpAPI.invoicesListPayments(invoiceId);
  },

  addPayment: async (payment) => {
    if (!window.btpAPI?.invoicesAddPayment) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesAddPayment(payment);
    if (r.success) await get().fetch();
    return r;
  },

  deletePayment: async (paymentId) => {
    if (!window.btpAPI?.invoicesDeletePayment) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesDeletePayment(paymentId);
    if (r.success) await get().fetch();
    return r;
  },

  markReminderSent: async (invoiceId) => {
    if (!window.btpAPI?.invoicesMarkReminderSent) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.invoicesMarkReminderSent(invoiceId);
    if (r.success) await get().fetch();
    return r;
  },
}));
