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
import type { Config } from "../config";

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
                email, firstName, lastName, companyId
         FROM users WHERE username = ? LIMIT 1`,
        [parsed.data.username]
      );
      const row = rows[0];
      const ip = req.ip ?? "";
      const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 500);

      if (!row || !verifyPassword(parsed.data.password, row.passwordHash)) {
        const reason = !row ? "unknown_user" : "bad_password";
        console.warn(
          `[auth] LOGIN FAIL ip=${ip} username=${parsed.data.username} reason=${reason}`
        );
        // Audit DB
        void writeAudit(db, {
          userId: row?.id ?? null,
          username: parsed.data.username,
          companyId: row?.companyId ?? null,
          action: "login_fail",
          ip,
          userAgent,
          meta: { reason },
        });
        // Délai constant pour éviter timing attack (existence du compte)
        await new Promise((r) => setTimeout(r, 200));
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

      // Met à jour lastLoginAt (best-effort, ne bloque pas la réponse)
      db.execute("UPDATE users SET lastLoginAt = CURRENT_TIMESTAMP WHERE id = ?", [row.id]).catch(
        (e) => console.warn("[auth] update lastLoginAt failed:", e)
      );

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
        newPassword: z.string().min(8).max(256),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide" });
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

      res.status(204).end();
    })
  );

  router.post("/logout", (_req: Request, res: Response) => {
    res.status(204).end();
  });

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
