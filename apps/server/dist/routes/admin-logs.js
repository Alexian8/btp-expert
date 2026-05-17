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
    router.use((0, auth_1.requireAuth)(cfg, db), (0, rbac_1.requireRole)("admin"));
    /**
     * Détermine le scope tenant à appliquer en lecture :
     *   - super_admin → undefined (= tous les tenants)
     *   - admin       → son propre companyId (isolation stricte)
     *
     * Si pour une raison quelconque un admin n'a pas de companyId dans son JWT,
     * on refuse l'accès plutôt que d'exposer tous les logs (fail-closed).
     */
    function tenantScope(req) {
        if (req.user?.role === "super_admin")
            return undefined;
        const cid = req.user?.companyId;
        if (typeof cid !== "number" || cid <= 0)
            return "deny";
        return cid;
    }
    router.get("/", wrap(async (req, res) => {
        const scope = tenantScope(req);
        if (scope === "deny") {
            res.status(403).json({ message: "Tenant inconnu" });
            return;
        }
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
            companyId: scope, // undefined pour super_admin, number pour admin
        };
        const result = await (0, audit_1.listAuditLogs)(db, filter);
        res.json(result);
    }));
    // Liste des actions distinctes — pour peupler le filtre UI (scopée tenant)
    router.get("/actions", wrap(async (req, res) => {
        const scope = tenantScope(req);
        if (scope === "deny") {
            res.status(403).json({ message: "Tenant inconnu" });
            return;
        }
        const sql = scope === undefined
            ? "SELECT DISTINCT action FROM audit_logs ORDER BY action ASC"
            : "SELECT DISTINCT action FROM audit_logs WHERE companyId = ? ORDER BY action ASC";
        const [rows] = await db.query(sql, scope === undefined ? [] : [scope]);
        res.json(rows.map((r) => r.action));
    }));
    // Liste compacte users — pour peupler le filtre UI (scopée tenant)
    router.get("/users", wrap(async (req, res) => {
        const scope = tenantScope(req);
        if (scope === "deny") {
            res.status(403).json({ message: "Tenant inconnu" });
            return;
        }
        const sql = scope === undefined
            ? `SELECT id, username, firstName, lastName
             FROM users ORDER BY firstName, lastName, username`
            : `SELECT id, username, firstName, lastName
             FROM users WHERE companyId = ? ORDER BY firstName, lastName, username`;
        const [rows] = await db.query(sql, scope === undefined ? [] : [scope]);
        res.json(rows);
    }));
    return router;
}
