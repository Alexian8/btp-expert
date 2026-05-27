"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Router CRUD générique — branche un MysqlRepository sur une route REST
//
// Convention :
//   GET    /            → findAll
//   GET    /count       → count
//   GET    /:id         → findById
//   POST   /            → create     (injecte createdBy depuis req.user.sub)
//   PATCH  /:id         → update     (injecte updatedBy depuis req.user.sub)
//   DELETE /:id         → delete
//
// SÉCURITÉ : `createdBy` / `updatedBy` ne sont JAMAIS lus depuis req.body.
// AUDIT : chaque create/update/delete est loggé en DB via writeAudit (best-effort).
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCrudRouter = buildCrudRouter;
const express_1 = require("express");
const audit_1 = require("../audit");
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
function buildCrudRouter(repo, opts = {}) {
    const router = (0, express_1.Router)();
    // Helper : construit le ScopeContext (auditUserId + tenantId) depuis le JWT.
    const ctxFromReq = (req) => ({
        auditUserId: req.user?.sub,
        tenantId: req.user?.companyId,
    });
    router.get("/count", wrap(async (req, res) => {
        res.json({
            count: await repo.count(req.query, ctxFromReq(req)),
        });
    }));
    router.get("/", wrap(async (req, res) => {
        const { offset, limit, orderBy, order, ...filter } = req.query;
        res.json(await repo.findAll(filter, { offset, limit, orderBy, order }, ctxFromReq(req)));
    }));
    router.get("/:id", wrap(async (req, res) => {
        const item = await repo.findById(String(req.params.id), ctxFromReq(req));
        if (!item) {
            res.status(404).json({ message: "Not found" });
            return;
        }
        res.json(item);
    }));
    router.post("/", wrap(async (req, res) => {
        try {
            let body = req.body ?? {};
            if (opts.hooks?.beforeCreate) {
                body = await opts.hooks.beforeCreate(body);
            }
            const created = await repo.create(body, ctxFromReq(req));
            res.status(201).json(created);
            // Audit (best-effort, après réponse client pour ne pas la retarder)
            if (opts.db && opts.resourceName) {
                const id = created.id;
                void (0, audit_1.writeAudit)(opts.db, {
                    ...(0, audit_1.audited)(req),
                    action: "create",
                    resource: opts.resourceName,
                    resourceId: id != null ? String(id) : "",
                    meta: extractKeyFields(body, opts.resourceName),
                });
            }
            // Hook after-create (best-effort) — reçoit le body enrichi par beforeCreate
            if (opts.hooks?.afterCreate) {
                const id = created.id;
                if (id != null) {
                    try {
                        await opts.hooks.afterCreate(String(id), body);
                    }
                    catch (err) {
                        console.warn(`[${opts.resourceName} afterCreate hook]`, err.message);
                    }
                }
            }
        }
        catch (e) {
            res.status(400).json({ message: e instanceof Error ? e.message : "Bad request" });
        }
    }));
    router.patch("/:id", wrap(async (req, res) => {
        const updated = await repo.update(String(req.params.id), req.body ?? {}, ctxFromReq(req));
        if (!updated) {
            res.status(404).json({ message: "Not found" });
            return;
        }
        res.json(updated);
        if (opts.db && opts.resourceName) {
            const changedFields = Object.keys(req.body ?? {}).filter((k) => k !== "id" && k !== "createdBy" && k !== "updatedBy" && k !== "companyId");
            void (0, audit_1.writeAudit)(opts.db, {
                ...(0, audit_1.audited)(req),
                action: "update",
                resource: opts.resourceName,
                resourceId: String(req.params.id),
                meta: { changedFields },
            });
        }
        if (opts.hooks?.afterUpdate) {
            try {
                await opts.hooks.afterUpdate(String(req.params.id), req.body);
            }
            catch (err) {
                console.warn(`[${opts.resourceName} afterUpdate hook]`, err.message);
            }
        }
    }));
    router.delete("/:id", wrap(async (req, res) => {
        const ctx = ctxFromReq(req);
        let snapshot = null;
        if (opts.db && opts.resourceName) {
            try {
                const before = await repo.findById(String(req.params.id), ctx);
                snapshot = before ? extractKeyFields(before, opts.resourceName) : null;
            }
            catch {
                /* best-effort */
            }
        }
        const ok = await repo.delete(String(req.params.id), ctx);
        if (!ok) {
            res.status(404).json({ message: "Not found" });
            return;
        }
        res.status(204).end();
        if (opts.db && opts.resourceName) {
            void (0, audit_1.writeAudit)(opts.db, {
                ...(0, audit_1.audited)(req),
                action: "delete",
                resource: opts.resourceName,
                resourceId: String(req.params.id),
                meta: snapshot ? { snapshot } : null,
            });
        }
        if (opts.hooks?.afterDelete) {
            try {
                await opts.hooks.afterDelete(String(req.params.id));
            }
            catch (err) {
                console.warn(`[${opts.resourceName} afterDelete hook]`, err.message);
            }
        }
    }));
    return router;
}
/**
 * Extrait les champs "lisibles" d'une ressource pour le log audit.
 * Évite de stocker des items JSON volumineux ou du PII détaillé.
 */
function extractKeyFields(data, resource) {
    if (!data || typeof data !== "object")
        return {};
    const d = data;
    const out = {};
    // Champs intéressants pour identifier la ressource dans les logs
    const ALLOW = {
        quotes: ["reference", "title", "status", "totalTTC", "clientId"],
        invoices: ["reference", "title", "status", "type", "totalTTC", "clientId"],
        clients: ["firstName", "lastName", "companyName", "email", "type"],
        suppliers: ["companyName", "email", "category"],
        chantiers: ["reference", "title", "status", "clientId"],
        expenses: ["label", "amount", "category"],
        expense_notes: ["label", "amount", "category"],
        subcontractors: ["companyName", "email"],
        agenda_events: ["title", "type", "startDate"],
        invoice_payments: ["invoiceId", "amount", "method"],
    };
    const keys = ALLOW[resource] ?? [];
    for (const k of keys) {
        if (k in d)
            out[k] = d[k];
    }
    return out;
}
