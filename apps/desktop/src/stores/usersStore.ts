import { create } from "zustand";

// ═══════════════════════════════════════════════════════════════════════════
// Users Store — annuaire compact des utilisateurs (id, username, prénom, nom)
//
// Chargé depuis GET /api/users/public (route auth requise mais non admin).
// Sert à afficher "Créé par X" dans les listes Devis/Factures/etc. sans
// faire un fetch par ligne.
//
// Cache simple en mémoire, rafraîchi au login et toutes les 10 min.
// ═══════════════════════════════════════════════════════════════════════════

export interface PublicUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role?: string;
}

interface UsersState {
  byId: Map<number, PublicUser>;
  loaded: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  /** Force un refresh (ex: après création d'un user). */
  reload: () => Promise<void>;
  /** Reset (à appeler au logout). */
  reset: () => void;
  /** Helper : nom complet d'un user (firstName + lastName, fallback @username). */
  fullName: (id: number | string | null | undefined) => string;
  /** Helper : initiale pour l'avatar. */
  initial: (id: number | string | null | undefined) => string;
  /** Helper : récupère un user par id. */
  get: (id: number | string | null | undefined) => PublicUser | undefined;
}

const TOKEN_KEY = "btp.web.token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function fetchUsers(): Promise<PublicUser[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch("/api/users/public", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return (await res.json()) as PublicUser[];
  } catch {
    return [];
  }
}

function toMap(list: PublicUser[]): Map<number, PublicUser> {
  return new Map(list.map((u) => [u.id, u]));
}

export const useUsersStore = create<UsersState>((set, get) => ({
  byId: new Map(),
  loaded: false,
  isLoading: false,

  load: async () => {
    const state = get();
    if (state.loaded || state.isLoading) return;
    set({ isLoading: true });
    const list = await fetchUsers();
    set({ byId: toMap(list), loaded: true, isLoading: false });
  },

  reload: async () => {
    set({ isLoading: true });
    const list = await fetchUsers();
    set({ byId: toMap(list), loaded: true, isLoading: false });
  },

  reset: () => set({ byId: new Map(), loaded: false, isLoading: false }),

  fullName: (id) => {
    if (id == null) return "—";
    const numId = typeof id === "string" ? Number(id) : id;
    const u = get().byId.get(numId);
    if (!u) return "—";
    const n = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    return n || `@${u.username}`;
  },

  initial: (id) => {
    if (id == null) return "?";
    const numId = typeof id === "string" ? Number(id) : id;
    const u = get().byId.get(numId);
    if (!u) return "?";
    return (u.firstName?.[0] ?? u.username[0] ?? "?").toUpperCase();
  },

  get: (id) => {
    if (id == null) return undefined;
    const numId = typeof id === "string" ? Number(id) : id;
    return get().byId.get(numId);
  },
}));
