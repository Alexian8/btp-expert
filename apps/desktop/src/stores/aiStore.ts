import { useEffect } from "react";
import { create } from "zustand";
import type { AiStatus } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// aiStore — statut de l'assistant IA locale (serveur node-llama-cpp)
//
// Le statut est récupéré UNE fois par session via window.btpAPI.aiStatus()
// (REST /api/ai/status en web, stub « indisponible » sur desktop) et sert au
// gating UI : les boutons IA ne s'affichent que si status.available.
// ═══════════════════════════════════════════════════════════════════════════

const UNAVAILABLE: AiStatus = {
  available: false,
  enabled: false,
  modelLoaded: false,
  modelFile: "",
};

interface AiState {
  status: AiStatus | null;
  fetched: boolean;
  fetch: () => Promise<void>;
}

export const useAiStore = create<AiState>((set, get) => ({
  status: null,
  fetched: false,

  fetch: async () => {
    if (get().fetched) return;
    set({ fetched: true });
    const api = window.btpAPI;
    if (!api?.aiStatus) {
      set({ status: UNAVAILABLE });
      return;
    }
    try {
      set({ status: await api.aiStatus() });
    } catch {
      set({ status: UNAVAILABLE });
    }
  },
}));

/** Hook de gating : true si l'assistant IA est prêt (déclenche le fetch au 1er montage). */
export function useAiAvailable(): boolean {
  const status = useAiStore((s) => s.status);
  const fetch = useAiStore((s) => s.fetch);
  useEffect(() => {
    void fetch();
  }, [fetch]);
  return Boolean(status?.available);
}
