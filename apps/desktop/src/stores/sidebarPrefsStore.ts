import { create } from "zustand";
import { persist } from "zustand/middleware";

// ═══════════════════════════════════════════════════════════════════════════
// sidebarPrefsStore — Préférences de la sidebar (Session 21)
// Permet de masquer/afficher des items + de réordonner
// Persisté dans localStorage via zustand/persist
// ═══════════════════════════════════════════════════════════════════════════

// Identifiants stables des items de la sidebar (servent de clés)
// IMPORTANT : si on ajoute un nouvel item dans la nav, il faut l'ajouter ici
// avec un id stable (l'ordre de NAV_ITEM_IDS ci-dessous est l'ordre par défaut).
export const NAV_ITEM_IDS = [
  "dashboard",
  "quotes",
  "chantiers",
  "clients",
  "suppliers",
  "expenses",
  "subcontractors",
  "finances",     // hub : Tableau de bord + Comptabilité + Statistiques
  "admin-docs",
  "calendar",     // Agenda : avant-dernier (juste au-dessus du coffre-fort)
  "vault",        // Coffre-fort : en dernier, juste au-dessus de Paramètres
] as const;

// Items retirés (fusionnés ou renommés) — purgés des préférences persistées.
const REMOVED_IDS = ["accounting", "statistics", "expense-notes"];

export type NavItemId = (typeof NAV_ITEM_IDS)[number];

interface SidebarPrefsState {
  /** Ordre actuel des items dans la sidebar (peut contenir plus d'items que NAV_ITEM_IDS si futur) */
  order: string[];

  /** Items masqués (leurs ids) */
  hidden: string[];

  /** Setters */
  setOrder: (order: string[]) => void;
  toggleHidden: (id: string) => void;
  setHidden: (hidden: string[]) => void;
  reset: () => void;

  /** Helpers de migration : s'assurer que tous les ids actuels sont présents */
  syncWithCurrentNav: (currentIds: readonly string[]) => void;
}

const DEFAULT_STATE: Pick<SidebarPrefsState, "order" | "hidden"> = {
  order: [...NAV_ITEM_IDS],
  hidden: [],
};

export const useSidebarPrefsStore = create<SidebarPrefsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setOrder: (order) => set({ order }),

      toggleHidden: (id) =>
        set((s) => ({
          hidden: s.hidden.includes(id)
            ? s.hidden.filter((x) => x !== id)
            : [...s.hidden, id],
        })),

      setHidden: (hidden) => set({ hidden }),

      reset: () => set(DEFAULT_STATE),

      // Quand l'app démarre, on s'assure que les nouveaux items ajoutés
      // depuis la dernière session apparaissent (à la fin de la liste, visibles).
      // On retire aussi les ids qui n'existent plus.
      syncWithCurrentNav: (currentIds) => {
        const state = get();
        // Garde l'ordre actuel des items existants
        const orderedExisting = state.order.filter((id) => currentIds.includes(id));
        // Ajoute les nouveaux items à la fin
        const newOnes = currentIds.filter((id) => !orderedExisting.includes(id));
        const finalOrder = [...orderedExisting, ...newOnes];

        // Garde uniquement les hidden qui correspondent à des items existants
        const validHidden = state.hidden.filter((id) => currentIds.includes(id));

        if (
          JSON.stringify(finalOrder) !== JSON.stringify(state.order) ||
          JSON.stringify(validHidden) !== JSON.stringify(state.hidden)
        ) {
          set({ order: finalOrder, hidden: validHidden });
        }
      },
    }),
    {
      name: "btp-sidebar-prefs",
      version: 3,
      // Migrations :
      //   v1 → v2 : fusion finances/comptabilité/statistiques en « finances ».
      //   v2 → v3 : Agenda (calendar) placé avant-dernier, Coffre-fort (vault)
      //             en dernier (juste au-dessus de Paramètres).
      // On réapplique l'ordre de référence (NAV_ITEM_IDS) tout en conservant
      // les éventuels items masqués par l'utilisateur.
      migrate: (persisted) => {
        const state = (persisted as Pick<SidebarPrefsState, "order" | "hidden">) || DEFAULT_STATE;
        const hidden = (state.hidden || []).filter(
          (id) => !REMOVED_IDS.includes(id) && (NAV_ITEM_IDS as readonly string[]).includes(id)
        );
        return { order: [...NAV_ITEM_IDS], hidden };
      },
    }
  )
);
