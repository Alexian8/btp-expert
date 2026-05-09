// ═══════════════════════════════════════════════════════════════════════════
// vault.js — Module Coffre-fort (Session 11)
//
// Gère :
//   - Chiffrement AES-256-CBC des fichiers uploadés
//   - Stockage dans userData/vault/
//   - Indexation FTS5 pour recherche
//   - Extraction texte PDF via pdf-parse (avec fallback safe)
//   - 18 handlers IPC (folders, documents, tags, search, trash)
// ═══════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ipcMain, app, dialog, shell } = require("electron");

const VAULT_TRASH_RETENTION_DAYS = 30;
const ALGO = "aes-256-cbc";

// ─── Utilitaires ─────────────────────────────────────────────────────────
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ─── Dérivation de la clé de chiffrement ─────────────────────────────────
// On dérive une clé à partir du chemin userData (= installation locale).
// → Si on backup la DB et qu'on la restore sur un autre PC, les fichiers
//   restent déchiffrables tant qu'on copie aussi le dossier vault/.
// → Sécurité : un attaquant ayant accès au PC peut tout déchiffrer (c'est
//   le compromis "AES simple" choisi par l'utilisateur).
function deriveKey(userDataPath) {
  // Sel statique mais propre à BatiDesk
  const salt = Buffer.from("batidesk-vault-v1-salt", "utf8");
  return crypto.scryptSync(userDataPath, salt, 32);
}

// ─── Chiffrement / Déchiffrement de fichier ──────────────────────────────
function encryptFile(srcPath, destPath, key) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);

    const inStream = fs.createReadStream(srcPath);
    const outStream = fs.createWriteStream(destPath);
    const hash = crypto.createHash("sha256");
    let totalSize = 0;

    inStream.on("data", (chunk) => {
      hash.update(chunk);
      totalSize += chunk.length;
    });

    inStream
      .pipe(cipher)
      .pipe(outStream)
      .on("finish", () => resolve({ iv: iv.toString("base64"), fileHash: hash.digest("hex"), fileSize: totalSize }))
      .on("error", reject);
    inStream.on("error", reject);
  });
}

function decryptFile(srcPath, destPath, key, ivBase64) {
  return new Promise((resolve, reject) => {
    const iv = Buffer.from(ivBase64, "base64");
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    fs.createReadStream(srcPath)
      .pipe(decipher)
      .pipe(fs.createWriteStream(destPath))
      .on("finish", resolve)
      .on("error", reject);
  });
}

// ─── Extraction texte PDF (pour FTS) ─────────────────────────────────────
async function extractPdfText(pdfPath) {
  try {
    // Lazy import : pdf-parse peut ne pas être installé, on est tolérant
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(buffer);
    return (data.text || "").slice(0, 500000); // cap à 500k chars
  } catch (e) {
    console.warn("[vault] extractPdfText failed (skipping):", e.message);
    return "";
  }
}

// ─── Mappers DB → JS ─────────────────────────────────────────────────────
function rowToFolder(row) {
  if (!row) return null;
  return { ...row };
}

