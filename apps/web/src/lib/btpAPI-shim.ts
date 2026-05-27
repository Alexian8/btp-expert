// ═══════════════════════════════════════════════════════════════════════════
// btpAPI-shim.ts — Émulation de window.btpAPI pour la web app
//
// L'app desktop appelle window.btpAPI.xxx() partout. Ce shim expose la même
// interface mais redirige vers nos routes HTTP /api/* quand elles existent,
// et renvoie des valeurs vides "douces" pour les méthodes pas encore portées
// (afin que l'app ne crash pas, juste les pages affichent "vide").
// ═══════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = "btp.web.token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// Timeout par défaut : 30s. Suffisant pour les exports PDF lourds, mais
// empêche une requête pendue indéfiniment si le serveur ne répond plus.
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

// Émet un event global que l'UI peut écouter pour afficher un toast d'erreur.
// On le fait uniquement pour les vraies erreurs API (5xx, network, timeout),
// pas pour les 401 (déjà gérés via btp:auth-required) ni les 4xx attendus
// par les composants (les composants devraient catcher et afficher eux-mêmes).
function emitApiError(detail: {
  method: string;
  path: string;
  status?: number;
  message: string;
  kind: "network" | "timeout" | "server";
}): void {
  try {
    window.dispatchEvent(new CustomEvent("btp:api-error", { detail }));
  } catch {
    /* dispatch ne devrait jamais throw, mais defensive */
  }
}

async function http<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout =
      err instanceof DOMException && err.name === "AbortError";
    const message = isTimeout
      ? `Délai d'attente dépassé (${Math.round(DEFAULT_HTTP_TIMEOUT_MS / 1000)}s)`
      : err instanceof Error
        ? err.message
        : "Erreur réseau";
    emitApiError({
      method,
      path,
      message,
      kind: isTimeout ? "timeout" : "network",
    });
    throw new Error(message);
  }
  clearTimeout(timeoutId);

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent("btp:auth-required"));
    throw new Error("Unauthorized");
  }
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `HTTP ${res.status}`;
    // 5xx et 429 sont des problèmes d'infra/serveur → utile pour l'UI globale.
    // 4xx (sauf 429) sont des erreurs métier → on laisse l'appelant les gérer.
    if (res.status >= 500 || res.status === 429) {
      emitApiError({ method, path, status: res.status, message: msg, kind: "server" });
    }
    throw new Error(msg);
  }
  return payload as T;
}

// ─── Helper "stub doux" : retourne une valeur par défaut + warn ──────────
function stub<T>(name: string, fallback: T): () => Promise<T> {
  let warned = false;
  return async () => {
    if (!warned) {
      console.warn(
        `[btpAPI-shim] "${name}" pas encore disponible en mode web. Retour par défaut.`
      );
      warned = true;
    }
    return fallback;
  };
}

