"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Routes Microsoft OAuth — flow web "Authorization Code with PKCE"
//
//   GET  /api/auth/microsoft/login    → redirige vers Microsoft (avec state)
//   GET  /api/auth/microsoft/callback → reçoit le code, échange contre token
//   GET  /api/auth/microsoft/account  → infos compte Microsoft (si connecté)
//   POST /api/auth/microsoft/logout   → supprime les tokens
//   POST /api/email/send              → envoie un email via Graph API
//
// Tokens stockés en DB (table oauth_tokens) avec refresh token pour rotation.
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMicrosoftRouter = buildMicrosoftRouter;
exports.buildEmailRouter = buildEmailRouter;
const express_1 = require("express");
const node_crypto_1 = __importDefault(require("node:crypto"));
const zod_1 = require("zod");
const auth_1 = require("../auth");
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
// ─── Helpers Microsoft ────────────────────────────────────────────────────
function authorizeUrl(cfg, state, codeChallenge) {
    const u = new URL(`https://login.microsoftonline.com/${cfg.MS_TENANT}/oauth2/v2.0/authorize`);
    u.searchParams.set("client_id", cfg.MS_CLIENT_ID);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", cfg.MS_REDIRECT_URI);
    u.searchParams.set("response_mode", "query");
    u.searchParams.set("scope", cfg.MS_SCOPES);
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
    return u.toString();
}
async function exchangeCode(cfg, code, codeVerifier) {
    const body = new URLSearchParams({
        client_id: cfg.MS_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: cfg.MS_REDIRECT_URI,
        code_verifier: codeVerifier,
        scope: cfg.MS_SCOPES,
    });
    if (cfg.MS_CLIENT_SECRET)
        body.set("client_secret", cfg.MS_CLIENT_SECRET);
    const res = await fetch(`https://login.microsoftonline.com/${cfg.MS_TENANT}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    if (!res.ok)
        throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
    const json = (await res.json());
    return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? null,
        expiresIn: json.expires_in,
        scope: json.scope,
    };
}
async function refreshAccessToken(cfg, refreshToken) {
    const body = new URLSearchParams({
        client_id: cfg.MS_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: cfg.MS_SCOPES,
    });
    if (cfg.MS_CLIENT_SECRET)
        body.set("client_secret", cfg.MS_CLIENT_SECRET);
    const res = await fetch(`https://login.microsoftonline.com/${cfg.MS_TENANT}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    if (!res.ok)
        throw new Error(`Microsoft refresh failed: ${await res.text()}`);
    const json = (await res.json());
    return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? null,
        expiresIn: json.expires_in,
    };
}
async function getValidAccessToken(db, cfg, userId) {
    const [rows] = await db.query("SELECT * FROM oauth_tokens WHERE provider = 'microsoft' AND userId = ? LIMIT 1", [userId]);
    const row = rows[0];
    if (!row)
        return null;
    // Si expiré ou expire dans <60s, rafraîchir
    const expiresAt = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
    if (expiresAt > Date.now() + 60_000)
        return row.accessToken;
    if (!row.refreshToken)
        return null;
    try {
        const fresh = await refreshAccessToken(cfg, row.refreshToken);
        const newExpiresAt = new Date(Date.now() + fresh.expiresIn * 1000);
        await db.execute(`UPDATE oauth_tokens SET accessToken=?, refreshToken=COALESCE(?, refreshToken), expiresAt=? WHERE id=?`, [fresh.accessToken, fresh.refreshToken, newExpiresAt, row.id]);
        return fresh.accessToken;
    }
    catch (e) {
        console.error("[ms-oauth] refresh failed:", e);
        return null;
    }
}
// Récupère le user JWT à partir de l'header Authorization
function userFromAuthHeader(req, cfg) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return null;
    return (0, auth_1.verifyToken)(header.slice(7), cfg);
}
// ─── Stockage temporaire du state OAuth (en mémoire, suffit pour 1-2 users) ─
// state → { userId, codeVerifier, expiresAt }
const pendingStates = new Map();
function cleanupExpiredStates() {
    const now = Date.now();
    for (const [k, v] of pendingStates) {
        if (v.expiresAt < now)
            pendingStates.delete(k);
    }
}
// ─── Tickets éphémères pour démarrer le flow OAuth sans exposer le JWT ─────
// Le web client appelle POST /api/auth/microsoft/start avec son JWT en
// Authorization header → reçoit un ticket à usage unique → redirige sur
// GET /api/auth/microsoft/login?ticket=... Le ticket expire en 30s.
const pendingTickets = new Map();
function cleanupExpiredTickets() {
    const now = Date.now();
    for (const [k, v] of pendingTickets) {
        if (v.expiresAt < now)
            pendingTickets.delete(k);
    }
}
// ─── Routes ───────────────────────────────────────────────────────────────
function buildMicrosoftRouter(db, cfg) {
    const router = (0, express_1.Router)();
    // POST /start : reçoit le JWT en header Authorization, retourne un ticket
    // éphémère à usage unique pour démarrer le flow OAuth sans exposer le JWT
    // dans une URL (historique navigateur, logs serveur, referer).
    router.post("/start", wrap(async (req, res) => {
        const payload = userFromAuthHeader(req, cfg);
        if (!payload) {
            res.status(401).json({ message: "Non authentifié" });
            return;
        }
        cleanupExpiredTickets();
        const ticket = node_crypto_1.default.randomBytes(24).toString("base64url");
        pendingTickets.set(ticket, {
            userId: payload.sub,
            expiresAt: Date.now() + 30_000, // 30s — juste le temps de cliquer
        });
        res.json({ loginUrl: `/api/auth/microsoft/login?ticket=${encodeURIComponent(ticket)}` });
    }));
    // Démarre le flow : génère state + code_verifier (PKCE), enregistre, redirige
    router.get("/login", wrap(async (req, res) => {
        // Auth via ticket éphémère (recommandé). On accepte aussi l'ancien
        // ?token=<JWT> en query pour la rétrocompat avec les builds desktop
        // déjà déployés, mais ce chemin sera retiré ultérieurement.
        const ticketParam = String(req.query.ticket || "");
        const tokenParam = String(req.query.token || "");
        let payload = null;
        if (ticketParam) {
            cleanupExpiredTickets();
            const t = pendingTickets.get(ticketParam);
            if (t && t.expiresAt >= Date.now()) {
                pendingTickets.delete(ticketParam); // single-use
                payload = { sub: t.userId, username: "", role: "", companyId: 0 };
            }
        }
        else if (tokenParam) {
            console.warn("[ms-oauth] /login appelé avec ?token= legacy — migrer vers ?ticket=");
            payload = (0, auth_1.verifyToken)(tokenParam, cfg);
        }
        if (!payload) {
            res.status(401).json({ message: "Ticket invalide ou expiré" });
            return;
        }
        if (!cfg.MS_CLIENT_ID) {
            res.status(500).json({ message: "MS_CLIENT_ID non configuré côté serveur" });
            return;
        }
        cleanupExpiredStates();
        const codeVerifier = node_crypto_1.default.randomBytes(32).toString("base64url");
        const codeChallenge = node_crypto_1.default.createHash("sha256").update(codeVerifier).digest("base64url");
        const state = node_crypto_1.default.randomBytes(16).toString("hex");
        pendingStates.set(state, {
            userId: payload.sub,
            codeVerifier,
            expiresAt: Date.now() + 10 * 60_000, // 10 min
        });
        res.redirect(authorizeUrl(cfg, state, codeChallenge));
    }));
    // Callback Microsoft : récupère code + state, échange contre tokens, sauve
    router.get("/callback", wrap(async (req, res) => {
        const code = String(req.query.code || "");
        const state = String(req.query.state || "");
        const err = String(req.query.error || "");
        if (err) {
            res.status(400).send(htmlMessage(`Erreur Microsoft : ${err}`, false));
            return;
        }
        if (!code || !state) {
            res.status(400).send(htmlMessage("Paramètres manquants", false));
            return;
        }
        const pending = pendingStates.get(state);
        pendingStates.delete(state);
        if (!pending) {
            res.status(400).send(htmlMessage("State expiré ou invalide. Recommencez.", false));
            return;
        }
        try {
            const tokens = await exchangeCode(cfg, code, pending.codeVerifier);
            const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
            // Récupère email du compte via Graph
            let accountEmail = "";
            try {
                const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
                    headers: { Authorization: `Bearer ${tokens.accessToken}` },
                });
                if (meRes.ok) {
                    const me = (await meRes.json());
                    accountEmail = me.mail || me.userPrincipalName || "";
                }
            }
            catch { }
            // Upsert : un seul token Microsoft par user
            await db.execute(`INSERT INTO oauth_tokens (provider, userId, accountEmail, accessToken, refreshToken, expiresAt, scope)
           VALUES ('microsoft', ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             accountEmail = VALUES(accountEmail),
             accessToken = VALUES(accessToken),
             refreshToken = COALESCE(VALUES(refreshToken), refreshToken),
             expiresAt = VALUES(expiresAt),
             scope = VALUES(scope)`, [pending.userId, accountEmail, tokens.accessToken, tokens.refreshToken, expiresAt, tokens.scope]);
            res.send(htmlMessage(`Connexion Microsoft réussie (${accountEmail}).`, true));
        }
        catch (e) {
            console.error("[ms-oauth] callback error:", e);
            res.status(500).send(htmlMessage(`Erreur : ${e instanceof Error ? e.message : "inconnue"}`, false));
        }
    }));
    // Infos sur le compte Microsoft connecté (pour l'utilisateur courant)
    router.get("/account", wrap(async (req, res) => {
        const payload = userFromAuthHeader(req, cfg);
        if (!payload) {
            res.status(401).json({ message: "Non authentifié" });
            return;
        }
        const [rows] = await db.query("SELECT id, accountEmail, expiresAt, scope FROM oauth_tokens WHERE provider='microsoft' AND userId=?", [payload.sub]);
        const row = rows[0];
        if (!row) {
            res.json({ connected: false });
            return;
        }
        res.json({
            connected: true,
            accountEmail: row.accountEmail,
            expiresAt: row.expiresAt,
            scope: row.scope,
        });
    }));
    // Déconnexion : supprime les tokens
    router.post("/logout", wrap(async (req, res) => {
        const payload = userFromAuthHeader(req, cfg);
        if (!payload) {
            res.status(401).json({ message: "Non authentifié" });
            return;
        }
        await db.execute("DELETE FROM oauth_tokens WHERE provider='microsoft' AND userId=?", [payload.sub]);
        res.status(204).end();
    }));
    return router;
}
// ─── Email via Microsoft Graph ────────────────────────────────────────────
const SendEmailSchema = zod_1.z.object({
    to: zod_1.z.array(zod_1.z.string().email()).min(1),
    cc: zod_1.z.array(zod_1.z.string().email()).optional(),
    subject: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1),
    isHtml: zod_1.z.boolean().default(true),
    attachments: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        contentType: zod_1.z.string().default("application/octet-stream"),
        contentBase64: zod_1.z.string(),
    }))
        .optional(),
});
function buildEmailRouter(db, cfg) {
    const router = (0, express_1.Router)();
    router.post("/send", wrap(async (req, res) => {
        const payload = userFromAuthHeader(req, cfg);
        if (!payload) {
            res.status(401).json({ message: "Non authentifié" });
            return;
        }
        const parsed = SendEmailSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide", details: parsed.error.issues });
            return;
        }
        const accessToken = await getValidAccessToken(db, cfg, payload.sub);
        if (!accessToken) {
            res.status(403).json({ message: "Pas de compte Microsoft connecté pour cet utilisateur" });
            return;
        }
        const message = {
            message: {
                subject: parsed.data.subject,
                body: {
                    contentType: parsed.data.isHtml ? "HTML" : "Text",
                    content: parsed.data.body,
                },
                toRecipients: parsed.data.to.map((email) => ({ emailAddress: { address: email } })),
                ccRecipients: (parsed.data.cc ?? []).map((email) => ({
                    emailAddress: { address: email },
                })),
                attachments: (parsed.data.attachments ?? []).map((a) => ({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    name: a.name,
                    contentType: a.contentType,
                    contentBytes: a.contentBase64,
                })),
            },
            saveToSentItems: true,
        };
        const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        });
        if (graphRes.status === 202) {
            res.status(202).json({ success: true });
            return;
        }
        const errBody = await graphRes.text();
        console.error("[ms-graph] sendMail failed:", graphRes.status, errBody);
        res.status(502).json({ success: false, error: `Graph API ${graphRes.status}`, details: errBody });
    }));
    return router;
}
// ─── HTML helper pour la callback page ────────────────────────────────────
function htmlMessage(message, success) {
    const color = success ? "#10b981" : "#ef4444";
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>BatiDesk · Microsoft</title>
<style>body{font-family:-apple-system,Segoe UI,system-ui,sans-serif;background:#0a0b0f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#16181f;border:1px solid #2a2d38;border-radius:16px;padding:40px;max-width:440px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.icon{width:64px;height:64px;background:${color}22;color:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px}
h1{margin:0 0 8px;font-size:20px}p{color:#94a3b8;margin:0;line-height:1.5;font-size:14px}
.footer{margin-top:24px;font-size:12px;color:#64748b}a{color:#3b82f6}</style></head>
<body><div class="card"><div class="icon">${success ? "✓" : "✕"}</div>
<h1>${success ? "Connexion réussie" : "Connexion échouée"}</h1>
<p>${message}</p>
<p style="margin-top:16px"><a href="/">← Retour à BatiDesk</a></p>
<p class="footer">BatiDesk · JACOB HABITAT</p></div></body></html>`;
}
