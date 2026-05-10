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
exports.buildAuthRouter = buildAuthRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../auth");
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
                email, firstName, lastName
         FROM users WHERE username = ? LIMIT 1`, [parsed.data.username]);
        const row = rows[0];
        if (!row || !verifyPassword(parsed.data.password, row.passwordHash)) {
            // Audit : log les échecs (sans exposer l'existence/non-existence du compte)
            console.warn(`[auth] LOGIN FAIL ip=${req.ip} username=${parsed.data.username} reason=${!row ? "unknown_user" : "bad_password"}`);
            // Délai constant pour éviter timing attack (existence du compte)
            await new Promise((r) => setTimeout(r, 200));
            res.status(401).json({ message: "Identifiants invalides" });
            return;
        }
        // Compte désactivé : refuser même si le password est correct
        if (row.disabled) {
            console.warn(`[auth] LOGIN BLOCKED disabled account ip=${req.ip} username=${parsed.data.username}`);
            res.status(403).json({ message: "Compte désactivé. Contactez un administrateur." });
            return;
        }
        console.log(`[auth] LOGIN OK ip=${req.ip} username=${row.username} role=${row.role}`);
        // Met à jour lastLoginAt (best-effort, ne bloque pas la réponse)
        db.execute("UPDATE users SET lastLoginAt = CURRENT_TIMESTAMP WHERE id = ?", [row.id]).catch((e) => console.warn("[auth] update lastLoginAt failed:", e));
        const payload = { sub: row.id, username: row.username, role: row.role };
        const token = (0, auth_1.signToken)(payload, cfg);
        res.json({
            id: row.id,
            username: row.username,
            role: row.role,
            email: row.email ?? "",
            firstName: row.firstName ?? "",
            lastName: row.lastName ?? "",
            mustChangePassword: Boolean(row.mustChangePassword),
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
            newPassword: zod_1.z.string().min(8).max(256),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide" });
            return;
        }
        const [rows] = await db.query("SELECT id, passwordHash FROM users WHERE id = ? LIMIT 1", [payload.sub]);
        const row = rows[0];
        if (!row || !verifyPassword(parsed.data.oldPassword, row.passwordHash)) {
            res.status(401).json({ message: "Ancien mot de passe incorrect" });
            return;
        }
        const newHash = hashPassword(parsed.data.newPassword);
        await db.execute("UPDATE users SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?", [newHash, row.id]);
        res.status(204).end();
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
        const payload = (0, auth_1.verifyToken)(header.slice(7), cfg);
        if (!payload) {
            res.status(401).json({ message: "Token invalide" });
            return;
        }
        const [rows] = await db.query(`SELECT id, username, role, email, firstName, lastName, avatarUrl,
                disabled, mustChangePassword
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
        res.json({
            id: row.id,
            username: row.username,
            role: row.role,
            email: row.email ?? "",
            firstName: row.firstName ?? "",
            lastName: row.lastName ?? "",
            avatarUrl: row.avatarUrl ?? "",
            mustChangePassword: Boolean(row.mustChangePassword),
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
        const [result] = await db.execute("INSERT INTO users (username, passwordHash, role) VALUES (?, ?, 'admin')", [parsed.data.username, hash]);
        res.status(201).json({ id: result.insertId, username: parsed.data.username });
    }));
    return router;
}
exports.__testHelpers = { hashPassword, verifyPassword };
//# sourceMappingURL=auth.js.map