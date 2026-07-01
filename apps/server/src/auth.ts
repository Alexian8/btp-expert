// ═══════════════════════════════════════════════════════════════════════════
// Auth — JWT helpers + middleware Express
// ═══════════════════════════════════════════════════════════════════════════

import jwt, { type SignOptions } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Config } from "./config";
import type { DB } from "./db";
import { isTokenRevoked, isUserSessionRevoked } from "./token-revocation";

export interface AuthPayload {
  sub: number;
  username: string;
  role: string;
  /** Multi-tenant : ID de l'entreprise du user. Sert à isoler les données. */
  companyId: number;
  /** `exp` standard JWT (epoch en secondes). Présent après jwt.verify. */
  exp?: number;
  /** `iat` standard JWT (epoch en secondes). Présent après jwt.verify. */
  iat?: number;
}

export function signToken(payload: AuthPayload, cfg: Config): string {
  const options: SignOptions = { expiresIn: cfg.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(payload, cfg.JWT_SECRET, options);
}

export function verifyToken(token: string, cfg: Config): AuthPayload | null {
  try {
    return jwt.verify(token, cfg.JWT_SECRET) as unknown as AuthPayload;
  } catch {
    return null;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthPayload;
    /** Token brut tel qu'envoyé dans l'en-tête Authorization, sans le préfixe Bearer. */
    authToken?: string;
  }
}

export function requireAuth(cfg: Config, db?: DB) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ message: "Token manquant" });
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    const payload = verifyToken(token, cfg);
    if (!payload) {
      res.status(401).json({ message: "Token invalide ou expiré" });
      return;
    }
    // Vérification de la blacklist (logout, password-change). Si la DB n'est
    // pas fournie (tests legacy), on saute — le contrôle reste solide là où
    // ça compte (production utilise toujours db).
    if (db) {
      try {
        if (await isTokenRevoked(db, token)) {
          res.status(401).json({ message: "Token révoqué" });
          return;
        }
        // Révocation PAR UTILISATEUR (désactivation admin, reset password) :
        // tout JWT émis avant users.tokensInvalidBefore est refusé.
        if (await isUserSessionRevoked(db, payload.sub, payload.iat)) {
          res.status(401).json({ message: "Session révoquée" });
          return;
        }
      } catch (e) {
        // En cas de panne DB on log mais on n'expose pas l'API : on rejette
        // par sécurité, mieux vaut un 503 qu'un token révoqué accepté.
        console.error("[auth] isTokenRevoked failed:", e);
        res.status(503).json({ message: "Service auth indisponible" });
        return;
      }
    }
    req.user = payload;
    req.authToken = token;
    next();
  };
}
