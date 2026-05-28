"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Routes Qonto — /api/qonto/*
//
// Socle d'intégration bancaire (lecture seule pour l'instant) :
//   POST   /connect       enregistre + teste les identifiants API
//   GET    /status        état de connexion (sans exposer la secret)
//   POST   /disconnect    supprime les identifiants
//   GET    /accounts      comptes + soldes (live)
//   GET    /transactions  transactions d'un compte (live)
//
// Le rapprochement bancaire et l'import en compta seront ajoutés ensuite,
// une fois la connexion testée avec un vrai compte.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQontoRouter = buildQontoRouter;
const express_1 = require("express");
const client_1 = require("../qonto/client");
const credentials_1 = require("../qonto/credentials");
function buildQontoRouter(db, cfg) {
    const router = (0, express_1.Router)();
    const jwtSecret = cfg.JWT_SECRET;
    // ─── État de connexion ─────────────────────────────────────────────────
    router.get("/status", async (_req, res) => {
        try {
            res.json(await (0, credentials_1.getStatus)(db));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ─── Connexion (teste puis enregistre) ─────────────────────────────────
    router.post("/connect", async (req, res) => {
        try {
            const login = String((req.body || {}).login || "").trim();
            const secretKey = String((req.body || {}).secretKey || "").trim();
            if (!login || !secretKey) {
                return res.status(400).json({ success: false, error: "Login et secret key requis." });
            }
            // Test immédiat : on tente de récupérer l'organisation
            const org = await (0, client_1.fetchOrganization)({ login, secretKey });
            await (0, credentials_1.saveCredentials)(db, { login, secretKey }, jwtSecret, org.legalName);
            res.json({
                success: true,
                organizationName: org.legalName,
                accountsCount: org.accounts.length,
            });
        }
        catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });
    // ─── Déconnexion ────────────────────────────────────────────────────────
    router.post("/disconnect", async (_req, res) => {
        try {
            await (0, credentials_1.deleteCredentials)(db);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // ─── Comptes + soldes (live) ────────────────────────────────────────────
    router.get("/accounts", async (_req, res) => {
        try {
            const creds = await (0, credentials_1.getCredentials)(db, jwtSecret);
            if (!creds)
                return res.status(409).json({ error: "Qonto non connecté." });
            const org = await (0, client_1.fetchOrganization)(creds);
            res.json({ organizationName: org.legalName, accounts: org.accounts });
        }
        catch (e) {
            res.status(502).json({ error: e.message });
        }
    });
    // ─── Transactions d'un compte (live) ────────────────────────────────────
    router.get("/transactions", async (req, res) => {
        try {
            const creds = await (0, credentials_1.getCredentials)(db, jwtSecret);
            if (!creds)
                return res.status(409).json({ error: "Qonto non connecté." });
            const accountSlug = String(req.query.accountId || "");
            if (!accountSlug)
                return res.status(400).json({ error: "accountId requis." });
            const settledFrom = req.query.from ? String(req.query.from) : undefined;
            const transactions = await (0, client_1.fetchTransactions)(creds, accountSlug, {
                settledFrom,
                maxPages: 10,
            });
            res.json({ transactions });
        }
        catch (e) {
            res.status(502).json({ error: e.message });
        }
    });
    return router;
}
