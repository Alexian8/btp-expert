// ═══════════════════════════════════════════════════════════════════════════
// Routes "Documents administratifs" — PV de réception, Attestations TVA,
// DC4 sous-traitance, RGE/MaPrimeRénov'.
//
// Expose une API CRUD HTTP pour que l'app web utilise les mêmes données que
// l'app Electron (qui passe par les handlers IPC). Toutes les routes sont
// scopées multi-tenant via la colonne companyId du repository.
//
// Endpoints :
//   GET    /api/admin-docs/stats              — compteurs agrégés
//   *      /api/admin-docs/receptions(/:id)   — CRUD PV de réception
//   GET    /api/admin-docs/receptions/:id/reserves
//   PUT    /api/admin-docs/receptions/:id/reserves
//   *      /api/admin-docs/tva(/:id)          — CRUD attestations TVA
//   *      /api/admin-docs/dc4(/:id)          — CRUD DC4
//   *      /api/admin-docs/rge(/:id)          — CRUD RGE
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { DB, RowDataPacket } from "../db";
import type { Config } from "../config";
import { MysqlRepository } from "../repository";
import { buildCrudRouter } from "./crud";
import { requireAuth } from "../auth";

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

// ─── Whitelists colonnes ───────────────────────────────────────────────────
const RECEPTION_COLS = [
  "reference",
  "chantierId",
  "clientId",
  "clientName",
  "receptionType",
  "receptionDate",
  "guaranteeStartDate",
  "location",
  "ownerPresent",
  "contractorPresent",
  "worksDescription",
  "observations",
  "retentionAmount",
  "retentionReleaseDate",
  "ownerSigned",
  "ownerSignedDate",
  "ownerSignatureDataUrl",
  "contractorSigned",
  "contractorSignedDate",
  "contractorSignatureDataUrl",
  "status",
  "vaultDocumentId",
];

const TVA_COLS = [
  "reference",
  "attestationType",
  "tvaRate",
  "chantierId",
  "clientId",
  "clientName",
  "logementType",
  "logementBuiltOver2Years",
  "logementYearOfConstruction",
  "logementAddress",
  "ownerCivilite",
  "ownerLastName",
  "ownerFirstName",
  "ownerEmail",
  "ownerPhone",
  "ownerSiret",
  "interventionType",
  "category",
  "worksDescription",
  "worksStartDate",
  "worksEndDate",
  "totalAmountHt",
  "invoiceReference",
  "clientCommitments",
  "signedDate",
  "signedLocation",
  "clientSignatureDataUrl",
  "status",
  "vaultDocumentId",
];

const DC4_COLS = [
  "reference",
  "acteSpecialNumber",
  "purchaseOrderId",
  "subcontractorId",
  "subcontractorName",
  "subcontractorSiret",
  "chantierId",
  "publicMarketReference",
  "publicMarketObject",
  "publicAuthorityName",
  "publicAuthorityAddress",
  "subcontractedWorksDescription",
  "subcontractedAmountHt",
  "subcontractedAmountTtc",
  "subcontractedDuration",
  "paymentMethod",
  "paymentDelay",
  "cautionType",
  "cautionRequired",
  "cautionReceived",
  "acceptanceDeadline",
  "signedDate",
  "signedLocation",
  "contractorSignatureDataUrl",
  "ownerSignatureDataUrl",
  "authoritySignatureDataUrl",
  "status",
  "vaultDocumentId",
];

const RGE_COLS = [
  "reference",
  "type",
  "chantierId",
  "clientId",
  "clientName",
  "rgeQualification",
  "rgeQualificationNumber",
  "rgeValidUntil",
  "worksDescription",
  "totalAmountTtc",
  "primeRenovExpected",
  "primeRenovActual",
  "notes",
  "vaultDocumentId",
];

// ─── Schéma : réserves d'un PV de réception ────────────────────────────────
const ReserveSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  description: z.string().max(2000).optional().default(""),
  location: z.string().max(255).optional().default(""),
  category: z.string().max(64).optional().default(""),
  toBeFixedBefore: z.string().max(32).optional().default(""),
  fixed: z.union([z.boolean(), z.number()]).optional().default(false),
  fixedDate: z.string().max(32).optional().default(""),
  sortOrder: z.number().int().optional().default(0),
});

