import { create } from "zustand";
import type { AgendaEvent, AgendaStats } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// agendaStore — Store Zustand pour l'agenda (Session 12)
// ═══════════════════════════════════════════════════════════════════════════

interface AgendaState {
  events: AgendaEvent[];
  todayEvents: AgendaEvent[];
  upcomingEvents: AgendaEvent[];
  stats: AgendaStats;
  isLoading: boolean;

  fetchEvents: (rangeStart?: string, rangeEnd?: string) => Promise<void>;
  fetchToday: () => Promise<void>;
  fetchUpcoming: (days?: number) => Promise<void>;
  fetchStats: () => Promise<void>;

  create: (data: Partial<AgendaEvent>) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (id: string, data: Partial<AgendaEvent>) => Promise<{ success: boolean; error?: string }>;
  remove: (id: string) => Promise<{ success: boolean; error?: string }>;

  syncAllToOutlook: () => Promise<{ success: boolean; pushed?: number; failed?: number; total?: number; needsLogin?: boolean; error?: string }>;
  syncOne: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  events: [],
  todayEvents: [],
  upcomingEvents: [],
  stats: { totalEvents: 0, todayCount: 0, thisWeekCount: 0, upcomingNext7Days: 0 },
  isLoading: false,

  fetchEvents: async (rangeStart, rangeEnd) => {
    if (!window.btpAPI?.agendaList) return;
    set({ isLoading: true });
    const events = await window.btpAPI.agendaList({ rangeStart, rangeEnd });
    set({ events, isLoading: false });
  },

  fetchToday: async () => {
    if (!window.btpAPI?.agendaListToday) return;
    const todayEvents = await window.btpAPI.agendaListToday();
    set({ todayEvents });
  },

  fetchUpcoming: async (days = 7) => {
    if (!window.btpAPI?.agendaListUpcoming) return;
    const upcomingEvents = await window.btpAPI.agendaListUpcoming(days);
    set({ upcomingEvents });
  },

  fetchStats: async () => {
    if (!window.btpAPI?.agendaGetStats) return;
    const stats = await window.btpAPI.agendaGetStats();
    set({ stats });
  },

  create: async (data) => {
    if (!window.btpAPI?.agendaCreate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.agendaCreate(data);
    if (r.success) {
      await Promise.all([get().fetchStats(), get().fetchToday()]);
    }
    return r;
  },

  update: async (id, data) => {
    if (!window.btpAPI?.agendaUpdate) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.agendaUpdate(id, data);
    if (r.success) {
      await Promise.all([get().fetchStats(), get().fetchToday()]);
    }
    return r;
  },

  remove: async (id) => {
    if (!window.btpAPI?.agendaDelete) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.agendaDelete(id);
    if (r.success) {
      await Promise.all([get().fetchStats(), get().fetchToday()]);
    }
    return r;
  },

  syncAllToOutlook: async () => {
    if (!window.btpAPI?.agendaSyncAllToOutlook) return { success: false, error: "API non disponible" };
    return window.btpAPI.agendaSyncAllToOutlook();
  },

  syncOne: async (id) => {
    if (!window.btpAPI?.agendaSyncOne) return { success: false, error: "API non disponible" };
    return window.btpAPI.agendaSyncOne(id);
  },
}));
