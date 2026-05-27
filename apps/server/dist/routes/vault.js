"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVaultRouter = buildVaultRouter;
const express_1 = __importStar(require("express"));
const zod_1 = require("zod");
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const auth_1 = require("../auth");
const audit_1 = require("../audit");
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
function genId() {
    return node_crypto_1.default.randomUUID();
}
/** Racine du stockage filesystem. Hors doc root pour ne pas être servie en HTTP. */
function storageRoot() {
    // ~/storage/btp/  (HOME = /home/mime9297/)
    const home = process.env.HOME ?? process.cwd();
    return node_path_1.default.join(home, "storage", "btp");
}
function tenantStorageDir(companyId) {
    return node_path_1.default.join(storageRoot(), String(companyId));
}
function ensureDir(p) {
    node_fs_1.default.mkdirSync(p, { recursive: true });
}
function storagePathFor(companyId, docId) {
    return node_path_1.default.join(tenantStorageDir(companyId), docId);
}
function sha256(buffer) {
    return node_crypto_1.default.createHash("sha256").update(buffer).digest("hex");
}
const FolderCreateSchema = zod_1.z.object({
    parentId: zod_1.z.string().max(64).optional().default(""),
    name: zod_1.z.string().min(1).max(255),
    iconKey: zod_1.z.string().max(32).optional().default("folder"),
    colorKey: zod_1.z.string().max(32).optional().default("default"),
    clientId: zod_1.z.string().max(64).optional().default(""),
    chantierId: zod_1.z.string().max(64).optional().default(""),
    description: zod_1.z.string().optional().default(""),
});
const FolderUpdateSchema = FolderCreateSchema.partial();
const DocUpdateSchema = zod_1.z.object({
    fileName: zod_1.z.string().max(255).optional(),
    description: zod_1.z.string().optional(),
    expirationDate: zod_1.z.string().optional(),
    folderId: zod_1.z.string().max(64).optional(),
    category: zod_1.z.string().max(64).optional(),
    chantierId: zod_1.z.string().max(64).optional(),
    clientId: zod_1.z.string().max(64).optional(),
    quoteId: zod_1.z.string().max(64).optional(),
    invoiceId: zod_1.z.string().max(64).optional(),
});
function buildVaultRouter(db, cfg) {
    const router = (0, express_1.Router)();
    router.use((0, auth_1.requireAuth)(cfg, db));
    // ─── Folders ──────────────────────────────────────────────────────────
    router.get("/folders", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM vault_folders WHERE companyId = ? ORDER BY parentId, name", [tenantId]);
        res.json(rows);
    }));
    router.post("/folders", wrap(async (req, res) => {
        const parsed = FolderCreateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide", errors: parsed.error.flatten().fieldErrors });
            return;
        }
        const tenantId = req.user?.companyId ?? 1;
        const id = genId();
        await db.execute(`INSERT INTO vault_folders
         (id, companyId, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        const [rows] = await db.query("SELECT * FROM vault_folders WHERE id = ? LIMIT 1", [id]);
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "create",
            resource: "vault_folders",
            resourceId: id,
            meta: { name: parsed.data.name },
        });
        res.status(201).json(rows[0]);
    }));
    router.patch("/folders/:id", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const parsed = FolderUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const sets = [];
        const values = [];
        for (const [k, v] of Object.entries(parsed.data)) {
            if (v === undefined)
                continue;
            sets.push(`\`${k}\` = ?`);
            values.push(v);
        }
        if (!sets.length) {
            res.status(400).json({ message: "Aucun champ à modifier" });
            return;
        }
        values.push(req.params.id, tenantId);
        await db.execute(`UPDATE vault_folders SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`, values);
        const [rows] = await db.query("SELECT * FROM vault_folders WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        if (!rows[0]) {
            res.status(404).json({ message: "Dossier introuvable" });
            return;
        }
        res.json(rows[0]);
    }));
    router.delete("/folders/:id", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        // Refuse si le folder contient des documents non supprimés
        const [docs] = await db.query("SELECT COUNT(*) AS n FROM vault_documents WHERE folderId = ? AND companyId = ? AND (deletedAt IS NULL OR deletedAt = '')", [req.params.id, tenantId]);
        const n = Number(docs[0].n);
        if (n > 0) {
            res
                .status(400)
                .json({ message: `Le dossier contient ${n} document(s). Videz-le d'abord.` });
            return;
        }
        const [result] = await db.execute("DELETE FROM vault_folders WHERE id = ? AND companyId = ?", [req.params.id, tenantId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: "Dossier introuvable" });
            return;
        }
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "delete",
            resource: "vault_folders",
            resourceId: String(req.params.id),
        });
        res.status(204).end();
    }));
    // ─── Documents ────────────────────────────────────────────────────────
    router.get("/documents", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const folderId = req.query.folderId;
        const chantierId = req.query.chantierId;
        const quoteId = req.query.quoteId;
        const invoiceId = req.query.invoiceId;
        const wheres = ["companyId = ?", "(deletedAt IS NULL OR deletedAt = '')"];
        const params = [tenantId];
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
        const [rows] = await db.query(`SELECT * FROM vault_documents WHERE ${wheres.join(" AND ")} ORDER BY createdAt DESC`, params);
        res.json(rows.map(hydrate));
    }));
    router.get("/trash", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM vault_documents WHERE companyId = ? AND deletedAt IS NOT NULL AND deletedAt <> '' ORDER BY deletedAt DESC", [tenantId]);
        res.json(rows.map(hydrate));
    }));
    // Upload : binaire brut dans le body (Content-Type = mime du fichier),
    // métadonnées en query string. Pas de multipart pour rester simple.
    router.post("/upload", express_1.default.raw({ type: "*/*", limit: "2gb" }), wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const buffer = req.body;
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            res.status(400).json({ message: "Body vide" });
            return;
        }
        const fileName = String(req.query.fileName ?? "document");
        const mimeType = String(req.query.mimeType ?? req.headers["content-type"] ?? "application/octet-stream");
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
            node_fs_1.default.writeFileSync(fullPath, buffer);
        }
        catch (e) {
            console.error("[vault] write file failed:", e);
            res.status(500).json({ message: "Erreur lors de l'écriture du fichier" });
            return;
        }
        const fileHash = sha256(buffer);
        const storagePath = node_path_1.default.relative(storageRoot(), fullPath); // ex: "1/abc-...uuid"
        await db.execute(`INSERT INTO vault_documents
         (id, companyId, folderId, fileName, originalFileName, storagePath,
          mimeType, fileSize, fileHash, description, category,
          chantierId, clientId, quoteId, invoiceId, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        const [rows] = await db.query("SELECT * FROM vault_documents WHERE id = ? LIMIT 1", [docId]);
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "create",
            resource: "vault_documents",
            resourceId: docId,
            meta: { fileName, fileSize: buffer.length, category, chantierId, quoteId, invoiceId },
        });
        res.status(201).json(hydrate(rows[0]));
    }));
    router.get("/documents/:id/download", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const doc = rows[0];
        if (!doc) {
            res.status(404).json({ message: "Document introuvable" });
            return;
        }
        const fullPath = node_path_1.default.join(storageRoot(), doc.storagePath);
        if (!node_fs_1.default.existsSync(fullPath)) {
            res.status(410).json({ message: "Fichier physique manquant" });
            return;
        }
        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
        res.setHeader("Content-Length", String(doc.fileSize));
        const stream = node_fs_1.default.createReadStream(fullPath);
        stream.pipe(res);
    }));
    // Inline preview (sans Content-Disposition attachment)
    router.get("/documents/:id/preview", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const doc = rows[0];
        if (!doc) {
            res.status(404).json({ message: "Document introuvable" });
            return;
        }
        const fullPath = node_path_1.default.join(storageRoot(), doc.storagePath);
        if (!node_fs_1.default.existsSync(fullPath)) {
            res.status(410).json({ message: "Fichier manquant" });
            return;
        }
        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.fileName)}"`);
        const stream = node_fs_1.default.createReadStream(fullPath);
        stream.pipe(res);
    }));
    router.patch("/documents/:id", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const parsed = DocUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const sets = [];
        const values = [];
        for (const [k, v] of Object.entries(parsed.data)) {
            if (v === undefined)
                continue;
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
        await db.execute(`UPDATE vault_documents SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`, values);
        const [rows] = await db.query("SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        if (!rows[0]) {
            res.status(404).json({ message: "Document introuvable" });
            return;
        }
        res.json(hydrate(rows[0]));
    }));
    // Move to trash (soft delete)
    router.post("/documents/:id/trash", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        await db.execute("UPDATE vault_documents SET deletedAt = ? WHERE id = ? AND companyId = ?", [new Date().toISOString(), req.params.id, tenantId]);
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "delete",
            resource: "vault_documents",
            resourceId: String(req.params.id),
        });
        res.status(204).end();
    }));
    // Restore from trash
    router.post("/documents/:id/restore", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        await db.execute("UPDATE vault_documents SET deletedAt = '' WHERE id = ? AND companyId = ?", [req.params.id, tenantId]);
        res.status(204).end();
    }));
    // Hard delete (suppression DB + filesystem)
    router.delete("/documents/:id", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM vault_documents WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const doc = rows[0];
        if (!doc) {
            res.status(404).json({ message: "Document introuvable" });
            return;
        }
        // Suppression du fichier (best-effort)
        try {
            const fullPath = node_path_1.default.join(storageRoot(), doc.storagePath);
            if (node_fs_1.default.existsSync(fullPath))
                node_fs_1.default.unlinkSync(fullPath);
        }
        catch (e) {
            console.warn("[vault] file unlink failed:", e);
        }
        await db.execute("DELETE FROM vault_documents WHERE id = ?", [req.params.id]);
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "user_deleted_permanent",
            resource: "vault_documents",
            resourceId: String(req.params.id),
            meta: { fileName: doc.fileName },
        });
        res.status(204).end();
    }));
    // ─── Stats ────────────────────────────────────────────────────────────
    router.get("/stats", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [docCount] = await db.query("SELECT COUNT(*) AS n, COALESCE(SUM(fileSize),0) AS s FROM vault_documents WHERE companyId = ? AND (deletedAt IS NULL OR deletedAt = '')", [tenantId]);
        const [folderCount] = await db.query("SELECT COUNT(*) AS n FROM vault_folders WHERE companyId = ?", [tenantId]);
        const [trashCount] = await db.query("SELECT COUNT(*) AS n FROM vault_documents WHERE companyId = ? AND deletedAt IS NOT NULL AND deletedAt <> ''", [tenantId]);
        const [expCount] = await db.query(`SELECT COUNT(*) AS n FROM vault_documents
         WHERE companyId = ? AND (deletedAt IS NULL OR deletedAt = '')
         AND expirationDate <> ''
         AND expirationDate >= CURDATE()
         AND expirationDate <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`, [tenantId]);
        res.json({
            totalDocuments: Number(docCount[0].n),
            totalSize: Number(docCount[0].s),
            totalFolders: Number(folderCount[0].n),
            trashCount: Number(trashCount[0].n),
            expiringIn30Days: Number(expCount[0].n),
        });
    }));
    // ─── Tags ─────────────────────────────────────────────────────────────
    router.get("/tags", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM vault_tags WHERE companyId = ? ORDER BY name", [tenantId]);
        res.json(rows);
    }));
    return router;
}
function hydrate(row) {
    // Petite hydratation : ajoute un champ tags vide pour compat avec
    // VaultDocumentWithTags. Les tags réels seront fetchés à part.
    return { ...row, tags: [], isEncrypted: false, iv: "" };
}
