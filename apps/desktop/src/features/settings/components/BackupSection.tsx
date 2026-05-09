import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  FolderOpen,
  HardDrive,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Check,
  Clock,
  FileArchive,
  Info,
  Database,
  Briefcase,
  Apple,
  Package,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@btp/ui";
import { SettingsSectionWrapper } from "./SettingsPage";
import { OneDriveSection } from "./OneDriveSection";
import { RestoreConfirmModal } from "./RestoreConfirmModal";
import { useBackupStore, startBackupScheduler } from "@/stores/backupStore";
import type { BackupFrequency } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// BackupSection — Sauvegarde & Restauration (local + clouds détectés)
// ═══════════════════════════════════════════════════════════════════════════

const FREQUENCY_OPTIONS: Array<{ key: BackupFrequency; label: string; description: string }> = [
  { key: "never", label: "Jamais", description: "Sauvegarde manuelle uniquement" },
  { key: "hourly", label: "Toutes les heures", description: "Pour une activité très intense" },
  { key: "every-6h", label: "Toutes les 6 heures", description: "Bon équilibre performance/sécurité" },
  { key: "daily", label: "Toutes les 24 heures", description: "Une sauvegarde par jour" },
  { key: "on-close", label: "À chaque fermeture", description: "Recommandé — zéro perte de données" },
];

