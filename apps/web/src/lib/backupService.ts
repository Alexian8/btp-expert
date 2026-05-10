// ═══════════════════════════════════════════════════════════════════════════
// backupService.ts — wrapper HTTP pour /api/backup/*
// ═══════════════════════════════════════════════════════════════════════════

import { getToken } from "./api";

export interface BackupFileInfo {
  name: string;
  size: number;
  createdAt: string;
}

export interface BackupListResponse {
  count: number;
  totalBytes: number;
  files: BackupFileInfo[];
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

export const backupService = {
  async list(): Promise<BackupListResponse> {
    const res = await authFetch("/api/backup/list");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async run(): Promise<{ name: string; bytes: number; tables: number; rows: number }> {
    const res = await authFetch("/api/backup/run", { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async restore(name: string): Promise<{ name: string; statements: number }> {
    const res = await authFetch(`/api/backup/restore/${encodeURIComponent(name)}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async delete(name: string): Promise<void> {
    const res = await authFetch(`/api/backup/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },

  downloadUrl(name: string): string {
    // Le download nécessite l'auth — on déclenche via fetch puis blob download
    return `/api/backup/download/${encodeURIComponent(name)}`;
  },

  async download(name: string): Promise<void> {
    const res = await authFetch(this.downloadUrl(name));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
