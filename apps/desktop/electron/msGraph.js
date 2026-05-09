// ═══════════════════════════════════════════════════════════════════════════
// MicrosoftGraph — Service d'appel à l'API Graph pour OneDrive
// Utilise l'AppFolder (isolé) pour les sauvegardes BatiDesk
// ═══════════════════════════════════════════════════════════════════════════

const fs = require("node:fs");
const path = require("node:path");
const { getAccessToken } = require("./msAuth");

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
// App folder = /me/drive/special/approot — isolé, pas visible des autres fichiers
const APP_FOLDER_PATH = "/me/drive/special/approot";

// Pour Node >= 18, fetch est global. Fallback sinon :
const fetchFn = global.fetch || require("node-fetch");

// ─── Helper : appel Graph API ────────────────────────────────────────────
async function graphFetch(url, options = {}) {
  const token = await getAccessToken();
  const fullUrl = url.startsWith("http") ? url : `${GRAPH_BASE}${url}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  const response = await fetchFn(fullUrl, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response;
}

// ─── Obtenir le profil utilisateur ───────────────────────────────────────
async function getProfile() {
  const res = await graphFetch("/me?$select=displayName,userPrincipalName,mail,id");
  const data = await res.json();
  return {
    id: data.id,
    name: data.displayName,
    email: data.mail || data.userPrincipalName,
  };
}

// ─── Obtenir le quota OneDrive ───────────────────────────────────────────
async function getQuota() {
  try {
    const res = await graphFetch("/me/drive?$select=quota");
    const data = await res.json();
    return {
      used: data.quota?.used || 0,
      total: data.quota?.total || 0,
      remaining: data.quota?.remaining || 0,
    };
  } catch {
    return null;
  }
}

// ─── Upload d'un fichier dans l'AppFolder ────────────────────────────────
// Pour <4Mo : upload simple PUT
// Pour >4Mo : upload session (chunked)
async function uploadFile(localPath, remoteName) {
  if (!fs.existsSync(localPath)) {
    throw new Error(`Fichier introuvable : ${localPath}`);
  }

  const stats = fs.statSync(localPath);
  const size = stats.size;
  const THRESHOLD = 4 * 1024 * 1024; // 4 Mo

  if (size < THRESHOLD) {
    // Upload simple
    const content = fs.readFileSync(localPath);
    const res = await graphFetch(
      `${APP_FOLDER_PATH}:/${encodeURIComponent(remoteName)}:/content`,
      {
        method: "PUT",
        body: content,
        headers: { "Content-Type": "application/octet-stream" },
      }
    );
    const data = await res.json();
    return mapFileMeta(data);
  }

  // Upload en chunks via upload session
  const sessionRes = await graphFetch(
    `${APP_FOLDER_PATH}:/${encodeURIComponent(remoteName)}:/createUploadSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: { "@microsoft.graph.conflictBehavior": "replace", name: remoteName },
      }),
    }
  );
  const session = await sessionRes.json();
  const uploadUrl = session.uploadUrl;

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 Mo
  let offset = 0;
  const fd = fs.openSync(localPath, "r");
  try {
    while (offset < size) {
      const chunkSize = Math.min(CHUNK_SIZE, size - offset);
      const buf = Buffer.alloc(chunkSize);
      fs.readSync(fd, buf, 0, chunkSize, offset);

      const contentRange = `bytes ${offset}-${offset + chunkSize - 1}/${size}`;
      const resp = await fetchFn(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunkSize),
          "Content-Range": contentRange,
        },
        body: buf,
      });

      if (!resp.ok && resp.status !== 202) {
        const text = await resp.text();
        throw new Error(`Chunk upload failed ${resp.status}: ${text.slice(0, 200)}`);
      }

      offset += chunkSize;

      // Dernière chunk => réponse avec metadata du fichier
      if (offset >= size) {
        const data = await resp.json();
        return mapFileMeta(data);
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  throw new Error("Upload incomplet");
}

// ─── Liste des fichiers dans l'AppFolder ─────────────────────────────────
async function listFiles() {
  const res = await graphFetch(`${APP_FOLDER_PATH}/children?$select=id,name,size,lastModifiedDateTime,file,@microsoft.graph.downloadUrl`);
  const data = await res.json();
  return (data.value || []).map(mapFileMeta);
}

// ─── Télécharger un fichier (pour restauration) ──────────────────────────
async function downloadFile(remoteName, localPath) {
  // On passe par les metadata pour obtenir l'URL de téléchargement pré-signée
  const metaRes = await graphFetch(`${APP_FOLDER_PATH}:/${encodeURIComponent(remoteName)}`);
  const meta = await metaRes.json();
  const downloadUrl = meta["@microsoft.graph.downloadUrl"];

  if (!downloadUrl) throw new Error("URL de téléchargement indisponible");

  const resp = await fetchFn(downloadUrl);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

  // Stream vers fichier local
  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);

  return { path: localPath, size: buffer.length };
}

// ─── Supprimer un fichier ────────────────────────────────────────────────
async function deleteFile(remoteName) {
  await graphFetch(`${APP_FOLDER_PATH}:/${encodeURIComponent(remoteName)}`, {
    method: "DELETE",
  });
  return { success: true };
}

// ─── Helper : mapper la structure Graph en structure BTP ─────────────────
function mapFileMeta(raw) {
  return {
    id: raw.id,
    name: raw.name,
    size: raw.size || 0,
    modifiedAt: raw.lastModifiedDateTime || new Date().toISOString(),
    path: raw.name, // path relatif dans AppFolder
  };
}

// ─── Session S28 — Envoi de mail via MS Graph (Outlook) ───────────────
async function sendMail({ to, subject, body, attachmentPath, attachmentName }) {
  const fs = require("fs");
  const path = require("path");

  // Construit le payload Graph API
  const message = {
    subject: subject || "(sans objet)",
    body: {
      contentType: "Text",
      content: body || "",
    },
    toRecipients: [
      { emailAddress: { address: to } },
    ],
  };

  // Pièce jointe : on lit le fichier et on l'encode en base64
  if (attachmentPath && fs.existsSync(attachmentPath)) {
    const buffer = fs.readFileSync(attachmentPath);
    const name = attachmentName || path.basename(attachmentPath);
    // Limite Graph "small attachment" : 3 Mo
    if (buffer.length > 3 * 1024 * 1024) {
      throw new Error("Pièce jointe > 3 Mo : non supportée pour l'instant");
    }
    message.attachments = [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name,
        contentType: "application/pdf",
        contentBytes: buffer.toString("base64"),
      },
    ];
  }

  const payload = {
    message,
    saveToSentItems: true,
  };

  const res = await graphFetch("/me/sendMail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // sendMail renvoie 202 Accepted sans body
  return { success: res.status === 202 || res.ok };
}

module.exports = {
  getProfile,
  getQuota,
  uploadFile,
  listFiles,
  downloadFile,
  deleteFile,
  sendMail,
};
