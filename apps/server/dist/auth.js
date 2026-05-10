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
function requireAuth(cfg) {
    return (req, res, next) => {
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
        req.user = payload;
        next();
    };
}
//# sourceMappingURL=auth.js.map