"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdminLogsRouter = buildAdminLogsRouter;
const express_1 = require("express");
const auth_1 = require("../auth");
const rbac_1 = require("../rbac");
const audit_1 = require("../audit");
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
function buildAdminLogsRouter(db, cfg) {
    const router = (0, express_1.Router)();
    router.use((0, auth_1.requireAuth)(cfg), (0, rbac_1.requireRole)("admin"));
    router.get("/", wrap(async (req, res) => {
        const q = req.query;
        const filter = {
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
        const result = await (0, audit_1.listAuditLogs)(db, filter);
        res.json(result);
    }));
    // Liste des actions distinctes — pour peupler le filtre UI
    router.get("/actions", wrap(async (_req, res) => {
        const [rows] = await db.query("SELECT DISTINCT action FROM audit_logs ORDER BY action ASC");
        res.json(rows.map((r) => r.action));
    }));
    // Liste compacte users — pour peupler le filtre UI
    router.get("/users", wrap(async (_req, res) => {
        const [rows] = await db.query(`SELECT id, username, firstName, lastName
         FROM users ORDER BY firstName, lastName, username`);
        res.json(rows);
    }));
    return router;
}
//# sourceMappingURL=admin-logs.js.map