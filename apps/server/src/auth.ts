// ═══════════════════════════════════════════════════════════════════════════
// Auth — JWT helpers + middleware Express
// ═══════════════════════════════════════════════════════════════════════════

import jwt, { type SignOptions } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Config } from "./config";

export interface AuthPayload {
  sub: number;
  username: string;
  role: string;
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
  }
}

export function requireAuth(cfg: Config) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
    req.user = payload;
    next();
  };
}