export function buildAdminDocsRouter(db: DB, cfg: Config): Router {
  const router = Router();
  router.use(requireAuth(cfg, db));

  // ─── Repositories ───────────────────────────────────────────────────────
  const receptions = new MysqlRepository(db, "reception_reports", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "clientId", "status", "receptionType"],
    sortableColumns: ["receptionDate", "createdAt", "reference"],
    writableColumns: RECEPTION_COLS,
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  const tva = new MysqlRepository(db, "tva_attestations", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "clientId", "status", "tvaRate", "attestationType"],
    sortableColumns: ["signedDate", "createdAt", "reference"],
    writableColumns: TVA_COLS,
    jsonColumns: ["clientCommitments"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  const dc4 = new MysqlRepository(db, "dc4_declarations", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "subcontractorId", "status"],
    sortableColumns: ["signedDate", "createdAt", "reference"],
    writableColumns: DC4_COLS,
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  const rge = new MysqlRepository(db, "rge_documents", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "clientId", "type"],
    sortableColumns: ["createdAt", "reference"],
    writableColumns: RGE_COLS,
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  // ─── Stats agrégées (utilisées par les bandeaux KPI de l'UI) ───────────
  router.get(
    "/stats",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [[rcp]] = await db.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN receptionType IN ('avec_reserves','refusee') THEN 1 ELSE 0 END) AS withReserves
         FROM reception_reports WHERE companyId = ?`,
        [tenantId]
      );
      const [[tvaStats]] = await db.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN YEAR(COALESCE(NULLIF(signedDate,''), createdAt)) = YEAR(CURDATE())
                    THEN 1 ELSE 0 END) AS thisYear
         FROM tva_attestations WHERE companyId = ?`,
        [tenantId]
      );
      const [[dc4Stats]] = await db.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status IN ('brouillon','envoye') THEN 1 ELSE 0 END) AS pending
         FROM dc4_declarations WHERE companyId = ?`,
        [tenantId]
      );
      const [[rgeStats]] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM rge_documents WHERE companyId = ?`,
        [tenantId]
      );
      res.json({
        receptionsTotal: Number(rcp?.total ?? 0),
        receptionsWithReserves: Number(rcp?.withReserves ?? 0),
        tvaAttestationsTotal: Number(tvaStats?.total ?? 0),
        tvaAttestationsThisYear: Number(tvaStats?.thisYear ?? 0),
        dc4Total: Number(dc4Stats?.total ?? 0),
        dc4Pending: Number(dc4Stats?.pending ?? 0),
        rgeDocumentsTotal: Number(rgeStats?.total ?? 0),
      });
    })
  );

  // ─── Réserves d'un PV de réception ─────────────────────────────────────
  // Stockées dans une table séparée (1 PV → N réserves). On les expose comme
  // sous-ressource pour ne pas alourdir le payload du PV principal.
  router.get(
    "/receptions/:id/reserves",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      // Vérifie d'abord que le PV appartient bien au tenant courant.
      const [parentRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      if (parentRows.length === 0) {
        res.status(404).json({ message: "PV introuvable" });
        return;
      }
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC, id ASC",
        [req.params.id]
      );
      res.json(rows);
    })
  );

  router.put(
    "/receptions/:id/reserves",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [parentRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      if (parentRows.length === 0) {
        res.status(404).json({ message: "PV introuvable" });
        return;
      }
      const parsed = z.array(ReserveSchema).max(200).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide", issues: parsed.error.issues });
        return;
      }
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute("DELETE FROM reception_reserves WHERE reportId = ?", [req.params.id]);
        for (const [idx, r] of parsed.data.entries()) {
          await conn.execute(
            `INSERT INTO reception_reserves
               (id, reportId, description, location, category,
                toBeFixedBefore, fixed, fixedDate, sortOrder)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              r.id ?? `res_${Date.now()}_${idx}`,
              req.params.id,
              r.description,
              r.location,
              r.category,
              r.toBeFixedBefore,
              r.fixed ? 1 : 0,
              r.fixedDate,
              r.sortOrder,
            ]
          );
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC, id ASC",
        [req.params.id]
      );
      res.json(rows);
    })
  );

  // ─── CRUD générique pour les 4 entités ─────────────────────────────────
  router.use("/receptions", buildCrudRouter(receptions, { db, resourceName: "admin_receptions" }));
  router.use("/tva", buildCrudRouter(tva, { db, resourceName: "admin_tva" }));
  router.use("/dc4", buildCrudRouter(dc4, { db, resourceName: "admin_dc4" }));
  router.use("/rge", buildCrudRouter(rge, { db, resourceName: "admin_rge" }));

  return router;
}
