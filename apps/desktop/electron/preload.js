const { contextBridge, ipcRenderer } = require("electron");

// ═══════════════════════════════════════════════════════════════════════════
// PRELOAD — Expose une API sécurisée au renderer
// ═══════════════════════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld("btpAPI", {
  // Settings
  getSettings: () => ipcRenderer.invoke("db:getSettings"),
  updateSettings: (patch) => ipcRenderer.invoke("db:updateSettings", patch),

  // Diagnostic : récupère l'erreur d'initialisation DB (null si tout va bien)
  getDbInitError: () => ipcRenderer.invoke("db:getInitError"),

  // Users / Auth
  countUsers: () => ipcRenderer.invoke("db:countUsers"),
  createFirstUser: (args) => ipcRenderer.invoke("db:createFirstUser", args),
  findUser: (username) => ipcRenderer.invoke("db:findUser", username),

  // Session S28 — Hotfix safety : stats DB locale pour comparaison cloud
  dbGetStats: () => ipcRenderer.invoke("db:getStats"),

  // Session S28 — PDF Lab : génère un PDF d'aperçu avec données factices
  pdfGeneratePreview: (docType) => ipcRenderer.invoke("pdf:generatePreview", docType),

  // Session S28 — Templates email (Outlook MS Graph)
  emailPrepareQuoteMail: (quoteId) => ipcRenderer.invoke("email:prepareQuoteMail", quoteId),
  emailPrepareInvoiceMail: (args) => ipcRenderer.invoke("email:prepareInvoiceMail", args),
  emailSendDocument: (args) => ipcRenderer.invoke("email:sendDocument", args),

  // Account management (Session 3)
  updateUsername: (args) => ipcRenderer.invoke("db:updateUsername", args),
  updatePassword: (args) => ipcRenderer.invoke("db:updatePassword", args),

  // Backup system (Session 3)
  detectClouds: () => ipcRenderer.invoke("cloud:detect"),
  chooseFolder: () => ipcRenderer.invoke("dialog:chooseFolder"),
  chooseBackupFile: () => ipcRenderer.invoke("dialog:chooseBackupFile"),
  createBackup: (opts) => ipcRenderer.invoke("backup:create", opts),
  listBackups: (opts) => ipcRenderer.invoke("backup:list", opts),
  deleteBackup: (backupPath) => ipcRenderer.invoke("backup:delete", backupPath),
  applyRetention: (opts) => ipcRenderer.invoke("backup:applyRetention", opts),
  inspectBackup: (opts) => ipcRenderer.invoke("backup:inspect", opts),
  restoreBackup: (opts) => ipcRenderer.invoke("backup:restore", opts),
  setOnCloseBackup: (config) => ipcRenderer.invoke("backup:setOnCloseConfig", config),
  getSystemPaths: () => ipcRenderer.invoke("system:getPaths"),

  // Microsoft OAuth + OneDrive (Session OAuth-1)
  msLogin: () => ipcRenderer.invoke("ms:login"),
  msLogout: () => ipcRenderer.invoke("ms:logout"),
  msGetAccount: () => ipcRenderer.invoke("ms:getAccount"),
  msGetQuota: () => ipcRenderer.invoke("ms:getQuota"),
  msOneDriveUpload: (opts) => ipcRenderer.invoke("msOneDrive:uploadBackup", opts),
  msOneDriveList: () => ipcRenderer.invoke("msOneDrive:listBackups"),
  msOneDriveDelete: (remoteName) => ipcRenderer.invoke("msOneDrive:deleteBackup", remoteName),
  msOneDriveApplyRetention: (opts) => ipcRenderer.invoke("msOneDrive:applyRetention", opts),
  msOneDriveCheckLatest: () => ipcRenderer.invoke("msOneDrive:checkLatest"),
  msOneDriveRestore: (opts) => ipcRenderer.invoke("msOneDrive:restoreBackup", opts),
  getLocalDbHash: () => ipcRenderer.invoke("backup:getLocalDbHash"),

  // Clients (Session 4)
  clientsList: () => ipcRenderer.invoke("clients:list"),
  clientsGet: (id) => ipcRenderer.invoke("clients:get", id),
  clientsCreate: (data) => ipcRenderer.invoke("clients:create", data),
  clientsUpdate: (args) => ipcRenderer.invoke("clients:update", args),
  clientsDelete: (id) => ipcRenderer.invoke("clients:delete", id),
  clientsCount: () => ipcRenderer.invoke("clients:count"),

  // Suppliers (Session 4)
  suppliersList: () => ipcRenderer.invoke("suppliers:list"),
  suppliersGet: (id) => ipcRenderer.invoke("suppliers:get", id),
  suppliersCreate: (data) => ipcRenderer.invoke("suppliers:create", data),
  suppliersUpdate: (args) => ipcRenderer.invoke("suppliers:update", args),
  suppliersDelete: (id) => ipcRenderer.invoke("suppliers:delete", id),
  suppliersCount: () => ipcRenderer.invoke("suppliers:count"),

  // Company profile (Session 4)
  companyGet: () => ipcRenderer.invoke("company:get"),
  companyUpdate: (patch) => ipcRenderer.invoke("company:update", patch),

  // Chantiers (Session 6)
  chantiersList: () => ipcRenderer.invoke("chantiers:list"),
  chantiersGet: (id) => ipcRenderer.invoke("chantiers:get", id),
  chantiersListByClient: (clientId) => ipcRenderer.invoke("chantiers:listByClient", clientId),
  chantiersCreate: (data) => ipcRenderer.invoke("chantiers:create", data),
  chantiersUpdate: (args) => ipcRenderer.invoke("chantiers:update", args),
  chantiersUpdateStatus: (args) => ipcRenderer.invoke("chantiers:updateStatus", args),
  chantiersDelete: (id) => ipcRenderer.invoke("chantiers:delete", id),
  chantiersCount: () => ipcRenderer.invoke("chantiers:count"),
  chantiersCountByStatus: () => ipcRenderer.invoke("chantiers:countByStatus"),
  chantiersUploadPhoto: (args) => ipcRenderer.invoke("chantiers:uploadPhoto", args),
  chantiersDeletePhoto: (args) => ipcRenderer.invoke("chantiers:deletePhoto", args),
  chantiersReadPhoto: (photoPath) => ipcRenderer.invoke("chantiers:readPhoto", photoPath),

  // Chantier Events (Session 7)
  chantierEventsList: (chantierId) => ipcRenderer.invoke("chantierEvents:listByChantier", chantierId),
  chantierEventsAddNote: (args) => ipcRenderer.invoke("chantierEvents:addNote", args),
  chantierEventsUpdateNote: (args) => ipcRenderer.invoke("chantierEvents:updateNote", args),
  chantierEventsDelete: (id) => ipcRenderer.invoke("chantierEvents:delete", id),

  // Chantier Documents (Session 7)
  chantierDocsList: (chantierId) => ipcRenderer.invoke("chantierDocs:listByChantier", chantierId),
  chantierDocsAdd: (args) => ipcRenderer.invoke("chantierDocs:add", args),
  chantierDocsUploadViaDialog: (args) => ipcRenderer.invoke("chantierDocs:uploadViaDialog", args),
  chantierDocsDelete: (id) => ipcRenderer.invoke("chantierDocs:delete", id),
  chantierDocsOpenExternal: (path) => ipcRenderer.invoke("chantierDocs:openExternal", path),
  chantierDocsShowInFolder: (path) => ipcRenderer.invoke("chantierDocs:showInFolder", path),

  // Catégories de documents chantier (Session 21)
  chantierDocCategoriesList: () => ipcRenderer.invoke("chantierDocCategories:list"),
  chantierDocCategoriesCreate: (args) => ipcRenderer.invoke("chantierDocCategories:create", args),
  chantierDocCategoriesUpdate: (args) => ipcRenderer.invoke("chantierDocCategories:update", args),
  chantierDocCategoriesDelete: (id) => ipcRenderer.invoke("chantierDocCategories:delete", id),
  chantierDocCategoriesReorder: (ids) => ipcRenderer.invoke("chantierDocCategories:reorder", ids),

  // Catégories chantier (Session 22)
  chantierCategoriesList: () => ipcRenderer.invoke("chantierCategories:list"),
  chantierCategoriesCreate: (args) => ipcRenderer.invoke("chantierCategories:create", args),
  chantierCategoriesUpdate: (args) => ipcRenderer.invoke("chantierCategories:update", args),
  chantierCategoriesDelete: (id) => ipcRenderer.invoke("chantierCategories:delete", id),
  chantierCategoriesReorder: (ids) => ipcRenderer.invoke("chantierCategories:reorder", ids),

  // Chantier Signatures (Session 7)
  chantierSignaturesList: (chantierId) => ipcRenderer.invoke("chantierSignatures:listByChantier", chantierId),
  chantierSignaturesCreate: (data) => ipcRenderer.invoke("chantierSignatures:create", data),
  chantierSignaturesDelete: (id) => ipcRenderer.invoke("chantierSignatures:delete", id),

  // Quotes (Session 8)
  quotesList: () => ipcRenderer.invoke("quotes:list"),
  quotesGet: (id) => ipcRenderer.invoke("quotes:get", id),
  quotesListByClient: (clientId) => ipcRenderer.invoke("quotes:listByClient", clientId),
  quotesListByChantier: (chantierId) => ipcRenderer.invoke("quotes:listByChantier", chantierId),
  quotesCreate: (data) => ipcRenderer.invoke("quotes:create", data),
  quotesUpdate: (args) => ipcRenderer.invoke("quotes:update", args),
  quotesUpdateStatus: (args) => ipcRenderer.invoke("quotes:updateStatus", args),
  quotesDelete: (id) => ipcRenderer.invoke("quotes:delete", id),
  quotesDuplicate: (id) => ipcRenderer.invoke("quotes:duplicate", id),
  quotesConvertToPo: (args) => ipcRenderer.invoke("quotes:convertToPo", args),
  quotesCount: () => ipcRenderer.invoke("quotes:count"),
  quotesCountByStatus: () => ipcRenderer.invoke("quotes:countByStatus"),

  // Library (Session 8)
  libraryList: () => ipcRenderer.invoke("library:list"),
  libraryCreate: (data) => ipcRenderer.invoke("library:create", data),
  libraryUpdate: (args) => ipcRenderer.invoke("library:update", args),
  libraryDelete: (id) => ipcRenderer.invoke("library:delete", id),
  libraryIncrementUsage: (id) => ipcRenderer.invoke("library:incrementUsage", id),

  // Company logo (Session 9)
  companyUploadLogo: () => ipcRenderer.invoke("company:uploadLogo"),
  companyDeleteLogo: () => ipcRenderer.invoke("company:deleteLogo"),
  companyReadLogo: (logoPath) => ipcRenderer.invoke("company:readLogo", logoPath),

  // Quote PDF + Email (Session 9)
  quotesExportPdfPreview: (quoteId) => ipcRenderer.invoke("quotes:exportPdfPreview", quoteId),
  quotesExportPdfSaveAs: (quoteId) => ipcRenderer.invoke("quotes:exportPdfSaveAs", quoteId),
  quotesOpenPdfExternal: (pdfPath) => ipcRenderer.invoke("quotes:openPdfExternal", pdfPath),
  quotesSendViaOutlook: (args) => ipcRenderer.invoke("quotes:sendViaOutlook", args),
  quotesGetDesignationHistory: () => ipcRenderer.invoke("quotes:getDesignationHistory"),

  // Invoices (Session 10)
  invoicesList: () => ipcRenderer.invoke("invoices:list"),
  invoicesGet: (id) => ipcRenderer.invoke("invoices:get", id),
  invoicesListByClient: (clientId) => ipcRenderer.invoke("invoices:listByClient", clientId),
  invoicesListByChantier: (chantierId) => ipcRenderer.invoke("invoices:listByChantier", chantierId),
  invoicesListByQuote: (quoteId) => ipcRenderer.invoke("invoices:listByQuote", quoteId),
  invoicesCreate: (data) => ipcRenderer.invoke("invoices:create", data),
  invoicesUpdate: (id, data) => ipcRenderer.invoke("invoices:update", { id, data }),
  invoicesUpdateStatus: (id, status) => ipcRenderer.invoke("invoices:updateStatus", { id, status }),
  invoicesDelete: (id) => ipcRenderer.invoke("invoices:delete", id),
  invoicesDuplicate: (id) => ipcRenderer.invoke("invoices:duplicate", id),
  invoicesCount: () => ipcRenderer.invoke("invoices:count"),
  invoicesCountByStatus: () => ipcRenderer.invoke("invoices:countByStatus"),
  invoicesConvertFromQuote: (quoteId, options) => ipcRenderer.invoke("invoices:convertFromQuote", { quoteId, options }),
  invoicesListPayments: (invoiceId) => ipcRenderer.invoke("invoices:listPayments", invoiceId),
  invoicesAddPayment: (payment) => ipcRenderer.invoke("invoices:addPayment", payment),
  invoicesDeletePayment: (paymentId) => ipcRenderer.invoke("invoices:deletePayment", paymentId),
  invoicesMarkReminderSent: (invoiceId) => ipcRenderer.invoke("invoices:markReminderSent", invoiceId),

  // Invoices PDF + Email (Session 10 msg 3)
  invoicesExportPdfPreview: (invoiceId) => ipcRenderer.invoke("invoices:exportPdfPreview", invoiceId),
  invoicesExportPdfSaveAs: (invoiceId) => ipcRenderer.invoke("invoices:exportPdfSaveAs", invoiceId),
  invoicesOpenPdfExternal: (pdfPath) => ipcRenderer.invoke("invoices:openPdfExternal", pdfPath),
  invoicesSendViaOutlook: (args) => ipcRenderer.invoke("invoices:sendViaOutlook", args),

  // ═════════════════════════════════════════════════════════════════════════
  // Vault (Session 11)
  // ═════════════════════════════════════════════════════════════════════════
  vaultListFolders: () => ipcRenderer.invoke("vault:listFolders"),
  vaultCreateFolder: (data) => ipcRenderer.invoke("vault:createFolder", data),
  vaultUpdateFolder: (id, data) => ipcRenderer.invoke("vault:updateFolder", { id, data }),
  vaultDeleteFolder: (id) => ipcRenderer.invoke("vault:deleteFolder", id),

  vaultListDocuments: (params) => ipcRenderer.invoke("vault:listDocuments", params || {}),
  vaultListTrash: () => ipcRenderer.invoke("vault:listTrash"),
  vaultUploadDocument: (params) => ipcRenderer.invoke("vault:uploadDocument", params),
  vaultUpdateDocument: (id, data) => ipcRenderer.invoke("vault:updateDocument", { id, data }),
  vaultTrashDocument: (id) => ipcRenderer.invoke("vault:trashDocument", id),
  vaultRestoreDocument: (id) => ipcRenderer.invoke("vault:restoreDocument", id),
  vaultDeleteDocumentForever: (id) => ipcRenderer.invoke("vault:deleteDocumentForever", id),

  vaultGetDocumentPreviewPath: (id) => ipcRenderer.invoke("vault:getDocumentPreviewPath", id),
  vaultDownloadDocument: (id) => ipcRenderer.invoke("vault:downloadDocument", id),
  vaultOpenDocumentExternal: (id) => ipcRenderer.invoke("vault:openDocumentExternal", id),

  vaultListTags: () => ipcRenderer.invoke("vault:listTags"),
  vaultCreateTag: (data) => ipcRenderer.invoke("vault:createTag", data),
  vaultUpdateTag: (data) => ipcRenderer.invoke("vault:updateTag", data),
  vaultDeleteTag: (id) => ipcRenderer.invoke("vault:deleteTag", id),
  vaultSetDocumentTags: (documentId, tagIds) => ipcRenderer.invoke("vault:setDocumentTags", { documentId, tagIds }),

  vaultSearch: (query, filters) => ipcRenderer.invoke("vault:search", { query, filters }),
  vaultGetStats: () => ipcRenderer.invoke("vault:getStats"),

  vaultEnsureClientFolder: (clientId, clientName) => ipcRenderer.invoke("vault:ensureClientFolder", { clientId, clientName }),
  vaultEnsureChantierFolder: (chantierId, chantierTitle, clientId) => ipcRenderer.invoke("vault:ensureChantierFolder", { chantierId, chantierTitle, clientId }),
  vaultPickFiles: () => ipcRenderer.invoke("vault:pickFiles"),

  // ═════════════════════════════════════════════════════════════════════════
  // Agenda (Session 12)
  // ═════════════════════════════════════════════════════════════════════════
  agendaList: (params) => ipcRenderer.invoke("agenda:list", params || {}),
  agendaGetById: (id) => ipcRenderer.invoke("agenda:getById", id),
  agendaCreate: (data) => ipcRenderer.invoke("agenda:create", data),
  agendaUpdate: (id, data) => ipcRenderer.invoke("agenda:update", { id, data }),
  agendaDelete: (id) => ipcRenderer.invoke("agenda:delete", id),
  agendaSyncAllToOutlook: () => ipcRenderer.invoke("agenda:syncAllToOutlook"),
  agendaSyncOne: (id) => ipcRenderer.invoke("agenda:syncOne", id),
  agendaGetStats: () => ipcRenderer.invoke("agenda:getStats"),
  agendaListToday: () => ipcRenderer.invoke("agenda:listToday"),
  agendaListUpcoming: (days) => ipcRenderer.invoke("agenda:listUpcoming", days),
  agendaListByClient: (clientId) => ipcRenderer.invoke("agenda:listByClient", clientId),
  agendaListByChantier: (chantierId) => ipcRenderer.invoke("agenda:listByChantier", chantierId),
  agendaEnsureChantierEvent: (params) => ipcRenderer.invoke("agenda:ensureChantierEvent", params),
  agendaEnsureSignatureEvent: (params) => ipcRenderer.invoke("agenda:ensureSignatureEvent", params),

  // ═════════════════════════════════════════════════════════════════════════
  // Comptabilité (Session 13)
  // ═════════════════════════════════════════════════════════════════════════
  accountingListExpenses: (filters) => ipcRenderer.invoke("accounting:listExpenses", filters || {}),
  accountingGetExpenseById: (id) => ipcRenderer.invoke("accounting:getExpenseById", id),
  accountingCreateExpense: (data) => ipcRenderer.invoke("accounting:createExpense", data),
  accountingUpdateExpense: (id, data) => ipcRenderer.invoke("accounting:updateExpense", { id, data }),
  accountingDeleteExpense: (id) => ipcRenderer.invoke("accounting:deleteExpense", id),
  accountingMarkExpensePaid: (id, paidDate, paymentMethod) => ipcRenderer.invoke("accounting:markExpensePaid", { id, paidDate, paymentMethod }),
  accountingGetFinanceStats: () => ipcRenderer.invoke("accounting:getFinanceStats"),
  accountingGetMonthlyEvolution: (monthsBack) => ipcRenderer.invoke("accounting:getMonthlyEvolution", monthsBack),
  accountingGetTopClients: (limit) => ipcRenderer.invoke("accounting:getTopClients", limit),
  accountingGetTopSuppliers: (limit) => ipcRenderer.invoke("accounting:getTopSuppliers", limit),
  accountingGetChantierMargins: () => ipcRenderer.invoke("accounting:getChantierMargins"),
  accountingExportFEC: (year) => ipcRenderer.invoke("accounting:exportFEC", { year }),

  // Session 30 — Comptabilité partie double
  accountingGetSettings: () => ipcRenderer.invoke("accounting:getSettings"),
  accountingUpdateSettings: (patch) => ipcRenderer.invoke("accounting:updateSettings", patch),
  accountingListAccounts: (filters) => ipcRenderer.invoke("accounting:listAccounts", filters || {}),
  accountingGetAccount: (numero) => ipcRenderer.invoke("accounting:getAccount", numero),
  accountingCreateAccount: (data) => ipcRenderer.invoke("accounting:createAccount", data),
  accountingUpdateAccount: (numero, data) => ipcRenderer.invoke("accounting:updateAccount", { numero, data }),
  accountingDeleteAccount: (numero) => ipcRenderer.invoke("accounting:deleteAccount", numero),
  accountingListJournals: () => ipcRenderer.invoke("accounting:listJournals"),
  accountingListEntries: (filters) => ipcRenderer.invoke("accounting:listEntries", filters || {}),
  accountingGetEntry: (entryId) => ipcRenderer.invoke("accounting:getEntry", entryId),
  accountingCreateManualEntry: (data) => ipcRenderer.invoke("accounting:createManualEntry", data),
  accountingDeleteEntry: (entryId) => ipcRenderer.invoke("accounting:deleteEntry", entryId),
  accountingRegenerateAllEntries: () => ipcRenderer.invoke("accounting:regenerateAllEntries"),
  accountingAutoLettrer: (compteAuxNum) => ipcRenderer.invoke("accounting:autoLettrer", compteAuxNum),
  accountingSetLettrage: (lineIds, code) => ipcRenderer.invoke("accounting:setLettrage", { lineIds, code }),
  accountingGetGrandLivre: (params) => ipcRenderer.invoke("accounting:getGrandLivre", params),
  accountingGetBalance: (params) => ipcRenderer.invoke("accounting:getBalance", params || {}),
  accountingGetIncomeStatement: (params) => ipcRenderer.invoke("accounting:getIncomeStatement", params || {}),
  accountingGetBalanceSheet: (params) => ipcRenderer.invoke("accounting:getBalanceSheet", params || {}),
  accountingGetVatReport: (period) => ipcRenderer.invoke("accounting:getVatReport", { period }),
  accountingEnsureClientAccount: (clientId) => ipcRenderer.invoke("accounting:ensureClientAccount", clientId),
  accountingEnsureSupplierAccount: (supplierId) => ipcRenderer.invoke("accounting:ensureSupplierAccount", supplierId),

  // ═════════════════════════════════════════════════════════════════════════
  // Notes de frais (Session 14)
  // ═════════════════════════════════════════════════════════════════════════
  expenseNotesList: (filters) => ipcRenderer.invoke("expenseNotes:list", filters || {}),
  expenseNotesGetById: (id) => ipcRenderer.invoke("expenseNotes:getById", id),
  expenseNotesCreate: (data) => ipcRenderer.invoke("expenseNotes:create", data),
  expenseNotesUpdate: (id, data) => ipcRenderer.invoke("expenseNotes:update", { id, data }),
  expenseNotesDelete: (id) => ipcRenderer.invoke("expenseNotes:delete", id),
  expenseNotesValidate: (id) => ipcRenderer.invoke("expenseNotes:validate", id),
  expenseNotesMarkReimbursed: (id, date) => ipcRenderer.invoke("expenseNotes:markReimbursed", { id, date }),
  expenseNotesGetStats: () => ipcRenderer.invoke("expenseNotes:getStats"),
  expenseNotesListByChantier: (chantierId) => ipcRenderer.invoke("expenseNotes:listByChantier", chantierId),
  expenseNotesExportMonth: (year, month) => ipcRenderer.invoke("expenseNotes:exportMonth", { year, month }),

  // ═════════════════════════════════════════════════════════════════════════
  // Sous-traitants (Session 15)
  // ═════════════════════════════════════════════════════════════════════════
  subcontractorsList: (filters) => ipcRenderer.invoke("subcontractors:list", filters || {}),
  subcontractorsGetById: (id) => ipcRenderer.invoke("subcontractors:getById", id),
  subcontractorsCreate: (data) => ipcRenderer.invoke("subcontractors:create", data),
  subcontractorsUpdate: (id, data) => ipcRenderer.invoke("subcontractors:update", { id, data }),
  subcontractorsDelete: (id) => ipcRenderer.invoke("subcontractors:delete", id),
  subcontractorsGetStats: () => ipcRenderer.invoke("subcontractors:getStats"),

  // Attestations
  subcontractorsListAttestations: (subcontractorId) => ipcRenderer.invoke("subcontractors:listAttestations", subcontractorId),
  subcontractorsCreateAttestation: (data) => ipcRenderer.invoke("subcontractors:createAttestation", data),
  subcontractorsUpdateAttestation: (id, data) => ipcRenderer.invoke("subcontractors:updateAttestation", { id, data }),
  subcontractorsDeleteAttestation: (id) => ipcRenderer.invoke("subcontractors:deleteAttestation", id),
  subcontractorsListExpiringAttestations: (daysAhead) => ipcRenderer.invoke("subcontractors:listExpiringAttestations", daysAhead),

  // Bons de commande
  poList: (filters) => ipcRenderer.invoke("po:list", filters || {}),
  poGetById: (id) => ipcRenderer.invoke("po:getById", id),
  poCreate: (data) => ipcRenderer.invoke("po:create", data),
  poUpdate: (id, data) => ipcRenderer.invoke("po:update", { id, data }),
  poDelete: (id) => ipcRenderer.invoke("po:delete", id),
  poReleaseRetention: (id) => ipcRenderer.invoke("po:releaseRetention", id),
  poGetStats: () => ipcRenderer.invoke("po:getStats"),

  // Situations
  situationsList: (filters) => ipcRenderer.invoke("situations:list", filters || {}),
  situationsGetById: (id) => ipcRenderer.invoke("situations:getById", id),
  situationsCreate: (data) => ipcRenderer.invoke("situations:create", data),
  situationsUpdate: (id, data) => ipcRenderer.invoke("situations:update", { id, data }),
  situationsDelete: (id) => ipcRenderer.invoke("situations:delete", id),
  situationsMarkPaid: (id, paidDate) => ipcRenderer.invoke("situations:markPaid", { id, paidDate }),
  situationsGetPreviousCumulPcts: (poId) => ipcRenderer.invoke("situations:getPreviousCumulPcts", poId),

  // ═════════════════════════════════════════════════════════════════════════
  // Statistiques avancées (Session 16)
  // ═════════════════════════════════════════════════════════════════════════
  statsGetQuotePipeline: () => ipcRenderer.invoke("stats:getQuotePipeline"),
  statsGetPaymentDelays: () => ipcRenderer.invoke("stats:getPaymentDelays"),
  statsGetClientPaymentDelays: (limit) => ipcRenderer.invoke("stats:getClientPaymentDelays", limit),
  statsGetOverdueInvoices: () => ipcRenderer.invoke("stats:getOverdueInvoices"),
  statsGetYoYComparison: (year) => ipcRenderer.invoke("stats:getYoYComparison", year),
  statsGetSeasonality: () => ipcRenderer.invoke("stats:getSeasonality"),

  // ═════════════════════════════════════════════════════════════════════════
  // Documents administratifs (Session 17)
  // ═════════════════════════════════════════════════════════════════════════
  // PV de réception
  adminReceptionList: (filters) => ipcRenderer.invoke("admin:reception:list", filters || {}),
  adminReceptionGetById: (id) => ipcRenderer.invoke("admin:reception:getById", id),
  adminReceptionCreate: (data) => ipcRenderer.invoke("admin:reception:create", data),
  adminReceptionUpdate: (id, data) => ipcRenderer.invoke("admin:reception:update", { id, data }),
  adminReceptionDelete: (id) => ipcRenderer.invoke("admin:reception:delete", id),

  // Attestations TVA
  adminTvaList: (filters) => ipcRenderer.invoke("admin:tva:list", filters || {}),
  adminTvaGetById: (id) => ipcRenderer.invoke("admin:tva:getById", id),
  adminTvaCreate: (data) => ipcRenderer.invoke("admin:tva:create", data),
  adminTvaUpdate: (id, data) => ipcRenderer.invoke("admin:tva:update", { id, data }),
  adminTvaDelete: (id) => ipcRenderer.invoke("admin:tva:delete", id),

  // DC4 sous-traitance
  adminDc4List: (filters) => ipcRenderer.invoke("admin:dc4:list", filters || {}),
  adminDc4GetById: (id) => ipcRenderer.invoke("admin:dc4:getById", id),
  adminDc4Create: (data) => ipcRenderer.invoke("admin:dc4:create", data),
  adminDc4Update: (id, data) => ipcRenderer.invoke("admin:dc4:update", { id, data }),
  adminDc4Delete: (id) => ipcRenderer.invoke("admin:dc4:delete", id),

  // DAACT — CERFA 13408*13
  adminDaactList: (filters) => ipcRenderer.invoke("admin:daact:list", filters || {}),
  adminDaactGetById: (id) => ipcRenderer.invoke("admin:daact:getById", id),
  adminDaactCreate: (data) => ipcRenderer.invoke("admin:daact:create", data),
  adminDaactUpdate: (id, data) => ipcRenderer.invoke("admin:daact:update", { id, data }),
  adminDaactDelete: (id) => ipcRenderer.invoke("admin:daact:delete", id),
  adminDaactExportPdfPreview: (id) => ipcRenderer.invoke("admin:daact:exportPdfPreview", id),
  adminDaactExportPdfSaveAs: (id) => ipcRenderer.invoke("admin:daact:exportPdfSaveAs", id),

  // RGE
  adminRgeList: () => ipcRenderer.invoke("admin:rge:list"),
  adminRgeCreate: (data) => ipcRenderer.invoke("admin:rge:create", data),
  adminRgeDelete: (id) => ipcRenderer.invoke("admin:rge:delete", id),

  adminGetStats: () => ipcRenderer.invoke("admin:getStats"),

  // Session 18 — Génération PDF des documents administratifs
  adminReceptionExportPdfPreview: (id) => ipcRenderer.invoke("admin:reception:exportPdfPreview", id),
  adminReceptionExportPdfSaveAs: (id) => ipcRenderer.invoke("admin:reception:exportPdfSaveAs", id),
  adminTvaExportPdfPreview: (id) => ipcRenderer.invoke("admin:tva:exportPdfPreview", id),
  adminTvaExportPdfSaveAs: (id) => ipcRenderer.invoke("admin:tva:exportPdfSaveAs", id),
  adminDc4ExportPdfPreview: (id) => ipcRenderer.invoke("admin:dc4:exportPdfPreview", id),
  adminDc4ExportPdfSaveAs: (id) => ipcRenderer.invoke("admin:dc4:exportPdfSaveAs", id),
  adminOpenPdfExternal: (path) => ipcRenderer.invoke("admin:openPdfExternal", path),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
