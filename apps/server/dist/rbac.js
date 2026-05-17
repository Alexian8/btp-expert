"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLES = void 0;
exports.isValidRole = isValidRole;
exports.isSuperAdmin = isSuperAdmin;
exports.roleAtLeast = roleAtLeast;
exports.requireRole = requireRole;
exports.canSeeAllData = canSeeAllData;
exports.ROLES = [
    "super_admin",
    "admin",
    "manager",
    "accountant",
    "worker",
    "viewer",
];
function isValidRole(s) {
    return typeof s === "string" && exports.ROLES.includes(s);
}
/** Hiérarchie : `super_admin > admin >= manager >= accountant >= worker >= viewer`. */
const ROLE_RANK = {
    super_admin: 200,
    admin: 100,
    manager: 80,
    accountant: 60,
    worker: 40,
    viewer: 20,
};
/** True si le user est super_admin (éditeur BatiDesk, pas un admin de company). */
function isSuperAdmin(role) {
    return role === "super_admin";
}
function roleAtLeast(actual, minimum) {
    if (!isValidRole(actual))
        return false;
    return ROLE_RANK[actual] >= ROLE_RANK[minimum];
}
/**
 * Middleware Express qui exige un rôle minimum.
 * À chaîner APRÈS requireAuth (qui populate req.user).
 *
 * @example
 *   app.use("/api/admin/users", requireAuth(cfg), requireRole("admin"), router);
 */
function requireRole(minimum) {
    return (req, res, next) => {
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
function canSeeAllData(role) {
    return roleAtLeast(role, "accountant");
}
