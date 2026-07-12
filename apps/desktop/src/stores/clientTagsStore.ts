import { create } from "zustand";
import { DEFAULT_CLIENT_TAGS, type ClientTag } from "@btp/types";
import { getDataService } from "@/lib/dataService";

// ═══════════════════════════════════════════════════════════════════════════
// clientTagsStore — étiquettes clients personnalisables (réglage partagé).
// Stockées dans les settings serveur (`clientTags`), donc communes à toute
// l'entreprise. Fallback sur DEFAULT_CLIENT_TAGS tant qu'aucune n'est définie.
// ═══════════════════════════════════════════════════════════════════════════

interface ClientTagsState {
  tags: ClientTag[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (tags: ClientTag[]) => Promise<boolean>;
  byId: (id: string) => ClientTag | undefined;
}

export const useClientTagsStore = create<ClientTagsState>((set, get) => ({
  tags: DEFAULT_CLIENT_TAGS,
  loaded: false,

  load: async () => {
    try {
      const s = (await getDataService().getSettings()) as { clientTags?: ClientTag[] };
      const t = s?.clientTags;
      set({ tags: Array.isArray(t) && t.length > 0 ? t : DEFAULT_CLIENT_TAGS, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  save: async (tags) => {
    set({ tags });
    try {
      await getDataService().updateSettings({ clientTags: tags });
      window.dispatchEvent(new Event("btp:settings-updated"));
      return true;
    } catch {
      return false;
    }
  },

  byId: (id) => get().tags.find((t) => t.id === id),
}));
