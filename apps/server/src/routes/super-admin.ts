// ═══════════════════════════════════════════════════════════════════════════
// Routes /api/super-admin/* — gestion des entreprises clientes BatiDesk
//
// Ces routes sont réservées au rôle "super_admin" (éditeur SaaS BatiDesk).
// Elles permettent de :
//   • Lister toutes les entreprises clientes (cross-tenant)
//   • Créer une nouvelle entreprise + son 1er admin (qui reçoit ses creds par email)
//   • Désactiver / réactiver une entreprise (bloque le login de tous ses users)
//   • Voir les stats par entreprise (nombre d'users, dernière activité)
//
// Sécurité : middleware requireRole("super_admin") sur toutes les routes.
// Le super_admin n'a PAS de companyId → impossible d'accéder aux données
// métier des tenants via les CRUD classiques (le scope tenant retournerait 0).
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import type { DB, RowDataPacket, ResultSetHeader } from "../db";
import { requireAuth } from "../auth";
import { requireRole } from "../rbac";
import { writeAudit, audited } from "../audit";
import { sendMail, welcomeEmailHtml } from "../email";
import type { Config } from "../config";

const SALT_LEN = 16;
const KEY_LEN = 64;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[bytes[i]! % chars.length];
  return out;
}

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

const CreateCompanySchema = z.object({
  companyName: z.string().min(2).max(255),
  adminUsername: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, {
      message: "Username : lettres, chiffres, points, tirets uniquement",
    }),
  adminEmail: z.string().email().max(255),
  adminFirstName: z.string().max(128).optional().default(""),
  adminLastName: z.string().max(128).optional().default(""),
  /** Mot de passe explicite. Si absent, le serveur en génère un. */
  adminPassword: z.string().min(8).max(256).optional(),
});

interface CompanyRow extends RowDataPacket {
  id: number;
  name: string;
  data: string | object;
  isSetupComplete: number;
  isActive: number;
  createdAt: string;
}

interface CountRow extends RowDataPacket {
  companyId: number;
  n: number;
}

