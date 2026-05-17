// ═══════════════════════════════════════════════════════════════════════════
// Routes Vault (coffre-fort) — gestion documents + dossiers
//
// Stockage :
//   • Métadonnées : MySQL (vault_folders, vault_documents, vault_tags)
//   • Fichiers : filesystem ~/storage/btp/<companyId>/<docId>
//
// Multi-tenant : toutes les queries scopées par req.user.companyId.
// Upload : raw binary body (pas de multipart, plus simple) avec
//   query params fileName, mimeType, folderId, etc.
// ═══════════════════════════════════════════════════════════════════════════

import express, {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import type { DB, RowDataPacket, ResultSetHeader } from "../db";
import { requireAuth } from "../auth";
import { writeAudit, audited } from "../audit";
import type { Config } from "../config";

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

function genId(): string {
  return crypto.randomUUID();
}

/** Racine du stockage filesystem. Hors doc root pour ne pas être servie en HTTP. */
function storageRoot(): string {
  // ~/storage/btp/  (HOME = /home/mime9297/)
  const home = process.env.HOME ?? process.cwd();
  return path.join(home, "storage", "btp");
}

function tenantStorageDir(companyId: number): string {
  return path.join(storageRoot(), String(companyId));
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function storagePathFor(companyId: number, docId: string): string {
  return path.join(tenantStorageDir(companyId), docId);
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

interface FolderRow extends RowDataPacket {
  id: string;
  parentId: string;
  name: string;
  iconKey: string;
  colorKey: string;
  clientId: string;
  chantierId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface DocRow extends RowDataPacket {
  id: string;
  folderId: string;
  fileName: string;
  originalFileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  extractedText: string;
  description: string;
  expirationDate: string;
  deletedAt: string;
  category: string;
  chantierId: string;
  clientId: string;
  quoteId: string;
  invoiceId: string;
  createdAt: string;
  updatedAt: string;
}

const FolderCreateSchema = z.object({
  parentId: z.string().max(64).optional().default(""),
  name: z.string().min(1).max(255),
  iconKey: z.string().max(32).optional().default("folder"),
  colorKey: z.string().max(32).optional().default("default"),
  clientId: z.string().max(64).optional().default(""),
  chantierId: z.string().max(64).optional().default(""),
  description: z.string().optional().default(""),
});

const FolderUpdateSchema = FolderCreateSchema.partial();

const DocUpdateSchema = z.object({
  fileName: z.string().max(255).optional(),
  description: z.string().optional(),
  expirationDate: z.string().optional(),
  folderId: z.string().max(64).optional(),
  category: z.string().max(64).optional(),
  chantierId: z.string().max(64).optional(),
  clientId: z.string().max(64).optional(),
  quoteId: z.string().max(64).optional(),
  invoiceId: z.string().max(64).optional(),
});

export function buildVaultRouter(db: DB, cfg: Config): Router {
  const router = Router();
  router.use(requireAuth(cfg, db));

  // ─── Folders ──────────────────────────────────────────────────────────
  router.get(
    "/folders",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<FolderRow[]>(
        "SELECT * FROM vault_folders WHERE companyId = ? ORDER BY parentId, name",
        [tenantId]
      );
      res.json(rows);
    })
  );

  router.post(
    "/folders",
    wrap(async (req, res) => {
      const parsed = FolderCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide", errors: parsed.error.flatten().fieldErrors });
        return;
      }
      const tenantId = req.user?.companyId ?? 1;
      const id = genId();
      await db.execute(
        `INSERT INTO vault_folders
         (id, companyId, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tenantId,
          parsed.data.parentId,
          parsed.data.name,
          parsed.data.iconKey,
          parsed.data.colorKey,
          parsed.data.clientId,
          parsed.data.chantierId,
          parsed.data.description,
          req.user?.sub ?? null,
        ]
      );
      const [rows] = await db.query<FolderRow[]>(
        "SELECT * FROM vault_folders WHERE id = ? LIMIT 1",
        [id]
      );
      void writeAudit(db, {
        ...audited(req),
        action: "create",
        resource: "vault_folders",
        resourceId: id,
        meta: { name: parsed.data.name },
      });
      res.status(201).json(rows[0]);
    })
  );

  router.patch(
    "/folders/:id",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const parsed = FolderUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide" });
        return;
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const [k, v] of Object.entries(parsed.data)) {
        if (v === undefined) continue;
        sets.push(`\`${k}\` = ?`);
        values.push(v);
      }
      if (!sets.length) {
        res.status(400).json({ message: "Aucun champ à modifier" });
        return;
      }
      values.push(req.params.id, tenantId);
      await db.execute(
        `UPDATE vault_folders SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`,
        values as never[]
      );
      const [rows] = await db.query<FolderRow[]>(
        "SELECT * FROM vault_folders WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Dossier introuvable" });
        return;
      }
      res.json(rows[0]);
    })
  );

  router.delete(
    "/folders/:id",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      // Refuse si le folder contient des documents non supprimés
      const [docs] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM vault_documents WHERE folderId = ? AND companyId = ? AND (deletedAt IS NULL OR deletedAt = '')",
        [req.params.id, tenantId]
      );
      const n = Number((docs[0] as { n: number }).n);
      if (n > 0) {
        res
          .status(400)
          .json({ message: `Le dossier contient ${n} document(s). Videz-le d'abord.` });
        return;
      }
      const [result] = await db.execute<ResultSetHeader>(
        "DELETE FROM vault_folders WHERE id = ? AND companyId = ?",
        [req.params.id, tenantId]
      );
      if (result.affectedRows === 0) {
        res.status(404).json({ message: "Dossier introuvable" });
        return;
      }
      void writeAudit(db, {
        ...audited(req),
        action: "delete",
        resource: "vault_folders",
        resourceId: String(req.params.id),
      });
      res.status(204).end();
    })
  );

  // ─── Documents ────────────────────────────────────────────────────────
  router.get(
    "/documents",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const folderId = req.query.folderId as string | undefined;
      const chantierId = req.query.chantierId as string | undefined;
      const quoteId = req.query.quoteId as string | undefined;
      const invoiceId = req.query.invoiceId as string | undefined;

      const wheres = ["companyId = ?", "(deletedAt IS NULL OR deletedAt = '')"];
      const params: unknown[] = [tenantId];
      if (folderId !== undefined) {
        wheres.push("folderId = ?");
        params.push(folderId);
      }
      if (chantierId) {
        wheres.push("chantierId = ?");
        params.push(chantierId);
      }
      if (quoteId) {
        wheres.push("quoteId = ?");
        params.push(quoteId);
      }
      if (invoiceId) {
        wheres.push("invoiceId = ?");
        params.push(invoiceId);
      }

      const [rows] = await db.query<DocRow[]>(
        `SELECT * FROM vault_documents WHERE ${wheres.join(" AND ")} ORDER BY createdAt DESC`,
        params
      );
      res.json(rows.map(hydrate));
    })
  );

  router.get(
    "/trash",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<DocRow[]>(
        "SELECT * FROM vault_documents WHERE companyId = ? AND deletedAt IS NOT NULL AND deletedAt <> '' ORDER BY deletedAt DESC",
        [tenantId]
      );
      res.json(rows.map(hydrate));
    })
  );

  // Upload : binaire brut dans le body (Content-Type = mime du fichier),
  // métadonnées en query string. Pas de multipart pour rester simple.
  router.post(
    "/upload",
    express.raw({ type: "*/*", limit: "2gb" }),
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ message: "Body vide" });
        return;
      }
      const fileName = String(req.query.fileName ?? "document");
      const mimeType =
        String(req.query.mimeType ?? req.headers["content-type"] ?? "application/octet-stream");
      const folderId = String(req.query.folderId ?? "");
      const description = String(req.query.description ?? "");
      const category = String(req.query.category ?? "upload");
      const chantierId = String(req.query.chantierId ?? "");
      const clientId = String(req.query.clientId ?? "");
      const quoteId = String(req.query.quoteId ?? "");
      const invoiceId = String(req.query.invoiceId ?? "");

      const docId = genId();
      const dir = tenantStorageDir(tenantId);
      ensureDir(dir);
      const fullPath = storagePathFor(tenantId, docId);
      try {
        fs.writeFileSync(fullPath, buffer);
      } catch (e) {
        console.error("[vault] write file failed:", e);
        res.status(500).json({ message: "Erreur lors de l'écriture du fichier" });
        return;
      }

      const fileHash = sha256(buffer);
      const storagePath = path.relative(storageRoot(), fullPath); // ex: "1/abc-...uuid"

      await db.execute(
        `INSERT INTO vault_documents
         (id, companyId, folderId, fileName, originalFileName, storagePath,
          mimeType, fileSize, fileHash, description, category,
          chantierId, clientId, quoteId, invoiceId, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          docId,
          tenantId,
          folderId,
          fileName,
          fileName,
          storagePath,
          mimeType,
          buffer.length,
          fileHash,
          description,
          category,
          chantierId,
          clientId,
          quoteId,
          invoiceId,
          req.user?.sub ?? null,
          req.user?.sub ?? null,
        ]
      );
      const [rows] = await db.query<DocRow[]>(
        "SELECT * FROM vault_documents WHERE id = ? LIMIT 1",
        [docId]
      );

      void writeAudit(db, {
        ...audited(req),
        action: "create",
        resource: "vault_documents",
        resourceId: docId,
        meta: { fileName, fileSize: buffer.length, category, chantierId, quoteId, invoiceId },
      });

      res.status(201).json(hydrate(rows[0]!));
    })
  );

  router.get(
    "/documents/:id/download",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<DocRow[]>(
        "SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const doc = rows[0];
      if (!doc) {
        res.status(404).json({ message: "Document introuvable" });
        return;
      }
      const fullPath = path.join(storageRoot(), doc.storagePath);
      if (!fs.existsSync(fullPath)) {
        res.status(410).json({ message: "Fichier physique manquant" });
        return;
      }
      res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(doc.fileName)}"`
      );
      res.setHeader("Content-Length", String(doc.fileSize));
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    })
  );

  // Inline preview (sans Content-Disposition attachment)
  router.get(
    "/documents/:id/preview",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<DocRow[]>(
        "SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const doc = rows[0];
      if (!doc) {
        res.status(404).json({ message: "Document introuvable" });
        return;
      }
      const fullPath = path.join(storageRoot(), doc.storagePath);
      if (!fs.existsSync(fullPath)) {
        res.status(410).json({ message: "Fichier manquant" });
        return;
      }
      res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.fileName)}"`);
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    })
  );

  router.patch(
    "/documents/:id",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const parsed = DocUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide" });
        return;
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const [k, v] of Object.entries(parsed.data)) {
        if (v === undefined) continue;
        sets.push(`\`${k}\` = ?`);
        values.push(v);
      }
      if (req.user?.sub) {
        sets.push("updatedBy = ?");
        values.push(req.user.sub);
      }
      if (!sets.length) {
        res.status(400).json({ message: "Aucun champ à modifier" });
        return;
      }
      values.push(req.params.id, tenantId);
      await db.execute(
        `UPDATE vault_documents SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`,
        values as never[]
      );
      const [rows] = await db.query<DocRow[]>(
        "SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Document introuvable" });
        return;
      }
      res.json(hydrate(rows[0]));
    })
  );

  // Move to trash (soft delete)
  router.post(
    "/documents/:id/trash",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      await db.execute(
        "UPDATE vault_documents SET deletedAt = ? WHERE id = ? AND companyId = ?",
        [new Date().toISOString(), req.params.id, tenantId]
      );
      void writeAudit(db, {
        ...audited(req),
        action: "delete",
        resource: "vault_documents",
        resourceId: String(req.params.id),
      });
      res.status(204).end();
    })
  );

  // Restore from trash
  router.post(
    "/documents/:id/restore",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      await db.execute(
        "UPDATE vault_documents SET deletedAt = '' WHERE id = ? AND companyId = ?",
        [req.params.id, tenantId]
      );
      res.status(204).end();
    })
  );

  // Hard delete (suppression DB + filesystem)
  router.delete(
    "/documents/:id",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<DocRow[]>(
        "SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const doc = rows[0];
      if (!doc) {
        res.status(404).json({ message: "Document introuvable" });
        return;
      }
      // Suppression du fichier (best-effort)
      try {
        const fullPath = path.join(storageRoot(), doc.storagePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (e) {
        console.warn("[vault] file unlink failed:", e);
      }
      await db.execute("DELETE FROM vault_documents WHERE id = ?", [req.params.id]);
      void writeAudit(db, {
        ...audited(req),
        action: "user_deleted_permanent",
        resource: "vault_documents",
        resourceId: String(req.params.id),
        meta: { fileName: doc.fileName },
      });
      res.status(204).end();
    })
  );

  // ─── Stats ────────────────────────────────────────────────────────────
  router.get(
    "/stats",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [docCount] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n, COALESCE(SUM(fileSize),0) AS s FROM vault_documents WHERE companyId = ? AND (deletedAt IS NULL OR deletedAt = '')",
        [tenantId]
      );
      const [folderCount] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM vault_folders WHERE companyId = ?",
        [tenantId]
      );
      const [trashCount] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM vault_documents WHERE companyId = ? AND deletedAt IS NOT NULL AND deletedAt <> ''",
        [tenantId]
      );
      const [expCount] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM vault_documents
         WHERE companyId = ? AND (deletedAt IS NULL OR deletedAt = '')
         AND expirationDate <> ''
         AND expirationDate >= CURDATE()
         AND expirationDate <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
        [tenantId]
      );
      res.json({
        totalDocuments: Number((docCount[0] as { n: number }).n),
        totalSize: Number((docCount[0] as { s: number }).s),
        totalFolders: Number((folderCount[0] as { n: number }).n),
        trashCount: Number((trashCount[0] as { n: number }).n),
        expiringIn30Days: Number((expCount[0] as { n: number }).n),
      });
    })
  );

  // ─── Tags ─────────────────────────────────────────────────────────────
  router.get(
    "/tags",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM vault_tags WHERE companyId = ? ORDER BY name",
        [tenantId]
      );
      res.json(rows);
    })
  );

  return router;
}

function hydrate(row: DocRow & Record<string, unknown>): Record<string, unknown> {
  // Petite hydratation : ajoute un champ tags vide pour compat avec
  // VaultDocumentWithTags. Les tags réels seront fetchés à part.
  return { ...row, tags: [], isEncrypted: false, iv: "" };
}
