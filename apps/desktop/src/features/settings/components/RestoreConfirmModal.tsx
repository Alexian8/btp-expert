import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, AlertTriangle, ShieldCheck, ShieldAlert, Database, Briefcase, FileText, Clock, Hash,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useBackupStore } from "@/stores/backupStore";

// ═══════════════════════════════════════════════════════════════════════════
// RestoreConfirmModal — Confirmation avant restauration (Session 23)
// Affiche le manifest, le hash, les warnings — propose un bypass intégrité
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  backupPath: string | null;
  onClose: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} o`;
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

export function RestoreConfirmModal({ open, backupPath, onClose }: Props) {
  const { inspectBackup, restoreBackup } = useBackupStore();
  const [inspecting, setInspecting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [forceRestore, setForceRestore] = useState(false);

  useEffect(() => {
    if (!open || !backupPath) {
      setReport(null);
      setForceRestore(false);
      return;
    }
    setInspecting(true);
    inspectBackup(backupPath)
      .then((r) => setReport(r))
      .finally(() => setInspecting(false));
  }, [open, backupPath]);

  const handleConfirm = async () => {
    if (!backupPath) return;
    if (report?.format === "btpbackup" && report?.integrityOk === false && !forceRestore) {
      toast.error("Cochez la case 'Forcer malgré la corruption' pour continuer");
      return;
    }
    setRestoring(true);
    const r = await restoreBackup(backupPath, forceRestore);
    setRestoring(false);
    if (!r.success) {
      toast.error(r.error || "Erreur lors de la restauration");
    }
    // Si succès : l'app redémarre automatiquement (app.relaunch côté Electron)
  };

  const isLegacy = report?.format === "legacy-db";
  const integrityOk = report?.integrityOk !== false;
  const hasWarnings = (report?.warnings || []).length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Restaurer une sauvegarde</h2>
                  <p className="text-xs text-muted-foreground">
                    L'application redémarrera après la restauration
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {inspecting ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Inspection du backup...
                </div>
              ) : !report || !report.success ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 text-sm text-red-700 dark:text-red-400">
                  ⚠ {report?.error || "Impossible d'inspecter le backup"}
                </div>
              ) : (
                <>
                  {/* Statut intégrité */}
                  {!isLegacy && (
                    <div className={cn(
                      "rounded-md p-3 flex items-center gap-2",
                      integrityOk
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-red-500/10 border border-red-500/30"
                    )}>
                      {integrityOk ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {integrityOk ? "Intégrité vérifiée" : "Backup corrompu"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {integrityOk
                            ? "Le hash SHA-256 correspond au manifest. Le backup est intact."
                            : "Le hash SHA-256 ne correspond pas. Données possiblement altérées."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Format ancien */}
                  {isLegacy && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 text-sm">
                      <p className="font-semibold mb-1">Format ancien (.db)</p>
                      <p className="text-[11px] text-muted-foreground">
                        Backup créé avant la S23. Pas de manifest ni de vérification d'intégrité.
                        La restauration fonctionne mais sans garantie d'intégrité.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Taille : </span>
                          <span className="font-medium">{formatBytes(report.size || 0)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Modifié : </span>
                          <span className="font-medium">{formatDate(report.modifiedAt)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manifest */}
                  {report.manifest && (
                    <div className="border border-border rounded-md p-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="w-3 h-3" />
                        Contenu du backup
                      </p>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Créé :</span>
                          <span className="font-medium">{formatDate(report.manifest.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Version :</span>
                          <span className="font-medium font-mono">{report.manifest.appVersion || "—"}</span>
                        </div>
                      </div>

                      {report.manifest.database?.stats && (
                        <div className="bg-muted/40 rounded p-2 grid grid-cols-3 gap-2 text-[11px]">
                          <Stat label="Clients" value={report.manifest.database.stats.clients} />
                          <Stat label="Chantiers" value={report.manifest.database.stats.chantiers} />
                          <Stat label="Devis" value={report.manifest.database.stats.devis} />
                          <Stat label="Factures" value={report.manifest.database.stats.factures} />
                          <Stat label="Sous-traitants" value={report.manifest.database.stats.sousTraitants} />
                          <Stat label="DB" value={formatBytes(report.manifest.database.size)} small />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 pt-1">
                        {report.manifest.vault?.included && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-500 inline-flex items-center gap-1">
                            <Briefcase className="w-2.5 h-2.5" />
                            Coffre-fort ({report.manifest.vault.fileCount} fichiers, {formatBytes(report.manifest.vault.size)})
                          </span>
                        )}
                        {report.manifest.settings?.included && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                            Paramètres
                          </span>
                        )}
                        {report.manifest.logs?.included && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-400/20 text-slate-600 dark:text-slate-200">
                            Logs ({report.manifest.logs.fileCount})
                          </span>
                        )}
                      </div>

                      {report.manifest.database?.sha256 && (
                        <div className="text-[9px] text-muted-foreground font-mono flex items-center gap-1 pt-1">
                          <Hash className="w-2.5 h-2.5" />
                          SHA-256 : {report.manifest.database.sha256.slice(0, 24)}…
                        </div>
                      )}
                    </div>
                  )}

                  {/* Warnings */}
                  {hasWarnings && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Avertissements
                      </p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {report.warnings.map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bypass intégrité (uniquement si KO) */}
                  {!isLegacy && !integrityOk && (
                    <label className="flex items-start gap-2 p-2 rounded border border-red-500/30 bg-red-500/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceRestore}
                        onChange={(e) => setForceRestore(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span className="text-xs">
                        <strong>Forcer la restauration malgré la corruption</strong>
                        <br />
                        <span className="text-muted-foreground">
                          À utiliser uniquement si vous comprenez que le backup peut être partiellement corrompu.
                        </span>
                      </span>
                    </label>
                  )}

                  {/* Avertissement général */}
                  <div className="bg-muted/40 rounded p-2.5 text-[11px] text-muted-foreground">
                    💡 Une copie de sécurité de votre base actuelle sera automatiquement créée
                    avant la restauration (sous le nom <code className="font-mono">btp-v16.before-restore-...db</code>
                    dans votre dossier de données).
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                onClick={handleConfirm}
                loading={restoring}
                disabled={inspecting || !report?.success || (!isLegacy && !integrityOk && !forceRestore)}
                variant={!integrityOk && forceRestore ? "destructive" : "default"}
              >
                Restaurer cette sauvegarde
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
      <p className={cn("font-semibold tabular-nums", small ? "text-[11px]" : "text-sm")}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </p>
    </div>
  );
}
