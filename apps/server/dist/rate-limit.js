"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Rate limiting — implémentation pure JS (zéro dépendance externe)
//
// Stockage en mémoire (Map). Suffisant pour 1 instance Node.
// En cas de scale horizontal (cluster), il faudra du Redis partagé.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLoginRateLimiter = buildLoginRateLimiter;
exports.buildApiRateLimiter = buildApiRateLimiter;
exports.buildAiRateLimiter = buildAiRateLimiter;
exports.buildPasswordResetRateLimiter = buildPasswordResetRateLimiter;
function makeLimiter(opts) {
    const buckets = new Map();
    // Garbage-collect périodique des buckets expirés (évite de fuir de la mémoire
    // sur le long terme avec des millions d'IPs distinctes).
    const gc = setInterval(() => {
        const now = Date.now();
        for (const [k, b] of buckets) {
            if (b.resetAt < now)
                buckets.delete(k);
        }
    }, opts.windowMs);
    // .unref() pour que ce timer ne bloque pas la fermeture du process
    if (typeof gc.unref === "function")
        gc.unref();
    return (req, res, next) => {
        if (opts.skip?.(req)) {
            next();
            return;
        }
        const key = req.ip ?? "unknown";
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt < now) {
            bucket = { count: 0, resetAt: now + opts.windowMs };
            buckets.set(key, bucket);
        }
        if (bucket.count >= opts.limit) {
            const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
            console.warn(`[rate-limit:${opts.name}] bloqué IP=${key} (>${opts.limit} en ${opts.windowMs / 60000}min)`);
            res.set("Retry-After", String(retryAfter));
            res.set("X-RateLimit-Limit", String(opts.limit));
            res.set("X-RateLimit-Remaining", "0");
            res.status(429).json({ message: opts.message });
            return;
        }
        bucket.count++;
        res.set("X-RateLimit-Limit", String(opts.limit));
        res.set("X-RateLimit-Remaining", String(opts.limit - bucket.count));
        // Si skipSuccess : on annule le coût du compteur après envoi de la réponse
        // si elle est 2xx/3xx.
        if (opts.skipSuccess) {
            res.on("finish", () => {
                if (res.statusCode < 400 && bucket) {
                    bucket.count = Math.max(0, bucket.count - 1);
                }
            });
        }
        next();
    };
}
/**
 * Rate-limit STRICT pour le login : protège contre brute-force.
 * Par IP : N tentatives par fenêtre de M minutes.
 * Compte uniquement les requêtes en échec (skipSuccess).
 */
function buildLoginRateLimiter(cfg) {
    return makeLimiter({
        name: "login",
        windowMs: cfg.RATE_LIMIT_LOGIN_WINDOW_MIN * 60 * 1000,
        limit: cfg.RATE_LIMIT_LOGIN_MAX,
        skipSuccess: true,
        message: "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
    });
}
/**
 * Rate-limit GLOBAL sur l'API : protège contre les bots / scrapers.
 * Plus permissif que login (un user normal peut faire plusieurs requêtes/sec).
 */
function buildApiRateLimiter(cfg) {
    return makeLimiter({
        name: "api",
        windowMs: cfg.RATE_LIMIT_API_WINDOW_MIN * 60 * 1000,
        limit: cfg.RATE_LIMIT_API_MAX,
        // Le health check est exempt (utile pour monitoring externe)
        skip: (req) => req.path === "/api/health",
        message: "Trop de requêtes. Réessayez plus tard.",
    });
}
/**
 * Rate-limit des routes IA (/api/ai/*) : l'inférence CPU est coûteuse sur
 * un hébergement mutualisé — on borne par IP, en comptant toutes les
 * requêtes (même réussies).
 */
function buildAiRateLimiter(cfg) {
    return makeLimiter({
        name: "ai",
        windowMs: cfg.RATE_LIMIT_AI_WINDOW_MIN * 60 * 1000,
        limit: cfg.RATE_LIMIT_AI_MAX,
        message: "Trop de requêtes IA. Réessayez dans quelques instants.",
    });
}
/**
 * Rate-limit pour la demande de réinitialisation de mot de passe.
 * Compte TOUTES les requêtes (skipSuccess=false) car la réponse est toujours
 * 200 (anti-énumération) : protège contre l'email-bombing. Réutilise la
 * fenêtre/quota du login.
 */
function buildPasswordResetRateLimiter(cfg) {
    return makeLimiter({
        name: "password-reset",
        windowMs: cfg.RATE_LIMIT_LOGIN_WINDOW_MIN * 60 * 1000,
        limit: cfg.RATE_LIMIT_LOGIN_MAX,
        message: "Trop de demandes de réinitialisation. Réessayez dans quelques minutes.",
    });
}
