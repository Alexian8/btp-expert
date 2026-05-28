// ═══════════════════════════════════════════════════════════════════════════
// Stockage chiffré des identifiants Qonto.
//
// La secret key est chiffrée (AES-256-GCM) avec une clé dérivée du JWT_SECRET
// du serveur avant d'être stockée en base (table settings, clé "qonto"). Elle
// n'est jamais renvoyée au front : seules les métadonnées (login masqué, état
// de connexion) sont exposées.
// ═══════════════════════════════════════════════════════════════════════════

import crypto from "node:crypto";
import type { DB, RowDataPacket } from "../db";
import type { QontoCredentials } from "./client";

const SETTINGS_KEY = "qonto";

interface StoredQonto {
  login: string;
  iv: string;       // hex
  tag: string;      // hex
  secret: string;   // hex (chiffré)
  organizationName?: string;
  connectedAt?: string;
}

function deriveKey(jwtSecret: string): Buffer {
  // Clé AES 32 octets dérivée du JWT_SECRET (stable, propre au serveur).
  return crypto.createHash("sha256").update(`qonto:${jwtSecret}`).digest();
}

function encryptSecret(secret: string, jwtSecret: string): { iv: string; tag: string; secret: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(jwtSecret), iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("hex"), tag: tag.toString("hex"), secret: enc.toString("hex") };
}

function decryptSecret(stored: StoredQonto, jwtSecret: string): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveKey(jwtSecret),
    Buffer.from(stored.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(stored.tag, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(stored.secret, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

async function readStored(db: DB): Promise<StoredQonto | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT value FROM settings WHERE `key` = ?",
    [SETTINGS_KEY]
  );
  const raw = (rows[0] as { value?: string })?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredQonto;
  } catch {
    return null;
  }
}

export async function saveCredentials(
  db: DB,
  creds: QontoCredentials,
  jwtSecret: string,
  organizationName?: string
): Promise<void> {
  const enc = encryptSecret(creds.secretKey, jwtSecret);
  const stored: StoredQonto = {
    login: creds.login,
    ...enc,
    organizationName,
    connectedAt: new Date().toISOString(),
  };
  await db.query(
    "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [SETTINGS_KEY, JSON.stringify(stored)]
  );
}

export async function getCredentials(db: DB, jwtSecret: string): Promise<QontoCredentials | null> {
  const stored = await readStored(db);
  if (!stored) return null;
  try {
    return { login: stored.login, secretKey: decryptSecret(stored, jwtSecret) };
  } catch {
    return null;
  }
}

export async function getStatus(db: DB): Promise<{
  connected: boolean;
  loginMasked?: string;
  organizationName?: string;
  connectedAt?: string;
}> {
  const stored = await readStored(db);
  if (!stored) return { connected: false };
  // Masque le login : "jacob-habitat-5678" → "jacob-habitat-••78"
  const login = stored.login;
  const loginMasked =
    login.length > 4 ? login.slice(0, -4).replace(/.(?=.{0})/g, (c) => c) + "••" + login.slice(-2) : login;
  return {
    connected: true,
    loginMasked,
    organizationName: stored.organizationName,
    connectedAt: stored.connectedAt,
  };
}

export async function deleteCredentials(db: DB): Promise<void> {
  await db.query("DELETE FROM settings WHERE `key` = ?", [SETTINGS_KEY]);
}
