import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud, Database, Clock, AlertTriangle, Check, Download, X, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useBackupStore } from "@/stores/backupStore";

// ═══════════════════════════════════════════════════════════════════════════
// OneDriveStartupCheck — Vérification au démarrage (Session iOS-1.5)
// Si le cloud a une version plus récente que la DB locale, propose la restauration.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  /** Lance la vérification au mount */
  enabled: boolean;
}

function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function ageHumanReadable(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function OneDriveStartupCheck({ enabled }: Props) {
  const checkOneDriveAtStartup = useBackupStore((s) => s.checkOneDriveAtStartup);
  const [report, setReport] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Session S28 — Hotfix safety : récupère stats locales + checkbox confirmation
  const [localStats, setLocalStats] = useState<any>(null);
  const [confirmedLoss, setConfirmedLoss] = useState(false);

  useEffect(() => {
    if (!enabled || dismissed) return;
    let mounted = true;
    (async () => {
      const r = await checkOneDriveAtStartup();
      if (!mounted) return;
      // On n'ouvre la modal QUE si une version plus récente existe
      if (r.success && r.cloudIsNewer) {
        setReport(r);
        setOpen(true);
        // Session S28 — Récupère les stats locales pour comparer
        try {
          const ls = await (window as any).btpAPI?.dbGetStats?.();
          if (mounted && ls) setLocalStats(ls);
        } catch {
          // Pas grave, on continue sans comparaison
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [enabled]);

  const handleRestore = async () => {
    if (!report?.latest?.name) return;
    if (!window.btpAPI?.msOneDriveRestore) {
      toast.error("API OneDrive indisponible");
      return;
    }
    setRestoring(true);
    try {
      const r = await window.btpAPI.msOneDriveRestore({ remoteName: report.latest.name });
      if (r.success) {
        toast.success("Restauration réussie, redémarrage...");
        // L'app va relancer automatiquement (côté Electron)
      } else {
        toast.error(r.error || "Erreur lors de la restauration");
        setRestoring(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur inattendue");
      setRestoring(false);
    }
  };

  const handleDismiss = () => {
    setOpen(false);
    setDismissed(true);
  };

  if (!report) return null;

  const stats = report.latest?.manifest?.database?.stats;

  // ─── Session S28 — Analyse du risque de perte de données ─────────────
  // Compare les volumes : si la DB cloud est < 50% des données locales sur
  // au moins 1 entité critique, on considère que c'est dangereux.
  const dangerAnalysis = (() => {
    if (!localStats || !stats) return { danger: false, losses: [] as Array<{ key: string; label: string; local: number; cloud: number; loss: number }> };
    const compare = (key: string, label: string) => {
      const local = Number(localStats[key] || 0);
      const cloud = Number(stats[key] || 0);
      // Risque significatif si on perd plus de 50% des données ET au moins 2 enregistrements
      if (local >= 2 && cloud < local * 0.5) {
        return { key, label, local, cloud, loss: local - cloud };
      }
      return null;
    };
    const losses = [
      compare("clients", "clients"),
      compare("chantiers", "chantiers"),
      compare("devis", "devis"),
      compare("factures", "factures"),
    ].filter(Boolean) as Array<{ key: string; label: string; local: number; cloud: number; loss: number }>;
    return { danger: losses.length > 0, losses };
  })();

  const isDangerous = dangerAnalysis.danger;
  const canRestore = !isDangerous || confirmedLoss;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-md w-full p-5"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold">Sauvegarde cloud plus récente</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Une version plus récente de vos données est disponible sur OneDrive.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Ignorer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comparaison locale vs cloud */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between p-2.5 border border-border rounded-md">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">DB locale</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {ageHumanReadable(report.localMtime)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 border border-blue-500/30 bg-blue-500/5 rounded-md">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium">OneDrive</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                    plus récent
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {ageHumanReadable(report.latest.modifiedAt)}
                </span>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="bg-muted/40 rounded p-2.5 mb-4">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                  Contenu de la sauvegarde cloud
                </p>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <Stat label="Clients" value={stats.clients} />
                  <Stat label="Chantiers" value={stats.chantiers} />
                  <Stat label="Devis" value={stats.devis} />
                  <Stat label="Factures" value={stats.factures} />
                  <Stat label="ST" value={stats.sousTraitants} />
                  <Stat label="Taille" value={formatBytes(report.latest.size)} small />
                </div>
              </div>
            )}

            {/* Session S28 — Avertissement de DANGER si données locales > cloud */}
            {isDangerous ? (
              <div className="bg-red-500/10 border-2 border-red-500/50 rounded-lg p-3 mb-3 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                      Attention : risque de perte de données
                    </p>
                    <p className="text-[11px] text-red-600 dark:text-red-300 mt-1">
                      La sauvegarde cloud contient moins de données que votre DB locale actuelle.
                      Si vous restaurez, vous PERDREZ :
                    </p>
                  </div>
                </div>
                <div className="ml-7 space-y-1">
                  {dangerAnalysis.losses.map((l) => (
                    <div key={l.key} className="text-[11px] text-red-700 dark:text-red-300 font-mono">
                      • <strong>{l.loss}</strong> {l.label} (vous en avez {l.local} en local, {l.cloud} dans le cloud)
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-2 mt-2 pt-2 border-t border-red-500/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedLoss}
                    onChange={(e) => setConfirmedLoss(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-red-500"
                  />
                  <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                    Je confirme accepter de perdre {dangerAnalysis.losses.map((l) => `${l.loss} ${l.label}`).join(", ")}
                  </span>
                </label>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2.5 mb-4 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Restaurer écrasera les données locales actuelles. Une copie de sécurité
                  de votre DB locale sera créée automatiquement.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDismiss}>
                Ignorer
              </Button>
              <Button
                onClick={handleRestore}
                loading={restoring}
                disabled={!canRestore}
                className={cn(isDangerous && !canRestore && "opacity-50 cursor-not-allowed")}
              >
                <Download className="w-4 h-4" />
                Restaurer
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn("font-semibold tabular-nums", small ? "text-[10px]" : "text-xs")}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </p>
    </div>
  );
}
