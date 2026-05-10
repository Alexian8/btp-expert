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

async function http<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
  ): Promise<{ id: number; username: string; role: string; passwordHash: string } | null> => {
    try {
      const res = await http<{ id: number; username: string; role: string; token: string }>(
        "POST",
        "/api/auth/login",
        { username, password }
      );
      if (res.token) setToken(res.token);
      return {
        id: res.id,
        username: res.username,
        role: res.role,
        passwordHash: "WEB_AUTH_OK", // sentinel : ElectronDataService va sauter la vérif locale
      };
    } catch {
      return null;
    }
  };

  // Auth & users
  const auth = {
    webLogin, // exposé pour usage par dataService desktop en mode web
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
    clientsList: () => httpGet("/api/clients").catch(() => []),
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
    suppliersList: () => httpGet("/api/suppliers").catch(() => []),
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
    chantiersList: () => httpGet("/api/chantiers").catch(() => []),
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
    quotesList: () => httpGet("/api/quotes").catch(() => []),
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
    invoicesList: () => httpGet("/api/invoices").catch(() => []),
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
      quoteId: string | number,
      options?: { type?: string; acomptePercent?: number; title?: string }
    ): Promise<{ success: boolean; id?: string; error?: string }> => {
      try {
        const quote = (await httpGet<Record<string, unknown>>(
          `/api/quotes/${encodeURIComponent(String(quoteId))}`
        )) as Record<string, unknown> | null;
        if (!quote) return { success: false, error: "Devis introuvable" };

        const opts = options ?? {};
        const invoiceType = opts.type ?? "standard";
        const newId = genId();

        const payload: Record<string, unknown> = {
          id: newId,
          reference: "",
          status: "brouillon",
          type: invoiceType,
          title: opts.title || quote.title || "",
          clientId: quote.clientId ?? "",
          chantierId: quote.chantierId ?? "",
          fromQuoteId: String(quoteId),
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: "",
          paymentTermsDays: 30,
          items: quote.items ?? [],
          globalDiscountMode: quote.globalDiscountMode ?? "none",
          globalDiscountPercent: quote.globalDiscountPercent ?? 0,
          globalDiscountAmount: quote.globalDiscountAmount ?? 0,
          acompteBasedOnQuoteId: invoiceType === "acompte" ? String(quoteId) : "",
          acomptePercent: opts.acomptePercent ?? 0,
          introText: quote.introText ?? "",
          conditionsText: quote.conditionsText ?? "",
          footerText: quote.footerText ?? "",
          internalNotes: "",
          companySnapshot: quote.companySnapshot ?? {},
          totalHT: quote.totalHT ?? 0,
          totalTTC: quote.totalTTC ?? 0,
          totalPaid: 0,
        };
        return wrapCreate(http("POST", "/api/invoices", payload));
      } catch (e) {
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

  // ─── Microsoft (Outlook via /api/auth/microsoft/* + /api/email/*) ─────
  const microsoft = {
    // Démarre le flow OAuth web : redirige vers Microsoft.
    // ⚠️ Cette fonction NE retourne jamais (la page change).
    msLogin: async (): Promise<{ success: boolean; account?: unknown }> => {
      const token = getToken();
      if (!token) {
        return { success: false } as { success: boolean; error?: string; account?: unknown } & {
          error: string;
        };
      }
      window.location.href = `/api/auth/microsoft/login?token=${encodeURIComponent(token)}`;
      // Promise qui ne se résout pas — la page va se recharger
      return new Promise(() => {});
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
    accountingListExpenses: () => httpGet("/api/expenses").catch(() => []),
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
          isPaid: 1,
          paidDate,
          paymentMethod,
        })
      ),
  };

  // ─── Expense notes (notes de frais) ────────────────────────────────────
  const expenseNotesAPI = {
    expenseNotesList: () => httpGet("/api/expense-notes").catch(() => []),
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
    subcontractorsList: () => httpGet("/api/subcontractors").catch(() => []),
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
    agendaList: () => httpGet("/api/agenda-events").catch(() => []),
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
    // Vault
    "vaultListFolders",
    "vaultCreateFolder",
    "vaultUpdateFolder",
    "vaultDeleteFolder",
    "vaultListDocuments",
    "vaultListTrash",
    "vaultUploadDocument",
    "vaultUpdateDocument",
    "vaultTrashDocument",
    "vaultRestoreDocument",
    "vaultDeleteDocumentForever",
    "vaultGetDocumentPreviewPath",
    "vaultDownloadDocument",
    "vaultOpenDocumentExternal",
    "vaultListTags",
    "vaultCreateTag",
    "vaultUpdateTag",
    "vaultDeleteTag",
    "vaultSetDocumentTags",
    "vaultSearch",
    "vaultGetStats",
    "vaultEnsureClientFolder",
    "vaultEnsureChantierFolder",
    "vaultPickFiles",
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
    // Admin docs
    "adminReceptionList",
    "adminReceptionGetById",
    "adminReceptionCreate",
    "adminReceptionUpdate",
    "adminReceptionDelete",
    "adminTvaList",
    "adminTvaGetById",
    "adminTvaCreate",
    "adminTvaUpdate",
    "adminTvaDelete",
    "adminDc4List",
    "adminDc4GetById",
    "adminDc4Create",
    "adminDc4Update",
    "adminDc4Delete",
    "adminRgeList",
    "adminRgeCreate",
    "adminRgeDelete",
    "adminGetStats",
    "adminReceptionExportPdfPreview",
    "adminReceptionExportPdfSaveAs",
    "adminTvaExportPdfPreview",
    "adminTvaExportPdfSaveAs",
    "adminDc4ExportPdfPreview",
    "adminDc4ExportPdfSaveAs",
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
    ...expenseNotesAPI,
    ...subcontractorsAPI,
    ...agendaAPI,
    ...backup,
    ...microsoft,
    ...allOtherStubs,
    platform: "web" as const,
    isElectron: false as const,
    isWeb: true as const,
  };

  console.log("[btpAPI-shim] installed for web mode");
}

function createStubsFor(names: readonly string[]): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const name of names) {
    // Heuristique pour deviner le format de retour attendu par le code desktop :
    //  - nom contient List/Search/All  → tableau vide
    //  - nom contient Count           → 0
    //  - nom contient Stats/Pipeline/Delays/Comparison/Seasonality → objet "vide" cohérent
    //  - autre (action) → { success: false, error: "non disponible en web" }
    const lower = name.toLowerCase();
    // Par défaut : objet vide {} — sûr car {}.anything === undefined (pas de TypeError)
    let fallback: unknown = {};
    if (/list|search|history|expir/i.test(lower)) fallback = [];
    else if (/count|hash/.test(lower)) fallback = 0;
    out[name] = stub(name, fallback);
  }
  return out;
}
