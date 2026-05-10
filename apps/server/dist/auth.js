// ═══════════════════════════════════════════════════════════════════════════
// Auth — JWT helpers + middleware Express
// ═══════════════════════════════════════════════════════════════════════════
import jwt from "jsonwebtoken";
export function signToken(payload, cfg) {
    const options = { expiresIn: cfg.JWT_EXPIRES_IN };
    return jwt.sign(payload, cfg.JWT_SECRET, options);
}
export function verifyToken(token, cfg) {
    try {
        return jwt.verify(token, cfg.JWT_SECRET);
    }
    catch {
        return null;
    }
}
export function requireAuth(cfg) {
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