"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Stockage chiffré des identifiants Qonto.
//
// La secret key est chiffrée (AES-256-GCM) avec une clé dérivée du JWT_SECRET
// du serveur avant d'être stockée en base (table settings, clé "qonto"). Elle
// n'est jamais renvoyée au front : seules les métadonnées (login masqué, état
// de connexion) sont exposées.
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCredentials = saveCredentials;
exports.getCredentials = getCredentials;
exports.getStatus = getStatus;
exports.deleteCredentials = deleteCredentials;
const node_crypto_1 = __importDefault(require("node:crypto"));
const SETTINGS_KEY = "qonto";
function deriveKey(jwtSecret) {
    // Clé AES 32 octets dérivée du JWT_SECRET (stable, propre au serveur).
    return node_crypto_1.default.createHash("sha256").update(`qonto:${jwtSecret}`).digest();
}
function encryptSecret(secret, jwtSecret) {
    const iv = node_crypto_1.default.randomBytes(12);
    const cipher = node_crypto_1.default.createCipheriv("aes-256-gcm", deriveKey(jwtSecret), iv);
    const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { iv: iv.toString("hex"), tag: tag.toString("hex"), secret: enc.toString("hex") };
}
function decryptSecret(stored, jwtSecret) {
    const decipher = node_crypto_1.default.createDecipheriv("aes-256-gcm", deriveKey(jwtSecret), Buffer.from(stored.iv, "hex"));
    decipher.setAuthTag(Buffer.from(stored.tag, "hex"));
    const dec = Buffer.concat([
        decipher.update(Buffer.from(stored.secret, "hex")),
        decipher.final(),
    ]);
    return dec.toString("utf8");
}
async function readStored(db) {
    const [rows] = await db.query("SELECT value FROM settings WHERE `key` = ?", [SETTINGS_KEY]);
    const raw = rows[0]?.value;
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function saveCredentials(db, creds, jwtSecret, organizationName) {
    const enc = encryptSecret(creds.secretKey, jwtSecret);
    const stored = {
        login: creds.login,
        ...enc,
        organizationName,
        connectedAt: new Date().toISOString(),
    };
    await db.query("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [SETTINGS_KEY, JSON.stringify(stored)]);
}
async function getCredentials(db, jwtSecret) {
    const stored = await readStored(db);
    if (!stored)
        return null;
    try {
        return { login: stored.login, secretKey: decryptSecret(stored, jwtSecret) };
    }
    catch {
        return null;
    }
}
async function getStatus(db) {
    const stored = await readStored(db);
    if (!stored)
        return { connected: false };
    // Masque le login : "jacob-habitat-5678" → "jacob-habitat-••78"
    const login = stored.login;
    const loginMasked = login.length > 4 ? login.slice(0, -4).replace(/.(?=.{0})/g, (c) => c) + "••" + login.slice(-2) : login;
    return {
        connected: true,
        loginMasked,
        organizationName: stored.organizationName,
        connectedAt: stored.connectedAt,
    };
}
async function deleteCredentials(db) {
    await db.query("DELETE FROM settings WHERE `key` = ?", [SETTINGS_KEY]);
}
