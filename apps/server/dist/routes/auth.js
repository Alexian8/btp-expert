"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Routes Auth — login / logout / me / bootstrap
// Hash des mots de passe : scrypt (Node natif).
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testHelpers = void 0;
exports.validatePasswordPolicy = validatePasswordPolicy;
exports.buildAuthRouter = buildAuthRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../auth");
const audit_1 = require("../audit");
const cpanel_email_1 = require("../cpanel-email");
const token_revocation_1 = require("../token-revocation");
const email_1 = require("../email");
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure
function sha256(s) {
    return node_crypto_1.default.createHash("sha256").update(s).digest("hex");
}
function resetEmailHtml(link, expiresMinutes) {
    return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:560px;width:100%;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:28px 36px;color:#fff;"><h1 style="margin:0;font-size:20px;">BatiDesk</h1></td></tr>
      <tr><td style="padding:32px 36px;">
        <h2 style="margin:0 0 12px;font-size:18px;">Réinitialisation de votre mot de passe</h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous (lien valable ${expiresMinutes} minutes).</p>
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:8px;">Choisir un nouveau mot de passe</a>
        <p style="margin:22px 0 0;font-size:12px;color:#64748b;line-height:1.6;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.<br>Lien : <a href="${link}" style="color:#2563eb;word-break:break-all;">${link}</a></p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
const SALT_LEN = 16;
const KEY_LEN = 64;
function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(SALT_LEN);
    const hash = node_crypto_1.default.scryptSync(password, salt, KEY_LEN);
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
function verifyPassword(password, stored) {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex)
        return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = node_crypto_1.default.scryptSync(password, salt, expected.length);
    return node_crypto_1.default.timingSafeEqual(expected, actual);
}
/**
 * Politique de mot de passe (alignée sur l'UI ChangePasswordModal) :
 * ≥ 10 caractères, au moins une majuscule, une minuscule et un chiffre.
 * Retourne un message d'erreur, ou null si le mot de passe est conforme.
 * Appliquée côté serveur (changement de mot de passe, réinitialisation).
 */
