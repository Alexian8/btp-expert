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

import { Router, type Request, type Response } from "express";
import type { Config } from "../config";
import { AiEngine, AiBusyError, AiUnavailableError } from "../ai/engine";
import {
  buildQuoteLinePrompts,
  buildExpenseCategoryPrompts,
  parseExpenseCategory,
  sanitizeQuoteLineDescription,
} from "../ai/prompts";
import { requireRole } from "../rbac";
import { buildAiRateLimiter } from "../rate-limit";

/** Convertit les erreurs moteur en réponses HTTP typées ({message} = convention shim). */
function sendAiError(res: Response, e: unknown): void {
  if (e instanceof AiBusyError) {
    res.status(429).json({ message: e.message });
    return;
  }
  if (e instanceof AiUnavailableError) {
    res.status(503).json({ message: e.message });
    return;
  }
  console.error("[ai]", e);
  res.status(500).json({ message: "Erreur du service IA" });
}

function readString(body: unknown, key: string, maxLen: number): string {
  const v = (body as Record<string, unknown> | null)?.[key];
  return typeof v === "string" ? v.trim().slice(0, maxLen) : "";
}

export function buildAiRouter(cfg: Config): Router {
  const router = Router();
  const engine = new AiEngine(cfg);
  const limiter = buildAiRateLimiter(cfg);

  // ─── Statut (gating UI : les boutons IA ne s'affichent que si available) ─
  router.get("/status", async (_req: Request, res: Response) => {
    res.json(await engine.status());
  });

  // ─── Devis : rédige la description d'une ligne ──────────────────────────
  router.post("/suggest-quote-line", limiter, async (req: Request, res: Response) => {
    const title = readString(req.body, "title", 200);
    if (!title) {
      res.status(400).json({ message: "title requis (désignation de la ligne)" });
      return;
    }
    const description = readString(req.body, "description", 500);
    const started = Date.now();
    try {
      const { system, prompt } = buildQuoteLinePrompts({ title, description });
      const raw = await engine.complete({ systemPrompt: system, prompt });
      const text = sanitizeQuoteLineDescription(raw);
      if (!text) {
        res.status(502).json({ message: "Le modèle a renvoyé une réponse vide — réessayez" });
        return;
      }
      res.json({ success: true, description: text, durationMs: Date.now() - started });
    } catch (e) {
      sendAiError(res, e);
    }
  });

  // ─── Dépenses : suggère une catégorie comptable ─────────────────────────
  router.post("/categorize-expense", limiter, async (req: Request, res: Response) => {
    const description = readString(req.body, "description", 300);
    if (!description) {
      res.status(400).json({ message: "description requise (libellé de la dépense)" });
      return;
    }
    const supplierName = readString(req.body, "supplierName", 120);
    const started = Date.now();
    try {
      const { system, prompt } = buildExpenseCategoryPrompts({ description, supplierName });
      // Réponse attendue : une clé — sortie courte et déterministe
      const raw = await engine.complete({
        systemPrompt: system,
        prompt,
        maxTokens: 12,
        temperature: 0,
      });
      const category = parseExpenseCategory(raw);
      if (!category) {
        res.status(502).json({
          message: `Le modèle n'a pas reconnu de catégorie (réponse : « ${raw.slice(0, 80)} »)`,
        });
        return;
      }
      res.json({ success: true, category, durationMs: Date.now() - started });
    } catch (e) {
      sendAiError(res, e);
    }
  });

  // ─── Diagnostic admin (Paramètres → IA locale) ──────────────────────────
  // Force le chargement du modèle et renvoie la durée réelle : premier
  // réflexe pour vérifier qu'un modèle fraîchement installé répond.
  router.post("/test", requireRole("admin"), limiter, async (_req: Request, res: Response) => {
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
    } catch (e) {
      sendAiError(res, e);
    }
  });

  return router;
}
