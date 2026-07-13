import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, XCircle, Cpu, FileCode2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSectionWrapper } from "./SettingsPage";
import type { AiStatus, AiTestResult } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// AiSection — diagnostic de l'assistant IA locale (admin).
// Affiche le statut vu par le serveur (modèle GGUF, threads, contexte) et
// lance un test d'inférence réel : le premier appel charge le modèle en RAM,
// la durée mesurée donne une idée honnête de la vitesse sur l'hébergement.
// Sur desktop (pas de serveur), le statut renvoie « indisponible » avec la
// raison — la section reste informative.
// ═══════════════════════════════════════════════════════════════════════════

export function AiSection() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<AiTestResult | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await window.btpAPI?.aiStatus?.();
        if (alive) {
          setStatus(
            s ?? { available: false, enabled: false, modelLoaded: false, modelFile: "" }
          );
        }
      } catch {
        if (alive) {
          setStatus({
            available: false,
            enabled: false,
            modelLoaded: false,
            modelFile: "",
            reason: "Serveur injoignable",
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleTest = async (): Promise<void> => {
    if (!window.btpAPI?.aiTest) return;
    setTesting(true);
    setResult(null);
    try {
      setResult(await window.btpAPI.aiTest());
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "Erreur inattendue" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statut vu par le serveur */}
      <SettingsSectionWrapper
        title="Assistant IA locale"
        description="Petit modèle de langage (GGUF) exécuté directement sur le serveur — aucune donnée n'est envoyée à un service externe. Utilisé pour la rédaction des lignes de devis et la catégorisation des dépenses."
      >
        {!status ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-2">
            <div
              className={
                status.available
                  ? "flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-400"
                  : "flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400"
              }
            >
              {status.available ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Assistant IA prêt
                  {status.modelLoaded ? " (modèle chargé en mémoire)" : " (le modèle se chargera à la première requête)"}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Assistant IA indisponible
                    {status.reason ? ` — ${status.reason}` : ""}
                  </span>
                </>
              )}
            </div>

            {status.available && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="p-3 rounded-md bg-muted flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs truncate">{status.modelFile}</span>
                </div>
                <div className="p-3 rounded-md bg-muted flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs truncate">
                    {status.threads} thread{(status.threads ?? 0) > 1 ? "s" : ""} · contexte{" "}
                    {status.contextSize} tokens
                  </span>
                </div>
              </div>
            )}

            {!status.enabled && (
              <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-md border border-border">
                <p className="font-medium text-foreground">Pour activer l'assistant :</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    Télécharger un modèle sur le serveur (SSH) :{" "}
                    <code className="bg-muted rounded px-1">
                      node apps/server/scripts/download-ai-model.js
                    </code>
                  </li>
                  <li>
                    Ajouter <code className="bg-muted rounded px-1">AI_MODEL_PATH=…</code> dans le{" "}
                    <code className="bg-muted rounded px-1">.env</code> du serveur
                  </li>
                  <li>Redémarrer l'application Node (cPanel → Restart)</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </SettingsSectionWrapper>

      {/* Test d'inférence */}
      <SettingsSectionWrapper
        title="Tester l'assistant"
        description="Lance une vraie inférence sur le serveur. Le premier test charge le modèle en mémoire (plus lent) ; les suivants reflètent la vitesse réelle."
      >
        <Button onClick={handleTest} loading={testing} disabled={!status?.available || testing}>
          <PlayCircle className="w-4 h-4" />
          {testing ? "Inférence en cours…" : "Lancer un test"}
        </Button>

        {result && (
          <div
            className={
              result.success
                ? "mt-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm"
                : "mt-4 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-sm"
            }
          >
            {result.success ? (
              <div className="text-emerald-700 dark:text-emerald-400">
                <p className="font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Réponse en {((result.durationMs ?? 0) / 1000).toFixed(1)} s
                  {result.modelFile ? ` — ${result.modelFile}` : ""}
                </p>
                {result.output && (
                  <code className="block mt-1.5 text-xs bg-background/60 rounded p-2 break-all">
                    {result.output}
                  </code>
                )}
                <p className="text-xs mt-1 opacity-90">
                  Au-delà de ~30 s par réponse, réduisez la taille du modèle (0.5B) ou vérifiez la
                  charge CPU de l'hébergement.
                </p>
              </div>
            ) : (
              <div className="text-rose-700 dark:text-rose-400">
                <p className="font-medium flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Échec du test
                </p>
                <code className="block mt-1.5 text-xs bg-background/60 rounded p-2 break-all">
                  {result.error}
                </code>
                <ul className="text-xs mt-2 space-y-1 opacity-90 list-disc pl-4">
                  <li>
                    <strong>Module non installé</strong> : lancer{" "}
                    <code>npm install --omit=dev</code> à la racine du site (Terminal cPanel), puis
                    redémarrer.
                  </li>
                  <li>
                    <strong>Fichier modèle introuvable</strong> : vérifier le chemin absolu dans{" "}
                    <code>AI_MODEL_PATH</code> (le fichier .gguf doit exister sur le serveur).
                  </li>
                  <li>
                    <strong>Occupé / trop de requêtes</strong> : une seule inférence tourne à la
                    fois — réessayez dans quelques secondes.
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </SettingsSectionWrapper>
    </div>
  );
}
