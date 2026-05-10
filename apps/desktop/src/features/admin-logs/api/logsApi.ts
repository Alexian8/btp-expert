// ═══════════════════════════════════════════════════════════════════════════
// API client — audit logs admin
// ═══════════════════════════════════════════════════════════════════════════

export interface AuditLog {
  id: number;
  timestamp: string;
  userId: number | null;
  username: string;
  action: string;
  resource: string;
  resourceId: string;
  ip: string;
  userAgent: string;
  meta: Record<string, unknown> | null;
}

export interface LogsQuery {
  limit?: number;
  offset?: number;
  userId?: number;
  action?: string;
  resource?: string;
  since?: string;
  until?: string;
  search?: string;
  order?: "asc" | "desc";
}

export interface LogUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
}

const TOKEN_KEY = "btp.web.token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { method, headers });
  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "message" in data
        ? (data as { message?: string }).message
        : null) ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function buildQuery(q: LogsQuery): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const logsApi = {
  list: (q: LogsQuery = {}) =>
    request<{ rows: AuditLog[]; total: number }>(
      "GET",
      `/api/admin/logs${buildQuery(q)}`
    ),

  actions: () => request<string[]>("GET", "/api/admin/logs/actions"),

  users: () => request<LogUser[]>("GET", "/api/admin/logs/users"),
};
