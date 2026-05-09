import { create } from "zustand";
import type { VaultFolder, VaultDocumentWithTags, VaultTag, VaultStats } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// vaultStore — Coffre-fort (Session 11)
// ═══════════════════════════════════════════════════════════════════════════

interface VaultState {
  folders: VaultFolder[];
  documents: VaultDocumentWithTags[];
  tags: VaultTag[];
  trash: VaultDocumentWithTags[];
  stats: VaultStats;
  isLoading: boolean;

  fetchFolders: () => Promise<void>;
  fetchTags: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchTrash: () => Promise<void>;

  fetchDocuments: (folderId?: string) => Promise<void>;
  searchDocuments: (query: string, filters?: { folderId?: string; tagIds?: string[]; mimeTypePrefix?: string; expiringSoon?: boolean }) => Promise<void>;

  // Folders
  createFolder: (data: Partial<VaultFolder>) => Promise<{ success: boolean; id?: string; error?: string }>;
  updateFolder: (id: string, data: Partial<VaultFolder>) => Promise<{ success: boolean; error?: string }>;
  deleteFolder: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Documents
  uploadDocument: (params: { folderId: string; sourcePath: string; fileName?: string; description?: string; expirationDate?: string; tags?: any[] }) => Promise<{ success: boolean; id?: string; error?: string }>;
  updateDocument: (id: string, data: any) => Promise<{ success: boolean; error?: string }>;
  trashDocument: (id: string) => Promise<{ success: boolean; error?: string }>;
  restoreDocument: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteDocumentForever: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Tags
  createTag: (data: { name: string; colorKey?: string }) => Promise<{ success: boolean; id?: string; alreadyExists?: boolean; error?: string }>;
  updateTag: (data: { id: string; name: string; colorKey: string }) => Promise<{ success: boolean; error?: string }>;
  deleteTag: (id: string) => Promise<{ success: boolean; error?: string }>;
  setDocumentTags: (documentId: string, tagIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  folders: [],
  documents: [],
  tags: [],
  trash: [],
  stats: { totalDocuments: 0, totalFolders: 0, totalSize: 0, trashCount: 0, expiringIn30Days: 0 },
  isLoading: false,

  fetchFolders: async () => {
    if (!window.btpAPI?.vaultListFolders) return;
    const list = await window.btpAPI.vaultListFolders();
    set({ folders: list });
  },

  fetchTags: async () => {
    if (!window.btpAPI?.vaultListTags) return;
    const list = await window.btpAPI.vaultListTags();
    set({ tags: list });
  },

  fetchStats: async () => {
    if (!window.btpAPI?.vaultGetStats) return;
    const stats = await window.btpAPI.vaultGetStats();
    set({ stats });
  },

  fetchTrash: async () => {
    if (!window.btpAPI?.vaultListTrash) return;
    const list = await window.btpAPI.vaultListTrash();
    set({ trash: list });
  },

  fetchDocuments: async (folderId) => {
    if (!window.btpAPI?.vaultListDocuments) return;
    set({ isLoading: true });
    const list = await window.btpAPI.vaultListDocuments({ folderId });
    set({ documents: list, isLoading: false });
  },

  searchDocuments: async (query, filters) => {
    if (!window.btpAPI?.vaultSearch) return;
    set({ isLoading: true });
    const list = await window.btpAPI.vaultSearch(query, filters);
    set({ documents: list, isLoading: false });
  },

  createFolder: async (data) => {
    if (!window.btpAPI?.vaultCreateFolder) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultCreateFolder(data);
    if (r.success) await get().fetchFolders();
    return r;
  },

  updateFolder: async (id, data) => {
    if (!window.btpAPI?.vaultUpdateFolder) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultUpdateFolder(id, data);
    if (r.success) await get().fetchFolders();
    return r;
  },

  deleteFolder: async (id) => {
    if (!window.btpAPI?.vaultDeleteFolder) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultDeleteFolder(id);
    if (r.success) await get().fetchFolders();
    return r;
  },

  uploadDocument: async (params) => {
    if (!window.btpAPI?.vaultUploadDocument) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultUploadDocument(params);
    if (r.success) {
      await Promise.all([get().fetchStats(), get().fetchDocuments(params.folderId)]);
    }
    return r;
  },

  updateDocument: async (id, data) => {
    if (!window.btpAPI?.vaultUpdateDocument) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultUpdateDocument(id, data);
    return r;
  },

  trashDocument: async (id) => {
    if (!window.btpAPI?.vaultTrashDocument) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultTrashDocument(id);
    if (r.success) await get().fetchStats();
    return r;
  },

  restoreDocument: async (id) => {
    if (!window.btpAPI?.vaultRestoreDocument) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultRestoreDocument(id);
    if (r.success) await get().fetchStats();
    return r;
  },

  deleteDocumentForever: async (id) => {
    if (!window.btpAPI?.vaultDeleteDocumentForever) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultDeleteDocumentForever(id);
    if (r.success) await get().fetchStats();
    return r;
  },

  createTag: async (data) => {
    if (!window.btpAPI?.vaultCreateTag) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultCreateTag(data);
    if (r.success) await get().fetchTags();
    return r;
  },

  updateTag: async (data) => {
    if (!window.btpAPI?.vaultUpdateTag) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultUpdateTag(data);
    if (r.success) await get().fetchTags();
    return r;
  },

  deleteTag: async (id) => {
    if (!window.btpAPI?.vaultDeleteTag) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultDeleteTag(id);
    if (r.success) await get().fetchTags();
    return r;
  },

  setDocumentTags: async (documentId, tagIds) => {
    if (!window.btpAPI?.vaultSetDocumentTags) return { success: false, error: "API non disponible" };
    const r = await window.btpAPI.vaultSetDocumentTags(documentId, tagIds);
    return r;
  },
}));
