"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Révocation de tokens JWT.
//
// On stocke en DB un sha256(token) avec sa date d'expiration. Le middleware
// auth consulte un cache mémoire (TTL 60s) pour éviter une query DB à chaque
// requête. À l'expiration du JWT lui-même, la ligne devient inutile et est
// supprimée par un job de purge périodique.
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = hashToken;
exports.isTokenRevoked = isTokenRevoked;
exports.revokeToken = revokeToken;
exports.revokeAllUserSessions = revokeAllUserSessions;
exports.isUserSessionRevoked = isUserSessionRevoked;
exports.purgeExpiredRevokedTokens = purgeExpiredRevokedTokens;
exports.startRevokedTokensPurgeJob = startRevokedTokensPurgeJob;
const node_crypto_1 = __importDefault(require("node:crypto"));
function hashToken(token) {
    return node_crypto_1.default.createHash("sha256").update(token).digest("hex");
}
// Cache mémoire : tokenHash → (revoked: boolean, expiresAt epoch ms)
// Évite un hit DB à chaque requête. Recharge toutes les 60s.
const CACHE_TTL_MS = 60_000;
const cache = new Map();
async function isTokenRevoked(db, token) {
    const tokenHash = hashToken(token);
    const cached = cache.get(tokenHash);
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
        return cached.revoked;
    }
    const [rows] = await db.query("SELECT 1 FROM revoked_tokens WHERE tokenHash = ? AND expiresAt > NOW() LIMIT 1", [tokenHash]);
    const revoked = rows.length > 0;
    cache.set(tokenHash, { revoked, checkedAt: Date.now() });
    return revoked;
}
async function revokeToken(db, token, payload) {
    const tokenHash = hashToken(token);
    // exp est en secondes (RFC 7519). Si absent, on suppose 7j max (cf. JWT_EXPIRES_IN).
    const expiresAt = new Date((payload.exp ? payload.exp : Math.floor(Date.now() / 1000) + 7 * 24 * 3600) * 1000);
    await db.execute("INSERT IGNORE INTO revoked_tokens (tokenHash, userId, expiresAt) VALUES (?, ?, ?)", [tokenHash, payload.sub ?? null, expiresAt]);
    // Invalide le cache pour ce token
    cache.set(tokenHash, { revoked: true, checkedAt: Date.now() });
}
// ─── Révocation de TOUTES les sessions d'un utilisateur ─────────────────
// La blacklist par token ne suffit pas quand on ne connaît pas les tokens
// émis (désactivation d'un compte, reset admin). On horodate à la place :
// `users.tokensInvalidBefore` (epoch secondes) — tout JWT dont l'`iat` est
// antérieur est refusé par le middleware. Cache mémoire 60s par userId.
const userCache = new Map();
/** Invalide immédiatement toutes les sessions (JWT déjà émis) d'un user. */
async function revokeAllUserSessions(db, userId) {
    const nowSec = Math.floor(Date.now() / 1000);
    await db.execute("UPDATE users SET tokensInvalidBefore = ? WHERE id = ?", [nowSec, userId]);
    userCache.set(userId, { invalidBefore: nowSec, checkedAt: Date.now() });
}
/**
 * Vrai si les sessions du user émises à `iat` (epoch s) sont révoquées.
 * Un user introuvable (supprimé) est considéré révoqué.
 */
async function isUserSessionRevoked(db, userId, iat) {
    const cached = userCache.get(userId);
    let invalidBefore;
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
        invalidBefore = cached.invalidBefore;
    }
    else {
        const [rows] = await db.query("SELECT tokensInvalidBefore FROM users WHERE id = ? LIMIT 1", [userId]);
        const row = rows[0];
        if (!row)
            return true; // user supprimé → sessions invalides
        invalidBefore = Number(row.tokensInvalidBefore ?? 0);
        userCache.set(userId, { invalidBefore, checkedAt: Date.now() });
    }
    if (!invalidBefore)
        return false;
    // Sans iat (JWT anormal), on rejette par prudence dès qu'une révocation existe.
    if (iat == null)
        return true;
    return iat < invalidBefore;
}
async function purgeExpiredRevokedTokens(db) {
    const [result] = (await db.execute("DELETE FROM revoked_tokens WHERE expiresAt <= NOW()"));
    return result.affectedRows ?? 0;
}
// Job de purge périodique (toutes les heures). Non bloquant.
function startRevokedTokensPurgeJob(db) {
    const ONE_HOUR = 60 * 60 * 1000;
    return setInterval(() => {
        purgeExpiredRevokedTokens(db).catch((e) => {
            console.warn("[token-revocation] purge failed:", e);
        });
    }, ONE_HOUR);
}
