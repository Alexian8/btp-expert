// ═══════════════════════════════════════════════════════════════════════════
// Routes Auth — login / logout / me / bootstrap
// Hash des mots de passe : scrypt (Node natif).
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import type { DB, RowDataPacket, ResultSetHeader } from "../db";
import { signToken, verifyToken, type AuthPayload } from "../auth";
import { writeAudit } from "../audit";
import { changeMailboxPassword, isCpanelConfigured } from "../cpanel-email";
import { revokeToken } from "../token-revocation";
import { sendMail } from "../email";
import type { Config } from "../config";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function resetEmailHtml(link: string, expiresMinutes: number): string {
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

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * Politique de mot de passe (alignée sur l'UI ChangePasswordModal) :
 * ≥ 10 caractères, au moins une majuscule, une minuscule et un chiffre.
 * Retourne un message d'erreur, ou null si le mot de passe est conforme.
 * Appliquée côté serveur (changement de mot de passe, réinitialisation).
 */
export function validatePasswordPolicy(pw: string): string | null {
  if (pw.length < 10) return "Le mot de passe doit contenir au moins 10 caractères";
  if (!/[A-Z]/.test(pw)) return "Le mot de passe doit contenir au moins une majuscule";
  if (!/[a-z]/.test(pw)) return "Le mot de passe doit contenir au moins une minuscule";
  if (!/[0-9]/.test(pw)) return "Le mot de passe doit contenir au moins un chiffre";
  return null;
}

const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  disabled?: number;
  mustChangePassword?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyId?: number;
  failedLoginAttempts?: number;
  lockedUntil?: number;
}

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

export function buildAuthRouter(db: DB, cfg: Config): Router {
  const router = Router();

  router.post(
    "/login",
    wrap(async (req, res) => {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide" });
        return;
      }
      const [rows] = await db.query<UserRow[]>(
        `SELECT id, username, passwordHash, role, disabled, mustChangePassword,
                email, firstName, lastName, companyId, failedLoginAttempts, lockedUntil
         FROM users WHERE username = ? LIMIT 1`,
        [parsed.data.username]
      );
      const row = rows[0];
      const ip = req.ip ?? "";
      const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 500);

      // Délai constant pour limiter les attaques par timing (existence compte).
      const failDelay = (): Promise<void> => new Promise((r) => setTimeout(r, 200));

      // Utilisateur inconnu : message générique, pas de compteur (on ne peut
      // pas verrouiller un compte qui n'existe pas).
      if (!row) {
        console.warn(`[auth] LOGIN FAIL ip=${ip} username=${parsed.data.username} reason=unknown_user`);
        void writeAudit(db, {
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
        void writeAudit(db, {
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
          await db.execute(
            "UPDATE users SET failedLoginAttempts = ?, lockedUntil = ? WHERE id = ?",
            [attempts, until, row.id]
          );
        } else {
          await db.execute("UPDATE users SET failedLoginAttempts = ? WHERE id = ?", [attempts, row.id]);
        }
        console.warn(
          `[auth] LOGIN FAIL ip=${ip} username=${row.username} reason=bad_password attempts=${attempts}${reachedMax ? " LOCKED" : ""}`
        );
        void writeAudit(db, {
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
        console.warn(
          `[auth] LOGIN BLOCKED disabled account ip=${ip} username=${parsed.data.username}`
        );
        void writeAudit(db, {
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
        const [activeRows] = await db.query<RowDataPacket[]>(
          "SELECT isActive FROM company WHERE id = ? LIMIT 1",
          [row.companyId]
        );
        const companyActive = activeRows[0]
          ? Boolean((activeRows[0] as { isActive?: number }).isActive ?? 1)
          : true;
        if (!companyActive) {
          console.warn(
            `[auth] LOGIN BLOCKED company disabled companyId=${row.companyId} username=${parsed.data.username}`
          );
          void writeAudit(db, {
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
      void writeAudit(db, {
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
      db.execute(
        "UPDATE users SET lastLoginAt = CURRENT_TIMESTAMP, failedLoginAttempts = 0, lockedUntil = 0 WHERE id = ?",
        [row.id]
      ).catch((e) => console.warn("[auth] update lastLoginAt failed:", e));

      const companyId = Number(row.companyId ?? 1);
      const payload: AuthPayload = {
        sub: row.id,
        username: row.username,
        role: row.role,
        companyId,
      };
      const token = signToken(payload, cfg);

      // Récupère le statut setup de la company pour l'onboarding flow
      const [companyRows] = await db.query<RowDataPacket[]>(
        "SELECT isSetupComplete, name FROM company WHERE id = ? LIMIT 1",
        [companyId]
      );
      const company = (companyRows[0] as { isSetupComplete?: number; name?: string }) ?? {};

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
    })
  );

  // ─── Changement de mot de passe (user authentifié) ────────────────────
  router.post(
    "/change-password",
    wrap(async (req, res) => {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ message: "Token manquant" });
        return;
      }
      const payload = verifyToken(header.slice(7), cfg);
      if (!payload) {
        res.status(401).json({ message: "Token invalide" });
        return;
      }
      const schema = z.object({
        oldPassword: z.string().min(1).max(256),
        newPassword: z.string().min(1).max(256),
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
      const [rows] = await db.query<UserRow[]>(
        `SELECT id, passwordHash, email,
          (SELECT 1 FROM users u WHERE u.id = users.id AND u.cpanelEmailCreated = 1) AS hasMailbox
         FROM users WHERE id = ? LIMIT 1`,
        [payload.sub]
      );
      const row = rows[0] as
        | (UserRow & { email?: string; hasMailbox?: number })
        | undefined;
      if (!row || !verifyPassword(parsed.data.oldPassword, row.passwordHash)) {
        res.status(401).json({ message: "Ancien mot de passe incorrect" });
        return;
      }
      const newHash = hashPassword(parsed.data.newPassword);
      await db.execute(
        "UPDATE users SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?",
        [newHash, row.id]
      );

      // ─── Sync : si mailbox cPanel existe, mettre à jour son password ─────
      // Best-effort : si la sync échoue, on log mais on retourne quand même
      // 204 (le password BatiDesk a bien changé).
      let mailboxSynced = false;
      let mailboxSyncError: string | undefined;
      if (row.hasMailbox && row.email && isCpanelConfigured(cfg)) {
        const r = await changeMailboxPassword(cfg, row.email, parsed.data.newPassword);
        mailboxSynced = r.ok;
        mailboxSyncError = r.error;
        if (r.ok) {
          void writeAudit(db, {
            userId: payload.sub,
            username: payload.username,
            companyId: payload.companyId ?? null,
            action: "cpanel_mailbox_password_synced",
            ip: req.ip ?? "",
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
            meta: { email: row.email },
          });
        } else {
          console.error(`[auth] mailbox sync FAILED for ${row.email}: ${r.error}`);
        }
      }

      void writeAudit(db, {
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
        await revokeToken(db, header.slice(7).trim(), payload);
      } catch (e) {
        console.warn("[auth] revokeToken failed at change-password:", e);
      }

      res.status(204).end();
    })
  );

  // ─── Demande de réinitialisation (self-service, lien par email) ───────
  // Anti-énumération : réponse 200 identique que le compte existe ou non.
  router.post(
    "/request-reset",
    wrap(async (req, res) => {
      const schema = z.object({ identifier: z.string().min(1).max(255) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Identifiant manquant" });
        return;
      }
      const identifier = parsed.data.identifier.trim();
      const ip = req.ip ?? "";
      const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 500);

      const [rows] = await db.query<UserRow[]>(
        `SELECT id, username, email, companyId, disabled
         FROM users WHERE (username = ? OR email = ?) LIMIT 1`,
        [identifier, identifier]
      );
      const row = rows[0];
      const smtpReady = Boolean(cfg.SMTP_HOST && cfg.SMTP_USER && cfg.SMTP_PASS);
      if (row && !row.disabled && row.email && smtpReady) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
        await db.execute(
          "INSERT INTO password_resets (userId, tokenHash, expiresAt) VALUES (?, ?, ?)",
          [row.id, sha256(token), expiresAt]
        );
        const base = (cfg.APP_URL || "").replace(/\/+$/, "");
        const link = `${base}/reset-password?token=${token}`;
        const r = await sendMail(cfg, {
          to: row.email,
          subject: "Réinitialisation de votre mot de passe — BatiDesk",
          html: resetEmailHtml(link, Math.round(RESET_TOKEN_TTL_MS / 60000)),
        });
        void writeAudit(db, {
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
    })
  );

  // ─── Réinitialisation effective via le token reçu par email ───────────
  router.post(
    "/reset-password",
    wrap(async (req, res) => {
      const schema = z.object({
        token: z.string().min(16).max(256),
        newPassword: z.string().min(1).max(256),
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
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT id, userId, expiresAt, usedAt FROM password_resets
         WHERE tokenHash = ? ORDER BY id DESC LIMIT 1`,
        [tokenHash]
      );
      const reset = rows[0] as
        | { id: number; userId: number; expiresAt: number; usedAt: number }
        | undefined;
      if (!reset || reset.usedAt > 0 || Number(reset.expiresAt) < Date.now()) {
        res.status(400).json({ message: "Lien invalide ou expiré. Refaites une demande." });
        return;
      }
      const newHash = hashPassword(parsed.data.newPassword);
      // Met à jour le mot de passe, lève mustChangePassword et déverrouille.
      await db.execute(
        "UPDATE users SET passwordHash = ?, mustChangePassword = 0, failedLoginAttempts = 0, lockedUntil = 0 WHERE id = ?",
        [newHash, reset.userId]
      );
      await db.execute("UPDATE password_resets SET usedAt = ? WHERE id = ?", [Date.now(), reset.id]);

      const [urows] = await db.query<UserRow[]>(
        "SELECT username, companyId FROM users WHERE id = ? LIMIT 1",
        [reset.userId]
      );
      void writeAudit(db, {
        userId: reset.userId,
        username: urows[0]?.username ?? "",
        companyId: urows[0]?.companyId ?? null,
        action: "password_reset_done",
        ip: req.ip ?? "",
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
        meta: {},
      });
      res.json({ success: true });
    })
  );

  router.post(
    "/logout",
    wrap(async (req, res) => {
      // Révoque le token courant (si présent et valide). Best-effort : on
      // répond 204 même si la révocation échoue, pour ne pas bloquer la
      // déconnexion côté client.
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        const token = header.slice(7).trim();
        const payload = verifyToken(token, cfg);
        if (payload) {
          try {
            await revokeToken(db, token, payload);
            void writeAudit(db, {
              userId: payload.sub,
              username: payload.username,
              companyId: payload.companyId ?? null,
              action: "logout",
              ip: req.ip ?? "",
              userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
              meta: {},
            });
          } catch (e) {
            console.warn("[auth] revokeToken failed at logout:", e);
          }
        }
      }
      res.status(204).end();
    })
  );

  router.get(
    "/me",
    wrap(async (req, res) => {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ message: "Token manquant" });
        return;
      }
      const payload = verifyToken(header.slice(7), cfg);
      if (!payload) {
        res.status(401).json({ message: "Token invalide" });
        return;
      }
      const [rows] = await db.query<UserRow[]>(
        `SELECT id, username, role, email, firstName, lastName, avatarUrl,
                disabled, mustChangePassword, companyId
         FROM users WHERE id = ? LIMIT 1`,
        [payload.sub]
      );
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
      const [companyRows] = await db.query<RowDataPacket[]>(
        "SELECT isSetupComplete, name FROM company WHERE id = ? LIMIT 1",
        [companyId]
      );
      const company = (companyRows[0] as { isSetupComplete?: number; name?: string }) ?? {};
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
    })
  );

  // ─── Bootstrap : créer le premier admin (refusé si table non vide) ─────
  // SÉCURITÉ : cette route ne fonctionne QUE si la table users est vide.
  // Une fois le 1er admin créé, elle renvoie systématiquement 409.
  router.post(
    "/bootstrap",
    wrap(async (req, res) => {
      const [countRows] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM users");
      const count = Number((countRows[0] as { n: number }).n);
      if (count > 0) {
        console.warn(
          `[auth] BOOTSTRAP REFUSE ip=${req.ip} (table users non vide, ${count} comptes)`
        );
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
      const [result] = await db.execute<ResultSetHeader>(
        "INSERT INTO users (username, passwordHash, role, companyId) VALUES (?, ?, 'admin', 1)",
        [parsed.data.username, hash]
      );
      res.status(201).json({ id: result.insertId, username: parsed.data.username });
    })
  );

  return router;
}

export const __testHelpers = { hashPassword, verifyPassword };
