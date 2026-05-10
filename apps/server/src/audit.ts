// ═══════════════════════════════════════════════════════════════════════════
// Audit logs — persistance des événements sensibles en DB
//
// Toutes les écritures sont best-effort (catch interne, jamais throw).
// Une erreur d'écriture audit ne doit JAMAIS casser la requête métier.
// ═══════════════════════════════════════════════════════════════════════════

import type { Request } from "express";
import type { DB, ResultSetHeader, RowDataPacket } from "./db";

export type AuditAction =
  // Auth
  | "login_ok"
  | "login_fail"
  | "login_blocked"
  | "logout"
  | "change_password"
  | "bootstrap"
  // Admin users
  | "user_created"
  | "user_updated"
  | "user_disabled"
  | "user_enabled"
  | "user_role_changed"
  | "user_password_reset"
  // CRUD
  | "create"
  | "update"
  | "delete"
  // Microsoft / email
  | "ms_connect"
  | "ms_disconnect"
  | "email_send"
  // Backup
  | "backup_run"
  | "backup_restore"
  | "backup_delete";

export interface AuditEntry {
  userId: number | null;
  username: string;
  action: AuditAction | string;
  resource?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown> | null;
  /** Multi-tenant : ID de l'entreprise. Sert à isoler les logs entre tenants.
   *  null = super_admin / système (visible uniquement par super_admin). */
  companyId?: number | null;
}

/**
 * Extrait IP + User-Agent + identité + tenant de la requête.
 * À appeler au début d'un handler pour avoir l'auteur.
 */
export function audited(req: Request, override?: Partial<AuditEntry>): Omit<AuditEntry, "action"> {
  return {
    userId: req.user?.sub ?? null,
    username: req.user?.username ?? "",
    companyId: req.user?.companyId ?? null,
    ip: req.ip ?? "",
    userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
    ...override,
  };
}

/**
 * Écrit un événement audit en DB.
 * Best-effort : aucune exception ne remonte au handler appelant.
 */
export async function writeAudit(db: DB, entry: AuditEntry): Promise<void> {
  try {
    await db.execute<ResultSetHeader>(
      `INSERT INTO audit_logs
         (companyId, userId, username, action, resource, resourceId, ip, userAgent, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.companyId ?? null,
        entry.userId,
        entry.username ?? "",
        entry.action,
        entry.resource ?? "",
        entry.resourceId ?? "",
        entry.ip ?? "",
        entry.userAgent ?? "",
        entry.meta ? JSON.stringify(entry.meta) : null,
      ] as never[]
    );
  } catch (e) {
    // Ne JAMAIS faire échouer la requête métier à cause d'un audit raté
    console.error("[audit] write failed:", e);
  }
}

// ─── Lecture (pour la route admin) ────────────────────────────────────────

export interface AuditQuery {
  limit?: number;
  offset?: number;
  userId?: number;
  action?: string;
  resource?: string;
  /** "asc" pour le mode follow, "desc" par défaut. */
  order?: "asc" | "desc";
  /** Filtre date >= (ISO ou DATETIME MySQL). */
  since?: string;
  /** Filtre date <= */
  until?: string;
  /** Recherche texte sur username / resourceId / ip. */
  search?: string;
  /** Multi-tenant : restreindre à un tenant précis.
   *  Quand défini, on n'expose QUE les logs de cette company.
   *  Pour super_admin : laisser undefined (= tous les logs). */
  companyId?: number;
}

export interface AuditRow extends RowDataPacket {
  id: number;
  timestamp: string;
  userId: number | null;
  username: string;
  action: string;
  resource: string;
  resourceId: string;
  ip: string;
  userAgent: string;
  meta: unknown;
  companyId: number | null;
}

export async function listAuditLogs(
  db: DB,
  q: AuditQuery
): Promise<{ rows: AuditRow[]; total: number }> {
  const wheres: string[] = [];
  const params: unknown[] = [];

  // ⚠️ Isolation multi-tenant : si companyId fourni, on filtre strictement.
  // Les logs sans companyId (legacy ou système) ne fuitent PAS aux admins.
  if (q.companyId != null) {
    wheres.push("companyId = ?");
    params.push(q.companyId);
  }
  if (q.userId != null) {
    wheres.push("userId = ?");
    params.push(q.userId);
  }
  if (q.action) {
    wheres.push("action = ?");
    params.push(q.action);
  }
  if (q.resource) {
    wheres.push("resource = ?");
    params.push(q.resource);
  }
  if (q.since) {
    wheres.push("timestamp >= ?");
    params.push(q.since);
  }
  if (q.until) {
    wheres.push("timestamp <= ?");
    params.push(q.until);
  }
  if (q.search) {
    wheres.push("(username LIKE ? OR resourceId LIKE ? OR ip LIKE ?)");
    const like = `%${q.search}%`;
    params.push(like, like, like);
  }

  const whereSql = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const orderSql = q.order === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
  const offset = Math.max(q.offset ?? 0, 0);

  const [rows] = await db.query<AuditRow[]>(
    `SELECT id, timestamp, companyId, userId, username, action, resource, resourceId,
            ip, userAgent, meta
     FROM audit_logs ${whereSql}
     ORDER BY timestamp ${orderSql}, id ${orderSql}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM audit_logs ${whereSql}`,
    params
  );
  const total = Number((countRows[0] as { n: number }).n);

  // Désérialiser meta pour le client
  for (const r of rows) {
    if (typeof r.meta === "string") {
      try {
        r.meta = JSON.parse(r.meta);
      } catch {
        /* laisse tel quel */
      }
    }
  }

  return { rows, total };
}
