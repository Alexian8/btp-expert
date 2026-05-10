import type { IDataService, IRepository } from "@btp/core";
import { MockRepository } from "@btp/core";
import type {
  Client,
  Supplier,
  Chantier,
  LegacyInvoice as Invoice,
  InvoicePayment,
  LegacyVaultDocument as VaultDocument,
  CGVClause,
  ChantierClause,
  User,
  AppSettings,
  AgendaEvent,
  AgendaStats,
  Expense,
  FinanceStats,
  MonthlyDataPoint,
  TopClient,
  TopSupplier,
  ChantierMargin,
  ExpenseNote,
  ExpenseNoteStats,
  Subcontractor,
  SubcontractorAttestation,
  SubcontractorStats,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStats,
  Situation,
  SituationLine,
  QuotePipelineStats,
  PaymentDelayStats,
  ClientPaymentDelay,
  OverdueInvoice,
  YoYComparison,
  SeasonalityData,
  ReceptionReport,
  ReceptionReserve,
  TvaAttestation,
  Dc4Declaration,
  RgeDocument,
  AdministrativeDocsStats,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// ElectronDataService — Implémentation de IDataService pour l'app desktop
//
// Parle au process Electron main via window.btpAPI (exposé par preload.js)
// qui parle à SQLite (better-sqlite3).
//
// NOTE v16 : Pour l'instant, tous les repositories sont des Mocks en mémoire.
// On les branchera à SQLite feature par feature au fur et à mesure de la
// migration depuis v15.11. L'interface restera identique pour le code React.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Session 23 — Types backup partagés
// ═══════════════════════════════════════════════════════════════════════════

export interface BackupManifest {
  formatVersion: number;
  appVersion: string;
  backupId: string;
  type: string;
  createdAt: string;
  platform: string;
  database: {
    size: number;
    sha256: string;
    stats: {
      clients: number;
      chantiers: number;
      devis: number;
      factures: number;
      sousTraitants: number;
    };
  };
  vault: {
    included: boolean;
    fileCount: number;
    size: number;
  };
  settings: {
    included: boolean;
  };
  logs: {
    included: boolean;
    fileCount: number;
  };
}

export interface BackupItem {
  id: string;
  path: string;
  size: number;
  createdAt: string;
  type: string;
  version: string;
  format?: "btpbackup" | "legacy-db";
  manifest?: BackupManifest | null;
}

declare global {
  interface Window {
    btpAPI?: {
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      countUsers: () => Promise<number>;
      createFirstUser: (args: { username: string; passwordHash: string }) => Promise<{ success: boolean; id?: number; error?: string }>;
      findUser: (username: string) => Promise<{ id: number; username: string; passwordHash: string; role: string } | null>;
      // Session 3 — Account
      updateUsername: (args: { currentUsername: string; newUsername: string; passwordHash: string }) => Promise<{ success: boolean; error?: string }>;
      updatePassword: (args: { username: string; oldPasswordHash: string; newPasswordHash: string }) => Promise<{ success: boolean; error?: string }>;
      // Session 3 — Backup
      detectClouds: () => Promise<Array<{ kind: string; label: string; path: string; available: boolean }>>;
      chooseFolder: () => Promise<string | null>;
      chooseBackupFile: () => Promise<string | null>;
      createBackup: (opts: { destinationPath: string; includeVault: boolean; includeSettings: boolean; includeLogs: boolean; settingsJson?: string; type?: string }) => Promise<{ success: boolean; backup?: BackupItem; error?: string }>;
      listBackups: (opts: { destinationPath: string }) => Promise<BackupItem[]>;
      deleteBackup: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
      applyRetention: (opts: { destinationPath: string; keepCount: number }) => Promise<{ deleted: number }>;
      inspectBackup: (opts: { backupPath: string }) => Promise<{ success: boolean; format?: "btpbackup" | "legacy-db"; manifest?: BackupManifest | null; integrityOk?: boolean; computedHash?: string; size?: number; modifiedAt?: string; warnings?: string[]; error?: string }>;
      restoreBackup: (opts: { backupPath: string; skipIntegrityCheck?: boolean }) => Promise<{ success: boolean; error?: string }>;
      setOnCloseBackup: (config: { enabled: boolean; destinationPath: string; retentionCount: number } | null) => Promise<{ success: boolean }>;
      getSystemPaths: () => Promise<{ userData: string; documents: string; home: string; platform: string }>;
      // Session OAuth-1 — Microsoft
      msLogin: () => Promise<{ success: boolean; profile?: { name: string; email: string; id: string }; error?: string }>;
      msLogout: () => Promise<{ success: boolean }>;
      msGetAccount: () => Promise<{ name: string; email: string; id: string } | null>;
      msGetQuota: () => Promise<{ used: number; total: number; remaining: number } | null>;
      msOneDriveUpload: (opts: { includeVault?: boolean; includeSettings?: boolean; includeLogs?: boolean; settingsJson?: string; type?: string }) => Promise<{ success: boolean; backup?: BackupItem; error?: string }>;
      msOneDriveList: () => Promise<Array<{ id: string; path: string; size: number; createdAt: string; type: string; version: string; format?: string; source: string }>>;
      msOneDriveDelete: (remoteName: string) => Promise<{ success: boolean; error?: string }>;
      msOneDriveApplyRetention: (opts: { keepCount: number }) => Promise<{ deleted: number; total?: number; kept?: number; errors?: string[]; error?: string }>;
      msOneDriveCheckLatest: () => Promise<{ success: boolean; hasCloudBackup?: boolean; cloudIsNewer?: boolean; latest?: { name: string; size: number; modifiedAt: string; manifest?: BackupManifest | null }; localMtime?: string; error?: string }>;
      msOneDriveRestore: (opts: { remoteName: string }) => Promise<{ success: boolean; error?: string }>;
      getLocalDbHash: () => Promise<{ success: boolean; hash?: string; size?: number; error?: string }>;
      // Session 4 — Clients
      clientsList: () => Promise<any[]>;
      clientsGet: (id: string) => Promise<any | null>;
      clientsCreate: (data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
      clientsUpdate: (args: { id: string; data: any }) => Promise<{ success: boolean; error?: string }>;
      clientsDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      clientsCount: () => Promise<number>;
      // Session 4 — Suppliers
      suppliersList: () => Promise<any[]>;
      suppliersGet: (id: string) => Promise<any | null>;
      suppliersCreate: (data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
      suppliersUpdate: (args: { id: string; data: any }) => Promise<{ success: boolean; error?: string }>;
      suppliersDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      suppliersCount: () => Promise<number>;
      // Session 4 — Company
      companyGet: () => Promise<any>;
      companyUpdate: (patch: any) => Promise<any>;
      // Session 6 — Chantiers
      chantiersList: () => Promise<any[]>;
      chantiersGet: (id: string) => Promise<any | null>;
      chantiersListByClient: (clientId: string) => Promise<any[]>;
      chantiersCreate: (data: any) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      chantiersUpdate: (args: { id: string; data: any }) => Promise<{ success: boolean; error?: string }>;
      chantiersUpdateStatus: (args: { id: string; status: string }) => Promise<{ success: boolean; error?: string }>;
      chantiersDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      chantiersCount: () => Promise<number>;
      chantiersCountByStatus: () => Promise<{ prospect: number; "en-cours": number; termine: number; annule: number }>;
      chantiersUploadPhoto: (args: { chantierId: string; fileName?: string }) => Promise<{ id: string; path: string; caption: string; createdAt: string } | null>;
      chantiersDeletePhoto: (args: { photoPath: string }) => Promise<{ success: boolean; error?: string }>;
      chantiersReadPhoto: (photoPath: string) => Promise<string | null>;
      // Session 7 — Events / Documents / Signatures
      chantierEventsList: (chantierId: string) => Promise<any[]>;
      chantierEventsAddNote: (args: { chantierId: string; note: string; title?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
      chantierEventsUpdateNote: (args: { id: string; title?: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
      chantierEventsDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      chantierDocsList: (chantierId: string) => Promise<any[]>;
      chantierDocsAdd: (args: { chantierId: string; sourcePath: string; originalName: string; mimeType?: string; category?: string }) => Promise<{ success: boolean; document?: any; error?: string }>;
      chantierDocsUploadViaDialog: (args: { chantierId: string; category?: string }) => Promise<{ success: boolean; documents?: any[]; error?: string }>;
      chantierDocsDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      chantierDocsOpenExternal: (path: string) => Promise<{ success: boolean; error?: string }>;
      chantierDocsShowInFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
      // Session 21 — Catégories de documents chantier
      chantierDocCategoriesList: () => Promise<Array<{ id: string; name: string; iconKey: string; colorKey: string; sortOrder: number; isSystem: boolean; createdAt: string; updatedAt: string }>>;
      chantierDocCategoriesCreate: (args: { name: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
      chantierDocCategoriesUpdate: (args: { id: string; name?: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; error?: string }>;
      chantierDocCategoriesDelete: (id: string) => Promise<{ success: boolean; reassigned?: number; error?: string }>;
      chantierDocCategoriesReorder: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
      // Session 22 — Catégories chantier (corps d'état)
      chantierCategoriesList: () => Promise<Array<{ id: string; name: string; iconKey: string; colorKey: string; sortOrder: number; isSystem: boolean; createdAt: string; updatedAt: string }>>;
      chantierCategoriesCreate: (args: { name: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
      chantierCategoriesUpdate: (args: { id: string; name?: string; iconKey?: string; colorKey?: string }) => Promise<{ success: boolean; error?: string }>;
      chantierCategoriesDelete: (id: string) => Promise<{ success: boolean; detached?: number; error?: string }>;
      chantierCategoriesReorder: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
      chantierSignaturesList: (chantierId: string) => Promise<any[]>;
      chantierSignaturesCreate: (data: { chantierId: string; kind: "start" | "end"; signerName: string; signerRole: string; signatureDataUrl: string; notes?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
      chantierSignaturesDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      // Session 8 — Quotes
      quotesList: () => Promise<any[]>;
      quotesGet: (id: string) => Promise<any | null>;
      quotesListByClient: (clientId: string) => Promise<any[]>;
      quotesListByChantier: (chantierId: string) => Promise<any[]>;
      quotesCreate: (data: any) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      quotesUpdate: (args: { id: string; data: any }) => Promise<{ success: boolean; error?: string }>;
      quotesUpdateStatus: (args: { id: string; status: string }) => Promise<{ success: boolean; error?: string }>;
      quotesDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      quotesDuplicate: (id: string) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      quotesConvertToPo: (args: { quoteId: string; subcontractorId: string }) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      quotesCount: () => Promise<number>;
      quotesCountByStatus: () => Promise<{ brouillon: number; envoye: number; accepte: number; refuse: number }>;
      // Session 8 — Library
      libraryList: () => Promise<any[]>;
      libraryCreate: (data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
      libraryUpdate: (args: { id: string; data: any }) => Promise<{ success: boolean; error?: string }>;
      libraryDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      libraryIncrementUsage: (id: string) => Promise<{ success: boolean; error?: string }>;
      // Session 9 — Company logo
      companyUploadLogo: () => Promise<{ success: boolean; logoPath?: string; error?: string } | null>;
      companyDeleteLogo: () => Promise<{ success: boolean; error?: string }>;
      companyReadLogo: (logoPath: string) => Promise<string | null>;
      // Session 9 — Quote PDF + Email
      quotesExportPdfPreview: (quoteId: string) => Promise<{ success: boolean; path?: string; error?: string; vault?: { stored: boolean; replaced?: boolean; folderId?: string; error?: string } }>;
      quotesExportPdfSaveAs: (quoteId: string) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string; vault?: { stored: boolean; replaced?: boolean; folderId?: string; error?: string } }>;
      quotesOpenPdfExternal: (pdfPath: string) => Promise<{ success: boolean; error?: string }>;
      quotesSendViaOutlook: (args: { quoteId: string; to: string; subject: string; body: string; cc?: string }) => Promise<{ success: boolean; needsLogin?: boolean; error?: string }>;
      quotesGetDesignationHistory: () => Promise<Array<{ title: string; description: string; unit: string; unitPriceHT: number; vatRate: number; count: number }>>;
      // Session 10 — Invoices
      invoicesList: () => Promise<any[]>;
      invoicesGet: (id: string) => Promise<any | null>;
      invoicesListByClient: (clientId: string) => Promise<any[]>;
      invoicesListByChantier: (chantierId: string) => Promise<any[]>;
      invoicesListByQuote: (quoteId: string) => Promise<any[]>;
      invoicesCreate: (data: any) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      invoicesUpdate: (id: string, data: any) => Promise<{ success: boolean; error?: string }>;
      invoicesUpdateStatus: (id: string, status: string) => Promise<{ success: boolean; error?: string }>;
      invoicesDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      invoicesDuplicate: (id: string) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      invoicesCount: () => Promise<number>;
      invoicesCountByStatus: () => Promise<Record<string, number>>;
      invoicesConvertFromQuote: (quoteId: string, options: { type: string; acomptePercent?: number }) => Promise<{ success: boolean; invoice?: any; error?: string }>;
      invoicesListPayments: (invoiceId: string) => Promise<any[]>;
      invoicesAddPayment: (payment: any) => Promise<{ success: boolean; id?: string; error?: string }>;
      invoicesDeletePayment: (paymentId: string) => Promise<{ success: boolean; error?: string }>;
      invoicesMarkReminderSent: (invoiceId: string) => Promise<{ success: boolean; error?: string }>;
      // Session 10 msg 3 — Invoice PDF + Email
      invoicesExportPdfPreview: (invoiceId: string) => Promise<{ success: boolean; path?: string; error?: string; vault?: { stored: boolean; replaced?: boolean; folderId?: string; error?: string } }>;
      invoicesExportPdfSaveAs: (invoiceId: string) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string; vault?: { stored: boolean; replaced?: boolean; folderId?: string; error?: string } }>;
      invoicesOpenPdfExternal: (pdfPath: string) => Promise<{ success: boolean; error?: string }>;
      invoicesSendViaOutlook: (args: { invoiceId: string; to: string; subject: string; body: string; cc?: string; markAsReminder?: boolean }) => Promise<{ success: boolean; needsLogin?: boolean; error?: string }>;
      // Session 11 — Vault
      vaultListFolders: () => Promise<any[]>;
      vaultCreateFolder: (data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
      vaultUpdateFolder: (id: string, data: any) => Promise<{ success: boolean; error?: string }>;
      vaultDeleteFolder: (id: string) => Promise<{ success: boolean; error?: string }>;
      vaultListDocuments: (params?: { folderId?: string; includeTrashed?: boolean }) => Promise<any[]>;
      vaultListTrash: () => Promise<any[]>;
      vaultUploadDocument: (params: { folderId: string; sourcePath: string; fileName?: string; description?: string; expirationDate?: string; tags?: any[] }) => Promise<{ success: boolean; id?: string; error?: string }>;
      vaultUpdateDocument: (id: string, data: any) => Promise<{ success: boolean; error?: string }>;
      vaultTrashDocument: (id: string) => Promise<{ success: boolean; error?: string }>;
      vaultRestoreDocument: (id: string) => Promise<{ success: boolean; error?: string }>;
      vaultDeleteDocumentForever: (id: string) => Promise<{ success: boolean; error?: string }>;
      vaultGetDocumentPreviewPath: (id: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      vaultDownloadDocument: (id: string) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      vaultOpenDocumentExternal: (id: string) => Promise<{ success: boolean; error?: string }>;
      vaultListTags: () => Promise<any[]>;
      vaultCreateTag: (data: { name: string; colorKey?: string }) => Promise<{ success: boolean; id?: string; alreadyExists?: boolean; error?: string }>;
      vaultUpdateTag: (data: { id: string; name: string; colorKey: string }) => Promise<{ success: boolean; error?: string }>;
      vaultDeleteTag: (id: string) => Promise<{ success: boolean; error?: string }>;
      vaultSetDocumentTags: (documentId: string, tagIds: string[]) => Promise<{ success: boolean; error?: string }>;
      vaultSearch: (query: string, filters?: { folderId?: string; tagIds?: string[]; mimeTypePrefix?: string; expiringSoon?: boolean }) => Promise<any[]>;
      vaultGetStats: () => Promise<{ totalDocuments: number; totalFolders: number; totalSize: number; trashCount: number; expiringIn30Days: number }>;
      vaultEnsureClientFolder: (clientId: string, clientName: string) => Promise<{ success: boolean; id?: string; alreadyExists?: boolean; error?: string }>;
      vaultEnsureChantierFolder: (chantierId: string, chantierTitle: string, clientId?: string) => Promise<{ success: boolean; id?: string; alreadyExists?: boolean; error?: string }>;
      vaultPickFiles: () => Promise<{ success: boolean; paths: string[]; cancelled?: boolean; error?: string }>;

      // Session 12 — Agenda
      agendaList: (params?: { rangeStart?: string; rangeEnd?: string }) => Promise<AgendaEvent[]>;
      agendaGetById: (id: string) => Promise<AgendaEvent | null>;
      agendaCreate: (data: Partial<AgendaEvent>) => Promise<{ success: boolean; id?: string; error?: string }>;
      agendaUpdate: (id: string, data: Partial<AgendaEvent>) => Promise<{ success: boolean; error?: string }>;
      agendaDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      agendaSyncAllToOutlook: () => Promise<{ success: boolean; pushed?: number; failed?: number; total?: number; needsLogin?: boolean; error?: string }>;
      agendaSyncOne: (id: string) => Promise<{ success: boolean; error?: string }>;
      agendaGetStats: () => Promise<AgendaStats>;
      agendaListToday: () => Promise<AgendaEvent[]>;
      agendaListUpcoming: (days?: number) => Promise<AgendaEvent[]>;
      agendaListByClient: (clientId: string) => Promise<AgendaEvent[]>;
      agendaListByChantier: (chantierId: string) => Promise<AgendaEvent[]>;
      agendaEnsureChantierEvent: (params: { chantierId: string; title: string; dateStart?: string; dateEnd?: string; clientId?: string; syncToOutlook?: boolean }) => Promise<{ success: boolean; id?: string; alreadyExists?: boolean; error?: string }>;
      agendaEnsureSignatureEvent: (params: { quoteId: string; title: string; dateStart?: string; clientId?: string; chantierId?: string; syncToOutlook?: boolean }) => Promise<{ success: boolean; id?: string; alreadyExists?: boolean; error?: string }>;

      // Session 13 — Comptabilité
      accountingListExpenses: (filters?: { status?: string; category?: string; supplierId?: string; chantierId?: string; yearMonth?: string; year?: number }) => Promise<Expense[]>;
      accountingGetExpenseById: (id: string) => Promise<Expense | null>;
      accountingCreateExpense: (data: Partial<Expense>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      accountingUpdateExpense: (id: string, data: Partial<Expense>) => Promise<{ success: boolean; error?: string }>;
      accountingDeleteExpense: (id: string) => Promise<{ success: boolean; error?: string }>;
      accountingMarkExpensePaid: (id: string, paidDate?: string, paymentMethod?: string) => Promise<{ success: boolean; error?: string }>;
      accountingGetFinanceStats: () => Promise<FinanceStats>;
      accountingGetMonthlyEvolution: (monthsBack?: number) => Promise<MonthlyDataPoint[]>;
      accountingGetTopClients: (limit?: number) => Promise<TopClient[]>;
      accountingGetTopSuppliers: (limit?: number) => Promise<TopSupplier[]>;
      accountingGetChantierMargins: () => Promise<ChantierMargin[]>;
      accountingExportFEC: (year: number) => Promise<{ success: boolean; path?: string; cancelled?: boolean; invoicesCount?: number; expensesCount?: number; lineCount?: number; error?: string }>;

      // Session 14 — Notes de frais
      expenseNotesList: (filters?: { status?: string; category?: string; payerType?: string; chantierId?: string; refacturable?: boolean; yearMonth?: string; year?: number }) => Promise<ExpenseNote[]>;
      expenseNotesGetById: (id: string) => Promise<ExpenseNote | null>;
      expenseNotesCreate: (data: Partial<ExpenseNote>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      expenseNotesUpdate: (id: string, data: Partial<ExpenseNote>) => Promise<{ success: boolean; error?: string }>;
      expenseNotesDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      expenseNotesValidate: (id: string) => Promise<{ success: boolean; error?: string }>;
      expenseNotesMarkReimbursed: (id: string, date?: string) => Promise<{ success: boolean; error?: string }>;
      expenseNotesGetStats: () => Promise<ExpenseNoteStats>;
      expenseNotesListByChantier: (chantierId: string) => Promise<ExpenseNote[]>;
      expenseNotesExportMonth: (year: number, month: number) => Promise<{ success: boolean; path?: string; cancelled?: boolean; notesCount?: number; error?: string }>;

      // Session 15 — Sous-traitants
      subcontractorsList: (filters?: { activity?: string; isActive?: boolean }) => Promise<Subcontractor[]>;
      subcontractorsGetById: (id: string) => Promise<Subcontractor | null>;
      subcontractorsCreate: (data: Partial<Subcontractor>) => Promise<{ success: boolean; id?: string; error?: string }>;
      subcontractorsUpdate: (id: string, data: Partial<Subcontractor>) => Promise<{ success: boolean; error?: string }>;
      subcontractorsDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      subcontractorsGetStats: () => Promise<SubcontractorStats>;

      subcontractorsListAttestations: (subcontractorId?: string) => Promise<SubcontractorAttestation[]>;
      subcontractorsCreateAttestation: (data: Partial<SubcontractorAttestation>) => Promise<{ success: boolean; id?: string; error?: string }>;
      subcontractorsUpdateAttestation: (id: string, data: Partial<SubcontractorAttestation>) => Promise<{ success: boolean; error?: string }>;
      subcontractorsDeleteAttestation: (id: string) => Promise<{ success: boolean; error?: string }>;
      subcontractorsListExpiringAttestations: (daysAhead?: number) => Promise<Array<SubcontractorAttestation & { companyName: string; isExpired: boolean }>>;

      poList: (filters?: { subcontractorId?: string; chantierId?: string; status?: string }) => Promise<PurchaseOrder[]>;
      poGetById: (id: string) => Promise<(PurchaseOrder & { lines: PurchaseOrderLine[] }) | null>;
      poCreate: (data: Partial<PurchaseOrder> & { lines?: Partial<PurchaseOrderLine>[] }) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      poUpdate: (id: string, data: Partial<PurchaseOrder> & { lines?: Partial<PurchaseOrderLine>[] }) => Promise<{ success: boolean; error?: string }>;
      poDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      poReleaseRetention: (id: string) => Promise<{ success: boolean; error?: string }>;
      poGetStats: () => Promise<PurchaseOrderStats>;

      situationsList: (filters?: { purchaseOrderId?: string; subcontractorId?: string; chantierId?: string; status?: string }) => Promise<Situation[]>;
      situationsGetById: (id: string) => Promise<(Situation & { lines: SituationLine[] }) | null>;
      situationsCreate: (data: Partial<Situation> & { lines?: Partial<SituationLine>[] }) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      situationsUpdate: (id: string, data: Partial<Situation> & { lines?: Partial<SituationLine>[] }) => Promise<{ success: boolean; error?: string }>;
      situationsDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      situationsMarkPaid: (id: string, paidDate?: string) => Promise<{ success: boolean; error?: string }>;
      situationsGetPreviousCumulPcts: (poId: string) => Promise<Record<string, number>>;

      // Session 16 — Stats avancées
      statsGetQuotePipeline: () => Promise<QuotePipelineStats | null>;
      statsGetPaymentDelays: () => Promise<PaymentDelayStats | null>;
      statsGetClientPaymentDelays: (limit?: number) => Promise<ClientPaymentDelay[]>;
      statsGetOverdueInvoices: () => Promise<OverdueInvoice[]>;
      statsGetYoYComparison: (year?: number) => Promise<YoYComparison | null>;
      statsGetSeasonality: () => Promise<SeasonalityData | null>;

      // Session 17 — Documents administratifs
      // PV de réception
      adminReceptionList: (filters?: { chantierId?: string; status?: string; receptionType?: string }) => Promise<ReceptionReport[]>;
      adminReceptionGetById: (id: string) => Promise<(ReceptionReport & { reserves: ReceptionReserve[] }) | null>;
      adminReceptionCreate: (data: Partial<ReceptionReport> & { reserves?: Partial<ReceptionReserve>[] }) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      adminReceptionUpdate: (id: string, data: Partial<ReceptionReport> & { reserves?: Partial<ReceptionReserve>[] }) => Promise<{ success: boolean; error?: string }>;
      adminReceptionDelete: (id: string) => Promise<{ success: boolean; error?: string }>;

      // Attestations TVA
      adminTvaList: (filters?: { chantierId?: string; tvaRate?: number; status?: string; year?: number }) => Promise<TvaAttestation[]>;
      adminTvaGetById: (id: string) => Promise<TvaAttestation | null>;
      adminTvaCreate: (data: Partial<TvaAttestation>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      adminTvaUpdate: (id: string, data: Partial<TvaAttestation>) => Promise<{ success: boolean; error?: string }>;
      adminTvaDelete: (id: string) => Promise<{ success: boolean; error?: string }>;

      // DC4
      adminDc4List: (filters?: { subcontractorId?: string; purchaseOrderId?: string; status?: string }) => Promise<Dc4Declaration[]>;
      adminDc4GetById: (id: string) => Promise<Dc4Declaration | null>;
      adminDc4Create: (data: Partial<Dc4Declaration>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      adminDc4Update: (id: string, data: Partial<Dc4Declaration>) => Promise<{ success: boolean; error?: string }>;
      adminDc4Delete: (id: string) => Promise<{ success: boolean; error?: string }>;

      // RGE
      adminRgeList: () => Promise<RgeDocument[]>;
      adminRgeCreate: (data: Partial<RgeDocument>) => Promise<{ success: boolean; id?: string; reference?: string; error?: string }>;
      adminRgeDelete: (id: string) => Promise<{ success: boolean; error?: string }>;

      adminGetStats: () => Promise<AdministrativeDocsStats>;

      // Session 18 — Génération PDF des documents administratifs
      adminReceptionExportPdfPreview: (id: string) => Promise<{ success: boolean; path?: string; vault?: any; error?: string }>;
      adminReceptionExportPdfSaveAs: (id: string) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      adminTvaExportPdfPreview: (id: string) => Promise<{ success: boolean; path?: string; vault?: any; error?: string }>;
      adminTvaExportPdfSaveAs: (id: string) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      adminDc4ExportPdfPreview: (id: string) => Promise<{ success: boolean; path?: string; vault?: any; error?: string }>;
      adminDc4ExportPdfSaveAs: (id: string) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      adminOpenPdfExternal: (path: string) => Promise<{ success: boolean; error?: string }>;
      platform: string;
      isElectron: boolean;
    };
  }
}

// Helper exposé (utilisé par les stores)
export async function hashPwd(pwd: string, salt: string): Promise<string> {
  return hashPassword(pwd, salt);
}

// ─── Hash simple de mot de passe (Web Crypto) ────────────────────────────
async function hashPassword(pwd: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class ElectronDataService implements IDataService {
  // Repositories (Mock pour l'instant, à remplacer par SQLite feature par feature)
  clients: IRepository<Client> = new MockRepository<Client>();
  fournisseurs: IRepository<Supplier> = new MockRepository<Supplier>();
  chantiers: IRepository<Chantier> = new MockRepository<Chantier>();
  invoices: IRepository<Invoice> = new MockRepository<Invoice>();
  invoicePayments: IRepository<InvoicePayment> = new MockRepository<InvoicePayment>();
  vault: IRepository<VaultDocument> = new MockRepository<VaultDocument>();
  cgvClauses: IRepository<CGVClause> = new MockRepository<CGVClause>();
  chantierClauses: IRepository<ChantierClause> = new MockRepository<ChantierClause>();

  private currentUser: User | null = null;

  private get api() {
    if (!window.btpAPI) {
      throw new Error("btpAPI non disponible (hors Electron ou preload.js manquant)");
    }
    return window.btpAPI;
  }

  // ─── Auth ────────────────────────────────────────────────────────────
  async login(username: string, password: string): Promise<User | null> {
    // Mode web : login via /api/auth/login (le serveur fait le hash + JWT)
    const api = this.api as unknown as {
      isWeb?: boolean;
      webLogin?: (
        u: string,
        p: string
      ) => Promise<{
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
      } | null>;
    };
    if (api.isWeb && api.webLogin) {
      const user = (await api.webLogin(username, password)) as
        | (User & {
            email?: string;
            firstName?: string;
            lastName?: string;
            mustChangePassword?: boolean;
            companyId?: number;
            isSetupComplete?: boolean;
            companyName?: string;
          })
        | null;
      if (!user) return null;
      // Propage TOUS les champs (multi-tenant + onboarding)
      this.currentUser = {
        id: user.id,
        username: user.username,
        role: (user.role as User["role"]) || "user",
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: user.mustChangePassword,
        companyId: user.companyId,
        isSetupComplete: user.isSetupComplete,
        companyName: user.companyName,
      };
      return this.currentUser;
    }

    // Mode desktop : findUser + verif locale du hash
    const user = await this.api.findUser(username);
    if (!user) return null;
    const hash = await hashPassword(password, username);
    if (hash !== user.passwordHash) return null;
    this.currentUser = {
      id: user.id,
      username: user.username,
      role: (user.role as "admin" | "user") || "user",
    };
    return this.currentUser;
  }

  async logout(): Promise<void> {
    this.currentUser = null;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async needsFirstUser(): Promise<boolean> {
    const count = await this.api.countUsers();
    return count === 0;
  }

  async createFirstUser(username: string, password: string): Promise<User> {
    const passwordHash = await hashPassword(password, username);
    const result = await this.api.createFirstUser({ username, passwordHash });
    if (!result.success || !result.id) {
      throw new Error(result.error || "Impossible de créer l'utilisateur");
    }
    this.currentUser = { id: result.id, username, role: "admin" };
    return this.currentUser;
  }

  // ─── Settings ────────────────────────────────────────────────────────
  async getSettings(): Promise<AppSettings> {
    return this.api.getSettings();
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return this.api.updateSettings(patch);
  }

  // ─── Operations spéciales (stubs pour l'instant) ─────────────────────
  async exportBackup(): Promise<ArrayBuffer> {
    throw new Error("Not implemented yet");
  }

  async importBackup(_data: ArrayBuffer): Promise<void> {
    throw new Error("Not implemented yet");
  }
}

// ─── Singleton exporté ───────────────────────────────────────────────────
let instance: ElectronDataService | null = null;

export function getDataService(): ElectronDataService {
  if (!instance) instance = new ElectronDataService();
  return instance;
}
