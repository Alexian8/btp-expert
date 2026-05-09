import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  LogIn,
  LogOut,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  FileArchive,
  AlertTriangle,
  Check,
  HardDrive,
  X,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { useMicrosoftStore, formatBytes } from "@/stores/microsoftStore";
import { useBackupStore } from "@/stores/backupStore";

// ═══════════════════════════════════════════════════════════════════════════
// OneDriveSection — Section unifiée Microsoft OneDrive (Session iOS-1.6)
// Fusionne :
//   • Connexion / Déconnexion Microsoft (depuis MicrosoftSection)
//   • Sync auto + rétention OneDrive (depuis BackupSection iOS-1.5)
//   • Liste UNIQUE des backups OneDrive
//   • Actions : envoyer / restaurer / supprimer / rafraîchir
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function OneDriveSection() {
  // Connexion Microsoft
  const { profile, quota, isConnecting, isConnected, login, logout, checkSession, refreshQuota } = useMicrosoftStore();

  // Configuration sync iOS-1.5
  const {
    autoUploadToOneDrive, oneDriveSyncIntervalMin, oneDriveRetentionCount,
    checkOneDriveOnStartup, requireMicrosoftLogin,
    lastOneDriveUploadAt, oneDriveUploadInProgress,
    setAutoUploadToOneDrive, setOneDriveSyncIntervalMin, setOneDriveRetentionCount,
    setCheckOneDriveOnStartup, setRequireMicrosoftLogin,
    uploadCurrentToOneDrive, applyOneDriveRetention,
  } = useBackupStore();

  // État liste backups
  const [remoteBackups, setRemoteBackups] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isConnected) {
      refreshBackups();
    } else {
      setRemoteBackups([]);
    }
  }, [isConnected]);

  const refreshBackups = async () => {
    if (!window.btpAPI?.msOneDriveList) return;
    setIsLoadingList(true);
    try {
      const list = await window.btpAPI.msOneDriveList();
      setRemoteBackups(list);
    } catch (e: any) {
      toast.error("Erreur chargement backups OneDrive : " + e.message);
    }
    setIsLoadingList(false);
  };

  const handleLogin = async () => {
    toast.info("Une fenêtre Microsoft va s'ouvrir...");
    const result = await login();
    if (result.success) {
      toast.success("Connecté à Microsoft");
    } else {
      toast.error("Connexion échouée : " + (result.error || "erreur inconnue"));
    }
  };

  const handleUploadNow = async () => {
    const r = await uploadCurrentToOneDrive();
    if (r.success) {
      if (r.skipped) {
        toast.info("DB inchangée — upload sauté");
      } else {
        toast.success("Sauvegarde envoyée sur OneDrive");
        refreshBackups();
        refreshQuota();
      }
    } else {
      toast.error(r.error || "Erreur lors de l'envoi");
    }
  };

  const handleApplyRetentionNow = async () => {
    const r = await applyOneDriveRetention();
    if (r.deleted > 0) {
      toast.success(`${r.deleted} ancien${r.deleted > 1 ? "s" : ""} backup${r.deleted > 1 ? "s" : ""} supprimé${r.deleted > 1 ? "s" : ""}`);
      refreshBackups();
    } else {
      toast.info("Aucun backup à supprimer (rétention déjà respectée)");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete || !window.btpAPI?.msOneDriveDelete) return;
    const result = await window.btpAPI.msOneDriveDelete(confirmDelete);
    if (result.success) {
      toast.success("Sauvegarde supprimée");
      refreshBackups();
    } else {
      toast.error(result.error || "Erreur suppression");
    }
    setConfirmDelete(null);
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestore || !window.btpAPI?.msOneDriveRestore) return;
    const result = await window.btpAPI.msOneDriveRestore({ remoteName: confirmRestore });
    if (!result.success) {
      toast.error(result.error || "Erreur restauration");
    }
    setConfirmRestore(null);
  };

  const handleConfirmLogout = async () => {
    await logout();
    toast.success("Déconnecté de Microsoft");
    setConfirmLogout(false);
  };

  // ─── État NON connecté ─────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Microsoft OneDrive</h3>
            <p className="text-xs text-muted-foreground">
              Sauvegarde cloud + sync mobile (BatiDesk Compagnon)
            </p>
          </div>
        </div>
        <div className="bg-muted/40 rounded-md p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Connectez-vous avec votre compte Microsoft pour activer la sauvegarde
            automatique sur OneDrive.
          </p>
          <Button onClick={handleLogin} loading={isConnecting}>
            <LogIn className="w-4 h-4" />
            Se connecter à Microsoft
          </Button>
        </div>
      </div>
    );
  }

  // ─── État CONNECTÉ ─────────────────────────────────────────────────────
  // Fallback défensif : selon les versions de l'API, le champ peut être
  // displayName, name, givenName, ou simplement absent → email comme fallback
  const p = profile as any;
  const displayName: string = p?.displayName || p?.name || p?.givenName || profile?.email || "Compte Microsoft";
  const userInitial = displayName[0]?.toUpperCase() || "?";
  const userQuotaPct = quota ? (quota.used / quota.total) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* En-tête : compte connecté + quota */}
      <div className="p-5 border-b border-border bg-emerald-500/5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-base font-bold text-primary shrink-0">
              {userInitial}
            </div>
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Connecté
              </p>
              <p className="text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConfirmLogout(true)}>
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </Button>
        </div>

        {/* Quota OneDrive */}
        {quota && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrive className="w-3.5 h-3.5" />
                Espace OneDrive
              </span>
              <span className="font-mono text-muted-foreground">
                {formatBytes(quota.used)} / {formatBytes(quota.total)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  userQuotaPct > 90 ? "bg-red-500" : userQuotaPct > 70 ? "bg-amber-500" : "bg-blue-500"
                )}
                style={{ width: `${Math.min(userQuotaPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Configuration de la sync auto */}
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-semibold">Synchronisation automatique</p>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                Pour BatiDesk Compagnon mobile
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Envoie les sauvegardes périodiquement vers OneDrive pour que l'app
              mobile puisse y accéder.
            </p>
            {lastOneDriveUploadAt && (
              <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                Dernier upload : {formatDate(lastOneDriveUploadAt)}
              </p>
            )}
          </div>
          <Switch
            checked={autoUploadToOneDrive}
            onCheckedChange={setAutoUploadToOneDrive}
          />
        </div>

        {autoUploadToOneDrive && (
          <>
            <Separator />

            {/* Fréquence */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Fréquence d'upload</p>
                <p className="text-[11px] text-muted-foreground">
                  Si la DB n'a pas changé, l'upload est sauté.
                </p>
              </div>
              <NativeSelect
                value={String(oneDriveSyncIntervalMin)}
                onChange={(e) => setOneDriveSyncIntervalMin(Number(e.target.value))}
                className="w-44"
              >
                <option value="0">Manuel uniquement</option>
                <option value="5">Toutes les 5 minutes</option>
                <option value="15">Toutes les 15 minutes</option>
                <option value="30">Toutes les 30 minutes</option>
                <option value="60">Toutes les heures</option>
                <option value="120">Toutes les 2 heures</option>
              </NativeSelect>
            </div>

            {/* Rétention */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Backups conservés sur OneDrive</p>
                <p className="text-[11px] text-muted-foreground">
                  Les plus anciens sont supprimés après chaque upload.
                </p>
              </div>
              <NativeSelect
                value={String(oneDriveRetentionCount)}
                onChange={(e) => setOneDriveRetentionCount(Number(e.target.value))}
                className="w-44"
              >
                <option value="1">Dernier seulement</option>
                <option value="3">3 derniers</option>
                <option value="5">5 derniers</option>
                <option value="10">10 derniers</option>
              </NativeSelect>
            </div>

            {/* Vérification au démarrage */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded border border-border">
              <div className="flex-1">
                <p className="text-sm font-medium">Vérifier au démarrage</p>
                <p className="text-[11px] text-muted-foreground">
                  Propose la restauration si OneDrive a une version plus récente.
                </p>
              </div>
              <Switch
                checked={checkOneDriveOnStartup}
                onCheckedChange={setCheckOneDriveOnStartup}
              />
            </div>

            {/* Auth Microsoft requise */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded border border-border">
              <div className="flex-1">
                <p className="text-sm font-medium">Demander mot de passe Microsoft à l'ouverture</p>
                <p className="text-[11px] text-muted-foreground">
                  En complément du mot de passe local. Fallback offline préservé.
                </p>
              </div>
              <Switch
                checked={requireMicrosoftLogin}
                onCheckedChange={setRequireMicrosoftLogin}
              />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 pt-0 flex flex-wrap gap-2">
        <Button
          onClick={handleUploadNow}
          loading={oneDriveUploadInProgress}
          className="flex-1 min-w-[180px]"
        >
          <Upload className="w-4 h-4" />
          Envoyer maintenant
        </Button>
        <Button
          variant="outline"
          onClick={() => { refreshBackups(); refreshQuota(); }}
          loading={isLoadingList}
        >
          <RefreshCw className="w-4 h-4" />
          Rafraîchir
        </Button>
        <Button
          variant="outline"
          onClick={handleApplyRetentionNow}
          title={`Garder ${oneDriveRetentionCount} dernier(s) et supprimer le reste`}
        >
          <Trash2 className="w-4 h-4" />
          Nettoyer
        </Button>
      </div>

      {/* Liste des backups */}
      <div className="border-t border-border">
        <div className="p-5 pb-2">
          <p className="text-sm font-semibold">
            Sauvegardes sur OneDrive ({remoteBackups.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Stockées dans l'AppFolder BatiDesk de votre OneDrive
          </p>
        </div>

        <div className="p-5 pt-2">
          {remoteBackups.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">
              Aucune sauvegarde sur OneDrive
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {remoteBackups.map((b) => {
                const isLegacy = b.format === "legacy-db";
                return (
                  <div
                    key={b.path}
                    className="flex items-center justify-between gap-2 p-2.5 border border-border rounded-md"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileArchive className={cn(
                        "w-4 h-4 shrink-0",
                        isLegacy ? "text-amber-500" : "text-blue-500"
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-medium truncate">{b.id}</p>
                          {isLegacy && (
                            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-amber-500/15 text-amber-600">
                              Format ancien
                            </span>
                          )}
                          {!isLegacy && (
                            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                              .btpbackup
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(b.createdAt)} · {formatBytes(b.size)} · {b.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setConfirmRestore(b.path)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        title="Restaurer cette sauvegarde"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(b.path)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal confirm restore */}
      <ConfirmModal
        open={!!confirmRestore}
        title="Restaurer depuis OneDrive ?"
        message="L'app va fermer et redémarrer avec les données de la sauvegarde sélectionnée. Une copie de sécurité de votre DB locale sera créée automatiquement."
        confirmLabel="Restaurer"
        confirmVariant="default"
        onConfirm={handleConfirmRestore}
        onCancel={() => setConfirmRestore(null)}
      />

      {/* Modal confirm delete */}
      <ConfirmModal
        open={!!confirmDelete}
        title="Supprimer cette sauvegarde ?"
        message="Cette action est irréversible. La sauvegarde sera supprimée de OneDrive."
        confirmLabel="Supprimer"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Modal confirm logout */}
      <ConfirmModal
        open={confirmLogout}
        title="Se déconnecter de Microsoft ?"
        message="Vous devrez vous reconnecter pour utiliser la sauvegarde OneDrive. Vos données locales restent intactes."
        confirmLabel="Déconnexion"
        confirmVariant="default"
        onConfirm={handleConfirmLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}

function ConfirmModal({
  open, title, message, confirmLabel, confirmVariant = "default", onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                confirmVariant === "destructive" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"
              )}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{message}</p>
              </div>
              <button onClick={onCancel} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={onCancel}>Annuler</Button>
              <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
