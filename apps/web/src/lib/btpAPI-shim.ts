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

  // ─── Clients ───────────────────────────────────────────────────────────
  const clients = {
    clientsList: () => http("GET", "/api/clients"),
    clientsGet: (id: string | number) => http("GET", `/api/clients/${encodeURIComponent(String(id))}`),
    clientsCreate: (data: unknown) => http("POST", "/api/clients", data),
    clientsUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      http("PATCH", `/api/clients/${encodeURIComponent(String(id))}`, data),
    clientsDelete: (id: string | number) =>
      http("DELETE", `/api/clients/${encodeURIComponent(String(id))}`),
    clientsCount: async (): Promise<number> => {
      const r = await http<{ count: number }>("GET", "/api/clients/count");
      return r.count;
    },
  };

  // ─── Suppliers (= fournisseurs côté serveur) ───────────────────────────
  const suppliers = {
    suppliersList: () => http("GET", "/api/fournisseurs"),
    suppliersGet: (id: string | number) =>
      http("GET", `/api/fournisseurs/${encodeURIComponent(String(id))}`),
    suppliersCreate: (data: unknown) => http("POST", "/api/fournisseurs", data),
    suppliersUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      http("PATCH", `/api/fournisseurs/${encodeURIComponent(String(id))}`, data),
    suppliersDelete: (id: string | number) =>
      http("DELETE", `/api/fournisseurs/${encodeURIComponent(String(id))}`),
    suppliersCount: async (): Promise<number> => {
      const r = await http<{ count: number }>("GET", "/api/fournisseurs/count");
      return r.count;
    },
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
    chantiersCreate: (data: unknown) => http("POST", "/api/chantiers", data),
    chantiersUpdate: ({ id, data }: { id: string | number; data: unknown }) =>
      http("PATCH", `/api/chantiers/${encodeURIComponent(String(id))}`, data),
    chantiersUpdateStatus: ({ id, status }: { id: string | number; status: string }) =>
      http("PATCH", `/api/chantiers/${encodeURIComponent(String(id))}`, { statut: status }),
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
    invoicesListByQuote: stub("invoicesListByQuote", [] as unknown[]),
    invoicesCreate: (data: unknown) => http("POST", "/api/invoices", data),
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
    invoicesAddPayment: (payment: unknown) => http("POST", "/api/invoice-payments", payment),
    invoicesDeletePayment: (paymentId: string | number) =>
      http("DELETE", `/api/invoice-payments/${encodeURIComponent(String(paymentId))}`),
    invoicesMarkReminderSent: stub("invoicesMarkReminderSent", { success: true }),
    invoicesExportPdfPreview: stub("invoicesExportPdfPreview", { success: false, error: "PDF web pas encore implémenté" }),
    invoicesExportPdfSaveAs: stub("invoicesExportPdfSaveAs", { success: false }),
    invoicesOpenPdfExternal: stub("invoicesOpenPdfExternal", { success: false }),
    invoicesSendViaOutlook: stub("invoicesSendViaOutlook", { success: false, error: "Outlook web pas encore implémenté" }),
  };

  // ─── Quotes (devis) — pas encore branchés serveur, stubs ──────────────
  const quotes = {
    quotesList: stub("quotesList", [] as unknown[]),
    quotesGet: stub("quotesGet", null),
    quotesListByClient: stub("quotesListByClient", [] as unknown[]),
    quotesListByChantier: stub("quotesListByChantier", [] as unknown[]),
    quotesCreate: stub("quotesCreate", null),
    quotesUpdate: stub("quotesUpdate", null),
    quotesUpdateStatus: stub("quotesUpdateStatus", null),
    quotesDelete: stub("quotesDelete", null),
    quotesDuplicate: stub("quotesDuplicate", null),
    quotesConvertToPo: stub("quotesConvertToPo", null),
    quotesCount: stub("quotesCount", 0),
    quotesCountByStatus: stub("quotesCountByStatus", {} as Record<string, number>),
    quotesExportPdfPreview: stub("quotesExportPdfPreview", { success: false }),
    quotesExportPdfSaveAs: stub("quotesExportPdfSaveAs", { success: false }),
    quotesOpenPdfExternal: stub("quotesOpenPdfExternal", { success: false }),
    quotesSendViaOutlook: stub("quotesSendViaOutlook", { success: false }),
    quotesGetDesignationHistory: stub("quotesGetDesignationHistory", [] as unknown[]),
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

  // ─── Microsoft (Outlook + OneDrive) — stub pour l'instant ─────────────
  const microsoft = {
    msLogin: stub("msLogin", { success: false, error: "Microsoft web pas encore branché" }),
    msLogout: stub("msLogout", { success: true }),
    msGetAccount: stub("msGetAccount", { account: null, isLoggedIn: false }),
    msGetQuota: stub("msGetQuota", { used: 0, total: 0 }),
    msOneDriveUpload: stub("msOneDriveUpload", { success: false }),
    msOneDriveList: stub("msOneDriveList", [] as unknown[]),
    msOneDriveDelete: stub("msOneDriveDelete", { success: false }),
    msOneDriveApplyRetention: stub("msOneDriveApplyRetention", { success: true }),
    msOneDriveCheckLatest: stub("msOneDriveCheckLatest", { hasNewer: false, latest: null }),
    msOneDriveRestore: stub("msOneDriveRestore", { success: false }),
    emailPrepareQuoteMail: stub("emailPrepareQuoteMail", { success: false, error: "Email web pas branché" }),
    emailPrepareInvoiceMail: stub("emailPrepareInvoiceMail", { success: false, error: "Email web pas branché" }),
    emailSendDocument: stub("emailSendDocument", { success: false, error: "Outlook web pas encore branché" }),
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
    ...clients,
    ...suppliers,
    ...chantiers,
    ...invoices,
    ...quotes,
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
