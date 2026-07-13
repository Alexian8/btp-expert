"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiEngine = exports.AiBusyError = exports.AiUnavailableError = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
/** Service IA non configuré / module ou modèle manquant → HTTP 503. */
class AiUnavailableError extends Error {
}
exports.AiUnavailableError = AiUnavailableError;
/** File d'attente pleine → HTTP 429. */
class AiBusyError extends Error {
}
exports.AiBusyError = AiBusyError;
// Échappe la transpilation CJS de tsc pour charger un package ESM-only.
const importEsm = new Function("specifier", "return import(specifier)");
class AiEngine {
    cfg;
    /** Instance llama + modèle résidents (chargés une fois, réutilisés). */
    llamaModule = null;
    model = null;
    loading = null;
    lastError = "";
    /** Sérialisation des inférences : une seule à la fois. */
    queue = Promise.resolve();
    pending = 0;
    constructor(cfg) {
        this.cfg = cfg;
    }
    get enabled() {
        return Boolean(this.cfg.AI_MODEL_PATH);
    }
    modelFileExists() {
        try {
            return this.enabled && node_fs_1.default.existsSync(this.cfg.AI_MODEL_PATH);
        }
        catch {
            return false;
        }
    }
    get modelFile() {
        return this.enabled ? node_path_1.default.basename(this.cfg.AI_MODEL_PATH) : "";
    }
    async loadModule() {
        if (this.llamaModule)
            return this.llamaModule;
        try {
            this.llamaModule = await importEsm("node-llama-cpp");
            return this.llamaModule;
        }
        catch (e) {
            this.lastError = e instanceof Error ? e.message : String(e);
            return null;
        }
    }
    async status() {
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
                reason: "Fichier modèle introuvable sur le serveur (vérifiez AI_MODEL_PATH — " +
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
                reason: "Module node-llama-cpp non installé (lancer `npm install --omit=dev` " +
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
    async ensureModel() {
        if (this.model)
            return;
        if (!this.loading) {
            this.loading = (async () => {
                const mod = await this.loadModule();
                if (!mod) {
                    throw new AiUnavailableError(`Module node-llama-cpp indisponible : ${this.lastError}`);
                }
                const getLlama = mod.getLlama;
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
    async complete(args) {
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
        this.queue = run.then(() => undefined, () => undefined);
        try {
            return await run;
        }
        finally {
            this.pending--;
        }
    }
    async runInference(args) {
        await this.ensureModel();
        const mod = this.llamaModule;
        const LlamaChatSession = mod.LlamaChatSession;
        // Un contexte NEUF par requête : pas d'état partagé entre utilisateurs,
        // mémoire libérée aussitôt (seul le modèle reste résident).
        const context = await this.model.createContext({
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
            }
            finally {
                clearTimeout(timer);
            }
        }
        finally {
            await context.dispose().catch(() => { });
        }
    }
}
exports.AiEngine = AiEngine;