// ─── L'objet window.btpAPI émulé ─────────────────────────────────────────
export function installBtpApiShim(): void {
  if (typeof window === "undefined") return;

  // ─── Login serveur direct (utilisé par dataService.login en mode web) ─
  const webLogin = async (
    username: string,
    password: string
  ): Promise<
    | {
        id: number;
        username: string;
        role: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        mustChangePassword?: boolean;
        companyId?: number;
        isSetupComplete?: boolean;
        companyName?: string;
        passwordHash: string;
      }
    | null
  > => {
    try {
      const res = await http<{
        id: number;
        username: string;
        role: string;
        token: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        mustChangePassword?: boolean;
        companyId?: number;
        isSetupComplete?: boolean;
        companyName?: string;
      }>("POST", "/api/auth/login", { username, password });
      if (res.token) setToken(res.token);
      return {
        id: res.id,
        username: res.username,
        role: res.role,
        email: res.email,
        firstName: res.firstName,
        lastName: res.lastName,
        mustChangePassword: res.mustChangePassword,
        companyId: res.companyId,
        isSetupComplete: res.isSetupComplete,
        companyName: res.companyName,
        passwordHash: "WEB_AUTH_OK", // sentinel : ElectronDataService va sauter la vérif locale
      };
    } catch {
      return null;
    }
  };

  // ─── Restauration de session (appelé au boot pour récupérer le user
  //     depuis le JWT en localStorage et éviter un re-login forcé) ────────
  const webMe = async (): Promise<
    | {
        id: number;
        username: string;
        role: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        mustChangePassword?: boolean;
        companyId?: number;
        isSetupComplete?: boolean;
        companyName?: string;
      }
    | null
  > => {
    if (!getToken()) return null;
    try {
      return await http("GET", "/api/auth/me");
    } catch {
      // 401 → http() a déjà nettoyé le token
      return null;
    }
  };

  // ─── Logout serveur : invalide la session côté UI (le JWT reste valide
  //     jusqu'à expiration côté serveur — on se contente de drop le token). ─
  const webLogout = async (): Promise<void> => {
    try {
      await http("POST", "/api/auth/logout");
    } catch {
      /* best-effort */
    }
    setToken(null);
  };

  // Auth & users
  const auth = {
    webLogin, // exposé pour usage par dataService desktop en mode web
    webMe, // exposé pour rehydratation au boot
    webLogout, // exposé pour drop le token au logout
    countUsers: async (): Promise<number> => {
      // Côté web : on renvoie 1 (admin déjà bootstrappé via /api/auth/bootstrap)
      // pour que l'app ne tente jamais l'écran "Créez votre compte"
      try {
        const me = await http<{ id: number } | null>("GET", "/api/auth/me");
        return me ? 1 : 1;
      } catch {
        return 1;
      }
    },
    findUser: async (
      username: string
    ): Promise<{ id: number; username: string; passwordHash?: string; role: string } | null> => {
      // Côté serveur, on n'expose pas findUser (utilisé seulement par auth desktop).
      // On simule en faisant un /me si déjà connecté.
      try {
        const me = await http<{ id: number; username: string; role: string }>("GET", "/api/auth/me");
        if (me && me.username === username) {
          // Le passwordHash n'est jamais exposé par l'API → on met une valeur dummy
          // pour que la vérif client passe (en mode web on s'appuie sur /login)
          return { ...me, passwordHash: "" };
        }
        return null;
      } catch {
        return null;
      }
    },
    createFirstUser: async ({
      username,
      passwordHash,
    }: {
      username: string;
      passwordHash: string;
    }): Promise<{ success: boolean; id?: number; error?: string }> => {
      // On délègue au bootstrap. NB: passwordHash en clair n'est PAS le password,
      // c'est déjà hashé côté desktop. Pour la web, on se simplifie : login via
      // la page login normale après bootstrap manuel via curl.
      try {
        const res = await http<{ id: number }>("POST", "/api/auth/bootstrap", {
          username,
          password: passwordHash, // côté desktop c'est déjà du SHA, mais le serveur va le rehasher en scrypt
        });
        return { success: true, id: res.id };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "bootstrap failed" };
      }
    },
  };

  // ─── Settings ──────────────────────────────────────────────────────────
  const settings = {
    getSettings: async (): Promise<Record<string, unknown>> => {
      try {
        return await http<Record<string, unknown>>("GET", "/api/settings");
      } catch {
        return {};
      }
    },
    updateSettings: async (patch: Record<string, unknown>): Promise<Record<string, unknown>> =>
      http<Record<string, unknown>>("PATCH", "/api/settings", patch),
  };

  // ─── Helper : génère un UUID-like pour les ressources qui en attendent ─
  const genId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  };

  // Le code desktop construit ses entités avec id déjà fixé OU laisse le serveur
  // décider. Côté serveur, on a primaryKey="client" donc on EXIGE un id.
  // → on injecte un UUID si le payload n'en a pas.
  const ensureId = (data: unknown): unknown => {
    if (typeof data !== "object" || data === null) return data;
    const obj = data as Record<string, unknown>;
    if (!obj.id) obj.id = genId();
    return obj;
  };

  // ─── Normalisation des champs JSON null retournés par MySQL ─────────────
  // Le code desktop fait `entity.items.map(…)` ou `entity.tags.map(…)` direct.
  // Si la colonne JSON est null en DB, ça crash. On comble avec des valeurs
  // sûres (tableaux ou objets vides) en relisant les rows.
  const arrayDefaults = ["items", "tags", "photos", "lignes"];
  const objectDefaults = ["companySnapshot", "data", "meta"];

  function normalizeRow<T>(row: T): T {
    if (!row || typeof row !== "object") return row;
    const out = { ...(row as Record<string, unknown>) };
    for (const k of arrayDefaults) {
      if (out[k] === null || out[k] === undefined) out[k] = [];
      else if (typeof out[k] === "string") {
        try {
          out[k] = JSON.parse(out[k] as string);
        } catch {
          out[k] = [];
        }
      }
    }
    for (const k of objectDefaults) {
      if (out[k] === null || out[k] === undefined) out[k] = {};
      else if (typeof out[k] === "string") {
        try {
          out[k] = JSON.parse(out[k] as string);
        } catch {
          out[k] = {};
        }
      }
    }
    return out as T;
  }
  function normalizeRows<T>(rows: T[] | T): T[] | T {
    if (Array.isArray(rows)) return rows.map(normalizeRow);
    return normalizeRow(rows);
  }
  // Wrapper pour les GET list/findById
  const httpGet = async <T>(path: string): Promise<T> => {
    const res = await http<T>("GET", path);
    return normalizeRows(res as never) as T;
  };

  // ─── Filtre data isolation (rôle WORKER) ────────────────────────────────
  // Décode le JWT (lecture seule, pas de vérif crypto — c'est juste pour
  // savoir quoi afficher côté UI ; la vérité reste imposée par le serveur).
  function readJwtPayload(): { sub: number; role: string } | null {
    const t = getToken();
    if (!t) return null;
    try {
      const parts = t.split(".");
      if (parts.length < 2) return null;
      // base64url → base64 standard. La taille du payload n'est pas toujours
      // multiple de 4 → atob() levait alors une InvalidCharacterError silencieuse
      // (catch en bas) et le rôle worker n'était jamais appliqué côté UI.
      let b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const json = atob(b64);
      const decoded = JSON.parse(json) as {
        sub?: number;
        role?: string;
        exp?: number;
      };
      // Si le JWT a un `exp` et qu'il est dépassé, on considère le payload
      // comme illisible — l'UI ne doit pas faire confiance à un token expiré
      // (le serveur rejettera de toute façon, mais autant ne pas afficher
      // d'infos basées dessus en attendant).
      if (typeof decoded.exp === "number" && decoded.exp * 1000 < Date.now()) {
        return null;
      }
      if (typeof decoded.sub !== "number" || typeof decoded.role !== "string") {
        return null;
      }
      return { sub: decoded.sub, role: decoded.role };
    } catch {
      return null;
    }
  }

  /** Ajoute ?createdBy=ME au path SI le user connecté a le rôle worker.
   *  Le filtre est whitelisté côté serveur (filterableColumns) sur toutes
   *  les tables data → un worker ne peut voir que ses propres lignes. */
  function withWorkerFilter(path: string): string {
    const u = readJwtPayload();
    if (!u || u.role !== "worker") return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}createdBy=${encodeURIComponent(String(u.sub))}`;
  }

  /** Wrapper "list" — applique automatiquement le filtre worker. */
  const httpGetList = async <T>(path: string): Promise<T> => httpGet(withWorkerFilter(path));

  // Le code desktop attend `{success, id, error}` pour les actions create/update/
  // updateStatus/delete. Notre serveur REST renvoie l'entité directement (200) ou
  // 204 sur delete. On wrappe pour matcher le format desktop.
  const wrapCreate = async <T>(promise: Promise<T>): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      const r = (await promise) as { id?: string };
      return { success: true, id: r?.id };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Erreur" };
    }
  };
  const wrapAction = async (promise: Promise<unknown>): Promise<{ success: boolean; error?: string }> => {
    try {
      await promise;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Erreur" };
    }
  };

  // ─── Clients ───────────────────────────────────────────────────────────
  const clients = {
    clientsList: () => httpGetList("/api/clients").catch(() => []),
    clientsGet: (id: string | number) =>
      httpGet(`/api/clients/${encodeURIComponent(String(id))}`).catch(() => null),
    clientsCreate: (data: unknown) => wrapCreate(http("POST", "/api/clients", ensureId(data))),
    clientsUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/clients/${encodeURIComponent(String(id))}`, data)),
    clientsDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/clients/${encodeURIComponent(String(id))}`)),
    clientsCount: async (): Promise<number> => {
      try {
        const r = await http<{ count: number }>("GET", "/api/clients/count");
        return r.count;
      } catch {
        return 0;
      }
    },
  };

  // ─── Suppliers ─────────────────────────────────────────────────────────
  const suppliers = {
    suppliersList: () => httpGetList("/api/suppliers").catch(() => []),
    suppliersGet: (id: string | number) =>
      httpGet(`/api/suppliers/${encodeURIComponent(String(id))}`).catch(() => null),
    suppliersCreate: (data: unknown) => wrapCreate(http("POST", "/api/suppliers", ensureId(data))),
    suppliersUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/suppliers/${encodeURIComponent(String(id))}`, data)),
    suppliersDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/suppliers/${encodeURIComponent(String(id))}`)),
    suppliersCount: async (): Promise<number> => {
      try {
        const r = await http<{ count: number }>("GET", "/api/suppliers/count");
        return r.count;
      } catch {
        return 0;
      }
    },
  };

  // ─── Company profile (singleton) ───────────────────────────────────────
  const company = {
    companyGet: () => http("GET", "/api/company"),
    companyUpdate: (patch: unknown) => http("PATCH", "/api/company", patch),
    companyUploadLogo: stub("companyUploadLogo", { success: false, error: "Upload logo non disponible en web" }),
    companyDeleteLogo: stub("companyDeleteLogo", { success: true }),
    companyReadLogo: stub("companyReadLogo", null),
  };

  // ─── Chantiers ─────────────────────────────────────────────────────────
  const chantiers = {
    chantiersList: () => httpGetList("/api/chantiers").catch(() => []),
    chantiersGet: (id: string | number) =>
      httpGet(`/api/chantiers/${encodeURIComponent(String(id))}`).catch(() => null),
    chantiersListByClient: async (clientId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/chantiers")) as Array<{ clientId: unknown }>;
        return all.filter((c) => String(c.clientId) === String(clientId));
      } catch {
        return [];
      }
    },
    chantiersCreate: (data: unknown) => wrapCreate(http("POST", "/api/chantiers", ensureId(data))),
    chantiersUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/chantiers/${encodeURIComponent(String(id))}`, data)),
    chantiersUpdateStatus: ({ id, status }: { id: string | number; status: string }) =>
      wrapAction(http("PATCH", `/api/chantiers/${encodeURIComponent(String(id))}`, { status })),
    chantiersDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/chantiers/${encodeURIComponent(String(id))}`)),
    chantiersCount: async (): Promise<number> => {
      try {
        const r = await http<{ count: number }>("GET", "/api/chantiers/count");
        return r.count;
      } catch {
        return 0;
      }
    },
    chantiersCountByStatus: stub("chantiersCountByStatus", {} as Record<string, number>),
    chantiersUploadPhoto: stub("chantiersUploadPhoto", { success: false }),
    chantiersDeletePhoto: stub("chantiersDeletePhoto", { success: false }),
    chantiersReadPhoto: stub("chantiersReadPhoto", null),
  };

  // ─── Quotes (devis) ────────────────────────────────────────────────────
  const quotes = {
    quotesList: () => httpGetList("/api/quotes").catch(() => []),
    quotesGet: (id: string | number) =>
      httpGet(`/api/quotes/${encodeURIComponent(String(id))}`).catch(() => null),
    quotesListByClient: async (clientId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/quotes")) as Array<{ clientId: unknown }>;
        return all.filter((c) => String(c.clientId) === String(clientId));
      } catch {
        return [];
      }
    },
    quotesListByChantier: async (chantierId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/quotes")) as Array<{ chantierId: unknown }>;
        return all.filter((c) => String(c.chantierId) === String(chantierId));
      } catch {
        return [];
      }
    },
    quotesCreate: (data: unknown) => wrapCreate(http("POST", "/api/quotes", ensureId(data))),
    quotesUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/quotes/${encodeURIComponent(String(id))}`, data)),
    quotesUpdateStatus: ({ id, status }: { id: string | number; status: string }) =>
      wrapAction(http("PATCH", `/api/quotes/${encodeURIComponent(String(id))}`, { status })),
    quotesDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/quotes/${encodeURIComponent(String(id))}`)),
    quotesDuplicate: async (id: string | number) => {
      try {
        const original = (await httpGet<Record<string, unknown>>(
          `/api/quotes/${encodeURIComponent(String(id))}`
        )) as Record<string, unknown> | null;
        if (!original) return { success: false, error: "Devis introuvable" };
        const { id: _omit, createdAt, updatedAt, reference, ...rest } = original as {
          id?: string;
          createdAt?: string;
          updatedAt?: string;
          reference?: string;
        };
        return wrapCreate(
          http("POST", "/api/quotes", {
            ...(rest as object),
            id: genId(),
            reference: "",
            status: "brouillon",
            sentAt: "",
            acceptedAt: "",
          })
        );
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
    quotesConvertToPo: stub("quotesConvertToPo", {
      success: false,
      error: "Conversion en bon de commande pas encore disponible en web",
    }),
    quotesCount: async (): Promise<number> => {
      try {
        const r = await http<{ count: number }>("GET", "/api/quotes/count");
        return r.count;
      } catch {
        return 0;
      }
    },
    quotesCountByStatus: stub("quotesCountByStatus", {} as Record<string, number>),
    quotesExportPdfPreview: stub("quotesExportPdfPreview", { success: false, error: "PDF web pas encore implémenté" }),
    quotesExportPdfSaveAs: stub("quotesExportPdfSaveAs", { success: false }),
    quotesOpenPdfExternal: stub("quotesOpenPdfExternal", { success: false }),
    quotesSendViaOutlook: stub("quotesSendViaOutlook", { success: false, error: "Envoi via Outlook : passer par /api/email/send" }),
    quotesGetDesignationHistory: stub("quotesGetDesignationHistory", [] as unknown[]),
  };

  // ─── Invoices ──────────────────────────────────────────────────────────
  const invoices = {
    invoicesList: () => httpGetList("/api/invoices").catch(() => []),
    invoicesGet: (id: string | number) =>
      httpGet(`/api/invoices/${encodeURIComponent(String(id))}`).catch(() => null),
    invoicesListByClient: async (clientId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/invoices")) as Array<{ clientId: unknown }>;
        return all.filter((i) => String(i.clientId) === String(clientId));
      } catch {
        return [];
      }
    },
    invoicesListByChantier: async (chantierId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/invoices")) as Array<{ chantierId: unknown }>;
        return all.filter((i) => String(i.chantierId) === String(chantierId));
      } catch {
        return [];
      }
    },
    invoicesListByQuote: async (quoteId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/invoices")) as Array<{ fromQuoteId: unknown }>;
        return all.filter((i) => String(i.fromQuoteId) === String(quoteId));
      } catch {
        return [];
      }
    },
    invoicesCreate: (data: unknown) => wrapCreate(http("POST", "/api/invoices", ensureId(data))),
    invoicesUpdate: (id: string | number, data: unknown) =>
      wrapAction(http("PATCH", `/api/invoices/${encodeURIComponent(String(id))}`, data)),
    invoicesUpdateStatus: (id: string | number, status: string) =>
      wrapAction(http("PATCH", `/api/invoices/${encodeURIComponent(String(id))}`, { status })),
    invoicesDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/invoices/${encodeURIComponent(String(id))}`)),
    invoicesDuplicate: async (id: string | number) => {
      try {
        const original = (await httpGet<Record<string, unknown>>(
          `/api/invoices/${encodeURIComponent(String(id))}`
        )) as Record<string, unknown>;
        if (!original) return { success: false, error: "Facture introuvable" };
        const { id: _omit, createdAt, updatedAt, reference, ...rest } = original as {
          id?: string;
          createdAt?: string;
          updatedAt?: string;
          reference?: string;
        };
        return wrapCreate(
          http("POST", "/api/invoices", {
            ...(rest as object),
            id: genId(),
            reference: "",
            status: "brouillon",
            sentAt: "",
            paidAt: "",
            totalPaid: 0,
            remindersCount: 0,
            lastReminderSentAt: "",
          })
        );
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
    invoicesCount: async (): Promise<number> => {
      try {
        const r = await http<{ count: number }>("GET", "/api/invoices/count");
        return r.count;
      } catch {
        return 0;
      }
    },
    invoicesCountByStatus: stub("invoicesCountByStatus", {} as Record<string, number>),
    invoicesConvertFromQuote: async (
      arg1: unknown,
      arg2?: unknown
    ): Promise<{ success: boolean; id?: string; invoice?: Record<string, unknown>; error?: string }> => {
      // Le code desktop appelle soit invoicesConvertFromQuote(quoteId, options)
      // soit invoicesConvertFromQuote({ quoteId, options }). On accepte les deux.
      let quoteId: string | number;
      let options: { type?: string; acomptePercent?: number; title?: string } = {};
      if (typeof arg1 === "object" && arg1 !== null && "quoteId" in arg1) {
        const a = arg1 as { quoteId: string | number; options?: typeof options };
        quoteId = a.quoteId;
        options = a.options ?? {};
      } else {
        quoteId = arg1 as string | number;
        options = (arg2 as typeof options) ?? {};
      }

      try {
        const quote = (await httpGet<Record<string, unknown>>(
          `/api/quotes/${encodeURIComponent(String(quoteId))}`
        )) as Record<string, unknown> | null;
        if (!quote) return { success: false, error: "Devis introuvable" };

        const invoiceType = options.type ?? "standard";

        // Normalise items pour qu'ils soient un tableau JSON valide
        let items: unknown[] = [];
        if (Array.isArray(quote.items)) items = quote.items;
        else if (typeof quote.items === "string") {
          try {
            items = JSON.parse(quote.items);
          } catch {
            items = [];
          }
        }

        // Si type=acompte, on remplace les items par UNE seule ligne forfaitaire
        const acomptePercent = Number(options.acomptePercent ?? 0);
        if (invoiceType === "acompte" && acomptePercent > 0) {
          const totalHT = Number(quote.totalHT ?? 0);
          const acompteAmount = (totalHT * acomptePercent) / 100;
          items = [
            {
              id: genId(),
              kind: "single",
              designation: `Acompte de ${acomptePercent}% sur devis ${quote.reference || ""}`,
              unit: "forfait",
              quantity: 1,
              unitPriceHT: acompteAmount,
              vatRate: 20,
              discount: 0,
            },
          ];
        }

        const payload: Record<string, unknown> = {
          id: genId(),
          reference: "",
          status: "brouillon",
          type: invoiceType,
          title: String(options.title || quote.title || ""),
          clientId: String(quote.clientId ?? ""),
          chantierId: String(quote.chantierId ?? ""),
          fromQuoteId: String(quoteId),
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: "",
          paymentTermsDays: 30,
          sentAt: "",
          paidAt: "",
          items,
          globalDiscountMode: quote.globalDiscountMode ?? "none",
          globalDiscountPercent: Number(quote.globalDiscountPercent ?? 0),
          globalDiscountAmount: Number(quote.globalDiscountAmount ?? 0),
          acompteBasedOnQuoteId: invoiceType === "acompte" ? String(quoteId) : "",
          acomptePercent,
          avoirReferenceInvoiceId: "",
          introText: quote.introText ?? "",
          conditionsText: quote.conditionsText ?? "",
          footerText: quote.footerText ?? "",
          internalNotes: "",
          companySnapshot: quote.companySnapshot ?? {},
          totalHT: Number(quote.totalHT ?? 0),
          totalTTC: Number(quote.totalTTC ?? 0),
          totalPaid: 0,
          lastReminderSentAt: "",
          remindersCount: 0,
        };

        // Le code desktop attend `{success, invoice: {id, reference, ...}}`
        try {
          const created = (await http<Record<string, unknown>>("POST", "/api/invoices", payload)) as
            | Record<string, unknown>
            | null;
          return { success: true, invoice: created ?? { id: payload.id }, id: payload.id as string };
        } catch (e) {
          console.error("[shim] invoicesConvertFromQuote POST failed:", e);
          return { success: false, error: e instanceof Error ? e.message : "Erreur" };
        }
      } catch (e) {
        console.error("[shim] invoicesConvertFromQuote exception:", e);
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
    invoicesListPayments: async (invoiceId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>(
          `/api/invoice-payments?invoiceId=${encodeURIComponent(String(invoiceId))}`
        )) as Array<{ invoiceId: unknown }>;
        return all.filter((p) => String(p.invoiceId) === String(invoiceId));
      } catch {
        return [];
      }
    },
    invoicesAddPayment: (payment: unknown) =>
      wrapCreate(http("POST", "/api/invoice-payments", ensureId(payment))),
    invoicesDeletePayment: (paymentId: string | number) =>
      wrapAction(http("DELETE", `/api/invoice-payments/${encodeURIComponent(String(paymentId))}`)),
    invoicesMarkReminderSent: stub("invoicesMarkReminderSent", { success: true }),
    invoicesExportPdfPreview: stub("invoicesExportPdfPreview", { success: false, error: "PDF web pas encore implémenté" }),
    invoicesExportPdfSaveAs: stub("invoicesExportPdfSaveAs", { success: false }),
    invoicesOpenPdfExternal: stub("invoicesOpenPdfExternal", { success: false }),
    invoicesSendViaOutlook: stub("invoicesSendViaOutlook", { success: false, error: "Outlook web pas encore implémenté" }),
  };

  // ─── Backup système (web utilise /api/backup/*) ────────────────────────
  const backup = {
    detectClouds: stub("detectClouds", [] as unknown[]),
    chooseFolder: stub("chooseFolder", { success: false }),
    chooseBackupFile: stub("chooseBackupFile", { success: false }),
    createBackup: async () => {
      try {
        return await http("POST", "/api/backup/run");
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
    listBackups: async () => {
      try {
        const res = await http<{ files: unknown[] }>("GET", "/api/backup/list");
        return res.files;
      } catch {
        return [];
      }
    },
    deleteBackup: (backupPath: string) =>
      http("DELETE", `/api/backup/${encodeURIComponent(backupPath)}`),
    applyRetention: stub("applyRetention", { success: true }),
    inspectBackup: stub("inspectBackup", null),
    restoreBackup: async ({ name }: { name?: string } = {}) => {
      if (!name) return { success: false };
      return http("POST", `/api/backup/restore/${encodeURIComponent(name)}`);
    },
    setOnCloseBackup: stub("setOnCloseBackup", { success: true }),
    getSystemPaths: stub("getSystemPaths", { home: "/web", documents: "/web", downloads: "/web" }),
    getLocalDbHash: stub("getLocalDbHash", null),
  };

  // ─── Helper : ouvre une URL HTML authentifiée dans un nouvel onglet ────
  // Utilisé par les exports PDF — on ne peut pas faire window.open(url)
  // directement parce que le navigateur n'enverrait pas le header
  // Authorization. On fetch le HTML, on en fait un Blob URL, on l'ouvre.
  async function openHtmlForPrint(
    path: string,
    label: string
  ): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
    try {
      const token = getToken();
      const res = await fetch(path, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        return { success: false, error: `Erreur ${res.status} lors du chargement (${label})` };
      }
      // Respecte le content-type : si le serveur renvoie application/pdf
      // (cas des CERFA officiels remplis via pdf-lib), on conserve ce MIME
      // pour que le navigateur affiche le PDF natif au lieu d'un HTML brut.
      const contentType = res.headers.get("content-type") || "text/html";
      const data = contentType.includes("pdf")
        ? await res.arrayBuffer()
        : await res.text();
      const blob = new Blob([data], { type: contentType });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        URL.revokeObjectURL(url);
        return {
          success: false,
          error: "Le navigateur a bloqué l'ouverture du PDF. Autorisez les popups pour ce site.",
        };
      }
      // Libère le blob après 5 min — laisse le temps à l'utilisateur d'imprimer.
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Erreur" };
    }
  }

  // ─── Documents administratifs (PV, TVA, DC4, RGE) ──────────────────────
  // Câblés sur /api/admin-docs/* (côté serveur, MysqlRepository + buildCrudRouter).
  // Le format de retour reste celui attendu par le desktop ({ success, id }) pour
  // ne pas modifier le store administrativeDocsStore.
  const adminReceptionPath = "/api/admin-docs/receptions";
  const adminTvaPath = "/api/admin-docs/tva";
  const adminDc4Path = "/api/admin-docs/dc4";
  const adminDaactPath = "/api/admin-docs/daact";
  const adminRgePath = "/api/admin-docs/rge";

  const adminDocs = {
    // ─── PV de réception ────────────────────────────────────────────────
    adminReceptionList: (filters?: Record<string, unknown>) => {
      const qs = filters
        ? "?" + new URLSearchParams(
            Object.entries(filters)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .map(([k, v]) => [k, String(v)])
          ).toString()
        : "";
      return httpGetList(`${adminReceptionPath}${qs}`).catch(() => []);
    },
    adminReceptionGetById: async (id: string) => {
      // Les réserves sont une sous-ressource séparée côté serveur, mais le
      // contrat desktop renvoie le PV avec un champ `reserves` peuplé.
      // On charge les deux en parallèle et on les fusionne pour que le
      // formulaire React puisse faire r.reserves.map() sans crasher.
      const [report, reserves] = await Promise.all([
        httpGet<Record<string, unknown> | null>(
          `${adminReceptionPath}/${encodeURIComponent(id)}`
        ).catch(() => null),
        httpGet<unknown[]>(
          `${adminReceptionPath}/${encodeURIComponent(id)}/reserves`
        ).catch(() => []),
      ]);
      if (!report) return null;
      return { ...report, reserves: Array.isArray(reserves) ? reserves : [] };
    },
    adminReceptionCreate: async (data: unknown) => {
      // Le formulaire envoie un seul payload avec un champ `reserves`. Côté
      // serveur on a deux routes (PV principal + sous-ressource réserves),
      // donc on splitte ici pour respecter le contrat de l'UI.
      const { reserves, ...payload } = (data ?? {}) as {
        reserves?: unknown[];
        [k: string]: unknown;
      };
      try {
        const created = (await http("POST", adminReceptionPath, ensureId(payload))) as {
          id?: string;
        };
        if (created?.id && Array.isArray(reserves) && reserves.length > 0) {
          await http("PUT", `${adminReceptionPath}/${encodeURIComponent(created.id)}/reserves`, reserves);
        }
        return { success: true, id: created?.id };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
    adminReceptionUpdate: async (id: string, data: unknown) => {
      const { reserves, ...payload } = (data ?? {}) as {
        reserves?: unknown[];
        [k: string]: unknown;
      };
      try {
        await http("PATCH", `${adminReceptionPath}/${encodeURIComponent(id)}`, payload);
        if (Array.isArray(reserves)) {
          await http("PUT", `${adminReceptionPath}/${encodeURIComponent(id)}/reserves`, reserves);
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
    adminReceptionDelete: (id: string) =>
      wrapAction(http("DELETE", `${adminReceptionPath}/${encodeURIComponent(id)}`)),
    adminReceptionGetReserves: (id: string) =>
      httpGet(`${adminReceptionPath}/${encodeURIComponent(id)}/reserves`).catch(() => []),
    adminReceptionSetReserves: (id: string, reserves: unknown[]) =>
      wrapAction(http("PUT", `${adminReceptionPath}/${encodeURIComponent(id)}/reserves`, reserves)),

    // ─── Attestations TVA ───────────────────────────────────────────────
    adminTvaList: (filters?: Record<string, unknown>) => {
      const qs = filters
        ? "?" + new URLSearchParams(
            Object.entries(filters)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .map(([k, v]) => [k, String(v)])
          ).toString()
        : "";
      return httpGetList(`${adminTvaPath}${qs}`).catch(() => []);
    },
    adminTvaGetById: (id: string) =>
      httpGet(`${adminTvaPath}/${encodeURIComponent(id)}`).catch(() => null),
    adminTvaCreate: (data: unknown) =>
      wrapCreate(http("POST", adminTvaPath, ensureId(data))),
    adminTvaUpdate: (id: string, data: unknown) =>
      wrapAction(http("PATCH", `${adminTvaPath}/${encodeURIComponent(id)}`, data)),
    adminTvaDelete: (id: string) =>
      wrapAction(http("DELETE", `${adminTvaPath}/${encodeURIComponent(id)}`)),

    // ─── DC4 ────────────────────────────────────────────────────────────
    adminDc4List: (filters?: Record<string, unknown>) => {
      const qs = filters
        ? "?" + new URLSearchParams(
            Object.entries(filters)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .map(([k, v]) => [k, String(v)])
          ).toString()
        : "";
      return httpGetList(`${adminDc4Path}${qs}`).catch(() => []);
    },
    adminDc4GetById: (id: string) =>
      httpGet(`${adminDc4Path}/${encodeURIComponent(id)}`).catch(() => null),
    adminDc4Create: (data: unknown) =>
      wrapCreate(http("POST", adminDc4Path, ensureId(data))),
    adminDc4Update: (id: string, data: unknown) =>
      wrapAction(http("PATCH", `${adminDc4Path}/${encodeURIComponent(id)}`, data)),
    adminDc4Delete: (id: string) =>
      wrapAction(http("DELETE", `${adminDc4Path}/${encodeURIComponent(id)}`)),

    // ─── DAACT (CERFA 13408*13) ─────────────────────────────────────────
    adminDaactList: (filters?: Record<string, unknown>) => {
      const qs = filters
        ? "?" + new URLSearchParams(
            Object.entries(filters)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .map(([k, v]) => [k, String(v)])
          ).toString()
        : "";
      return httpGetList(`${adminDaactPath}${qs}`).catch(() => []);
    },
    adminDaactGetById: (id: string) =>
      httpGet(`${adminDaactPath}/${encodeURIComponent(id)}`).catch(() => null),
    adminDaactCreate: (data: unknown) =>
      wrapCreate(http("POST", adminDaactPath, ensureId(data))),
    adminDaactUpdate: (id: string, data: unknown) =>
      wrapAction(http("PATCH", `${adminDaactPath}/${encodeURIComponent(id)}`, data)),
    adminDaactDelete: (id: string) =>
      wrapAction(http("DELETE", `${adminDaactPath}/${encodeURIComponent(id)}`)),
    // DAACT : on sert directement le PDF officiel CERFA 13408*13 rempli.
    // C'est le seul format pertinent (la mairie attend le formulaire officiel).
    adminDaactExportPdfPreview: async (id: string) => openHtmlForPrint(
      `/api/admin-docs/daact/${encodeURIComponent(id)}/pdf`,
      "Aperçu DAACT"
    ),
    adminDaactExportPdfSaveAs: async (id: string) => openHtmlForPrint(
      `/api/admin-docs/daact/${encodeURIComponent(id)}/pdf`,
      "Enregistrer DAACT"
    ),

    // ─── RGE / MaPrimeRénov' ────────────────────────────────────────────
    adminRgeList: (filters?: Record<string, unknown>) => {
      const qs = filters
        ? "?" + new URLSearchParams(
            Object.entries(filters)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .map(([k, v]) => [k, String(v)])
          ).toString()
        : "";
      return httpGetList(`${adminRgePath}${qs}`).catch(() => []);
    },
    adminRgeCreate: (data: unknown) =>
      wrapCreate(http("POST", adminRgePath, ensureId(data))),
    adminRgeDelete: (id: string) =>
      wrapAction(http("DELETE", `${adminRgePath}/${encodeURIComponent(id)}`)),

    // ─── Exports PDF via impression navigateur native ────────────────────
    // Le serveur génère le HTML stylé du document, on l'ouvre dans un onglet
    // qui déclenche automatiquement window.print() — l'utilisateur choisit
    // "Enregistrer en PDF" dans le dialogue d'impression natif du navigateur.
    // Gratuit, zéro dépendance, fonctionne sur tous les navigateurs modernes.
    // On utilise un Blob URL plutôt que d'ouvrir l'URL directement parce que
    // window.open() n'envoie pas le header Authorization (et on ne veut pas
    // exposer le JWT en query string).
    adminReceptionExportPdfPreview: async (id: string) => openHtmlForPrint(
      `/api/admin-docs/receptions/${encodeURIComponent(id)}/html?autoprint=1`,
      "Aperçu PV"
    ),
    adminReceptionExportPdfSaveAs: async (id: string) => openHtmlForPrint(
      `/api/admin-docs/receptions/${encodeURIComponent(id)}/html?autoprint=1`,
      "Enregistrer PV"
    ),
    // L'attestation TVA peut être au format HTML (modèle simplifié / CERFA
    // visuel BatiDesk) OU directement le CERFA officiel 1301-SD pré-rempli
    // (PDF AcroForm). On essaye d'abord le PDF officiel ; s'il échoue (l'attestation
    // n'est pas en mode cerfa_officiel_1301sd, le serveur renvoie 200 quand
    // même mais en HTML fallback), on bascule sur l'aperçu HTML.
    // Stratégie simple : ouvrir directement le PDF — le serveur sait quoi servir
    // selon attestationType (route /pdf = CERFA officiel ; /html = autres).
    adminTvaExportPdfPreview: async (id: string) => {
      // Récupère le type pour choisir la bonne route
      const att = await httpGet<{ attestationType?: string } | null>(
        `${adminTvaPath}/${encodeURIComponent(id)}`
      ).catch(() => null);
      const route = att?.attestationType === "cerfa_officiel_1301sd"
        ? `/api/admin-docs/tva/${encodeURIComponent(id)}/pdf`
        : `/api/admin-docs/tva/${encodeURIComponent(id)}/html?autoprint=1`;
      return openHtmlForPrint(route, "Aperçu attestation TVA");
    },
    adminTvaExportPdfSaveAs: async (id: string) => {
      const att = await httpGet<{ attestationType?: string } | null>(
        `${adminTvaPath}/${encodeURIComponent(id)}`
      ).catch(() => null);
      const route = att?.attestationType === "cerfa_officiel_1301sd"
        ? `/api/admin-docs/tva/${encodeURIComponent(id)}/pdf`
        : `/api/admin-docs/tva/${encodeURIComponent(id)}/html?autoprint=1`;
      return openHtmlForPrint(route, "Enregistrer attestation TVA");
    },
    adminDc4ExportPdfPreview: async (id: string) => openHtmlForPrint(
      `/api/admin-docs/dc4/${encodeURIComponent(id)}/html?autoprint=1`,
      "Aperçu DC4"
    ),
    adminDc4ExportPdfSaveAs: async (id: string) => openHtmlForPrint(
      `/api/admin-docs/dc4/${encodeURIComponent(id)}/html?autoprint=1`,
      "Enregistrer DC4"
    ),

    // ─── Stats globales ─────────────────────────────────────────────────
    adminGetStats: () =>
      http("GET", "/api/admin-docs/stats").catch(() => ({
        receptionsTotal: 0,
        receptionsWithReserves: 0,
        tvaAttestationsTotal: 0,
        tvaAttestationsThisYear: 0,
        dc4Total: 0,
        dc4Pending: 0,
        rgeDocumentsTotal: 0,
      })),
  };

  // ─── Microsoft (Outlook via /api/auth/microsoft/* + /api/email/*) ─────
  const microsoft = {
    // Démarre le flow OAuth web : redirige vers Microsoft.
    // ⚠️ Cette fonction NE retourne jamais en cas de succès (la page change).
    //
    // SÉCURITÉ : on échange d'abord le JWT contre un ticket éphémère via
    // POST /start (authentifié par header Authorization), puis on redirige
    // avec ?ticket=... — le JWT ne se retrouve jamais dans une URL, donc
    // pas de fuite via l'historique navigateur, les logs serveur ou le referer.
    msLogin: async (): Promise<{ success: boolean; account?: unknown; error?: string }> => {
      const token = getToken();
      if (!token) return { success: false, error: "Non authentifié" };
      try {
        const { loginUrl } = await http<{ loginUrl: string }>(
          "POST",
          "/api/auth/microsoft/start"
        );
        window.location.href = loginUrl;
        return new Promise(() => {}); // la page se recharge
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur OAuth" };
      }
    },

    msLogout: async (): Promise<{ success: boolean }> => {
      try {
        await http<void>("POST", "/api/auth/microsoft/logout");
        return { success: true };
      } catch {
        return { success: false };
      }
    },

    msGetAccount: async (): Promise<{
      account: { username?: string; mail?: string } | null;
      isLoggedIn: boolean;
    }> => {
      try {
        const res = await http<{
          connected: boolean;
          accountEmail?: string;
        }>("GET", "/api/auth/microsoft/account");
        if (res.connected) {
          return {
            account: { username: res.accountEmail, mail: res.accountEmail },
            isLoggedIn: true,
          };
        }
        return { account: null, isLoggedIn: false };
      } catch {
        return { account: null, isLoggedIn: false };
      }
    },

    msGetQuota: stub("msGetQuota", { used: 0, total: 0 }),

    // OneDrive backups : pas implémenté côté serveur (intentionnel — on a les
    // backups locaux via /api/backup/*). Les méthodes restent stubbées.
    msOneDriveUpload: stub("msOneDriveUpload", { success: false }),
    msOneDriveList: stub("msOneDriveList", [] as unknown[]),
    msOneDriveDelete: stub("msOneDriveDelete", { success: false }),
    msOneDriveApplyRetention: stub("msOneDriveApplyRetention", { success: true }),
    msOneDriveCheckLatest: stub("msOneDriveCheckLatest", { hasNewer: false, latest: null }),
    msOneDriveRestore: stub("msOneDriveRestore", { success: false }),

    // Email via Graph API : route serveur /api/email/send branchée.
    emailPrepareQuoteMail: stub("emailPrepareQuoteMail", {
      success: true,
      data: { to: [], subject: "", body: "" },
    }),
    emailPrepareInvoiceMail: stub("emailPrepareInvoiceMail", {
      success: true,
      data: { to: [], subject: "", body: "" },
    }),
    emailSendDocument: async (args: {
      to: string[] | string;
      cc?: string[] | string;
      subject: string;
      body: string;
      isHtml?: boolean;
      attachmentPath?: string;
      attachmentName?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      try {
        // Normalise to/cc en tableaux
        const toArr = Array.isArray(args.to) ? args.to : [args.to];
        const ccArr = args.cc ? (Array.isArray(args.cc) ? args.cc : [args.cc]) : undefined;
        // L'attachment path vient du desktop (chemin local) — pas exploitable en
        // web. À adapter quand on aura un endpoint d'upload pour pièces jointes.
        await http<void>("POST", "/api/email/send", {
          to: toArr,
          cc: ccArr,
          subject: args.subject,
          body: args.body,
          isHtml: args.isHtml ?? true,
        });
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
  };

  // ─── Expenses (dépenses) ───────────────────────────────────────────────
  const expensesAPI = {
    accountingListExpenses: () => httpGetList("/api/expenses").catch(() => []),
    accountingGetExpenseById: (id: string | number) =>
      httpGet(`/api/expenses/${encodeURIComponent(String(id))}`).catch(() => null),
    accountingCreateExpense: (data: unknown) =>
      wrapCreate(http("POST", "/api/expenses", ensureId(data))),
    accountingUpdateExpense: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/expenses/${encodeURIComponent(String(id))}`, data)),
    accountingDeleteExpense: (id: string | number) =>
      wrapAction(http("DELETE", `/api/expenses/${encodeURIComponent(String(id))}`)),
    accountingMarkExpensePaid: ({
      id,
      paidDate,
      paymentMethod,
    }: {
      id: string | number;
      paidDate?: string;
      paymentMethod?: string;
    }) =>
      wrapAction(
        http("PATCH", `/api/expenses/${encodeURIComponent(String(id))}`, {
          status: "payee",
          isPaid: 1,
          paidDate,
          paymentMethod,
        })
      ),
  };

  // ─── Comptabilité partie double (Session 30) ─────────────────────────
  const buildQueryString = (filters: Record<string, unknown> | undefined): string => {
    if (!filters) return "";
    const parts: string[] = [];
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null || v === "") continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? "?" + parts.join("&") : "";
  };

  const EMPTY_GRAND_LIVRE = {
    compteNum: "",
    lines: [],
    totals: { debit: 0, credit: 0, solde: 0 },
  };
  const EMPTY_INCOME = {
    charges: [],
    produits: [],
    totalCharges: 0,
    totalProduits: 0,
    resultat: 0,
  };
  const EMPTY_BALANCE_SHEET = {
    actif: [],
    passif: [],
    totalActif: 0,
    totalPassif: 0,
    resultat: 0,
  };
  const EMPTY_REGEN = {
    success: false,
    invoices: 0,
    expenses: 0,
    invoicePayments: 0,
    expensePayments: 0,
    errors: [],
  };

  const accountingPartieDouble = {
    accountingGetSettings: () =>
      httpGet("/api/accounting/settings").catch(() => null),
    accountingUpdateSettings: (patch: unknown) =>
      wrapAction(http("PATCH", "/api/accounting/settings", patch)),

    accountingListAccounts: (filters?: Record<string, unknown>) =>
      httpGetList(`/api/accounting/accounts${buildQueryString(filters)}`).catch(
        () => [] as unknown[]
      ),
    accountingGetAccount: (numero: string) =>
      httpGet(`/api/accounting/accounts/${encodeURIComponent(numero)}`).catch(() => null),
    accountingCreateAccount: (data: unknown) =>
      wrapCreate(http("POST", "/api/accounting/accounts", data)),
    accountingUpdateAccount: ({ numero, data }: { numero: string; data: unknown }) =>
      wrapAction(http("PATCH", `/api/accounting/accounts/${encodeURIComponent(numero)}`, data)),
    accountingDeleteAccount: (numero: string) =>
      wrapAction(http("DELETE", `/api/accounting/accounts/${encodeURIComponent(numero)}`)),

    accountingListJournals: () =>
      httpGetList("/api/accounting/journals").catch(() => [] as unknown[]),

    accountingListEntries: (filters?: Record<string, unknown>) =>
      httpGetList(`/api/accounting/entries${buildQueryString(filters)}`).catch(
        () => [] as unknown[]
      ),
    accountingGetEntry: (entryId: string) =>
      httpGet(`/api/accounting/entries/${encodeURIComponent(entryId)}`).catch(() => null),
    accountingCreateManualEntry: (data: unknown) =>
      wrapCreate(http("POST", "/api/accounting/entries", data)).then(
        (r) => r as { success: boolean; id?: string; numero?: number; error?: string }
      ),
    accountingDeleteEntry: (entryId: string) =>
      wrapAction(http("DELETE", `/api/accounting/entries/${encodeURIComponent(entryId)}`)),

    accountingRegenerateAllEntries: () =>
      http("POST", "/api/accounting/regenerate")
        .then((r) => r as typeof EMPTY_REGEN)
        .catch(() => EMPTY_REGEN),

    accountingAutoLettrer: (compteAuxNum?: string) =>
      wrapAction(http("POST", "/api/accounting/lettrer", { compteAuxNum })),
    accountingSetLettrage: ({ lineIds, code }: { lineIds: string[]; code: string }) =>
      wrapAction(http("POST", "/api/accounting/set-lettrage", { lineIds, code })),

    accountingGetGrandLivre: ({
      compteNum,
      year,
      dateFrom,
      dateTo,
    }: {
      compteNum: string;
      year?: number;
      dateFrom?: string;
      dateTo?: string;
    }) =>
      httpGet(
        `/api/accounting/grand-livre/${encodeURIComponent(compteNum)}${buildQueryString({ year, dateFrom, dateTo })}`
      ).catch(() => ({ ...EMPTY_GRAND_LIVRE, compteNum })),

    accountingGetBalance: (params?: Record<string, unknown>) =>
      httpGetList(`/api/accounting/balance${buildQueryString(params)}`).catch(
        () => [] as unknown[]
      ),
    accountingGetIncomeStatement: (params?: Record<string, unknown>) =>
      httpGet(`/api/accounting/income-statement${buildQueryString(params)}`).catch(
        () => EMPTY_INCOME
      ),
    accountingGetBalanceSheet: (params?: Record<string, unknown>) =>
      httpGet(`/api/accounting/balance-sheet${buildQueryString(params)}`).catch(
        () => EMPTY_BALANCE_SHEET
      ),

    accountingEnsureClientAccount: (clientId: string) =>
      http("POST", `/api/accounting/ensure-client-account/${encodeURIComponent(clientId)}`)
        .then((r) => r as { success: boolean; numero?: string; error?: string })
        .catch((e) => ({ success: false, error: e instanceof Error ? e.message : "Erreur" })),
    accountingEnsureSupplierAccount: (supplierId: string) =>
      http(
        "POST",
        `/api/accounting/ensure-supplier-account/${encodeURIComponent(supplierId)}`
      )
        .then((r) => r as { success: boolean; numero?: string; error?: string })
        .catch((e) => ({ success: false, error: e instanceof Error ? e.message : "Erreur" })),
  };

  // ─── Expense notes (notes de frais) ────────────────────────────────────
  const expenseNotesAPI = {
    expenseNotesList: () => httpGetList("/api/expense-notes").catch(() => []),
    expenseNotesGetById: (id: string | number) =>
      httpGet(`/api/expense-notes/${encodeURIComponent(String(id))}`).catch(() => null),
    expenseNotesCreate: (data: unknown) =>
      wrapCreate(http("POST", "/api/expense-notes", ensureId(data))),
    expenseNotesUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/expense-notes/${encodeURIComponent(String(id))}`, data)),
    expenseNotesDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/expense-notes/${encodeURIComponent(String(id))}`)),
    expenseNotesValidate: (id: string | number) =>
      wrapAction(
        http("PATCH", `/api/expense-notes/${encodeURIComponent(String(id))}`, {
          isValidated: 1,
          validatedAt: new Date().toISOString(),
        })
      ),
    expenseNotesMarkReimbursed: ({ id, date }: { id: string | number; date?: string }) =>
      wrapAction(
        http("PATCH", `/api/expense-notes/${encodeURIComponent(String(id))}`, {
          isReimbursed: 1,
          reimbursedDate: date,
        })
      ),
    expenseNotesListByChantier: async (chantierId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/expense-notes")) as Array<{ chantierId: unknown }>;
        return all.filter((c) => String(c.chantierId) === String(chantierId));
      } catch {
        return [];
      }
    },
  };

  // ─── Subcontractors (sous-traitants) ───────────────────────────────────
  const subcontractorsAPI = {
    subcontractorsList: () => httpGetList("/api/subcontractors").catch(() => []),
    subcontractorsGetById: (id: string | number) =>
      httpGet(`/api/subcontractors/${encodeURIComponent(String(id))}`).catch(() => null),
    subcontractorsCreate: (data: unknown) =>
      wrapCreate(http("POST", "/api/subcontractors", ensureId(data))),
    subcontractorsUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/subcontractors/${encodeURIComponent(String(id))}`, data)),
    subcontractorsDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/subcontractors/${encodeURIComponent(String(id))}`)),
  };

  // ─── Agenda events ─────────────────────────────────────────────────────
  const agendaAPI = {
    agendaList: () => httpGetList("/api/agenda-events").catch(() => []),
    agendaGetById: (id: string | number) =>
      httpGet(`/api/agenda-events/${encodeURIComponent(String(id))}`).catch(() => null),
    agendaCreate: (data: unknown) =>
      wrapCreate(http("POST", "/api/agenda-events", ensureId(data))),
    agendaUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      wrapAction(http("PATCH", `/api/agenda-events/${encodeURIComponent(String(id))}`, data)),
    agendaDelete: (id: string | number) =>
      wrapAction(http("DELETE", `/api/agenda-events/${encodeURIComponent(String(id))}`)),
    agendaListToday: async () => {
      try {
        const all = (await httpGet<Array<{ startDate: string }>>("/api/agenda-events")) ?? [];
        const today = new Date().toISOString().slice(0, 10);
        return all.filter((e) => e.startDate?.slice(0, 10) === today);
      } catch {
        return [];
      }
    },
    agendaListUpcoming: async (days: number = 7) => {
      try {
        const all = (await httpGet<Array<{ startDate: string }>>("/api/agenda-events")) ?? [];
        const now = Date.now();
        const limit = now + days * 24 * 3600 * 1000;
        return all.filter((e) => {
          const t = new Date(e.startDate).getTime();
          return t >= now && t <= limit;
        });
      } catch {
        return [];
      }
    },
    agendaListByClient: async (clientId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/agenda-events")) as Array<{ clientId: unknown }>;
        return all.filter((c) => String(c.clientId) === String(clientId));
      } catch {
        return [];
      }
    },
    agendaListByChantier: async (chantierId: string | number) => {
      try {
        const all = (await httpGet<unknown[]>("/api/agenda-events")) as Array<{ chantierId: unknown }>;
        return all.filter((c) => String(c.chantierId) === String(chantierId));
      } catch {
        return [];
      }
    },
  };

  // ─── Vault : câblage REST ──────────────────────────────────────────────
  const vaultAPI = {
    vaultListFolders: () => httpGet("/api/vault/folders").catch(() => []),
    vaultCreateFolder: async (data: unknown) => {
      try {
        const r = (await http<{ id?: string }>("POST", "/api/vault/folders", data)) as { id?: string };
        return { success: true, id: r?.id };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },
    vaultUpdateFolder: ({ id, data }: { id: string; data: unknown }) =>
      wrapAction(http("PATCH", `/api/vault/folders/${encodeURIComponent(id)}`, data)),
    vaultDeleteFolder: (id: string) =>
      wrapAction(http("DELETE", `/api/vault/folders/${encodeURIComponent(id)}`)),

    vaultListDocuments: async (params?: {
      folderId?: string;
      chantierId?: string;
      quoteId?: string;
      invoiceId?: string;
    }) => {
      const sp = new URLSearchParams();
      if (params?.folderId) sp.set("folderId", params.folderId);
      if (params?.chantierId) sp.set("chantierId", params.chantierId);
      if (params?.quoteId) sp.set("quoteId", params.quoteId);
      if (params?.invoiceId) sp.set("invoiceId", params.invoiceId);
      const q = sp.toString();
      try {
        return await httpGet(`/api/vault/documents${q ? "?" + q : ""}`);
      } catch {
        return [];
      }
    },
    vaultListTrash: () => httpGet("/api/vault/trash").catch(() => []),

    /** Upload web : prend un objet { folderId, file: Blob, fileName, ... } */
    vaultUploadDocument: async (params: {
      folderId?: string;
      file?: Blob | ArrayBuffer | Uint8Array;
      fileName?: string;
      mimeType?: string;
      description?: string;
      category?: string;
      chantierId?: string;
      clientId?: string;
      quoteId?: string;
      invoiceId?: string;
      // Compat desktop : sourcePath (ignoré en web)
      sourcePath?: string;
    }) => {
      try {
        if (!params.file) {
          // Mode desktop legacy non supporté en web
          return { success: false, error: "Upload via dialog non disponible en web. Sélectionne un fichier directement." };
        }
        const sp = new URLSearchParams();
        sp.set("fileName", params.fileName ?? "document");
        if (params.folderId) sp.set("folderId", params.folderId);
        if (params.mimeType) sp.set("mimeType", params.mimeType);
        if (params.description) sp.set("description", params.description);
        if (params.category) sp.set("category", params.category);
        if (params.chantierId) sp.set("chantierId", params.chantierId);
        if (params.clientId) sp.set("clientId", params.clientId);
        if (params.quoteId) sp.set("quoteId", params.quoteId);
        if (params.invoiceId) sp.set("invoiceId", params.invoiceId);
        const token = getToken();
        const res = await fetch(`/api/vault/upload?${sp.toString()}`, {
          method: "POST",
          headers: {
            "Content-Type": params.mimeType ?? "application/octet-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: params.file as BodyInit,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
        }
        const json = (await res.json()) as { id?: string };
        return { success: true, id: json?.id };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },

    vaultUpdateDocument: ({ id, data }: { id: string; data: unknown }) =>
      wrapAction(http("PATCH", `/api/vault/documents/${encodeURIComponent(id)}`, data)),
    vaultTrashDocument: (id: string) =>
      wrapAction(http("POST", `/api/vault/documents/${encodeURIComponent(id)}/trash`)),
    vaultRestoreDocument: (id: string) =>
      wrapAction(http("POST", `/api/vault/documents/${encodeURIComponent(id)}/restore`)),
    vaultDeleteDocumentForever: (id: string) =>
      wrapAction(http("DELETE", `/api/vault/documents/${encodeURIComponent(id)}`)),

    /** Téléchargement : ouvre un nouvel onglet vers la route download
     *  (le serveur gère l'auth via Bearer; on passe par fetch + blob). */
    vaultDownloadDocument: async (id: string) => {
      try {
        const token = getToken();
        const res = await fetch(`/api/vault/documents/${encodeURIComponent(id)}/download`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
        const blob = await res.blob();
        const cd = res.headers.get("Content-Disposition") ?? "";
        const m = /filename="?([^"]+)"?/.exec(cd);
        const fileName = m?.[1] ?? "document";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = decodeURIComponent(fileName);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Erreur" };
      }
    },

    vaultGetStats: () =>
      httpGet("/api/vault/stats").catch(() => ({
        totalDocuments: 0,
        totalFolders: 0,
        totalSize: 0,
        trashCount: 0,
        expiringIn30Days: 0,
      })),
  };

  // ─── Toutes les autres méthodes du preload (vault, etc.) ──────────────
  // On les expose comme stubs doux pour ne pas crasher l'app.
  const allOtherStubs = createStubsFor([
    // Account
    "updateUsername",
    "updatePassword",
    // PDF Lab
    "pdfGeneratePreview",
    // Company logo (le get/update vrais sont au-dessus)
    "companyUploadLogo",
    "companyDeleteLogo",
    "companyReadLogo",
    // Chantier events / docs / signatures
    "chantierEventsList",
    "chantierEventsAddNote",
    "chantierEventsUpdateNote",
    "chantierEventsDelete",
    "chantierDocsList",
    "chantierDocsAdd",
    "chantierDocsUploadViaDialog",
    "chantierDocsDelete",
    "chantierDocsOpenExternal",
    "chantierDocsShowInFolder",
    "chantierDocCategoriesList",
    "chantierDocCategoriesCreate",
    "chantierDocCategoriesUpdate",
    "chantierDocCategoriesDelete",
    "chantierDocCategoriesReorder",
    "chantierCategoriesList",
    "chantierCategoriesCreate",
    "chantierCategoriesUpdate",
    "chantierCategoriesDelete",
    "chantierCategoriesReorder",
    "chantierSignaturesList",
    "chantierSignaturesCreate",
    "chantierSignaturesDelete",
    // Library
    "libraryList",
    "libraryCreate",
    "libraryUpdate",
    "libraryDelete",
    "libraryIncrementUsage",
    // Vault — câblés via vaultAPI ci-dessous, pas de stub ici
    // Restent stubés : tags + search + pickFiles + ensureFolder (UI Electron-only)
    "vaultListTags",
    "vaultCreateTag",
    "vaultUpdateTag",
    "vaultDeleteTag",
    "vaultSetDocumentTags",
    "vaultSearch",
    "vaultEnsureClientFolder",
    "vaultEnsureChantierFolder",
    "vaultPickFiles",
    "vaultGetDocumentPreviewPath",
    "vaultOpenDocumentExternal",
    // Agenda : sync Outlook + stats uniquement (CRUD/list câblés au-dessus)
    "agendaSyncAllToOutlook",
    "agendaSyncOne",
    "agendaGetStats",
    "agendaEnsureChantierEvent",
    "agendaEnsureSignatureEvent",
    // Accounting (les CRUD expenses sont câblés au-dessus, ces stubs sont les stats)
    "accountingGetFinanceStats",
    "accountingGetMonthlyEvolution",
    "accountingGetTopClients",
    "accountingGetTopSuppliers",
    "accountingGetChantierMargins",
    "accountingExportFEC",
    // Expense notes : stats & export uniquement (CRUD câblé au-dessus)
    "expenseNotesGetStats",
    "expenseNotesExportMonth",
    // Subcontractors : stats uniquement (CRUD câblé au-dessus)
    "subcontractorsGetStats",
    "subcontractorsListAttestations",
    "subcontractorsCreateAttestation",
    "subcontractorsUpdateAttestation",
    "subcontractorsDeleteAttestation",
    "subcontractorsListExpiringAttestations",
    "poList",
    "poGetById",
    "poCreate",
    "poUpdate",
    "poDelete",
    "poReleaseRetention",
    "poGetStats",
    "situationsList",
    "situationsGetById",
    "situationsCreate",
    "situationsUpdate",
    "situationsDelete",
    "situationsMarkPaid",
    "situationsGetPreviousCumulPcts",
    // Stats
    "statsGetQuotePipeline",
    "statsGetPaymentDelays",
    "statsGetClientPaymentDelays",
    "statsGetOverdueInvoices",
    "statsGetYoYComparison",
    "statsGetSeasonality",
    // Admin docs — CRUD est câblé via `adminDocs` (HTTP réel). Exports PDF
    // explicitement implémentés plus bas (pas dans les stubs) pour renvoyer
    // un message clair "indisponible en web" plutôt que {} silencieux.
    "adminOpenPdfExternal",
    // Misc
    "getDbInitError",
    "dbGetStats",
  ]);

  // Assemblage final
  (window as unknown as { btpAPI: unknown }).btpAPI = {
    ...auth,
    ...settings,
    ...company,
    ...clients,
    ...suppliers,
    ...chantiers,
    ...quotes,
    ...invoices,
    ...expensesAPI,
    ...accountingPartieDouble,
    ...expenseNotesAPI,
    ...subcontractorsAPI,
    ...agendaAPI,
    ...vaultAPI,
    ...backup,
    ...microsoft,
    ...adminDocs,
    ...allOtherStubs,
    platform: "web" as const,
    isElectron: false as const,
    isWeb: true as const,
  };

  console.log("[btpAPI-shim] installed for web mode");
}

// Méthodes stub qui renvoient un TABLEAU (le code desktop fait .map/.filter
// dessus). L'heuristique par nom ne suffit pas pour celles-ci : on les liste
// explicitement pour éviter les crashs "x.map is not a function".
const ARRAY_RETURNING_STUBS = new Set<string>([
  "accountingGetMonthlyEvolution",
  "accountingGetTopClients",
  "accountingGetTopSuppliers",
  "accountingGetChantierMargins",
  "statsGetClientPaymentDelays",
  "statsGetOverdueInvoices",
]);

function createStubsFor(names: readonly string[]): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const name of names) {
    // Heuristique pour deviner le format de retour attendu par le code desktop :
    //  - nom contient List/Search/All / dans ARRAY_RETURNING_STUBS → tableau vide
    //  - nom contient Count           → 0
    //  - nom contient Stats/Pipeline/Delays/Comparison/Seasonality → objet "vide" cohérent
    //  - autre (action) → { success: false, error: "non disponible en web" }
    const lower = name.toLowerCase();
    // Par défaut : objet vide {} — sûr car {}.anything === undefined (pas de TypeError)
    let fallback: unknown = {};
    if (/list|search|history|expir/i.test(lower) || ARRAY_RETURNING_STUBS.has(name)) {
      fallback = [];
    } else if (/count|hash/.test(lower)) {
      fallback = 0;
    }
    out[name] = stub(name, fallback);
  }
  return out;
}
