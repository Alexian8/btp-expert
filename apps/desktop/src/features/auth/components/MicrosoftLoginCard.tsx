import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cloud, Check, AlertCircle, RefreshCw, LogIn, Clock } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { useMicrosoftStore } from "@/stores/microsoftStore";
import { useBackupStore } from "@/stores/backupStore";

// ═══════════════════════════════════════════════════════════════════════════
// MicrosoftLoginCard — Encart de statut Microsoft sur l'écran de login
// (Session iOS-1.7)
//
// Toujours visible sous le formulaire :
//   • État connecté : montre le compte + date du dernier sync OneDrive
//   • État déconnecté : bouton "Se connecter à Microsoft"
//   • Discret, ne perturbe pas le flux de login principal
// ═══════════════════════════════════════════════════════════════════════════

function ageHumanReadable(iso: string | null): string {
  if (!iso) return "jamais";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

export function MicrosoftLoginCard() {
  const { profile, isConnected, isConnecting, login, checkSession } = useMicrosoftStore();
  const lastOneDriveUploadAt = useBackupStore((s) => s.lastOneDriveUploadAt);

  // État local pour gérer le bouton "Reconnecter" (test rapide du token)
  const [isChecking, setIsChecking] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Vérification au mount du composant
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await checkSession();
      } catch {
        if (mounted) setHasError(true);
      } finally {
        if (mounted) setIsChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleConnect = async () => {
    toast.info("Une fenêtre Microsoft va s'ouvrir...");
    setHasError(false);
    const result = await login();
    if (result.success) {
      toast.success("Connecté à Microsoft");
    } else {
      toast.error("Connexion échouée : " + (result.error || "erreur inconnue"));
      setHasError(true);
    }
  };

  // ─── État LOADING (vérification initiale) ──────────────────────────────
  if (isChecking) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 px-4 py-3 rounded-lg border border-border bg-card flex items-center gap-3"
      >
        <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
        <p className="text-xs text-muted-foreground">Vérification du statut Microsoft…</p>
      </motion.div>
    );
  }

  // ─── État CONNECTÉ ─────────────────────────────────────────────────────
  if (isConnected && profile) {
    // Fallback défensif : selon les versions de l'API, le champ peut être
    // displayName, name, givenName, ou simplement absent → email comme fallback
    const p = profile as any;
    const displayName: string = p.displayName || p.name || p.givenName || p.email || "Compte Microsoft";
    const userInitial = displayName[0]?.toUpperCase() || "?";
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              <p className="text-xs font-medium truncate">{displayName}</p>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
          </div>
          <Cloud className="w-4 h-4 text-emerald-500 shrink-0" />
        </div>

        <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground truncate">
              Dernier sync : {ageHumanReadable(lastOneDriveUploadAt)}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── État DÉCONNECTÉ ───────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn(
        "mt-4 px-4 py-3 rounded-lg border",
        hasError
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          hasError ? "bg-amber-500/15" : "bg-muted"
        )}>
          {hasError ? (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          ) : (
            <Cloud className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">
            {hasError ? "Reconnexion Microsoft requise" : "Microsoft non connecté"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {hasError
              ? "Le token a peut-être expiré"
              : "Sync OneDrive et BatiDesk Compagnon désactivés"}
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isConnecting ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <LogIn className="w-3 h-3" />
          )}
          {isConnecting ? "..." : hasError ? "Reconnecter" : "Se connecter"}
        </button>
      </div>
    </motion.div>
  );
}
