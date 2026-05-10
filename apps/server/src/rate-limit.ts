// ═══════════════════════════════════════════════════════════════════════════
// Rate limiting — protection contre brute-force et abus API
//
// Stockage en mémoire (par défaut d'express-rate-limit). Suffisant pour
// 1 instance Node. En cas de scale horizontal (cluster), utiliser
// rate-limit-redis pour partager le compteur.
// ═══════════════════════════════════════════════════════════════════════════

import rateLimit from "express-rate-limit";
import type { Config } from "./config";

/**
 * Rate-limit STRICT pour le login : protège contre brute-force.
 * Par IP : N tentatives par fenêtre de M minutes.
 * Compte uniquement les requêtes en échec (skipSuccessfulRequests).
 */
export function buildLoginRateLimiter(cfg: Config) {
  return rateLimit({
    windowMs: cfg.RATE_LIMIT_LOGIN_WINDOW_MIN * 60 * 1000,
    limit: cfg.RATE_LIMIT_LOGIN_MAX,
    skipSuccessfulRequests: true, // ne pénalise pas les login réussis
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      message:
        "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
    },
    handler: (req, res, _next, options) => {
      console.warn(
        `[rate-limit] LOGIN bloqué pour IP=${req.ip} (>${options.limit} tentatives en ${options.windowMs / 60000}min)`
      );
      res.status(options.statusCode).json(options.message);
    },
  });
}

/**
 * Rate-limit GLOBAL sur l'API : protège contre les bots / scrapers.
 * Plus permissif que login (un user normal peut faire plusieurs requêtes/sec).
 */
export function buildApiRateLimiter(cfg: Config) {
  return rateLimit({
    windowMs: cfg.RATE_LIMIT_API_WINDOW_MIN * 60 * 1000,
    limit: cfg.RATE_LIMIT_API_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => {
      // Le health check est exempt (utile pour monitoring externe)
      return req.path === "/api/health";
    },
    message: {
      message: "Trop de requêtes. Réessayez plus tard.",
    },
    handler: (req, res, _next, options) => {
      console.warn(
        `[rate-limit] API bloqué pour IP=${req.ip} sur ${req.path}`
      );
      res.status(options.statusCode).json(options.message);
    },
  });
}
