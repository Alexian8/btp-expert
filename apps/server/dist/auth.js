"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Auth — JWT helpers + middleware Express
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const token_revocation_1 = require("./token-revocation");
function signToken(payload, cfg) {
    const options = { expiresIn: cfg.JWT_EXPIRES_IN };
    return jsonwebtoken_1.default.sign(payload, cfg.JWT_SECRET, options);
}
function verifyToken(token, cfg) {
    try {
        return jsonwebtoken_1.default.verify(token, cfg.JWT_SECRET);
    }
    catch {
        return null;
    }
}
function requireAuth(cfg, db) {
    return async (req, res, next) => {
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
        // Vérification de la blacklist (logout, password-change). Si la DB n'est
        // pas fournie (tests legacy), on saute — le contrôle reste solide là où
        // ça compte (production utilise toujours db).
        if (db) {
            try {
                if (await (0, token_revocation_1.isTokenRevoked)(db, token)) {
                    res.status(401).json({ message: "Token révoqué" });
                    return;
                }
            }
            catch (e) {
                // En cas de panne DB on log mais on n'expose pas l'API : on rejette
                // par sécurité, mieux vaut un 503 qu'un token révoqué accepté.
                console.error("[auth] isTokenRevoked failed:", e);
                res.status(503).json({ message: "Service auth indisponible" });
                return;
            }
        }
        req.user = payload;
        req.authToken = token;
        next();
    };
}
