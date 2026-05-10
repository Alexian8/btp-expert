// ═══════════════════════════════════════════════════════════════════════════
// Route admin /api/admin/logs — consultation des audit logs (admin only)
//
// GET /api/admin/logs
//   query params (tous optionnels) :
//     limit       (int, max 500, défaut 50)
//     offset      (int)
//     userId      (int)
//     action      (string : login_ok, create, update, ...)
//     resource    (string : quotes, invoices, users, ...)
//     since       (ISO date)
//     until       (ISO date)
//     search      (texte sur username/resourceId/ip)
//     order       ("asc" | "desc", défaut "desc")
//
// Response : { rows: AuditRow[], total: number }
//
// GET /api/admin/logs/actions  — liste les actions distinctes (pour filtre UI)
// GET /api/admin/logs/users    — liste compacte users (pour filtre UI)
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import type { DB, RowDataPacket } from "../db";
import { requireAuth } from "../auth";
import { requireRole } from "../rbac";
import { listAuditLogs, type AuditQuery } from "../audit";
import type { Config } from "../config";

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

export function buildAdminLogsRouter(db: DB, cfg: Config): Router {
  const router = Router();
  router.use(requireAuth(cfg), requireRole("admin"));

  router.get(
    "/",
    wrap(async (req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const filter: AuditQuery = {
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
        userId: q.userId ? Number(q.userId) : undefined,
        action: q.action || undefined,
        resource: q.resource || undefined,
        since: q.since || undefined,
        until: q.until || undefined,
        search: q.search || undefined,
        order: q.order === "asc" ? "asc" : "desc",
      };
      const result = await listAuditLogs(db, filter);
      res.json(result);
    })
  );

  // Liste des actions distinctes — pour peupler le filtre UI
  router.get(
    "/actions",
    wrap(async (_req, res) => {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT DISTINCT action FROM audit_logs ORDER BY action ASC"
      );
      res.json(rows.map((r) => (r as { action: string }).action));
    })
  );

  // Liste compacte users — pour peupler le filtre UI
  router.get(
    "/users",
    wrap(async (_req, res) => {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT id, username, firstName, lastName
         FROM users ORDER BY firstName, lastName, username`
      );
      res.json(rows);
    })
  );

  return router;
}
