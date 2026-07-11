// ═══════════════════════════════════════════════════════════════════════════
// API client — gestion super-admin (entreprises clientes BatiDesk)
// ═══════════════════════════════════════════════════════════════════════════

export interface CompanyAdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  disabled: number;
  lastLoginAt: string | null;
}

export interface Company {
  id: number;
  name: string;
  data: Record<string, unknown>;
  isSetupComplete: boolean;
  isActive: boolean;
  createdAt: string;
  userCount?: number;
  activeUsers?: number;
  users?: CompanyAdminUser[];
}

export interface CreateCompanyPayload {
  companyName: string;
  adminUsername: string;
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
}

export interface CreatedCompany {
  id: number;
  name: string;
  isSetupComplete: boolean;
  isActive: boolean;
  admin: {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  tempPassword?: string;
  emailSent?: boolean;
  emailError?: string;
}

const TOKEN_KEY = "btp.web.token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

export const superAdminApi = {
  listCompanies: () => request<Company[]>("GET", "/api/super-admin/companies"),
  getCompany: (id: number) => request<Company>("GET", `/api/super-admin/companies/${id}`),
  createCompany: (payload: CreateCompanyPayload) =>
    request<CreatedCompany>("POST", "/api/super-admin/companies", payload),
  updateCompany: (id: number, payload: { name?: string; isActive?: boolean }) =>
    request<Company>("PATCH", `/api/super-admin/companies/${id}`, payload),
  /** Suppression définitive (cascade sur toutes les données du tenant).
   *  Garde-fous serveur : entreprise ID 1 interdite, désactivation requise. */
  deleteCompany: (id: number) =>
    request<{ success: boolean; deletedRows: Record<string, number> }>(
      "DELETE",
      `/api/super-admin/companies/${id}`
    ),
};
