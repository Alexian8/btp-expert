"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// cPanel Email — création/suppression de boîtes mail via UAPI
//
// Utilise l'API cPanel UAPI exposée sur https://<cpanel-host>:2083/execute/
// avec authentification par API Token (généré par le user dans cPanel →
// Manage API Tokens). Pas de password user, pas de cookie : juste un header
// `Authorization: cpanel USERNAME:TOKEN`.
//
// Endpoints utilisés :
//   • Email/add_pop      → crée une boîte mail (local@domain)
//   • Email/delete_pop   → supprime une boîte mail
//   • Email/list_pops    → liste les boîtes (debug / vérif)
//
// Doc UAPI : https://api.docs.cpanel.net/openapi/cpanel/operation/Email/add_pop/
// ═══════════════════════════════════════════════════════════════════════════
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCpanelConfigured = isCpanelConfigured;
exports.createMailbox = createMailbox;
exports.deleteMailbox = deleteMailbox;
exports.listMailboxes = listMailboxes;
const https = __importStar(require("node:https"));
/** Vrai si la config cPanel est complète (sinon les méthodes seront no-op). */
function isCpanelConfigured(cfg) {
    return Boolean(cfg.CPANEL_HOST && cfg.CPANEL_USERNAME && cfg.CPANEL_API_TOKEN);
}
/**
 * Appel HTTP UAPI bas-niveau. GET avec query string + header Authorization.
 * UAPI accepte aussi POST mais GET est plus simple ici.
 */
function uapiRequest(cfg, module, func, params) {
    return new Promise((resolve, reject) => {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(params))
            sp.set(k, String(v));
        const path = `/execute/${module}/${func}?${sp.toString()}`;
        const req = https.request({
            host: cfg.CPANEL_HOST,
            port: 2083,
            method: "GET",
            path,
            headers: {
                Authorization: `cpanel ${cfg.CPANEL_USERNAME}:${cfg.CPANEL_API_TOKEN}`,
                Accept: "application/json",
            },
            // o2switch a un certif Let's Encrypt valide → vérif ON
            rejectUnauthorized: true,
        }, (res) => {
            let raw = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (raw += chunk));
            res.on("end", () => {
                let body = null;
                try {
                    body = JSON.parse(raw);
                }
                catch {
                    /* laisser body à null */
                }
                resolve({ status: res.statusCode ?? 0, body, raw });
            });
        });
        req.on("error", reject);
        // Timeout 20s (cPanel peut être lent)
        req.setTimeout(20000, () => {
            req.destroy(new Error("Timeout cPanel API (20s)"));
        });
        req.end();
    });
}
/**
 * Crée une boîte mail dans cPanel.
 * Retourne ok:false avec alreadyExists:true si la boîte existe déjà.
 */
async function createMailbox(cfg, input) {
    if (!isCpanelConfigured(cfg)) {
        return { ok: false, error: "cPanel API non configurée (env CPANEL_*)" };
    }
    const [localPart, domain] = input.email.split("@");
    if (!localPart || !domain) {
        return { ok: false, error: `Email invalide : ${input.email}` };
    }
    // Sécurité : on autorise seulement les emails dans le domaine configuré
    // (sinon un admin pourrait créer des mailboxes sur n'importe quel domaine
    // hébergé sur ce cPanel).
    if (cfg.CPANEL_EMAIL_DOMAIN && domain !== cfg.CPANEL_EMAIL_DOMAIN) {
        return {
            ok: false,
            error: `Domaine "${domain}" non autorisé (attendu : ${cfg.CPANEL_EMAIL_DOMAIN})`,
        };
    }
    const quotaMB = input.quotaMB ?? cfg.CPANEL_EMAIL_QUOTA_MB ?? 250;
    try {
        const { status, body, raw } = await uapiRequest(cfg, "Email", "add_pop", {
            email: localPart,
            password: input.password,
            domain,
            quota: quotaMB,
        });
        if (status !== 200) {
            return { ok: false, error: `HTTP ${status} cPanel: ${raw.slice(0, 200)}`, raw: body };
        }
        const r = body;
        if (r?.status === 1) {
            return { ok: true, raw: body };
        }
        const errMsg = (r?.errors ?? [])[0] ?? "Erreur cPanel inconnue";
        if (/already exists|existe déjà/i.test(errMsg)) {
            return { ok: false, alreadyExists: true, error: errMsg, raw: body };
        }
        return { ok: false, error: errMsg, raw: body };
    }
    catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
/** Supprime une boîte mail dans cPanel. Idempotent : ok=true si déjà absente. */
async function deleteMailbox(cfg, email) {
    if (!isCpanelConfigured(cfg)) {
        return { ok: false, error: "cPanel API non configurée" };
    }
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) {
        return { ok: false, error: `Email invalide : ${email}` };
    }
    try {
        const { status, body, raw } = await uapiRequest(cfg, "Email", "delete_pop", {
            email: localPart,
            domain,
        });
        if (status !== 200) {
            return { ok: false, error: `HTTP ${status}: ${raw.slice(0, 200)}`, raw: body };
        }
        const r = body;
        if (r?.status === 1)
            return { ok: true };
        const errMsg = (r?.errors ?? [])[0] ?? "Erreur cPanel";
        // Si la boîte n'existait pas, on considère le delete comme OK (idempotent)
        if (/does not exist|introuvable|n'existe pas/i.test(errMsg)) {
            return { ok: true };
        }
        return { ok: false, error: errMsg, raw: body };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
/** Liste toutes les mailboxes du domaine (debug / sync). */
async function listMailboxes(cfg) {
    if (!isCpanelConfigured(cfg))
        return { emails: [], error: "cPanel non configuré" };
    try {
        const { body } = await uapiRequest(cfg, "Email", "list_pops", {});
        const r = body;
        if (r?.status === 1 && Array.isArray(r.data)) {
            return { emails: r.data.map((d) => d.email) };
        }
        return { emails: [], error: r?.errors?.[0] ?? "Format inattendu" };
    }
    catch (e) {
        return { emails: [], error: e instanceof Error ? e.message : String(e) };
    }
}
//# sourceMappingURL=cpanel-email.js.map