function publicCompany(row: CompanyRow, stats?: { userCount?: number; activeUsers?: number }) {
  const data = typeof row.data === "string" ? safeJson(row.data) : row.data ?? {};
  return {
    id: row.id,
    name: row.name ?? "",
    data,
    isSetupComplete: Boolean(row.isSetupComplete),
    isActive: Boolean(row.isActive ?? 1),
    createdAt: row.createdAt,
    userCount: stats?.userCount ?? 0,
    activeUsers: stats?.activeUsers ?? 0,
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export function buildSuperAdminRouter(db: DB, cfg: Config): Router {
  const router = Router();
  router.use(requireAuth(cfg, db), requireRole("super_admin"));

  // ─── Liste toutes les entreprises ─────────────────────────────────────
  router.get(
    "/companies",
    wrap(async (_req, res) => {
      const [companies] = await db.query<CompanyRow[]>(
        "SELECT id, name, data, isSetupComplete, isActive, createdAt FROM company ORDER BY id ASC"
      );
      // Compte users par company
      const [counts] = await db.query<CountRow[]>(
        `SELECT companyId, COUNT(*) AS n FROM users
         WHERE companyId IS NOT NULL
         GROUP BY companyId`
      );
      const [activeCounts] = await db.query<CountRow[]>(
        `SELECT companyId, COUNT(*) AS n FROM users
         WHERE companyId IS NOT NULL AND disabled = 0
         GROUP BY companyId`
      );
      const userMap = new Map<number, number>();
      for (const r of counts as Array<{ companyId: number; n: number }>) {
        userMap.set(Number(r.companyId), Number(r.n));
      }
      const activeMap = new Map<number, number>();
      for (const r of activeCounts as Array<{ companyId: number; n: number }>) {
        activeMap.set(Number(r.companyId), Number(r.n));
      }
      res.json(
        companies.map((c) =>
          publicCompany(c, {
            userCount: userMap.get(c.id) ?? 0,
            activeUsers: activeMap.get(c.id) ?? 0,
          })
        )
      );
    })
  );

  // ─── Détail d'une entreprise ──────────────────────────────────────────
  router.get(
    "/companies/:id",
    wrap(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "ID invalide" });
        return;
      }
      const [rows] = await db.query<CompanyRow[]>(
        "SELECT id, name, data, isSetupComplete, isActive, createdAt FROM company WHERE id = ? LIMIT 1",
        [id]
      );
      const row = rows[0];
      if (!row) {
        res.status(404).json({ message: "Entreprise introuvable" });
        return;
      }
      const [users] = await db.query<RowDataPacket[]>(
        "SELECT id, username, email, firstName, lastName, role, disabled, lastLoginAt FROM users WHERE companyId = ? ORDER BY createdAt DESC",
        [id]
      );
      res.json({ ...publicCompany(row), users });
    })
  );

  // ─── Création d'une entreprise + son 1er admin ────────────────────────
  router.post(
    "/companies",
    wrap(async (req, res) => {
      const parsed = CreateCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: "Payload invalide",
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
      }
      const data = parsed.data;

      // Unicité username (cross-tenant)
      const [dup] = await db.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE username = ? LIMIT 1",
        [data.adminUsername]
      );
      if (dup.length > 0) {
        res.status(409).json({ message: "Username déjà utilisé" });
        return;
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // 1. Crée la company
        const [companyResult] = await conn.execute<ResultSetHeader>(
          `INSERT INTO company (name, data, isSetupComplete, isActive)
           VALUES (?, ?, 0, 1)`,
          [
            data.companyName,
            JSON.stringify({ companyName: data.companyName }),
          ]
        );
        const newCompanyId = companyResult.insertId;

        // 2. Crée le 1er admin
        const tempPassword = data.adminPassword ?? generateTempPassword();
        const wasGenerated = data.adminPassword === undefined;
        const passwordHash = hashPassword(tempPassword);
        const [userResult] = await conn.execute<ResultSetHeader>(
          `INSERT INTO users
             (username, passwordHash, email, firstName, lastName, role,
              mustChangePassword, companyId)
           VALUES (?, ?, ?, ?, ?, 'admin', 1, ?)`,
          [
            data.adminUsername,
            passwordHash,
            data.adminEmail,
            data.adminFirstName,
            data.adminLastName,
            newCompanyId,
          ]
        );
        const newUserId = userResult.insertId;

        await conn.commit();

        // 3. Audit log — companyId pointe vers la company créée pour que
        // son admin voie l'événement dans son journal.
        void writeAudit(db, {
          ...audited(req),
          companyId: newCompanyId,
          action: "company_created",
          resource: "company",
          resourceId: String(newCompanyId),
          meta: {
            companyName: data.companyName,
            adminUsername: data.adminUsername,
            adminEmail: data.adminEmail,
            adminUserId: newUserId,
          },
        });

        // 4. Email automatique au nouvel admin (best-effort)
        let emailSent = false;
        let emailError: string | undefined;
        const html = welcomeEmailHtml({
          firstName: data.adminFirstName,
          username: data.adminUsername,
          tempPassword,
          loginUrl: cfg.APP_URL || "https://intranet.jacobhabitat-dev.fr",
          companyName: data.companyName,
        });
        const r = await sendMail(cfg, {
          to: data.adminEmail,
          subject: `[${data.companyName}] Vos accès BatiDesk`,
          html,
        });
        emailSent = r.ok;
        emailError = r.skipped ? "SMTP non configuré" : r.error;

        res.status(201).json({
          id: newCompanyId,
          name: data.companyName,
          isSetupComplete: false,
          isActive: true,
          admin: {
            id: newUserId,
            username: data.adminUsername,
            email: data.adminEmail,
            firstName: data.adminFirstName,
            lastName: data.adminLastName,
          },
          tempPassword: wasGenerated ? tempPassword : undefined,
          emailSent,
          emailError,
        });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    })
  );

  // ─── Désactivation d'une entreprise (bloque tous ses users) ──────────
  // Soft-delete : on set isActive=0 sur la company + disabled=1 sur tous
  // ses users. Réversible via PATCH avec isActive: true.
  router.patch(
    "/companies/:id",
    wrap(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "ID invalide" });
        return;
      }
      const schema = z.object({
        name: z.string().min(2).max(255).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide" });
        return;
      }

      const sets: string[] = [];
      const values: unknown[] = [];
      if (parsed.data.name !== undefined) {
        sets.push("name = ?");
        values.push(parsed.data.name);
      }
      if (parsed.data.isActive !== undefined) {
        sets.push("isActive = ?");
        values.push(parsed.data.isActive ? 1 : 0);
      }
      if (!sets.length) {
        res.status(400).json({ message: "Aucun champ modifiable fourni" });
        return;
      }
      values.push(id);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        await conn.execute(
          `UPDATE company SET ${sets.join(", ")} WHERE id = ?`,
          values as never[]
        );

        // Si désactivation : disable aussi tous les users de la company
        if (parsed.data.isActive === false) {
          await conn.execute(
            "UPDATE users SET disabled = 1 WHERE companyId = ?",
            [id]
          );
        } else if (parsed.data.isActive === true) {
          // Réactivation : on ne ré-enable PAS automatiquement les users
          // (l'admin de la company devra le faire manuellement)
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      void writeAudit(db, {
        ...audited(req),
        companyId: id,
        action: parsed.data.isActive === false ? "company_disabled" : "company_updated",
        resource: "company",
        resourceId: String(id),
        meta: parsed.data,
      });

      const [rows] = await db.query<CompanyRow[]>(
        "SELECT id, name, data, isSetupComplete, isActive, createdAt FROM company WHERE id = ? LIMIT 1",
        [id]
      );
      const row = rows[0];
      if (!row) {
        res.status(404).json({ message: "Entreprise introuvable" });
        return;
      }
      res.json(publicCompany(row));
    })
  );

  return router;
}
