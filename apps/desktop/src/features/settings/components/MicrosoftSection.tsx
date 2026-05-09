import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  LogIn,
  LogOut,
  Upload,
  RefreshCw,
  Trash2,
  FileArchive,
  AlertTriangle,
  Check,
  Info,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@btp/ui";
import { SettingsSectionWrapper } from "./SettingsPage";
import { useMicrosoftStore, formatBytes } from "@/stores/microsoftStore";

// ═══════════════════════════════════════════════════════════════════════════
// MicrosoftSection — OAuth Microsoft + OneDrive backups
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function MicrosoftSection() {
  const { profile, quota, isConnecting, isConnected, login, logout, checkSession, refreshQuota } = useMicrosoftStore();

  const [remoteBackups, setRemoteBackups] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
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
    toast.info("Une fenêtre Microsoft va s'ouvrir dans votre navigateur...");
    const result = await login();
    if (result.success) {
      toast.success("Connecté à Microsoft");
    } else {
      toast.error("Connexion échouée : " + (result.error || "erreur inconnue"));
    }
  };

  const handleUploadNow = async () => {
    if (!window.btpAPI?.msOneDriveUpload) return;
    setIsUploading(true);
    const result = await window.btpAPI.msOneDriveUpload({ includeVault: false, type: "manual" });
    setIsUploading(false);
    if (result.success) {
      toast.success("Sauvegarde envoyée sur OneDrive");
      refreshBackups();
      refreshQuota();
    } else {
      toast.error(result.error || "Erreur lors de l'envoi");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete || !window.btpAPI?.msOneDriveDelete) return;
    const result = await window.btpAPI.msOneDriveDelete(confirmDelete);
    if (result.success) {
      toast.success("Sauvegarde supprimée de OneDrive");
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

  // ─── UI ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header avec statut */}
      <SettingsSectionWrapper
        title="Microsoft OneDrive (API)"
        description="Sauvegarde directe sur OneDrive via votre compte Microsoft (sans client OneDrive Windows requis)"
      >
        {!isConnected ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Cloud className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold mb-1">Non connecté</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Connectez-vous avec votre compte Microsoft pour sauvegarder votre base directement sur OneDrive.
            </p>
            <Button onClick={handleLogin} loading={isConnecting}>
              <LogIn className="w-4 h-4" />
              Se connecter à Microsoft
            </Button>
            <p className="text-[11px] text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <Info className="w-3 h-3" />
              Une fenêtre s'ouvrira dans votre navigateur pour la connexion sécurisée
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile card */}
            <div className="p-4 rounded-lg border border-success/30 bg-success/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-base font-bold text-primary shrink-0">
                    {profile?.name?.[0]?.toUpperCase() || "M"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Check className="w-4 h-4 text-success" />
                      Connecté
                    </p>
                    <p className="text-sm mt-0.5 truncate">{profile?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setConfirmLogout(true)}>
                  <LogOut className="w-3 h-3" />
                  Déconnexion
                </Button>
              </div>
            </div>

            {/* Quota */}
            {quota && (
              <div className="p-3 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Espace OneDrive</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(quota.used)} / {formatBytes(quota.total)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (quota.used / Math.max(quota.total, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleUploadNow} loading={isUploading} disabled={isUploading}>
                <Upload className="w-4 h-4" />
                Sauvegarder sur OneDrive
              </Button>
              <Button variant="outline" onClick={refreshBackups}>
                <RefreshCw className={cn("w-4 h-4", isLoadingList && "animate-spin")} />
                Rafraîchir la liste
              </Button>
            </div>
          </div>
        )}
      </SettingsSectionWrapper>

      {/* Backups OneDrive */}
      {isConnected && (
        <SettingsSectionWrapper
          title={`Sauvegardes sur OneDrive (${remoteBackups.length})`}
          description="Sauvegardes stockées dans l'AppFolder BatiDesk sur votre OneDrive"
        >
          {remoteBackups.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-lg">
              <FileArchive className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucune sauvegarde sur OneDrive</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cliquez sur "Sauvegarder sur OneDrive" pour créer votre première sauvegarde
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {remoteBackups.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Cloud className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{b.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.createdAt)} · {formatBytes(b.size)} · {b.type}
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
              ))}
            </div>
          )}
        </SettingsSectionWrapper>
      )}

      {/* Info box sur les futures fonctionnalités */}
      {isConnected && (
        <div className="p-4 border border-border rounded-lg bg-muted/40">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Votre connexion Microsoft servira aussi pour <strong>Outlook (envoi des devis par mail)</strong> et{" "}
              <strong>Calendar (synchronisation de l'agenda)</strong> dans les prochaines sessions.
            </span>
          </p>
        </div>
      )}

      {/* Modals de confirmation */}
      <AnimatePresence>
        {confirmLogout && (
          <ConfirmModal
            onClose={() => setConfirmLogout(false)}
            onConfirm={handleConfirmLogout}
            icon={<LogOut className="w-5 h-5 text-warning" />}
            iconBg="bg-warning/15"
            title="Se déconnecter de Microsoft ?"
            description="Vos sauvegardes OneDrive resteront en ligne. Vous pourrez vous reconnecter à tout moment."
            confirmLabel="Se déconnecter"
          />
        )}
        {confirmRestore && (
          <ConfirmModal
            onClose={() => setConfirmRestore(null)}
            onConfirm={handleConfirmRestore}
            icon={<AlertTriangle className="w-5 h-5 text-warning" />}
            iconBg="bg-warning/15"
            title="Restaurer cette sauvegarde ?"
            description={
              <>
                <p>L'app va télécharger le fichier depuis OneDrive et redémarrer avec ces données.</p>
                <p className="text-xs mt-2 break-all font-mono bg-muted p-2 rounded">{confirmRestore}</p>
                <p className="text-xs text-warning mt-2 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  Une sauvegarde de vos données actuelles sera créée en local avant.
                </p>
              </>
            }
            confirmLabel="Restaurer et redémarrer"
          />
        )}
        {confirmDelete && (
          <ConfirmModal
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleConfirmDelete}
            icon={<Trash2 className="w-5 h-5 text-destructive" />}
            iconBg="bg-destructive/15"
            title="Supprimer cette sauvegarde ?"
            description="Le fichier sera supprimé définitivement de votre OneDrive. Cette action est irréversible."
            confirmLabel="Supprimer"
            destructive
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Modal de confirmation réutilisable ──────────────────────────────────
function ConfirmModal({
  onClose,
  onConfirm,
  icon,
  iconBg,
  title,
  description,
  confirmLabel,
  destructive,
}: {
  onClose: () => void;
  onConfirm: () => void;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="text-sm text-muted-foreground mb-4">{description}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
