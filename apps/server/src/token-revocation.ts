// ═══════════════════════════════════════════════════════════════════════════
// Révocation de tokens JWT.
//
// On stocke en DB un sha256(token) avec sa date d'expiration. Le middleware
// auth consulte un cache mémoire (TTL 60s) pour éviter une query DB à chaque
// requête. À l'expiration du JWT lui-même, la ligne devient inutile et est
// supprimée par un job de purge périodique.
// ═══════════════════════════════════════════════════════════════════════════

import crypto from "node:crypto";
import type { DB, RowDataPacket } from "./db";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Cache mémoire : tokenHash → (revoked: boolean, expiresAt epoch ms)
// Évite un hit DB à chaque requête. Recharge toutes les 60s.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { revoked: boolean; checkedAt: number }>();

export async function isTokenRevoked(db: DB, token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const cached = cache.get(tokenHash);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.revoked;
  }
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT 1 FROM revoked_tokens WHERE tokenHash = ? AND expiresAt > NOW() LIMIT 1",
    [tokenHash]
  );
  const revoked = rows.length > 0;
  cache.set(tokenHash, { revoked, checkedAt: Date.now() });
  return revoked;
}

export async function revokeToken(
  db: DB,
  token: string,
  payload: { sub?: number; exp?: number }
): Promise<void> {
  const tokenHash = hashToken(token);
  // exp est en secondes (RFC 7519). Si absent, on suppose 7j max (cf. JWT_EXPIRES_IN).
  const expiresAt = new Date((payload.exp ? payload.exp : Math.floor(Date.now() / 1000) + 7 * 24 * 3600) * 1000);
  await db.execute(
    "INSERT IGNORE INTO revoked_tokens (tokenHash, userId, expiresAt) VALUES (?, ?, ?)",
    [tokenHash, payload.sub ?? null, expiresAt]
  );
  // Invalide le cache pour ce token
  cache.set(tokenHash, { revoked: true, checkedAt: Date.now() });
}

// ─── Révocation de TOUTES les sessions d'un utilisateur ─────────────────
// La blacklist par token ne suffit pas quand on ne connaît pas les tokens
// émis (désactivation d'un compte, reset admin). On horodate à la place :
// `users.tokensInvalidBefore` (epoch secondes) — tout JWT dont l'`iat` est
// antérieur est refusé par le middleware. Cache mémoire 60s par userId.
const userCache = new Map<number, { invalidBefore: number; checkedAt: number }>();

/** Invalide immédiatement toutes les sessions (JWT déjà émis) d'un user. */
export async function revokeAllUserSessions(db: DB, userId: number): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  await db.execute("UPDATE users SET tokensInvalidBefore = ? WHERE id = ?", [nowSec, userId]);
  userCache.set(userId, { invalidBefore: nowSec, checkedAt: Date.now() });
}

/**
 * Vrai si les sessions du user émises à `iat` (epoch s) sont révoquées.
 * Un user introuvable (supprimé) est considéré révoqué.
 */
export async function isUserSessionRevoked(db: DB, userId: number, iat?: number): Promise<boolean> {
  const cached = userCache.get(userId);
  let invalidBefore: number;
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    invalidBefore = cached.invalidBefore;
  } else {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT tokensInvalidBefore FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const row = rows[0] as { tokensInvalidBefore?: number } | undefined;
    if (!row) return true; // user supprimé → sessions invalides
    invalidBefore = Number(row.tokensInvalidBefore ?? 0);
    userCache.set(userId, { invalidBefore, checkedAt: Date.now() });
  }
  if (!invalidBefore) return false;
  // Sans iat (JWT anormal), on rejette par prudence dès qu'une révocation existe.
  if (iat == null) return true;
  return iat < invalidBefore;
}

export async function purgeExpiredRevokedTokens(db: DB): Promise<number> {
  const [result] = (await db.execute(
    "DELETE FROM revoked_tokens WHERE expiresAt <= NOW()"
  )) as unknown as [{ affectedRows: number }];
  return result.affectedRows ?? 0;
}

// Job de purge périodique (toutes les heures). Non bloquant.
export function startRevokedTokensPurgeJob(db: DB): NodeJS.Timeout {
  const ONE_HOUR = 60 * 60 * 1000;
  return setInterval(() => {
    purgeExpiredRevokedTokens(db).catch((e) => {
      console.warn("[token-revocation] purge failed:", e);
    });
  }, ONE_HOUR);
}
