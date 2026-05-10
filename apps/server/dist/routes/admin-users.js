"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Routes admin /api/admin/users — gestion des utilisateurs (admin only)
//
// Endpoints :
//   GET    /api/admin/users                — liste tous les users
//   GET    /api/admin/users/:id            — détail d'un user
//   POST   /api/admin/users                — créer un user (génère temp password)
//   PATCH  /api/admin/users/:id            — modifier (role, profil, disabled)
//   POST   /api/admin/users/:id/reset-password — regénère un password temporaire
//   DELETE /api/admin/users/:id            — soft-delete (disabled = 1)
//
// Toutes ces routes sont gardées par requireAuth + requireRole("admin").
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__helpers = void 0;
exports.buildAdminUsersRouter = buildAdminUsersRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../auth");
const rbac_1 = require("../rbac");
const audit_1 = require("../audit");
const email_1 = require("../email");
const cpanel_email_1 = require("../cpanel-email");
const SALT_LEN = 16;
const KEY_LEN = 64;
function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(SALT_LEN);
    const hash = node_crypto_1.default.scryptSync(password, salt, KEY_LEN);
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
/** Génère un mot de passe temporaire aléatoire (16 caractères ASCII safe). */
function generateTempPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = node_crypto_1.default.randomBytes(16);
    let out = "";
    for (let i = 0; i < 16; i++) {
        out += chars[bytes[i] % chars.length];
    }
    return out;
}
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
const CreateUserSchema = zod_1.z.object({
    username: zod_1.z.string().min(2).max(64).regex(/^[a-zA-Z0-9._-]+$/, {
        message: "Username : lettres, chiffres, points, tirets uniquement",
    }),
    email: zod_1.z.string().email().max(255).optional().default(""),
    firstName: zod_1.z.string().max(128).optional().default(""),
    lastName: zod_1.z.string().max(128).optional().default(""),
    role: zod_1.z.enum(rbac_1.ROLES),
    password: zod_1.z.string().min(8).max(256).optional(), // si absent, on génère
    /** Si true, crée aussi une mailbox cPanel (utilise data.email). Le domaine
     *  doit matcher CPANEL_EMAIL_DOMAIN configuré côté serveur. */
    createMailbox: zod_1.z.boolean().optional().default(false),
    /** Adresse alternative où envoyer le welcome email avec les credentials.
     *  Utile si on crée une mailbox pro mais que l'utilisateur n'y a pas
     *  encore accès — on envoie alors les accès à son email perso (Gmail). */
    notificationEmail: zod_1.z.string().email().max(255).optional(),
});
const UpdateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255).optional(),
    firstName: zod_1.z.string().max(128).optional(),
    lastName: zod_1.z.string().max(128).optional(),
    avatarUrl: zod_1.z.string().url().max(512).optional().or(zod_1.z.literal("")),
    role: zod_1.z.enum(rbac_1.ROLES).optional(),
    disabled: zod_1.z.boolean().optional(),
});
/** Convertit une row MySQL en réponse JSON publique (pas de hash). */
function publicUser(row) {
    return {
        id: row.id,
        username: row.username,
        email: row.email ?? "",
        firstName: row.firstName ?? "",
        lastName: row.lastName ?? "",
        avatarUrl: row.avatarUrl ?? "",
        role: row.role,
        disabled: Boolean(row.disabled),
        mustChangePassword: Boolean(row.mustChangePassword),
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        companyId: row.companyId,
    };
}
function buildAdminUsersRouter(db, cfg) {
    const router = (0, express_1.Router)();
    // Toutes les routes ici exigent admin
    router.use((0, auth_1.requireAuth)(cfg), (0, rbac_1.requireRole)("admin"));
    // ─── Liste (scopée par tenant) ────────────────────────────────────────
    router.get("/", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query(`SELECT id, username, email, firstName, lastName, avatarUrl,
                role, disabled, mustChangePassword, lastLoginAt,
                createdAt, updatedAt, companyId
         FROM users WHERE companyId = ? ORDER BY createdAt DESC`, [tenantId]);
        res.json(rows.map(publicUser));
    }));
    // ─── Détail ───────────────────────────────────────────────────────────
    router.get("/:id", wrap(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            res.status(400).json({ message: "ID invalide" });
            return;
        }
        const [rows] = await db.query(`SELECT id, username, email, firstName, lastName, avatarUrl,
                role, disabled, mustChangePassword, lastLoginAt,
                createdAt, updatedAt, companyId
         FROM users WHERE id = ? AND companyId = ? LIMIT 1`, [id, req.user?.companyId ?? 1]);
        const row = rows[0];
        if (!row) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        res.json(publicUser(row));
    }));
    // ─── Création ─────────────────────────────────────────────────────────
    router.post("/", wrap(async (req, res) => {
        const parsed = CreateUserSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                message: "Payload invalide",
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }
        const data = parsed.data;
        // Unicité username (globale — un username doit être unique cross-tenant
        // car c'est un identifiant de login direct ; pas de qualification par tenant)
        const [dup] = await db.query("SELECT id FROM users WHERE username = ? LIMIT 1", [data.username]);
        if (dup.length > 0) {
            res.status(409).json({ message: "Username déjà utilisé" });
            return;
        }
        // Génération du temp password si pas fourni
        const tempPassword = data.password ?? generateTempPassword();
        const wasGenerated = data.password === undefined;
        const hash = hashPassword(tempPassword);
        // Multi-tenant : le nouveau user hérite de la company de l'admin créateur.
        const tenantId = req.user?.companyId ?? 1;
        const [result] = await db.execute(`INSERT INTO users
           (username, passwordHash, email, firstName, lastName, role,
            mustChangePassword, companyId)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`, [
            data.username,
            hash,
            data.email,
            data.firstName,
            data.lastName,
            data.role,
            tenantId,
        ]);
        const [rows] = await db.query(`SELECT id, username, email, firstName, lastName, avatarUrl,
                role, disabled, mustChangePassword, lastLoginAt,
                createdAt, updatedAt, companyId
         FROM users WHERE id = ? LIMIT 1`, [result.insertId]);
        const created = rows[0];
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "user_created",
            resource: "users",
            resourceId: String(created.id),
            meta: {
                username: created.username,
                role: created.role,
                tempPasswordGenerated: wasGenerated,
            },
        });
        // ─── Création mailbox cPanel (optionnelle) ─────────────────────────
        // Si l'admin a coché "Créer une mailbox cPanel" ET que l'email est
        // dans le domaine autorisé, on crée la boîte mail via UAPI.
        // Le password de la mailbox = même que le tempPassword BatiDesk
        // (l'utilisateur les change tous les deux indépendamment ensuite).
        let mailboxCreated = false;
        let mailboxError;
        let mailboxAlreadyExists = false;
        if (data.createMailbox && created.email) {
            const r = await (0, cpanel_email_1.createMailbox)(cfg, {
                email: created.email,
                password: tempPassword,
            });
            mailboxCreated = r.ok;
            mailboxError = r.error;
            mailboxAlreadyExists = Boolean(r.alreadyExists);
            if (r.ok) {
                await db.execute("UPDATE users SET cpanelEmailCreated = 1 WHERE id = ?", [created.id]);
                void (0, audit_1.writeAudit)(db, {
                    ...(0, audit_1.audited)(req),
                    action: "cpanel_mailbox_created",
                    resource: "users",
                    resourceId: String(created.id),
                    meta: { email: created.email, quotaMB: cfg.CPANEL_EMAIL_QUOTA_MB },
                });
            }
        }
        // ─── Envoi email de bienvenue (best-effort, async) ─────────────────
        // Destination : notificationEmail si fournie (perso), sinon l'email
        // pro. Logique : si on crée une mailbox cPanel pour l'utilisateur, il
        // ne peut pas encore checker son email pro -> on envoie souvent à son
        // adresse perso. L'admin choisit dans la modal.
        const notifyTo = data.notificationEmail || created.email || "";
        let emailSent = false;
        let emailError;
        let emailSentTo;
        if (notifyTo) {
            const [companyRows] = await db.query("SELECT name FROM company WHERE id = ? LIMIT 1", [tenantId]);
            const companyName = companyRows[0]?.name ?? "BatiDesk";
            const html = (0, email_1.welcomeEmailHtml)({
                firstName: created.firstName ?? "",
                username: created.username,
                tempPassword,
                loginUrl: cfg.APP_URL || "https://intranet.jacobhabitat-dev.fr",
                companyName,
                mailbox: mailboxCreated
                    ? {
                        email: created.email,
                        imapHost: cfg.CPANEL_HOST || "intranet.jacobhabitat-dev.fr",
                        smtpHost: cfg.CPANEL_HOST || "intranet.jacobhabitat-dev.fr",
                        webmailUrl: `https://${cfg.CPANEL_HOST || "intranet.jacobhabitat-dev.fr"}/webmail`,
                    }
                    : undefined,
            });
            const result = await (0, email_1.sendMail)(cfg, {
                to: notifyTo,
                subject: `[${companyName}] Vos accès BatiDesk`,
                html,
            });
            emailSent = result.ok;
            emailError = result.skipped ? "SMTP non configuré" : result.error;
            emailSentTo = notifyTo;
        }
        res.status(201).json({
            ...publicUser(created),
            // ⚠️ Le mot de passe temporaire n'est exposé QU'À LA CRÉATION,
            // jamais relisible ensuite. L'admin doit le copier maintenant.
            tempPassword: wasGenerated ? tempPassword : undefined,
            emailSent,
            emailError,
            emailSentTo,
            mailboxCreated,
            mailboxError,
            mailboxAlreadyExists,
            cpanelEnabled: (0, cpanel_email_1.isCpanelConfigured)(cfg),
        });
    }));
    // ─── Modification ─────────────────────────────────────────────────────
    router.patch("/:id", wrap(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            res.status(400).json({ message: "ID invalide" });
            return;
        }
        const parsed = UpdateUserSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                message: "Payload invalide",
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }
        // Garde-fou : l'admin ne peut pas désactiver SON PROPRE compte
        // (sinon il se locke out)
        if (req.user?.sub === id &&
            parsed.data.disabled === true) {
            res
                .status(400)
                .json({ message: "Impossible de désactiver votre propre compte" });
            return;
        }
        // Garde-fou : un admin ne peut pas se downgrader lui-même
        if (req.user?.sub === id && parsed.data.role && parsed.data.role !== "admin") {
            res.status(400).json({
                message: "Impossible de changer votre propre rôle (demandez à un autre admin)",
            });
            return;
        }
        const sets = [];
        const values = [];
        for (const [k, v] of Object.entries(parsed.data)) {
            if (v === undefined)
                continue;
            sets.push(`\`${k}\` = ?`);
            values.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
        }
        if (!sets.length) {
            res.status(400).json({ message: "Aucun champ modifiable fourni" });
            return;
        }
        // Snapshot avant pour traquer les vrais changements (scopé tenant)
        const tenantId = req.user?.companyId ?? 1;
        const [beforeRows] = await db.query("SELECT role, disabled, email, firstName, lastName FROM users WHERE id = ? AND companyId = ? LIMIT 1", [id, tenantId]);
        const before = beforeRows[0];
        if (!before) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        values.push(id);
        values.push(tenantId);
        await db.execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`, values);
        const [rows] = await db.query(`SELECT id, username, email, firstName, lastName, avatarUrl,
                role, disabled, mustChangePassword, lastLoginAt,
                createdAt, updatedAt, companyId
         FROM users WHERE id = ? AND companyId = ? LIMIT 1`, [id, req.user?.companyId ?? 1]);
        const row = rows[0];
        if (!row) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        // Logs spécifiques selon le type de changement
        if (before && parsed.data.role && parsed.data.role !== before.role) {
            void (0, audit_1.writeAudit)(db, {
                ...(0, audit_1.audited)(req),
                action: "user_role_changed",
                resource: "users",
                resourceId: String(id),
                meta: {
                    username: row.username,
                    oldRole: before.role,
                    newRole: parsed.data.role,
                },
            });
        }
        if (before && parsed.data.disabled !== undefined && Boolean(before.disabled) !== parsed.data.disabled) {
            void (0, audit_1.writeAudit)(db, {
                ...(0, audit_1.audited)(req),
                action: parsed.data.disabled ? "user_disabled" : "user_enabled",
                resource: "users",
                resourceId: String(id),
                meta: { username: row.username },
            });
        }
        const otherFieldsChanged = Object.keys(parsed.data).filter((k) => k !== "role" && k !== "disabled");
        if (otherFieldsChanged.length > 0) {
            void (0, audit_1.writeAudit)(db, {
                ...(0, audit_1.audited)(req),
                action: "user_updated",
                resource: "users",
                resourceId: String(id),
                meta: { username: row.username, changedFields: otherFieldsChanged },
            });
        }
        res.json(publicUser(row));
    }));
    // ─── Reset password ───────────────────────────────────────────────────
    router.post("/:id/reset-password", wrap(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            res.status(400).json({ message: "ID invalide" });
            return;
        }
        const tenantId = req.user?.companyId ?? 1;
        const tempPassword = generateTempPassword();
        const hash = hashPassword(tempPassword);
        const [result] = await db.execute("UPDATE users SET passwordHash = ?, mustChangePassword = 1 WHERE id = ? AND companyId = ?", [hash, id, tenantId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        // Récupérer username pour log lisible
        const [rows] = await db.query("SELECT username FROM users WHERE id = ? LIMIT 1", [id]);
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "user_password_reset",
            resource: "users",
            resourceId: String(id),
            meta: { username: rows[0]?.username ?? "" },
        });
        res.json({ tempPassword });
    }));
    // ─── Soft-delete (désactivation) ──────────────────────────────────────
    router.delete("/:id", wrap(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            res.status(400).json({ message: "ID invalide" });
            return;
        }
        if (req.user?.sub === id) {
            res
                .status(400)
                .json({ message: "Impossible de désactiver votre propre compte" });
            return;
        }
        const tenantIdDel = req.user?.companyId ?? 1;
        const [beforeRows] = await db.query("SELECT username FROM users WHERE id = ? AND companyId = ? LIMIT 1", [id, tenantIdDel]);
        const [result] = await db.execute("UPDATE users SET disabled = 1 WHERE id = ? AND companyId = ?", [id, tenantIdDel]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "user_disabled",
            resource: "users",
            resourceId: String(id),
            meta: { username: beforeRows[0]?.username ?? "" },
        });
        res.status(204).end();
    }));
    // ─── Hard delete (suppression définitive) ─────────────────────────────
    // Différent du soft-delete (DELETE /:id qui désactive). Ici on supprime
    // physiquement la row de la table users.
    // Garde-fous :
    //   • impossible de se supprimer soi-même (sinon plus personne pour gérer)
    //   • impossible de supprimer le dernier admin actif d'une company
    // Les rows de données qui ont createdBy = ce user seront orphelines (FK
    // soft, pas de contrainte ON DELETE CASCADE) → la colonne pointera vers
    // un ID inexistant et l'UI affichera "—" via UserBadge.
    router.delete("/:id/permanent", wrap(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            res.status(400).json({ message: "ID invalide" });
            return;
        }
        if (req.user?.sub === id) {
            res
                .status(400)
                .json({ message: "Impossible de supprimer votre propre compte" });
            return;
        }
        const tenantId = req.user?.companyId ?? 1;
        // Récupère l'utilisateur cible (scopé tenant)
        const [targetRows] = await db.query("SELECT id, username, role, email, cpanelEmailCreated FROM users WHERE id = ? AND companyId = ? LIMIT 1", [id, tenantId]);
        const target = targetRows[0];
        if (!target) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        // Garde-fou : pas de suppression du dernier admin actif
        if (target.role === "admin") {
            const [adminCount] = await db.query(`SELECT COUNT(*) AS n FROM users
           WHERE role = 'admin' AND disabled = 0 AND companyId = ?`, [tenantId]);
            const n = Number(adminCount[0].n);
            if (n <= 1) {
                res.status(400).json({
                    message: "Impossible de supprimer le dernier administrateur. Promouvez d'abord un autre utilisateur en admin.",
                });
                return;
            }
        }
        // Hard delete
        const [result] = await db.execute("DELETE FROM users WHERE id = ? AND companyId = ?", [id, tenantId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        // Si l'utilisateur avait une mailbox cPanel, on la supprime aussi
        // (best-effort, ne fait pas échouer la suppression user si ça plante).
        let mailboxDeleted = false;
        let mailboxDeleteError;
        if (target.cpanelEmailCreated && target.email) {
            const r = await (0, cpanel_email_1.deleteMailbox)(cfg, target.email);
            mailboxDeleted = r.ok;
            mailboxDeleteError = r.error;
            if (r.ok) {
                void (0, audit_1.writeAudit)(db, {
                    ...(0, audit_1.audited)(req),
                    action: "cpanel_mailbox_deleted",
                    resource: "users",
                    resourceId: String(id),
                    meta: { email: target.email },
                });
            }
        }
        void (0, audit_1.writeAudit)(db, {
            ...(0, audit_1.audited)(req),
            action: "user_deleted_permanent",
            resource: "users",
            resourceId: String(id),
            meta: {
                username: target.username,
                role: target.role,
                email: target.email ?? "",
                mailboxDeleted,
                mailboxDeleteError,
            },
        });
        res.status(204).end();
    }));
    return router;
}
// Pour qu'un autre service (login) puisse vérifier qu'un user n'est pas disabled
exports.__helpers = { hashPassword, generateTempPassword, isValidRole: rbac_1.isValidRole };
//# sourceMappingURL=admin-users.js.map