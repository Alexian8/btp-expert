"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Routes IA locale — /api/ai/*
//
// Inférence CPU sur le serveur via node-llama-cpp (voir ../ai/engine.ts).
// Montées derrière requireAuth dans app.ts ; rate-limit dédié (l'inférence
// est coûteuse). Consommées par le shim web ET par iOS (REST).
//
//   GET  /status             → AiStatus (tous rôles — sert au gating UI)
//   POST /suggest-quote-line → { success, description } (description de ligne de devis)
//   POST /categorize-expense → { success, category } (clé ExpenseCategory)
//   POST /test               → admin only : mini-prompt de diagnostic
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAiRouter = buildAiRouter;
const express_1 = require("express");
const engine_1 = require("../ai/engine");
const prompts_1 = require("../ai/prompts");
const rbac_1 = require("../rbac");
const rate_limit_1 = require("../rate-limit");
/** Convertit les erreurs moteur en réponses HTTP typées ({message} = convention shim). */
function sendAiError(res, e) {
    if (e instanceof engine_1.AiBusyError) {
        res.status(429).json({ message: e.message });
        return;
    }
    if (e instanceof engine_1.AiUnavailableError) {
        res.status(503).json({ message: e.message });
        return;
    }
    console.error("[ai]", e);
    res.status(500).json({ message: "Erreur du service IA" });
}
function readString(body, key, maxLen) {
    const v = body?.[key];
    return typeof v === "string" ? v.trim().slice(0, maxLen) : "";
}
function buildAiRouter(cfg) {
    const router = (0, express_1.Router)();
    const engine = new engine_1.AiEngine(cfg);
    const limiter = (0, rate_limit_1.buildAiRateLimiter)(cfg);
    // ─── Statut (gating UI : les boutons IA ne s'affichent que si available) ─
    router.get("/status", async (_req, res) => {
        res.json(await engine.status());
    });
    // ─── Devis : rédige la description d'une ligne ──────────────────────────
    router.post("/suggest-quote-line", limiter, async (req, res) => {
        const title = readString(req.body, "title", 200);
        if (!title) {
            res.status(400).json({ message: "title requis (désignation de la ligne)" });
            return;
        }
        const description = readString(req.body, "description", 500);
        const started = Date.now();
        try {
            const { system, prompt } = (0, prompts_1.buildQuoteLinePrompts)({ title, description });
            const raw = await engine.complete({ systemPrompt: system, prompt });
            const text = (0, prompts_1.sanitizeQuoteLineDescription)(raw);
            if (!text) {
                res.status(502).json({ message: "Le modèle a renvoyé une réponse vide — réessayez" });
                return;
            }
            res.json({ success: true, description: text, durationMs: Date.now() - started });
        }
        catch (e) {
            sendAiError(res, e);
        }
    });
    // ─── Dépenses : suggère une catégorie comptable ─────────────────────────
    router.post("/categorize-expense", limiter, async (req, res) => {
        const description = readString(req.body, "description", 300);
        if (!description) {
            res.status(400).json({ message: "description requise (libellé de la dépense)" });
            return;
        }
        const supplierName = readString(req.body, "supplierName", 120);
        const started = Date.now();
        try {
            const { system, prompt } = (0, prompts_1.buildExpenseCategoryPrompts)({ description, supplierName });
            // Réponse attendue : une clé — sortie courte et déterministe
            const raw = await engine.complete({
                systemPrompt: system,
                prompt,
                maxTokens: 12,
                temperature: 0,
            });
            const category = (0, prompts_1.parseExpenseCategory)(raw);
            if (!category) {
                res.status(502).json({
                    message: `Le modèle n'a pas reconnu de catégorie (réponse : « ${raw.slice(0, 80)} »)`,
                });
                return;
            }
            res.json({ success: true, category, durationMs: Date.now() - started });
        }
        catch (e) {
            sendAiError(res, e);
        }
    });
    // ─── Diagnostic admin (Paramètres → IA locale) ──────────────────────────
    // Force le chargement du modèle et renvoie la durée réelle : premier
    // réflexe pour vérifier qu'un modèle fraîchement installé répond.
    router.post("/test", (0, rbac_1.requireRole)("admin"), limiter, async (_req, res) => {
        const started = Date.now();
        try {
            const output = await engine.complete({
                systemPrompt: "Tu es l'assistant de test de BatiDesk. Réponds en une phrase.",
                prompt: "Réponds exactement : OK, l'assistant IA de BatiDesk fonctionne.",
                maxTokens: 30,
                temperature: 0,
            });
            res.json({
                success: true,
                output,
                durationMs: Date.now() - started,
                modelFile: engine.modelFile,
            });
        }
        catch (e) {
            sendAiError(res, e);
        }
    });
    return router;
}
