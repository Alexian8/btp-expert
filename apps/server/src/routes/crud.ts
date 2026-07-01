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

import { Router, type Request, type Response, type NextFunction } from "express";
import type { MysqlRepository } from "../repository";
import type { DB } from "../db";
import { writeAudit, audited } from "../audit";

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

export interface CrudRouterOptions {
  /** Pool MySQL — requis si on veut activer l'audit log. */
  db?: DB;
  /** Nom de la ressource pour les logs (ex: "quotes", "invoices"). */
  resourceName?: string;
  /** Hooks optionnels appelés autour de chaque opération. */
  hooks?: {
    /** Appelé avant create — peut enrichir le body (ex: générer une référence). */
    beforeCreate?: (body: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
    afterCreate?: (id: string, body: unknown) => Promise<void> | void;
    afterUpdate?: (id: string, body: unknown) => Promise<void> | void;
    afterDelete?: (id: string) => Promise<void> | void;
  };
}

export function buildCrudRouter<T extends Record<string, unknown> & { id?: number }>(
  repo: MysqlRepository<T>,
  opts: CrudRouterOptions = {}
): Router {
  const router = Router();

  // Helper : construit le ScopeContext (auditUserId + tenantId) depuis le JWT.
  // Le rôle `worker` est restreint à ses propres lignes (createdBy) CÔTÉ
  // SERVEUR — le filtre `?createdBy=ME` du shim web n'est qu'un confort d'UI.
  const ctxFromReq = (req: Request) => ({
    auditUserId: req.user?.sub,
    tenantId: req.user?.companyId,
    restrictToCreatedBy: req.user?.role === "worker" ? req.user.sub : undefined,
  });

  router.get(
    "/count",
    wrap(async (req, res) => {
      res.json({
        count: await repo.count(req.query as Record<string, unknown>, ctxFromReq(req)),
      });
    })
  );

  router.get(
    "/",
    wrap(async (req, res) => {
      const { offset, limit, orderBy, order, ...filter } = req.query as Record<string, unknown>;
      res.json(
        await repo.findAll(filter, { offset, limit, orderBy, order }, ctxFromReq(req))
      );
    })
  );

  router.get(
    "/:id",
    wrap(async (req, res) => {
      const item = await repo.findById(String(req.params.id), ctxFromReq(req));
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
        let body: Record<string, unknown> = (req.body as Record<string, unknown>) ?? {};
        if (opts.hooks?.beforeCreate) {
          body = await opts.hooks.beforeCreate(body);
        }
        const created = await repo.create(body, ctxFromReq(req));
        res.status(201).json(created);

        // Audit (best-effort, après réponse client pour ne pas la retarder)
        if (opts.db && opts.resourceName) {
          const id = (created as { id?: unknown }).id;
          void writeAudit(opts.db, {
            ...audited(req),
            action: "create",
            resource: opts.resourceName,
            resourceId: id != null ? String(id) : "",
            meta: extractKeyFields(body, opts.resourceName),
          });
        }

        // Hook after-create (best-effort) — reçoit le body enrichi par beforeCreate
        if (opts.hooks?.afterCreate) {
          const id = (created as { id?: unknown }).id;
          if (id != null) {
            try {
              await opts.hooks.afterCreate(String(id), body);
            } catch (err) {
              console.warn(`[${opts.resourceName} afterCreate hook]`, (err as Error).message);
            }
          }
        }
      } catch (e) {
        res.status(400).json({ message: e instanceof Error ? e.message : "Bad request" });
      }
    })
  );

  router.patch(
    "/:id",
    wrap(async (req, res) => {
      const updated = await repo.update(String(req.params.id), req.body ?? {}, ctxFromReq(req));
      if (!updated) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      res.json(updated);

      if (opts.db && opts.resourceName) {
        const changedFields = Object.keys(req.body ?? {}).filter(
          (k) => k !== "id" && k !== "createdBy" && k !== "updatedBy" && k !== "companyId"
        );
        void writeAudit(opts.db, {
          ...audited(req),
          action: "update",
          resource: opts.resourceName,
          resourceId: String(req.params.id),
          meta: { changedFields },
        });
      }

      if (opts.hooks?.afterUpdate) {
        try {
          await opts.hooks.afterUpdate(String(req.params.id), req.body);
        } catch (err) {
          console.warn(`[${opts.resourceName} afterUpdate hook]`, (err as Error).message);
        }
      }
    })
  );

  router.delete(
    "/:id",
    wrap(async (req, res) => {
      const ctx = ctxFromReq(req);
      let snapshot: Record<string, unknown> | null = null;
      if (opts.db && opts.resourceName) {
        try {
          const before = await repo.findById(String(req.params.id), ctx);
          snapshot = before ? extractKeyFields(before, opts.resourceName) : null;
        } catch {
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
        void writeAudit(opts.db, {
          ...audited(req),
          action: "delete",
          resource: opts.resourceName,
          resourceId: String(req.params.id),
          meta: snapshot ? { snapshot } : null,
        });
      }

      if (opts.hooks?.afterDelete) {
        try {
          await opts.hooks.afterDelete(String(req.params.id));
        } catch (err) {
          console.warn(`[${opts.resourceName} afterDelete hook]`, (err as Error).message);
        }
      }
    })
  );

  return router;
}

/**
 * Extrait les champs "lisibles" d'une ressource pour le log audit.
 * Évite de stocker des items JSON volumineux ou du PII détaillé.
 */
function extractKeyFields(
  data: unknown,
  resource: string
): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  // Champs intéressants pour identifier la ressource dans les logs
  const ALLOW: Record<string, string[]> = {
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
    if (k in d) out[k] = d[k];
  }
  return out;
}
