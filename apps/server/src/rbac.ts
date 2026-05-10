// ═══════════════════════════════════════════════════════════════════════════
// RBAC — Role-Based Access Control
//
// Système de rôles centralisé pour BatiDesk.
// Hiérarchie (du plus fort au plus faible) :
//   super_admin — éditeur SaaS BatiDesk : crée/désactive les entreprises
//                 clientes. Pas rattaché à une company spécifique (companyId
//                 NULL en DB). N'accède PAS aux données métier des tenants.
//   admin       — accès total à SA company, gestion users, paramétrage entreprise
//   manager     — gestion devis/factures/clients/chantiers de toute l'équipe
//   accountant  — accès lecture sur tout, écriture sur factures/dépenses
//   worker      — accès uniquement sur ses propres données (auteur)
//   viewer      — lecture seule sur ce qui lui est assigné
// ═══════════════════════════════════════════════════════════════════════════

import type { NextFunction, Request, Response } from "express";

export const ROLES = [
  "super_admin",
  "admin",
  "manager",
  "accountant",
  "worker",
  "viewer",
] as const;
export type Role = (typeof ROLES)[number];

export function isValidRole(s: unknown): s is Role {
  return typeof s === "string" && (ROLES as readonly string[]).includes(s);
}

/** Hiérarchie : `super_admin > admin >= manager >= accountant >= worker >= viewer`. */
const ROLE_RANK: Record<Role, number> = {
  super_admin: 200,
  admin: 100,
  manager: 80,
  accountant: 60,
  worker: 40,
  viewer: 20,
};

/** True si le user est super_admin (éditeur BatiDesk, pas un admin de company). */
export function isSuperAdmin(role: string | undefined): boolean {
  return role === "super_admin";
}

export function roleAtLeast(actual: string | undefined, minimum: Role): boolean {
  if (!isValidRole(actual)) return false;
  return ROLE_RANK[actual] >= ROLE_RANK[minimum];
}

/**
 * Middleware Express qui exige un rôle minimum.
 * À chaîner APRÈS requireAuth (qui populate req.user).
 *
 * @example
 *   app.use("/api/admin/users", requireAuth(cfg), requireRole("admin"), router);
 */
export function requireRole(minimum: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Non authentifié" });
      return;
    }
    if (!roleAtLeast(req.user.role, minimum)) {
      res.status(403).json({
        message: `Accès refusé : rôle '${minimum}' requis`,
      });
      return;
    }
    next();
  };
}

/**
 * Helper : un utilisateur peut-il voir TOUTES les données de l'entreprise ?
 * Worker/viewer ne voient que ce qu'ils ont créé ou ce qui leur est assigné.
 */
export function canSeeAllData(role: string | undefined): boolean {
  return roleAtLeast(role, "accountant");
}
