// ═══════════════════════════════════════════════════════════════════════════
// Routes Auth — login / logout / me / bootstrap
// Hash des mots de passe : scrypt (Node natif).
// ═══════════════════════════════════════════════════════════════════════════
import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { signToken, verifyToken } from "../auth";
const SALT_LEN = 16;
const KEY_LEN = 64;
function hashPassword(password) {
    const salt = crypto.randomBytes(SALT_LEN);
    const hash = crypto.scryptSync(password, salt, KEY_LEN);
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
function verifyPassword(password, stored) {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex)
        return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(expected, actual);
}
const LoginSchema = z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(256),
});
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
export function buildAuthRouter(db, cfg) {
    const router = Router();
    router.post("/login", wrap(async (req, res) => {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const [rows] = await db.query("SELECT id, username, passwordHash, role FROM users WHERE username = ? LIMIT 1", [parsed.data.username]);
        const row = rows[0];
        if (!row || !verifyPassword(parsed.data.password, row.passwordHash)) {
            res.status(401).json({ message: "Identifiants invalides" });
            return;
        }
        const payload = { sub: row.id, username: row.username, role: row.role };
        const token = signToken(payload, cfg);
        res.json({ id: row.id, username: row.username, role: row.role, token });
    }));
    router.post("/logout", (_req, res) => {
        res.status(204).end();
    });
    router.get("/me", wrap(async (req, res) => {
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
        const [rows] = await db.query("SELECT id, username, role FROM users WHERE id = ? LIMIT 1", [payload.sub]);
        const row = rows[0];
        if (!row) {
            res.status(404).json({ message: "Utilisateur introuvable" });
            return;
        }
        res.json({ id: row.id, username: row.username, role: row.role });
    }));
    // ─── Bootstrap : créer le premier admin (refusé si table non vide) ─────
    router.post("/bootstrap", wrap(async (req, res) => {
        const [countRows] = await db.query("SELECT COUNT(*) AS n FROM users");
        const count = Number(countRows[0].n);
        if (count > 0) {
            res.status(409).json({ message: "Bootstrap déjà effectué" });
            return;
        }
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const hash = hashPassword(parsed.data.password);
        const [result] = await db.execute("INSERT INTO users (username, passwordHash, role) VALUES (?, ?, 'admin')", [parsed.data.username, hash]);
        res.status(201).json({ id: result.insertId, username: parsed.data.username });
    }));
    return router;
}
export const __testHelpers = { hashPassword, verifyPassword };
//# sourceMappingURL=auth.js.map