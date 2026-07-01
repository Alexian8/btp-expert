// ═══════════════════════════════════════════════════════════════════════════
// API client — gestion admin des utilisateurs
//
// Toutes les routes sont gardées par requireAuth + requireRole("admin")
// côté serveur. Le token JWT est lu depuis localStorage["btp.web.token"]
// (web mode) ou depuis le contexte Electron (desktop mode — non pertinent
// pour cette feature qui ne s'utilise qu'en multi-user web).
// ═══════════════════════════════════════════════════════════════════════════

export type Role = "admin" | "manager" | "accountant" | "worker" | "viewer";

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  role: Role;
  disabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Nombre d'échecs de connexion consécutifs. */
  failedLoginAttempts?: number;
  /** Fin du verrouillage (epoch ms), 0 si non verrouillé. */
  lockedUntil?: number;
  /** Compte actuellement verrouillé (trop de tentatives). */
  locked?: boolean;
}

export interface CreateUserPayload {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  password?: string; // si absent, le serveur génère un temp password
  /** Si true, crée aussi une mailbox cPanel pour cet utilisateur. */
  createMailbox?: boolean;
  /** Adresse alternative où envoyer le welcome email avec les credentials.
   *  Utile si la mailbox pro vient d'être créée et n'est pas encore
   *  utilisable — on envoie alors à l'email perso (Gmail). */
  notificationEmail?: string;
}

export interface CreatedUser extends AdminUser {
  /** Présent uniquement si le serveur a généré un temp password. */
  tempPassword?: string;
  emailSent?: boolean;
  emailError?: string;
  /** Adresse à laquelle l'email a été envoyé (pro ou perso selon notificationEmail). */
  emailSentTo?: string;
  /** True si une mailbox cPanel a été créée avec succès. */
  mailboxCreated?: boolean;
  /** Raison si mailboxCreated === false (ex: "domaine non autorisé"). */
  mailboxError?: string;
  /** True si la mailbox existait déjà (pas une vraie erreur). */
  mailboxAlreadyExists?: boolean;
  /** True si la config cPanel est présente côté serveur (pour l'UI). */
  cpanelEnabled?: boolean;
}

const TOKEN_KEY = "btp.web.token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
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
    /* pas de body JSON */
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

export const usersAdminApi = {
  list: () => request<AdminUser[]>("GET", "/api/admin/users"),

  get: (id: number) => request<AdminUser>("GET", `/api/admin/users/${id}`),

  create: (payload: CreateUserPayload) =>
    request<CreatedUser>("POST", "/api/admin/users", payload),

  update: (id: number, payload: Partial<Omit<AdminUser, "id" | "username">>) =>
    request<AdminUser>("PATCH", `/api/admin/users/${id}`, payload),

  resetPassword: (id: number) =>
    request<{ tempPassword: string }>("POST", `/api/admin/users/${id}/reset-password`),

  /** Déverrouille un compte verrouillé (sans toucher au mot de passe). */
  unlock: (id: number) =>
    request<{ success: boolean }>("POST", `/api/admin/users/${id}/unlock`),

  /** Renvoie l'email d'invitation (régénère un mot de passe temporaire). */
  resendInvite: (id: number, notificationEmail?: string) =>
    request<{ tempPassword: string; emailSent: boolean; emailError?: string; emailSentTo?: string }>(
      "POST",
      `/api/admin/users/${id}/resend-invite`,
      notificationEmail ? { notificationEmail } : {}
    ),

  disable: (id: number) => request<void>("DELETE", `/api/admin/users/${id}`),

  /** Suppression définitive (hard delete). Garde-fous serveur :
   *  pas de self-delete, pas de delete du dernier admin. */
  deletePermanent: (id: number) =>
    request<void>("DELETE", `/api/admin/users/${id}/permanent`),
};
