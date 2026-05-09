// ═══════════════════════════════════════════════════════════════════════════
// Router CRUD générique — branche un MysqlRepository sur une route REST
//
// Convention :
//   GET    /            → findAll
//   GET    /count       → count
//   GET    /:id         → findById
//   POST   /            → create
//   PATCH  /:id         → update
//   DELETE /:id         → delete
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import type { MysqlRepository } from "../repository";

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

export function buildCrudRouter<T extends Record<string, unknown> & { id?: number }>(
  repo: MysqlRepository<T>
): Router {
  const router = Router();

  router.get(
    "/count",
    wrap(async (req, res) => {
      res.json({ count: await repo.count(req.query as Record<string, unknown>) });
    })
  );

  router.get(
    "/",
    wrap(async (req, res) => {
      const { offset, limit, orderBy, order, ...filter } = req.query as Record<string, unknown>;
      res.json(await repo.findAll(filter, { offset, limit, orderBy, order }));
    })
  );

  router.get(
    "/:id",
    wrap(async (req, res) => {
      const item = await repo.findById(String(req.params.id));
      if (!item) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      res.json(item);
    })
  );

  router.post(
    "/",
    wrap(async (req, res) => {
      try {
        const created = await repo.create(req.body ?? {});
        res.status(201).json(created);
      } catch (e) {
        res.status(400).json({ message: e instanceof Error ? e.message : "Bad request" });
      }
    })
  );

  router.patch(
    "/:id",
    wrap(async (req, res) => {
      const updated = await repo.update(String(req.params.id), req.body ?? {});
      if (!updated) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      res.json(updated);
    })
  );

  router.delete(
    "/:id",
    wrap(async (req, res) => {
      const ok = await repo.delete(String(req.params.id));
      if (!ok) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      res.status(204).end();
    })
  );

  return router;
}
