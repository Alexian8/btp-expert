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
// Le middleware d'auth (requireAuth) populate req.user à partir du JWT
// vérifié, et c'est cette valeur (req.user.sub) qui est passée au repo.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCrudRouter = buildCrudRouter;
const express_1 = require("express");
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
function buildCrudRouter(repo) {
    const router = (0, express_1.Router)();
    router.get("/count", wrap(async (req, res) => {
        res.json({ count: await repo.count(req.query) });
    }));
    router.get("/", wrap(async (req, res) => {
        const { offset, limit, orderBy, order, ...filter } = req.query;
        res.json(await repo.findAll(filter, { offset, limit, orderBy, order }));
    }));
    router.get("/:id", wrap(async (req, res) => {
        const item = await repo.findById(String(req.params.id));
        if (!item) {
            res.status(404).json({ message: "Not found" });
            return;
        }
        res.json(item);
    }));
    router.post("/", wrap(async (req, res) => {
        try {
            // SÉCURITÉ : on lit l'ID utilisateur depuis le JWT vérifié, JAMAIS du body
            const auditUserId = req.user?.sub;
            const created = await repo.create(req.body ?? {}, auditUserId);
            res.status(201).json(created);
        }
        catch (e) {
            res.status(400).json({ message: e instanceof Error ? e.message : "Bad request" });
        }
    }));
    router.patch("/:id", wrap(async (req, res) => {
        const auditUserId = req.user?.sub;
        const updated = await repo.update(String(req.params.id), req.body ?? {}, auditUserId);
        if (!updated) {
            res.status(404).json({ message: "Not found" });
            return;
        }
        res.json(updated);
    }));
    router.delete("/:id", wrap(async (req, res) => {
        const ok = await repo.delete(String(req.params.id));
        if (!ok) {
            res.status(404).json({ message: "Not found" });
            return;
        }
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=crud.js.map