function rowToDocument(row) {
  if (!row) return null;
  return {
    ...row,
    isEncrypted: !!row.isEncrypted,
    fileSize: Number(row.fileSize || 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Initialisation du module
// ═══════════════════════════════════════════════════════════════════════════
function init({ db, userDataPath, mainWindow }) {
  const vaultDir = path.join(userDataPath, "vault");
  if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

  const trashDir = path.join(vaultDir, ".trash");
  if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

  const tempDir = path.join(userDataPath, "vault-temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const key = deriveKey(userDataPath);

  // ─── Initialiser les dossiers racines par défaut s'ils n'existent pas ───
  function ensureRootFolders() {
    const count = db.prepare("SELECT COUNT(*) as n FROM vault_folders WHERE parentId = ''").get().n;
    if (count === 0) {
      const now = nowIso();
      const folders = [
        { id: "root_company",  name: "Entreprise",  iconKey: "shield",   colorKey: "blue"    },
        { id: "root_clients",  name: "Clients",     iconKey: "users",    colorKey: "violet"  },
        { id: "root_chantiers", name: "Chantiers",  iconKey: "hammer",   colorKey: "amber"   },
      ];
      for (const f of folders) {
        db.prepare(`
          INSERT INTO vault_folders (id, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdAt, updatedAt)
          VALUES (?, '', ?, ?, ?, '', '', '', ?, ?)
        `).run(f.id, f.name, f.iconKey, f.colorKey, now, now);
      }
      console.log("[vault] Dossiers racines créés");
    }
  }
  ensureRootFolders();

  // ─── Cleanup auto de la corbeille (purge des fichiers > 30 jours) ───
  function cleanupTrash() {
    const cutoff = new Date(Date.now() - VAULT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const expired = db.prepare("SELECT * FROM vault_documents WHERE deletedAt != '' AND deletedAt < ?").all(cutoff);
    for (const doc of expired) {
      const fullPath = path.join(vaultDir, doc.storagePath);
      try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch {}
      db.prepare("DELETE FROM vault_documents WHERE id = ?").run(doc.id);
    }
    if (expired.length > 0) console.log(`[vault] ${expired.length} document(s) purgé(s) de la corbeille`);
  }
  cleanupTrash();
  setInterval(cleanupTrash, 6 * 60 * 60 * 1000); // toutes les 6h

  // ─── Helper : reconstruire l'index FTS pour un document ───
  function reindexDocument(doc) {
    if (!doc) return;
    // Récup les tags
    const tags = db.prepare(`
      SELECT t.name FROM vault_tags t
      INNER JOIN vault_document_tags dt ON dt.tagId = t.id
      WHERE dt.documentId = ?
    `).all(doc.id);
    const tagsStr = tags.map(t => t.name).join(" ");

    // Supprimer l'entrée FTS existante
    db.prepare("DELETE FROM vault_search WHERE documentId = ?").run(doc.id);

    // Recréer (uniquement si pas dans la corbeille)
    if (!doc.deletedAt) {
      db.prepare(`
        INSERT INTO vault_search (documentId, fileName, description, extractedText, tags)
        VALUES (?, ?, ?, ?, ?)
      `).run(doc.id, doc.fileName, doc.description || "", doc.extractedText || "", tagsStr);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HANDLERS IPC
  // ═════════════════════════════════════════════════════════════════════════

  // ─── Dossiers ──────────────────────────────────────────────────────────
  ipcMain.handle("vault:listFolders", () => {
    try {
      return db.prepare("SELECT * FROM vault_folders ORDER BY parentId, name").all().map(rowToFolder);
    } catch (e) {
      console.error("[vault:listFolders]", e);
      return [];
    }
  });

  ipcMain.handle("vault:createFolder", (_e, data) => {
    try {
      const id = generateId("fold");
      const now = nowIso();
      db.prepare(`
        INSERT INTO vault_folders (id, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, data.parentId || "", data.name, data.iconKey || "folder", data.colorKey || "default",
        data.clientId || "", data.chantierId || "", data.description || "", now, now
      );
      return { success: true, id };
    } catch (e) {
      console.error("[vault:createFolder]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:updateFolder", (_e, { id, data }) => {
    try {
      const allowedKeys = ["name", "iconKey", "colorKey", "description", "parentId"];
      const keys = Object.keys(data).filter(k => allowedKeys.includes(k));
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) payload[k] = data[k];
      db.prepare(`UPDATE vault_folders SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      return { success: true };
    } catch (e) {
      console.error("[vault:updateFolder]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:deleteFolder", (_e, folderId) => {
    try {
      // Empêcher la suppression des racines
      if (folderId === "root_company" || folderId === "root_clients" || folderId === "root_chantiers") {
        return { success: false, error: "Impossible de supprimer un dossier racine" };
      }
      // Compter les sous-éléments
      const subFolders = db.prepare("SELECT COUNT(*) as n FROM vault_folders WHERE parentId = ?").get(folderId).n;
      const docsCount = db.prepare("SELECT COUNT(*) as n FROM vault_documents WHERE folderId = ? AND deletedAt = ''").get(folderId).n;
      if (subFolders > 0 || docsCount > 0) {
        return { success: false, error: `Le dossier contient ${subFolders} sous-dossier(s) et ${docsCount} document(s). Videz-le d'abord.` };
      }
      db.prepare("DELETE FROM vault_folders WHERE id = ?").run(folderId);
      return { success: true };
    } catch (e) {
      console.error("[vault:deleteFolder]", e);
      return { success: false, error: e.message };
    }
  });

  // ─── Documents : upload ──────────────────────────────────────────────
  ipcMain.handle("vault:uploadDocument", async (_e, { folderId, sourcePath, fileName, description, expirationDate, tags }) => {
    try {
      if (!fs.existsSync(sourcePath)) return { success: false, error: "Fichier source introuvable" };
      const stat = fs.statSync(sourcePath);

      const id = generateId("doc");
      const ext = path.extname(sourcePath).toLowerCase();

      // Détection du MIME type
      const mimeMap = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt": "text/plain", ".csv": "text/csv",
      };
      const mimeType = mimeMap[ext] || "application/octet-stream";

      // Stockage : userData/vault/<id>.enc
      const storedFileName = `${id}.enc`;
      const destPath = path.join(vaultDir, storedFileName);

      const enc = await encryptFile(sourcePath, destPath, key);

      // Extraction texte PDF (pour FTS) — sur le fichier source non chiffré
      let extractedText = "";
      if (mimeType === "application/pdf") {
        extractedText = await extractPdfText(sourcePath);
      }

      const now = nowIso();
      db.prepare(`
        INSERT INTO vault_documents (
          id, folderId, fileName, originalFileName, storagePath, isEncrypted,
          iv, fileSize, mimeType, fileHash, extractedText, description,
          expirationDate, deletedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
      `).run(
        id, folderId, fileName || path.basename(sourcePath), path.basename(sourcePath),
        storedFileName, enc.iv, enc.fileSize, mimeType, enc.fileHash, extractedText,
        description || "", expirationDate || "", now, now
      );

      // Associer les tags si fournis (par ID ou par nom)
      if (Array.isArray(tags)) {
        for (const tagInput of tags) {
          let tagId = tagInput.id;
          if (!tagId && tagInput.name) {
            // Créer le tag s'il n'existe pas (par nom)
            const existing = db.prepare("SELECT id FROM vault_tags WHERE name = ?").get(tagInput.name);
            if (existing) {
              tagId = existing.id;
            } else {
              tagId = generateId("tag");
              db.prepare("INSERT INTO vault_tags (id, name, colorKey, createdAt) VALUES (?, ?, ?, ?)")
                .run(tagId, tagInput.name, tagInput.colorKey || "default", now);
            }
          }
          if (tagId) {
            db.prepare("INSERT OR IGNORE INTO vault_document_tags (documentId, tagId) VALUES (?, ?)")
              .run(id, tagId);
          }
        }
      }

      // Indexer FTS
      const fullDoc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
      reindexDocument(fullDoc);

      return { success: true, id };
    } catch (e) {
      console.error("[vault:uploadDocument]", e);
      return { success: false, error: e.message };
    }
  });

  // ─── Documents : list ────────────────────────────────────────────────
  ipcMain.handle("vault:listDocuments", (_e, { folderId, includeTrashed }) => {
    try {
      let sql = "SELECT * FROM vault_documents WHERE deletedAt = ''";
      const params = [];
      if (includeTrashed) sql = "SELECT * FROM vault_documents WHERE 1=1";
      if (folderId) {
        sql += " AND folderId = ?";
        params.push(folderId);
      }
      sql += " ORDER BY createdAt DESC";
      const rows = db.prepare(sql).all(...params).map(rowToDocument);

      // Hydrater les tags
      const tagsByDoc = {};
      const docIds = rows.map(r => r.id);
      if (docIds.length > 0) {
        const placeholders = docIds.map(() => "?").join(",");
        const tagRows = db.prepare(`
          SELECT dt.documentId, t.id, t.name, t.colorKey
          FROM vault_document_tags dt
          INNER JOIN vault_tags t ON t.id = dt.tagId
          WHERE dt.documentId IN (${placeholders})
        `).all(...docIds);
        for (const t of tagRows) {
          (tagsByDoc[t.documentId] = tagsByDoc[t.documentId] || []).push({
            id: t.id, name: t.name, colorKey: t.colorKey,
          });
        }
      }
      return rows.map(d => ({ ...d, tags: tagsByDoc[d.id] || [] }));
    } catch (e) {
      console.error("[vault:listDocuments]", e);
      return [];
    }
  });

  ipcMain.handle("vault:listTrash", () => {
    try {
      const rows = db.prepare("SELECT * FROM vault_documents WHERE deletedAt != '' ORDER BY deletedAt DESC")
        .all().map(rowToDocument);
      return rows;
    } catch {
      return [];
    }
  });

  // ─── Document : update metadata ──────────────────────────────────────
  ipcMain.handle("vault:updateDocument", (_e, { id, data }) => {
    try {
      const allowedKeys = ["fileName", "description", "expirationDate", "folderId"];
      const keys = Object.keys(data).filter(k => allowedKeys.includes(k));
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) payload[k] = data[k];
      db.prepare(`UPDATE vault_documents SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);

      // Reindex FTS
      const doc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
      reindexDocument(doc);

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Document : trash / restore / delete forever ────────────────────
  ipcMain.handle("vault:trashDocument", (_e, id) => {
    try {
      db.prepare("UPDATE vault_documents SET deletedAt = ?, updatedAt = ? WHERE id = ?")
        .run(nowIso(), nowIso(), id);
      // Retirer de l'index FTS
      db.prepare("DELETE FROM vault_search WHERE documentId = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:restoreDocument", (_e, id) => {
    try {
      db.prepare("UPDATE vault_documents SET deletedAt = '', updatedAt = ? WHERE id = ?")
        .run(nowIso(), id);
      const doc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
      reindexDocument(doc);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:deleteDocumentForever", (_e, id) => {
    try {
      const doc = db.prepare("SELECT storagePath FROM vault_documents WHERE id = ?").get(id);
      if (doc) {
        const fullPath = path.join(vaultDir, doc.storagePath);
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch {}
      }
      db.prepare("DELETE FROM vault_documents WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Document : déchiffrer pour aperçu/téléchargement ────────────────
  ipcMain.handle("vault:getDocumentPreviewPath", async (_e, id) => {
    try {
      const doc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
      if (!doc) return { success: false, error: "Document introuvable" };
      const srcPath = path.join(vaultDir, doc.storagePath);
      const tempName = `${doc.id}_${doc.originalFileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempPath = path.join(tempDir, tempName);
      // Si déjà déchiffré récemment, on réutilise (cache 1h)
      if (fs.existsSync(tempPath)) {
        const age = Date.now() - fs.statSync(tempPath).mtimeMs;
        if (age < 60 * 60 * 1000) return { success: true, path: tempPath };
      }
      await decryptFile(srcPath, tempPath, key, doc.iv);
      return { success: true, path: tempPath };
    } catch (e) {
      console.error("[vault:getDocumentPreviewPath]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:downloadDocument", async (_e, id) => {
    try {
      const doc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
      if (!doc) return { success: false, error: "Document introuvable" };

      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Enregistrer le document",
        defaultPath: doc.originalFileName,
      });
      if (result.canceled || !result.filePath) return { success: false, cancelled: true };

      const srcPath = path.join(vaultDir, doc.storagePath);
      await decryptFile(srcPath, result.filePath, key, doc.iv);
      return { success: true, path: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:openDocumentExternal", async (_e, id) => {
    try {
      const doc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
      if (!doc) return { success: false, error: "Document introuvable" };
      const srcPath = path.join(vaultDir, doc.storagePath);
      const tempName = `${doc.id}_${doc.originalFileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempPath = path.join(tempDir, tempName);
      if (!fs.existsSync(tempPath) || (Date.now() - fs.statSync(tempPath).mtimeMs) > 60 * 60 * 1000) {
        await decryptFile(srcPath, tempPath, key, doc.iv);
      }
      shell.openPath(tempPath);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Tags ──────────────────────────────────────────────────────────────
  ipcMain.handle("vault:listTags", () => {
    try {
      return db.prepare("SELECT * FROM vault_tags ORDER BY name").all();
    } catch {
      return [];
    }
  });

  ipcMain.handle("vault:createTag", (_e, { name, colorKey }) => {
    try {
      const existing = db.prepare("SELECT id FROM vault_tags WHERE name = ?").get(name);
      if (existing) return { success: true, id: existing.id, alreadyExists: true };
      const id = generateId("tag");
      db.prepare("INSERT INTO vault_tags (id, name, colorKey, createdAt) VALUES (?, ?, ?, ?)")
        .run(id, name, colorKey || "default", nowIso());
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:updateTag", (_e, { id, name, colorKey }) => {
    try {
      db.prepare("UPDATE vault_tags SET name = ?, colorKey = ? WHERE id = ?").run(name, colorKey, id);
      // Reindex tous les documents qui ont ce tag (pour FTS)
      const docs = db.prepare(`
        SELECT d.* FROM vault_documents d
        INNER JOIN vault_document_tags dt ON dt.documentId = d.id
        WHERE dt.tagId = ?
      `).all(id);
      for (const d of docs) reindexDocument(d);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:deleteTag", (_e, id) => {
    try {
      // Récupérer les docs affectés AVANT suppression
      const docs = db.prepare(`
        SELECT d.* FROM vault_documents d
        INNER JOIN vault_document_tags dt ON dt.documentId = d.id
        WHERE dt.tagId = ?
      `).all(id);
      db.prepare("DELETE FROM vault_tags WHERE id = ?").run(id);
      // Reindex
      for (const d of docs) reindexDocument(d);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:setDocumentTags", (_e, { documentId, tagIds }) => {
    try {
      db.prepare("DELETE FROM vault_document_tags WHERE documentId = ?").run(documentId);
      for (const tagId of tagIds || []) {
        db.prepare("INSERT OR IGNORE INTO vault_document_tags (documentId, tagId) VALUES (?, ?)")
          .run(documentId, tagId);
      }
      const doc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(documentId);
      reindexDocument(doc);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Recherche FTS ────────────────────────────────────────────────────
  ipcMain.handle("vault:search", (_e, { query, filters }) => {
    try {
      filters = filters || {};
      const q = (query || "").trim();
      let docs;

      if (q) {
        // Sanitize FTS5 input : enlever les caractères réservés
        const safe = q.replace(/['"]/g, "").replace(/[^\w\sàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ-]/g, " ").trim();
        if (!safe) {
          docs = db.prepare("SELECT * FROM vault_documents WHERE deletedAt = '' ORDER BY createdAt DESC").all();
        } else {
          // FTS5 prefix matching avec OR sur tokens
          const tokens = safe.split(/\s+/).filter(Boolean).map(t => `"${t}"*`).join(" OR ");
          const ids = db.prepare(`
            SELECT documentId FROM vault_search WHERE vault_search MATCH ?
            ORDER BY rank
          `).all(tokens).map(r => r.documentId);
          if (ids.length === 0) {
            docs = [];
          } else {
            const placeholders = ids.map(() => "?").join(",");
            docs = db.prepare(`SELECT * FROM vault_documents WHERE id IN (${placeholders}) AND deletedAt = ''`).all(...ids);
          }
        }
      } else {
        docs = db.prepare("SELECT * FROM vault_documents WHERE deletedAt = '' ORDER BY createdAt DESC").all();
      }

      // Filtres additionnels
      if (filters.folderId) docs = docs.filter(d => d.folderId === filters.folderId);
      if (filters.mimeTypePrefix) docs = docs.filter(d => (d.mimeType || "").startsWith(filters.mimeTypePrefix));
      if (filters.tagIds && filters.tagIds.length > 0) {
        const placeholders = filters.tagIds.map(() => "?").join(",");
        const allowedDocIds = new Set(db.prepare(`
          SELECT DISTINCT documentId FROM vault_document_tags WHERE tagId IN (${placeholders})
        `).all(...filters.tagIds).map(r => r.documentId));
        docs = docs.filter(d => allowedDocIds.has(d.id));
      }
      if (filters.expiringSoon) {
        const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        docs = docs.filter(d => d.expirationDate && d.expirationDate >= today && d.expirationDate <= cutoff);
      }

      // Hydrater tags
      const docIds = docs.map(r => r.id);
      const tagsByDoc = {};
      if (docIds.length > 0) {
        const placeholders = docIds.map(() => "?").join(",");
        const tagRows = db.prepare(`
          SELECT dt.documentId, t.id, t.name, t.colorKey
          FROM vault_document_tags dt
          INNER JOIN vault_tags t ON t.id = dt.tagId
          WHERE dt.documentId IN (${placeholders})
        `).all(...docIds);
        for (const t of tagRows) {
          (tagsByDoc[t.documentId] = tagsByDoc[t.documentId] || []).push({
            id: t.id, name: t.name, colorKey: t.colorKey,
          });
        }
      }
      return docs.map(d => ({ ...rowToDocument(d), tags: tagsByDoc[d.id] || [] }));
    } catch (e) {
      console.error("[vault:search]", e);
      return [];
    }
  });

  // ─── Stats ────────────────────────────────────────────────────────────
  ipcMain.handle("vault:getStats", () => {
    try {
      const totalDocuments = db.prepare("SELECT COUNT(*) as n FROM vault_documents WHERE deletedAt = ''").get().n;
      const totalFolders = db.prepare("SELECT COUNT(*) as n FROM vault_folders").get().n;
      const totalSize = db.prepare("SELECT COALESCE(SUM(fileSize), 0) as s FROM vault_documents WHERE deletedAt = ''").get().s;
      const trashCount = db.prepare("SELECT COUNT(*) as n FROM vault_documents WHERE deletedAt != ''").get().n;
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const expiringIn30Days = db.prepare(`
        SELECT COUNT(*) as n FROM vault_documents
        WHERE deletedAt = '' AND expirationDate >= ? AND expirationDate <= ?
      `).get(today, cutoff).n;
      return { totalDocuments, totalFolders, totalSize: Number(totalSize || 0), trashCount, expiringIn30Days };
    } catch {
      return { totalDocuments: 0, totalFolders: 0, totalSize: 0, trashCount: 0, expiringIn30Days: 0 };
    }
  });

  // ─── Auto-stockage : copier un fichier (PDF, etc.) dans le coffre-fort ───
  // Idempotent : si un document existe déjà avec la même origin (quoteId/invoiceId),
  // il est REMPLACÉ (utile pour PDF de devis/facture mis à jour)
  ipcMain.handle("vault:autoStoreDocument", async (_e, { sourcePath, fileName, folderId, originType, originId, description, tags }) => {
    try {
      if (!fs.existsSync(sourcePath)) return { success: false, error: "Fichier source introuvable" };

      // Détection MIME
      const ext = path.extname(sourcePath).toLowerCase();
      const mimeMap = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",
      };
      const mimeType = mimeMap[ext] || "application/octet-stream";

      // Si un document existe déjà avec ce nom + folderId, on le remplace
      const existing = db.prepare(`
        SELECT id, storagePath FROM vault_documents
        WHERE folderId = ? AND fileName = ? AND deletedAt = ''
      `).get(folderId, fileName);

      if (existing) {
        // Supprimer l'ancien fichier physique
        const oldPath = path.join(vaultDir, existing.storagePath);
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
        // Réutiliser l'ID
        const id = existing.id;
        const storedFileName = `${id}.enc`;
        const destPath = path.join(vaultDir, storedFileName);
        const enc = await encryptFile(sourcePath, destPath, key);
        let extractedText = "";
        if (mimeType === "application/pdf") {
          extractedText = await extractPdfText(sourcePath);
        }
        db.prepare(`
          UPDATE vault_documents
          SET storagePath = ?, iv = ?, fileSize = ?, fileHash = ?, extractedText = ?,
              description = ?, updatedAt = ?
          WHERE id = ?
        `).run(storedFileName, enc.iv, enc.fileSize, enc.fileHash, extractedText,
                description || "", nowIso(), id);
        const fullDoc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
        reindexDocument(fullDoc);
        return { success: true, id, replaced: true };
      }

      // Nouveau document
      const id = generateId("doc");
      const storedFileName = `${id}.enc`;
      const destPath = path.join(vaultDir, storedFileName);
      const enc = await encryptFile(sourcePath, destPath, key);

      let extractedText = "";
      if (mimeType === "application/pdf") {
        extractedText = await extractPdfText(sourcePath);
      }

      const now = nowIso();
      db.prepare(`
        INSERT INTO vault_documents (
          id, folderId, fileName, originalFileName, storagePath, isEncrypted,
          iv, fileSize, mimeType, fileHash, extractedText, description,
          expirationDate, deletedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, '', '', ?, ?)
      `).run(
        id, folderId, fileName, path.basename(sourcePath),
        storedFileName, enc.iv, enc.fileSize, mimeType, enc.fileHash, extractedText,
        description || "", now, now
      );

      // Tags
      if (Array.isArray(tags)) {
        for (const tagInput of tags) {
          let tagId = tagInput.id;
          if (!tagId && tagInput.name) {
            const existingTag = db.prepare("SELECT id FROM vault_tags WHERE name = ?").get(tagInput.name);
            if (existingTag) tagId = existingTag.id;
            else {
              tagId = generateId("tag");
              db.prepare("INSERT INTO vault_tags (id, name, colorKey, createdAt) VALUES (?, ?, ?, ?)")
                .run(tagId, tagInput.name, tagInput.colorKey || "default", now);
            }
          }
          if (tagId) {
            db.prepare("INSERT OR IGNORE INTO vault_document_tags (documentId, tagId) VALUES (?, ?)")
              .run(id, tagId);
          }
        }
      }

      const fullDoc = db.prepare("SELECT * FROM vault_documents WHERE id = ?").get(id);
      reindexDocument(fullDoc);

      return { success: true, id, replaced: false };
    } catch (e) {
      console.error("[vault:autoStoreDocument]", e);
      return { success: false, error: e.message };
    }
  });

  // ─── Picker fichiers (pour upload depuis le bouton "+") ──────────────
  ipcMain.handle("vault:pickFiles", async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Sélectionner des fichiers à ajouter au coffre-fort",
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Documents", extensions: ["pdf", "doc", "docx", "xls", "xlsx", "txt", "csv", "jpg", "jpeg", "png", "gif", "webp"] },
          { name: "Tous les fichiers", extensions: ["*"] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true, paths: [] };
      }
      return { success: true, paths: result.filePaths };
    } catch (e) {
      return { success: false, error: e.message, paths: [] };
    }
  });

  // ─── Hook chantiers/clients : créer un dossier dédié à la création ────
  // (sera utilisé en Message 3 ; pour l'instant exposé en API)
  ipcMain.handle("vault:ensureClientFolder", (_e, { clientId, clientName }) => {
    try {
      let row = db.prepare("SELECT id FROM vault_folders WHERE clientId = ?").get(clientId);
      if (row) return { success: true, id: row.id, alreadyExists: true };
      const id = generateId("fold");
      const now = nowIso();
      db.prepare(`
        INSERT INTO vault_folders (id, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdAt, updatedAt)
        VALUES (?, 'root_clients', ?, 'users', 'violet', ?, '', '', ?, ?)
      `).run(id, clientName, clientId, now, now);
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("vault:ensureChantierFolder", (_e, { chantierId, chantierTitle, clientId }) => {
    try {
      let row = db.prepare("SELECT id FROM vault_folders WHERE chantierId = ?").get(chantierId);
      if (row) return { success: true, id: row.id, alreadyExists: true };
      const id = generateId("fold");
      const now = nowIso();
      db.prepare(`
        INSERT INTO vault_folders (id, parentId, name, iconKey, colorKey, clientId, chantierId, description, createdAt, updatedAt)
        VALUES (?, 'root_chantiers', ?, 'hammer', 'amber', ?, ?, '', ?, ?)
      `).run(id, chantierTitle, clientId || "", chantierId, now, now);
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log("[vault] Module initialisé · " + vaultDir);
}

module.exports = { init };
