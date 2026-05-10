"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Audit logs — persistance des événements sensibles en DB
//
// Toutes les écritures sont best-effort (catch interne, jamais throw).
// Une erreur d'écriture audit ne doit JAMAIS casser la requête métier.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.audited = audited;
exports.writeAudit = writeAudit;
exports.listAuditLogs = listAuditLogs;
/**
 * Extrait IP + User-Agent + identité de la requête.
 * À appeler au début d'un handler pour avoir l'auteur.
 */
function audited(req, override) {
    return {
        userId: req.user?.sub ?? null,
        username: req.user?.username ?? "",
        ip: req.ip ?? "",
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
        ...override,
    };
}
/**
 * Écrit un événement audit en DB.
 * Best-effort : aucune exception ne remonte au handler appelant.
 */
async function writeAudit(db, entry) {
    try {
        await db.execute(`INSERT INTO audit_logs
         (userId, username, action, resource, resourceId, ip, userAgent, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            entry.userId,
            entry.username ?? "",
            entry.action,
            entry.resource ?? "",
            entry.resourceId ?? "",
            entry.ip ?? "",
            entry.userAgent ?? "",
            entry.meta ? JSON.stringify(entry.meta) : null,
        ]);
    }
    catch (e) {
        // Ne JAMAIS faire échouer la requête métier à cause d'un audit raté
        console.error("[audit] write failed:", e);
    }
}
async function listAuditLogs(db, q) {
    const wheres = [];
    const params = [];
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
    const [rows] = await db.query(`SELECT id, timestamp, userId, username, action, resource, resourceId,
            ip, userAgent, meta
     FROM audit_logs ${whereSql}
     ORDER BY timestamp ${orderSql}, id ${orderSql}
     LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countRows] = await db.query(`SELECT COUNT(*) AS n FROM audit_logs ${whereSql}`, params);
    const total = Number(countRows[0].n);
    // Désérialiser meta pour le client
    for (const r of rows) {
        if (typeof r.meta === "string") {
            try {
                r.meta = JSON.parse(r.meta);
            }
            catch {
                /* laisse tel quel */
            }
        }
    }
    return { rows, total };
}
//# sourceMappingURL=audit.js.map