const CLOUD_ICONS: Record<string, LucideIcon> = {
  "onedrive-local":    Cloud,
  "onedrive-business": Briefcase,
  "icloud-local":      Apple,
  "dropbox-local":     Package,
  "gdrive-local":      BookOpen,
  local:               Database,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BackupSection() {
  const {
    frequency,
    destinationPath,
    destinationProvider,
    retentionCount,
    includeVault,
    includeSettings,
    includeLogs,
    detectedClouds,
    backups,
    isLoading,
    lastBackupAt,
    setFrequency,
    setDestination,
    setRetention,
    setIncludeVault,
    setIncludeSettings,
    setIncludeLogs,
    detectClouds,
    refreshBackups,
    createBackup,
    deleteBackup,
  } = useBackupStore();

  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    detectClouds();
    refreshBackups();
    startBackupScheduler();
  }, []);

  const handleChooseFolder = async () => {
    const path = await window.btpAPI?.chooseFolder();
    if (path) {
      setDestination(path, "local");
      toast.success("Dossier de sauvegarde configuré");
    }
  };

  const handleSelectCloud = (kind: string, path: string) => {
    // Créer un sous-dossier "BatiDesk" dans le cloud
    const sep = path.includes("\\") ? "\\" : "/";
    const dest = `${path}${sep}BatiDesk`;
    setDestination(dest, kind);
    toast.success("Sauvegarde configurée dans " + (kind.includes("onedrive") ? "OneDrive" : kind.replace("-local", "")));
  };

  const handleBackupNow = async () => {
    const result = await createBackup("manual");
    if (result.success) {
      toast.success("Sauvegarde créée avec succès");
    } else {
      toast.error(result.error || "Erreur lors de la sauvegarde");
    }
  };

  const handleImportBackup = async () => {
    const file = await window.btpAPI?.chooseBackupFile();
    if (file) {
      setConfirmRestore(file);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await deleteBackup(confirmDelete);
    toast.success("Sauvegarde supprimée");
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Destination / Cloud detection */}
      <SettingsSectionWrapper
        title="Où sauvegarder ?"
        description="Choisissez un dossier local ou un cloud détecté (OneDrive, iCloud, Dropbox, Google Drive)"
      >
        {/* Destination actuelle */}
        {destinationPath ? (
          <div className="p-3 rounded-lg border border-success/30 bg-success/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-md bg-success/10 text-success flex items-center justify-center shrink-0">
                  {(() => {
                    const Icon = CLOUD_ICONS[destinationProvider] || Database;
                    return <Icon className="w-4 h-4" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Sauvegarde configurée
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-all font-mono">
                    {destinationPath}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleChooseFolder}>
                Changer
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-warning/30 bg-warning/5">
            <p className="text-sm flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" />
              Aucune destination de sauvegarde configurée
            </p>
          </div>
        )}

        {/* Clouds détectés */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Clouds détectés sur ce PC</p>
            <Button variant="ghost" size="sm" onClick={detectClouds}>
              <RefreshCw className="w-3 h-3" />
              Rafraîchir
            </Button>
          </div>
          {detectedClouds.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-lg text-center">
              <Cloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucun cloud détecté. Installez OneDrive, iCloud Drive, Dropbox ou Google Drive pour une sauvegarde synchronisée.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {detectedClouds.map((cloud) => (
                <button
                  key={cloud.kind}
                  onClick={() => handleSelectCloud(cloud.kind, cloud.path)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                    "hover:border-primary/40 hover:bg-accent",
                    destinationProvider === cloud.kind && "border-primary bg-primary/5"
                  )}
                >
                  <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {(() => {
                      const Icon = CLOUD_ICONS[cloud.kind] || Cloud;
                      return <Icon className="w-4 h-4" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{cloud.label}</p>
                    <p className="text-xs text-muted-foreground truncate font-mono">{cloud.path}</p>
                  </div>
                  {destinationProvider === cloud.kind && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ou dossier local custom */}
        <div className="pt-2">
          <Button variant="outline" onClick={handleChooseFolder} className="w-full">
            <FolderOpen className="w-4 h-4" />
            Choisir un autre dossier
          </Button>
        </div>
      </SettingsSectionWrapper>

      {/* OAuth Microsoft — la vraie section OAuth-1 */}
      <OneDriveSection />

      {/* Fréquence */}
      <SettingsSectionWrapper
        title="Fréquence de sauvegarde automatique"
        description="À quelle fréquence créer des sauvegardes"
      >
        <div className="grid gap-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFrequency(opt.key)}
              className={cn(
                "flex items-center justify-between gap-3 p-3 rounded-lg border-2 text-left transition-all",
                frequency === opt.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-3">
                <Clock className={cn("w-4 h-4", frequency === opt.key ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </div>
              {frequency === opt.key && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      </SettingsSectionWrapper>

      {/* Contenu du backup + rétention */}
      <SettingsSectionWrapper title="Options de sauvegarde" description="Que sauvegarder et combien conserver">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <Label>Base de données</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Clients, chantiers, factures... (toujours inclus)</p>
            </div>
            <Switch checked={true} disabled />
          </div>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <Label htmlFor="sw-vault">Coffre-fort (fichiers chiffrés)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Documents sensibles dans le coffre</p>
            </div>
            <Switch id="sw-vault" checked={includeVault} onCheckedChange={setIncludeVault} />
          </div>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <Label htmlFor="sw-settings">Paramètres</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Configuration de l'app</p>
            </div>
            <Switch id="sw-settings" checked={includeSettings} onCheckedChange={setIncludeSettings} />
          </div>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <Label htmlFor="sw-logs">Logs</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Journaux de l'application (optionnel)</p>
            </div>
            <Switch id="sw-logs" checked={includeLogs} onCheckedChange={setIncludeLogs} />
          </div>
        </div>


        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="retention">Nombre de sauvegardes à conserver</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Les plus anciennes sont supprimées automatiquement</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setRetention(Math.max(1, retentionCount - 1))}>
              -
            </Button>
            <span className="w-10 text-center text-lg font-bold">{retentionCount}</span>
            <Button variant="outline" size="icon" onClick={() => setRetention(Math.min(100, retentionCount + 1))}>
              +
            </Button>
          </div>
        </div>
      </SettingsSectionWrapper>

      {/* Actions rapides */}
      <SettingsSectionWrapper title="Actions" description="Sauvegarder ou restaurer manuellement">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleBackupNow}
            disabled={!destinationPath || isLoading}
            loading={isLoading}
          >
            <Download className="w-4 h-4" />
            Sauvegarder maintenant
          </Button>
          <Button variant="outline" onClick={handleImportBackup}>
            <Upload className="w-4 h-4" />
            Restaurer depuis un fichier
          </Button>
        </div>
        {lastBackupAt && (
          <p className="text-xs text-muted-foreground text-center">
            Dernière sauvegarde : {formatDate(lastBackupAt)}
          </p>
        )}
      </SettingsSectionWrapper>

      {/* Historique */}
      {destinationPath && (
        <SettingsSectionWrapper
          title={`Historique (${backups.length})`}
          description="Sauvegardes disponibles dans le dossier configuré"
        >
          {backups.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-lg">
              <FileArchive className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucune sauvegarde pour l'instant</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {backups.map((b: any) => {
                const manifest = b.manifest;
                const isLegacy = b.format === "legacy-db";
                const statsLine = manifest?.database?.stats
                  ? `${manifest.database.stats.clients}c · ${manifest.database.stats.chantiers}ch · ${manifest.database.stats.devis}d · ${manifest.database.stats.factures}f`
                  : null;
                return (
                  <div key={b.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                        isLegacy ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
                      )}>
                        <FileArchive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium truncate">{b.id}</p>
                          {isLegacy && (
                            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-amber-500/15 text-amber-600">
                              Format ancien
                            </span>
                          )}
                          {!isLegacy && manifest && (
                            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                              .btpbackup
                            </span>
                          )}
                          {b.version && (
                            <span className="text-[9px] font-mono text-muted-foreground">
                              v{b.version}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(b.createdAt)} · {formatBytes(b.size)} · {b.type}
                          {statsLine && ` · ${statsLine}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => setConfirmRestore(b.path)} title="Restaurer">
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(b.path)} title="Supprimer">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SettingsSectionWrapper>
      )}

      {/* Confirmation restauration (Session 23 — modal enrichi avec manifest) */}
      <RestoreConfirmModal
        open={!!confirmRestore}
        backupPath={confirmRestore}
        onClose={() => setConfirmRestore(null)}
      />

      {/* Confirmation suppression */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold">Supprimer cette sauvegarde ?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Cette action est irréversible. Le fichier sera supprimé définitivement.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleConfirmDelete}>
                  Supprimer
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Re-export Label pour éviter un import isolé
function Label({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium", className)}>
      {children}
    </label>
  );
}
