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

  // ─── Clients ───────────────────────────────────────────────────────────
  const clients = {
    clientsList: () => http("GET", "/api/clients"),
    clientsGet: (id: string | number) => http("GET", `/api/clients/${encodeURIComponent(String(id))}`),
    clientsCreate: (data: unknown) => http("POST", "/api/clients", ensureId(data)),
    clientsUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      http("PATCH", `/api/clients/${encodeURIComponent(String(id))}`, data),
    clientsDelete: (id: string | number) =>
      http("DELETE", `/api/clients/${encodeURIComponent(String(id))}`),
    clientsCount: async (): Promise<number> => {
      const r = await http<{ count: number }>("GET", "/api/clients/count");
      return r.count;
    },
  };

  // ─── Suppliers ─────────────────────────────────────────────────────────
  const suppliers = {
    suppliersList: () => http("GET", "/api/suppliers"),
    suppliersGet: (id: string | number) =>
      http("GET", `/api/suppliers/${encodeURIComponent(String(id))}`),
    suppliersCreate: (data: unknown) => http("POST", "/api/suppliers", ensureId(data)),
    suppliersUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      http("PATCH", `/api/suppliers/${encodeURIComponent(String(id))}`, data),
    suppliersDelete: (id: string | number) =>
      http("DELETE", `/api/suppliers/${encodeURIComponent(String(id))}`),
    suppliersCount: async (): Promise<number> => {
      const r = await http<{ count: number }>("GET", "/api/suppliers/count");
      return r.count;
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
    chantiersList: () => http("GET", "/api/chantiers"),
    chantiersGet: (id: string | number) =>
      http("GET", `/api/chantiers/${encodeURIComponent(String(id))}`),
    chantiersListByClient: async (clientId: string | number) => {
      const all = (await http<unknown[]>("GET", "/api/chantiers")) as Array<{ clientId: unknown }>;
      return all.filter((c) => String(c.clientId) === String(clientId));
    },
    chantiersCreate: (data: unknown) => http("POST", "/api/chantiers", ensureId(data)),
    chantiersUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      http("PATCH", `/api/chantiers/${encodeURIComponent(String(id))}`, data),
    chantiersUpdateStatus: ({ id, status }: { id: string | number; status: string }) =>
      http("PATCH", `/api/chantiers/${encodeURIComponent(String(id))}`, { status }),
    chantiersDelete: (id: string | number) =>
      http("DELETE", `/api/chantiers/${encodeURIComponent(String(id))}`),
    chantiersCount: async (): Promise<number> => {
      const r = await http<{ count: number }>("GET", "/api/chantiers/count");
      return r.count;
    },
    chantiersCountByStatus: stub("chantiersCountByStatus", {} as Record<string, number>),
    chantiersUploadPhoto: stub("chantiersUploadPhoto", { success: false }),
    chantiersDeletePhoto: stub("chantiersDeletePhoto", { success: false }),
    chantiersReadPhoto: stub("chantiersReadPhoto", null),
  };

  // ─── Quotes (devis) ────────────────────────────────────────────────────
  const quotes = {
    quotesList: () => http("GET", "/api/quotes"),
    quotesGet: (id: string | number) => http("GET", `/api/quotes/${encodeURIComponent(String(id))}`),
    quotesListByClient: async (clientId: string | number) => {
      const all = (await http<unknown[]>("GET", "/api/quotes")) as Array<{ clientId: unknown }>;
      return all.filter((c) => String(c.clientId) === String(clientId));
    },
    quotesListByChantier: async (chantierId: string | number) => {
      const all = (await http<unknown[]>("GET", "/api/quotes")) as Array<{ chantierId: unknown }>;
      return all.filter((c) => String(c.chantierId) === String(chantierId));
    },
    quotesCreate: (data: unknown) => http("POST", "/api/quotes", ensureId(data)),
    quotesUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      http("PATCH", `/api/quotes/${encodeURIComponent(String(id))}`, data),
    quotesUpdateStatus: ({ id, status }: { id: string | number; status: string }) =>
      http("PATCH", `/api/quotes/${encodeURIComponent(String(id))}`, { status }),
    quotesDelete: (id: string | number) =>
      http("DELETE", `/api/quotes/${encodeURIComponent(String(id))}`),
    quotesDuplicate: stub("quotesDuplicate", null),
    quotesConvertToPo: stub("quotesConvertToPo", null),
    quotesCount: async (): Promise<number> => {
      const r = await http<{ count: number }>("GET", "/api/quotes/count");
      return r.count;
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
    invoicesList: () => http("GET", "/api/invoices"),
    invoicesGet: (id: string | number) =>
      http("GET", `/api/invoices/${encodeURIComponent(String(id))}`),
    invoicesListByClient: async (clientId: string | number) => {
      const all = (await http<unknown[]>("GET", "/api/invoices")) as Array<{ clientId: unknown }>;
      return all.filter((i) => String(i.clientId) === String(clientId));
    },
    invoicesListByChantier: async (chantierId: string | number) => {
      const all = (await http<unknown[]>("GET", "/api/invoices")) as Array<{ chantierId: unknown }>;
      return all.filter((i) => String(i.chantierId) === String(chantierId));
    },
    invoicesListByQuote: async (quoteId: string | number) => {
      const all = (await http<unknown[]>("GET", "/api/invoices")) as Array<{ fromQuoteId: unknown }>;
      return all.filter((i) => String(i.fromQuoteId) === String(quoteId));
    },
    invoicesCreate: (data: unknown) => http("POST", "/api/invoices", ensureId(data)),
    invoicesUpdate: (id: string | number, data: unknown) =>
      http("PATCH", `/api/invoices/${encodeURIComponent(String(id))}`, data),
    invoicesUpdateStatus: (id: string | number, status: string) =>
      http("PATCH", `/api/invoices/${encodeURIComponent(String(id))}`, { status }),
    invoicesDelete: (id: string | number) =>
      http("DELETE", `/api/invoices/${encodeURIComponent(String(id))}`),
    invoicesDuplicate: stub("invoicesDuplicate", null),
    invoicesCount: async (): Promise<number> => {
      const r = await http<{ count: number }>("GET", "/api/invoices/count");
      return r.count;
    },
    invoicesCountByStatus: stub("invoicesCountByStatus", {} as Record<string, number>),
    invoicesConvertFromQuote: stub("invoicesConvertFromQuote", null),
    invoicesListPayments: async (invoiceId: string | number) => {
      const all = (await http<unknown[]>(
        "GET",
        `/api/invoice-payments?invoiceId=${encodeURIComponent(String(invoiceId))}`
      )) as Array<{ invoiceId: unknown }>;
      return all.filter((p) => String(p.invoiceId) === String(invoiceId));
    },
    invoicesAddPayment: (payment: unknown) => http("POST", "/api/invoice-payments", ensureId(payment)),
    invoicesDeletePayment: (paymentId: string | number) =>
      http("DELETE", `/api/invoice-payments/${encodeURIComponent(String(paymentId))}`),
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

  // ─── Toutes les autres méthodes du preload (vault, agenda, etc.) ──────
  // On les expose comme stubs doux pour ne pas crasher l'app.
  const allOtherStubs = createStubsFor([
    // Account
    "updateUsername",
    "updatePassword",
    // PDF Lab
    "pdfGeneratePreview",
    // Company
    "companyGet",
    "companyUpdate",
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
    // Agenda
    "agendaList",
    "agendaGetById",
    "agendaCreate",
    "agendaUpdate",
    "agendaDelete",
    "agendaSyncAllToOutlook",
    "agendaSyncOne",
    "agendaGetStats",
    "agendaListToday",
    "agendaListUpcoming",
    "agendaListByClient",
    "agendaListByChantier",
    "agendaEnsureChantierEvent",
    "agendaEnsureSignatureEvent",
    // Accounting
    "accountingListExpenses",
    "accountingGetExpenseById",
    "accountingCreateExpense",
    "accountingUpdateExpense",
    "accountingDeleteExpense",
    "accountingMarkExpensePaid",
    "accountingGetFinanceStats",
    "accountingGetMonthlyEvolution",
    "accountingGetTopClients",
    "accountingGetTopSuppliers",
    "accountingGetChantierMargins",
    "accountingExportFEC",
    // Expense Notes
    "expenseNotesList",
    "expenseNotesGetById",
    "expenseNotesCreate",
    "expenseNotesUpdate",
    "expenseNotesDelete",
    "expenseNotesValidate",
    "expenseNotesMarkReimbursed",
    "expenseNotesGetStats",
    "expenseNotesListByChantier",
    "expenseNotesExportMonth",
    // Subcontractors
    "subcontractorsList",
    "subcontractorsGetById",
    "subcontractorsCreate",
    "subcontractorsUpdate",
    "subcontractorsDelete",
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
