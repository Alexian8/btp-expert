// ═══════════════════════════════════════════════════════════════════════════
// Moteur IA locale — inférence CPU via node-llama-cpp (modèle GGUF quantifié)
//
// Conçu pour l'hébergement mutualisé (o2switch / Passenger) :
//   • chargement PARESSEUX : le modèle n'est monté en RAM qu'à la première
//     requête IA — le boot Passenger reste instantané ;
//   • UNE inférence à la fois (file d'attente) + threads bornés (AI_THREADS,
//     défaut 2) pour ne pas saturer le CPU partagé ni déclencher le fair-use ;
//   • node-llama-cpp est une dépendance OPTIONNELLE : si le module ou le
//     fichier modèle manquent, le service se déclare indisponible (l'UI
//     masque les boutons IA) sans jamais empêcher le serveur de démarrer.
//
// node-llama-cpp v3 est ESM-only alors que le serveur est compilé en
// CommonJS : l'import passe par `new Function("return import(...)")` pour
// échapper à la transpilation tsc (sinon `await import` devient `require`).
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import type { Config } from "../config";

/** Même forme que AiStatus dans packages/types/src/ai.ts — garder aligné. */
export interface AiEngineStatus {
  available: boolean;
  enabled: boolean;
  modelLoaded: boolean;
  modelFile: string;
  reason?: string;
  threads?: number;
  contextSize?: number;
}

/** Service IA non configuré / module ou modèle manquant → HTTP 503. */
export class AiUnavailableError extends Error {}
/** File d'attente pleine → HTTP 429. */
export class AiBusyError extends Error {}

// Échappe la transpilation CJS de tsc pour charger un package ESM-only.
const importEsm = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<Record<string, unknown>>;

interface CompleteArgs {
  systemPrompt: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export class AiEngine {
  private readonly cfg: Config;
  /** Instance llama + modèle résidents (chargés une fois, réutilisés). */
  private llamaModule: Record<string, unknown> | null = null;
  private model: { createContext: (o: object) => Promise<LlamaContextLike> } | null = null;
  private loading: Promise<void> | null = null;
  private lastError = "";
  /** Sérialisation des inférences : une seule à la fois. */
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  get enabled(): boolean {
    return Boolean(this.cfg.AI_MODEL_PATH);
  }

  private modelFileExists(): boolean {
    try {
      return this.enabled && fs.existsSync(this.cfg.AI_MODEL_PATH);
    } catch {
      return false;
    }
  }

  get modelFile(): string {
    return this.enabled ? path.basename(this.cfg.AI_MODEL_PATH) : "";
  }

  private async loadModule(): Promise<Record<string, unknown> | null> {
    if (this.llamaModule) return this.llamaModule;
    try {
      this.llamaModule = await importEsm("node-llama-cpp");
      return this.llamaModule;
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      return null;
    }
  }

  async status(): Promise<AiEngineStatus> {
    if (!this.enabled) {
      return {
        available: false,
        enabled: false,
        modelLoaded: false,
        modelFile: "",
        reason: "IA non configurée côté serveur (variable AI_MODEL_PATH absente)",
      };
    }
    if (!this.modelFileExists()) {
      return {
        available: false,
        enabled: true,
        modelLoaded: false,
        modelFile: this.modelFile,
        reason:
          "Fichier modèle introuvable sur le serveur (vérifiez AI_MODEL_PATH — " +
          "téléchargez le modèle avec apps/server/scripts/download-ai-model.js)",
      };
    }
    const mod = await this.loadModule();
    if (!mod) {
      return {
        available: false,
        enabled: true,
        modelLoaded: false,
        modelFile: this.modelFile,
        reason:
          "Module node-llama-cpp non installé (lancer `npm install --omit=dev` " +
          `sur le serveur) : ${this.lastError}`,
      };
    }
    return {
      available: true,
      enabled: true,
      modelLoaded: this.model !== null,
      modelFile: this.modelFile,
      threads: this.cfg.AI_THREADS,
      contextSize: this.cfg.AI_CONTEXT_SIZE,
    };
  }

  /** Charge llama + le modèle une seule fois (les appels concurrents attendent). */
  private async ensureModel(): Promise<void> {
    if (this.model) return;
    if (!this.loading) {
      this.loading = (async () => {
        const mod = await this.loadModule();
        if (!mod) {
          throw new AiUnavailableError(`Module node-llama-cpp indisponible : ${this.lastError}`);
        }
        const getLlama = mod.getLlama as (o: object) => Promise<{
          loadModel: (o: object) => Promise<{ createContext: (o: object) => Promise<LlamaContextLike> }>;
        }>;
        // gpu:false — hébergement mutualisé sans GPU ; build:"never" — utiliser
        // uniquement les binaires précompilés (jamais de compilation cmake sur
        // cPanel) ; logLevel error pour ne pas polluer les logs Passenger.
        const llama = await getLlama({ gpu: false, build: "never", logLevel: "error" });
        this.model = await llama.loadModel({ modelPath: this.cfg.AI_MODEL_PATH });
        console.log(`[ai] modèle chargé en mémoire : ${this.modelFile}`);
      })().catch((e) => {
        // Reset pour permettre une nouvelle tentative au prochain appel
        this.loading = null;
        throw e;
      });
    }
    await this.loading;
  }

  /**
   * Lance une complétion. Les appels sont sérialisés (un seul à la fois) ;
   * au-delà de AI_QUEUE_MAX requêtes en attente → AiBusyError (429).
   */
  async complete(args: CompleteArgs): Promise<string> {
    if (!this.enabled) {
      throw new AiUnavailableError("IA non configurée côté serveur (AI_MODEL_PATH)");
    }
    if (!this.modelFileExists()) {
      throw new AiUnavailableError("Fichier modèle introuvable sur le serveur");
    }
    if (this.pending >= this.cfg.AI_QUEUE_MAX) {
      throw new AiBusyError("Assistant IA occupé — réessayez dans quelques secondes");
    }
    this.pending++;
    const run = this.queue.then(() => this.runInference(args));
    // La chaîne continue même si cette inférence échoue
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    try {
      return await run;
    } finally {
      this.pending--;
    }
  }

  private async runInference(args: CompleteArgs): Promise<string> {
    await this.ensureModel();
    const mod = this.llamaModule as Record<string, unknown>;
    const LlamaChatSession = mod.LlamaChatSession as new (o: object) => {
      prompt: (p: string, o: object) => Promise<string>;
    };

    // Un contexte NEUF par requête : pas d'état partagé entre utilisateurs,
    // mémoire libérée aussitôt (seul le modèle reste résident).
    const context = await (this.model as NonNullable<typeof this.model>).createContext({
      contextSize: this.cfg.AI_CONTEXT_SIZE,
      threads: this.cfg.AI_THREADS,
    });
    try {
      const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: args.systemPrompt,
      });
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), this.cfg.AI_TIMEOUT_MS);
      try {
        // stopOnAbortSignal : au timeout on récupère le texte partiel plutôt
        // qu'une erreur — sur CPU mutualisé mieux vaut une phrase incomplète.
        const out = await session.prompt(args.prompt, {
          maxTokens: args.maxTokens ?? this.cfg.AI_MAX_TOKENS,
          temperature: args.temperature ?? 0.4,
          signal: abort.signal,
          stopOnAbortSignal: true,
        });
        return String(out ?? "").trim();
      } finally {
        clearTimeout(timer);
      }
    } finally {
      await context.dispose().catch(() => {});
    }
  }
}

interface LlamaContextLike {
  getSequence: () => unknown;
  dispose: () => Promise<void>;
}