function validatePasswordPolicy(pw) {
    if (pw.length < 10)
        return "Le mot de passe doit contenir au moins 10 caractères";
    if (!/[A-Z]/.test(pw))
        return "Le mot de passe doit contenir au moins une majuscule";
    if (!/[a-z]/.test(pw))
        return "Le mot de passe doit contenir au moins une minuscule";
    if (!/[0-9]/.test(pw))
        return "Le mot de passe doit contenir au moins un chiffre";
    return null;
}
const LoginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1).max(64),
    password: zod_1.z.string().min(1).max(256),
});
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
function buildAuthRouter(db, cfg) {
    const router = (0, express_1.Router)();
    router.post("/login", wrap(async (req, res) => {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const [rows] = await db.query(`SELECT id, username, passwordHash, role, disabled, mustChangePassword,
                email, firstName, lastName, companyId, failedLoginAttempts, lockedUntil
         FROM users WHERE username = ? LIMIT 1`, [parsed.data.username]);
        const row = rows[0];
        const ip = req.ip ?? "";
        const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 500);
        // Délai constant pour limiter les attaques par timing (existence compte).
        const failDelay = () => new Promise((r) => setTimeout(r, 200));
        // Utilisateur inconnu : message générique, pas de compteur (on ne peut
        // pas verrouiller un compte qui n'existe pas).
        if (!row) {
            console.warn(`[auth] LOGIN FAIL ip=${ip} username=${parsed.data.username} reason=unknown_user`);
            void (0, audit_1.writeAudit)(db, {
                userId: null,
                username: parsed.data.username,
                companyId: null,
                action: "login_fail",
                ip,
                userAgent,
                meta: { reason: "unknown_user" },
            });
            await failDelay();
            res.status(401).json({ message: "Identifiants invalides" });
            return;
        }
        // Compte verrouillé (trop de tentatives) : refuser même si le mot de
        // passe est correct, tant que la période de verrouillage n'est pas écoulée.
        const lockedUntil = Number(row.lockedUntil ?? 0);
        if (lockedUntil > Date.now()) {
            const minutesLeft = Math.ceil((lockedUntil - Date.now()) / 60_000);
            console.warn(`[auth] LOGIN BLOCKED locked ip=${ip} username=${row.username}`);
            void (0, audit_1.writeAudit)(db, {
                userId: row.id,
                username: row.username,
                companyId: row.companyId ?? null,
                action: "login_blocked",
                ip,
                userAgent,
                meta: { reason: "locked", minutesLeft },
            });
            res.status(429).json({
                message: `Compte temporairement verrouillé suite à trop de tentatives. Réessayez dans ${minutesLeft} min.`,
            });
            return;
        }
        // Mauvais mot de passe : incrémente le compteur, verrouille au seuil.
        if (!verifyPassword(parsed.data.password, row.passwordHash)) {
            const attempts = (row.failedLoginAttempts ?? 0) + 1;
            const reachedMax = attempts >= cfg.LOGIN_LOCKOUT_MAX_ATTEMPTS;
            if (reachedMax) {
                const until = Date.now() + cfg.LOGIN_LOCKOUT_MINUTES * 60_000;
                await db.execute("UPDATE users SET failedLoginAttempts = ?, lockedUntil = ? WHERE id = ?", [attempts, until, row.id]);
            }
            else {
                await db.execute("UPDATE users SET failedLoginAttempts = ? WHERE id = ?", [attempts, row.id]);
            }
            console.warn(`[auth] LOGIN FAIL ip=${ip} username=${row.username} reason=bad_password attempts=${attempts}${reachedMax ? " LOCKED" : ""}`);
            void (0, audit_1.writeAudit)(db, {
                userId: row.id,
                username: row.username,
                companyId: row.companyId ?? null,
                action: reachedMax ? "login_blocked" : "login_fail",
                ip,
                userAgent,
                meta: reachedMax ? { reason: "locked", attempts } : { reason: "bad_password", attempts },
            });
            await failDelay();
            res.status(401).json({ message: "Identifiants invalides" });
            return;
        }
        // Compte désactivé : refuser même si le password est correct
        if (row.disabled) {
            console.warn(`[auth] LOGIN BLOCKED disabled account ip=${ip} username=${parsed.data.username}`);
            void (0, audit_1.writeAudit)(db, {
                userId: row.id,
                username: row.username,
                companyId: row.companyId ?? null,
                action: "login_blocked",
                ip,
                userAgent,
                meta: { reason: "disabled" },
            });
            res.status(403).json({ message: "Compte désactivé. Contactez un administrateur." });
            return;
        }
        // Multi-tenant : si la company est désactivée par super_admin → refuser
        // Le super_admin lui-même n'a pas de companyId → bypass.
        if (row.companyId != null && row.role !== "super_admin") {
            const [activeRows] = await db.query("SELECT isActive FROM company WHERE id = ? LIMIT 1", [row.companyId]);
            const companyActive = activeRows[0]
                ? Boolean(activeRows[0].isActive ?? 1)
                : true;
            if (!companyActive) {
                console.warn(`[auth] LOGIN BLOCKED company disabled companyId=${row.companyId} username=${parsed.data.username}`);
                void (0, audit_1.writeAudit)(db, {
                    userId: row.id,
                    username: row.username,
                    companyId: row.companyId ?? null,
                    action: "login_blocked",
                    ip,
                    userAgent,
                    meta: { reason: "company_disabled", companyId: row.companyId },
                });
                res.status(403).json({
                    message: "Cette entreprise est désactivée. Contactez le support BatiDesk.",
                });
                return;
            }
        }
        console.log(`[auth] LOGIN OK ip=${ip} username=${row.username} role=${row.role}`);
        void (0, audit_1.writeAudit)(db, {
            userId: row.id,
            username: row.username,
            companyId: row.companyId ?? null,
            action: "login_ok",
            ip,
            userAgent,
            meta: { role: row.role },
        });
        // Met à jour lastLoginAt + réinitialise le compteur d'échecs / le
        // verrouillage (best-effort, ne bloque pas la réponse).
        db.execute("UPDATE users SET lastLoginAt = CURRENT_TIMESTAMP, failedLoginAttempts = 0, lockedUntil = 0 WHERE id = ?", [row.id]).catch((e) => console.warn("[auth] update lastLoginAt failed:", e));
        const companyId = Number(row.companyId ?? 1);
        const payload = {
            sub: row.id,
            username: row.username,
            role: row.role,
            companyId,
        };
        const token = (0, auth_1.signToken)(payload, cfg);
        // Récupère le statut setup de la company pour l'onboarding flow
        const [companyRows] = await db.query("SELECT isSetupComplete, name FROM company WHERE id = ? LIMIT 1", [companyId]);
        const company = companyRows[0] ?? {};
        res.json({
            id: row.id,
            username: row.username,
            role: row.role,
            email: row.email ?? "",
            firstName: row.firstName ?? "",
            lastName: row.lastName ?? "",
            mustChangePassword: Boolean(row.mustChangePassword),
            companyId,
            isSetupComplete: Boolean(company.isSetupComplete),
            companyName: company.name ?? "",
            token,
        });
    }));
    // ─── Changement de mot de passe (user authentifié) ────────────────────
    router.post("/change-password", wrap(async (req, res) => {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            res.status(401).json({ message: "Token manquant" });
            return;
        }
        const payload = (0, auth_1.verifyToken)(header.slice(7), cfg);
        if (!payload) {
            res.status(401).json({ message: "Token invalide" });
            return;
        }
        const schema = zod_1.z.object({
            oldPassword: zod_1.z.string().min(1).max(256),
            newPassword: zod_1.z.string().min(1).max(256),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        // Politique de mot de passe appliquée côté serveur (pas seulement l'UI).
        const policyError = validatePasswordPolicy(parsed.data.newPassword);
        if (policyError) {
            res.status(400).json({ message: policyError });
            return;
        }
        const [rows] = await db.query(`SELECT id, passwordHash, email,
          (SELECT 1 FROM users u WHERE u.id = users.id AND u.cpanelEmailCreated = 1) AS hasMailbox
         FROM users WHERE id = ? LIMIT 1`, [payload.sub]);
        const row = rows[0];
        if (!row || !verifyPassword(parsed.data.oldPassword, row.passwordHash)) {
            res.status(401).json({ message: "Ancien mot de passe incorrect" });
            return;
        }
        const newHash = hashPassword(parsed.data.newPassword);
        await db.execute("UPDATE users SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?", [newHash, row.id]);
        // ─── Sync : si mailbox cPanel existe, mettre à jour son password ─────
        // Best-effort : si la sync échoue, on log mais on retourne quand même
        // 204 (le password BatiDesk a bien changé).
        let mailboxSynced = false;
        let mailboxSyncError;
        if (row.hasMailbox && row.email && (0, cpanel_email_1.isCpanelConfigured)(cfg)) {
            const r = await (0, cpanel_email_1.changeMailboxPassword)(cfg, row.email, parsed.data.newPassword);
            mailboxSynced = r.ok;
            mailboxSyncError = r.error;
            if (r.ok) {
                void (0, audit_1.writeAudit)(db, {
                    userId: payload.sub,
                    username: payload.username,
                    companyId: payload.companyId ?? null,
                    action: "cpanel_mailbox_password_synced",
                    ip: req.ip ?? "",
                    userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
                    meta: { email: row.email },
                });
            }
            else {
                console.error(`[auth] mailbox sync FAILED for ${row.email}: ${r.error}`);
            }
        }
        void (0, audit_1.writeAudit)(db, {
            userId: payload.sub,
            username: payload.username,
            companyId: payload.companyId ?? null,
            action: "change_password",
            ip: req.ip ?? "",
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
            meta: { mailboxSynced, mailboxSyncError },
        });
        // Révoque le token courant : après un changement de mot de passe, il
        // faut reseigner pour obtenir un nouveau token. Empêche la persistance
        // d'une session sur un appareil potentiellement compromis.
        try {
            await (0, token_revocation_1.revokeToken)(db, header.slice(7).trim(), payload);
        }
        catch (e) {
            console.warn("[auth] revokeToken failed at change-password:", e);
        }
        res.status(204).end();
    }));
    // ─── Mise à jour de son propre profil (prénom, nom, email) ────────────
    router.patch("/me", wrap(async (req, res) => {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            res.status(401).json({ message: "Token manquant" });
            return;
        }
        const payload = (0, auth_1.verifyToken)(header.slice(7), cfg);
        if (!payload) {
            res.status(401).json({ message: "Token invalide" });
            return;
        }
        const schema = zod_1.z.object({
            firstName: zod_1.z.string().max(128).optional(),
            lastName: zod_1.z.string().max(128).optional(),
            email: zod_1.z.union([zod_1.z.string().email().max(255), zod_1.z.literal("")]).optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide", details: parsed.error.issues });
            return;
        }
        const sets = [];
        const values = [];
        const changed = [];
        for (const key of ["firstName", "lastName", "email"]) {
            const v = parsed.data[key];
            if (v !== undefined) {
                sets.push(`${key} = ?`);
                values.push(v.trim());
                changed.push(key);
            }
        }
        if (sets.length === 0) {
            res.status(400).json({ message: "Aucun champ à mettre à jour" });
            return;
        }
        values.push(payload.sub);
        await db.execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, values);
        void (0, audit_1.writeAudit)(db, {
            userId: payload.sub,
            username: payload.username,
            companyId: payload.companyId ?? null,
            action: "profile_updated",
            ip: req.ip ?? "",
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
            meta: { changedFields: changed },
        });
        res.json({ success: true });
    }));
    // ─── Changement de son propre identifiant (confirmé par mot de passe) ──
    router.post("/change-username", wrap(async (req, res) => {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            res.status(401).json({ message: "Token manquant" });
            return;
        }
        const payload = (0, auth_1.verifyToken)(header.slice(7), cfg);
        if (!payload) {
            res.status(401).json({ message: "Token invalide" });
            return;
        }
        const schema = zod_1.z.object({
            newUsername: zod_1.z.string().min(3).max(64).regex(/^[a-zA-Z0-9._@-]+$/, {
                message: "Identifiant invalide (lettres, chiffres, . _ @ - uniquement)",
            }),
            password: zod_1.z.string().min(1).max(256),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            const msg = parsed.error.issues[0]?.message ?? "Payload invalide";
            res.status(400).json({ message: msg });
            return;
        }
        const [rows] = await db.query("SELECT id, username, passwordHash, companyId FROM users WHERE id = ? LIMIT 1", [payload.sub]);
        const row = rows[0];
        if (!row || !verifyPassword(parsed.data.password, row.passwordHash)) {
            res.status(401).json({ message: "Mot de passe incorrect" });
            return;
        }
        const newUsername = parsed.data.newUsername.trim();
        if (newUsername === row.username) {
            res.status(400).json({ message: "Le nouvel identifiant est identique à l'actuel" });
            return;
        }
        // Unicité globale (l'identifiant est la clé de connexion)
        const [dupRows] = await db.query("SELECT id FROM users WHERE username = ? LIMIT 1", [newUsername]);
        if (dupRows[0]) {
            res.status(409).json({ message: "Cet identifiant est déjà utilisé" });
            return;
        }
        await db.execute("UPDATE users SET username = ? WHERE id = ?", [newUsername, row.id]);
        void (0, audit_1.writeAudit)(db, {
            userId: row.id,
            username: newUsername,
            companyId: row.companyId ?? null,
            action: "username_changed",
            ip: req.ip ?? "",
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
            meta: { oldUsername: row.username },
        });
        // Le JWT courant contient l'ancien username → on le révoque pour forcer
        // une reconnexion propre avec le nouvel identifiant.
        try {
            await (0, token_revocation_1.revokeToken)(db, header.slice(7).trim(), payload);
        }
        catch (e) {
            console.warn("[auth] revokeToken failed at change-username:", e);
        }
        res.json({ success: true });
    }));
    // ─── Demande de réinitialisation (self-service, lien par email) ───────
    // Anti-énumération : réponse 200 identique que le compte existe ou non.
    router.post("/request-reset", wrap(async (req, res) => {
        const schema = zod_1.z.object({ identifier: zod_1.z.string().min(1).max(255) });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Identifiant manquant" });
            return;
        }
        const identifier = parsed.data.identifier.trim();
        const ip = req.ip ?? "";
        const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 500);
        const [rows] = await db.query(`SELECT id, username, email, companyId, disabled
         FROM users WHERE (username = ? OR email = ?) LIMIT 1`, [identifier, identifier]);
        const row = rows[0];
        const smtpReady = Boolean(cfg.SMTP_HOST && cfg.SMTP_USER && cfg.SMTP_PASS);
        if (row && !row.disabled && row.email && smtpReady) {
            const token = node_crypto_1.default.randomBytes(32).toString("hex");
            const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
            await db.execute("INSERT INTO password_resets (userId, tokenHash, expiresAt) VALUES (?, ?, ?)", [row.id, sha256(token), expiresAt]);
            const base = (cfg.APP_URL || "").replace(/\/+$/, "");
            const link = `${base}/reset-password?token=${token}`;
            const r = await (0, email_1.sendMail)(cfg, {
                to: row.email,
                subject: "Réinitialisation de votre mot de passe — BatiDesk",
                html: resetEmailHtml(link, Math.round(RESET_TOKEN_TTL_MS / 60000)),
            });
            void (0, audit_1.writeAudit)(db, {
                userId: row.id,
                username: row.username,
                companyId: row.companyId ?? null,
                action: "password_reset_requested",
                ip,
                userAgent,
                meta: { emailSent: r.ok },
            });
        }
        // Toujours 200 (ne révèle pas l'existence du compte).
        res.json({ success: true });
    }));
    // ─── Réinitialisation effective via le token reçu par email ───────────
    router.post("/reset-password", wrap(async (req, res) => {
        const schema = zod_1.z.object({
            token: zod_1.z.string().min(16).max(256),
            newPassword: zod_1.z.string().min(1).max(256),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const policyError = validatePasswordPolicy(parsed.data.newPassword);
        if (policyError) {
            res.status(400).json({ message: policyError });
            return;
        }
        const tokenHash = sha256(parsed.data.token);
        const [rows] = await db.query(`SELECT id, userId, expiresAt, usedAt FROM password_resets
         WHERE tokenHash = ? ORDER BY id DESC LIMIT 1`, [tokenHash]);
        const reset = rows[0];
        if (!reset || reset.usedAt > 0 || Number(reset.expiresAt) < Date.now()) {
            res.status(400).json({ message: "Lien invalide ou expiré. Refaites une demande." });
            return;
        }
        const newHash = hashPassword(parsed.data.newPassword);
        // Met à jour le mot de passe, lève mustChangePassword et déverrouille.
        await db.execute("UPDATE users SET passwordHash = ?, mustChangePassword = 0, failedLoginAttempts = 0, lockedUntil = 0 WHERE id = ?", [newHash, reset.userId]);
        await db.execute("UPDATE password_resets SET usedAt = ? WHERE id = ?", [Date.now(), reset.id]);
        const [urows] = await db.query("SELECT username, companyId FROM users WHERE id = ? LIMIT 1", [reset.userId]);
        void (0, audit_1.writeAudit)(db, {
            userId: reset.userId,
            username: urows[0]?.username ?? "",
            companyId: urows[0]?.companyId ?? null,
            action: "password_reset_done",
            ip: req.ip ?? "",
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
            meta: {},
        });
        res.json({ success: true });
    }));
    router.post("/logout", wrap(async (req, res) => {
        // Révoque le token courant (si présent et valide). Best-effort : on
        // répond 204 même si la révocation échoue, pour ne pas bloquer la
        // déconnexion côté client.
        const header = req.headers.authorization;
        if (header?.startsWith("Bearer ")) {
            const token = header.slice(7).trim();
            const payload = (0, auth_1.verifyToken)(token, cfg);
            if (payload) {
                try {
                    await (0, token_revocation_1.revokeToken)(db, token, payload);
                    void (0, audit_1.writeAudit)(db, {
                        userId: payload.sub,
                        username: payload.username,
                        companyId: payload.companyId ?? null,
                        action: "logout",
                        ip: req.ip ?? "",
                        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
                        meta: {},
                    });
                }
                catch (e) {
                    console.warn("[auth] revokeToken failed at logout:", e);
                }
            }
        }
        res.status(204).end();
    }));
    router.get("/me", wrap(async (req, res) => {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            res.status(401).json({ message: "Token manquant" });
            return;
        }
        const payload = (0, auth_1.verifyToken)(header.slice(7), cfg);
        if (!payload) {
            res.status(401).json({ message: "Token invalide" });
            return;
        }
        const [rows] = await db.query(`SELECT id, username, role, email, firstName, lastName, avatarUrl,
                disabled, mustChangePassword, companyId
         FROM users WHERE id = ? LIMIT 1`, [payload.sub]);
        const row = rows[0];
        if (!row) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        if (row.disabled) {
            res.status(403).json({ message: "Compte désactivé" });
            return;
        }
        const companyId = Number(row.companyId ?? 1);
        const [companyRows] = await db.query("SELECT isSetupComplete, name FROM company WHERE id = ? LIMIT 1", [companyId]);
        const company = companyRows[0] ?? {};
        res.json({
            id: row.id,
            username: row.username,
            role: row.role,
            email: row.email ?? "",
            firstName: row.firstName ?? "",
            lastName: row.lastName ?? "",
            avatarUrl: row.avatarUrl ?? "",
            mustChangePassword: Boolean(row.mustChangePassword),
            companyId,
            isSetupComplete: Boolean(company.isSetupComplete),
            companyName: company.name ?? "",
        });
    }));
    // ─── Bootstrap : créer le premier admin (refusé si table non vide) ─────
    // SÉCURITÉ : cette route ne fonctionne QUE si la table users est vide.
    // Une fois le 1er admin créé, elle renvoie systématiquement 409.
    router.post("/bootstrap", wrap(async (req, res) => {
        const [countRows] = await db.query("SELECT COUNT(*) AS n FROM users");
        const count = Number(countRows[0].n);
        if (count > 0) {
            console.warn(`[auth] BOOTSTRAP REFUSE ip=${req.ip} (table users non vide, ${count} comptes)`);
            res.status(409).json({ message: "Bootstrap déjà effectué" });
            return;
        }
        console.log(`[auth] BOOTSTRAP attempt ip=${req.ip}`);
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const hash = hashPassword(parsed.data.password);
        // Le 1er admin est rattaché au tenant id=1 (créé par les migrations)
        const [result] = await db.execute("INSERT INTO users (username, passwordHash, role, companyId) VALUES (?, ?, 'admin', 1)", [parsed.data.username, hash]);
        res.status(201).json({ id: result.insertId, username: parsed.data.username });
    }));
    return router;
}
exports.__testHelpers = { hashPassword, verifyPassword };
