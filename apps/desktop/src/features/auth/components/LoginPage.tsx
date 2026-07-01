import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Lock,
  User as UserIcon,
  Mail,
  ArrowLeft,
  MailCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import logoSquareUrl from "@/assets/logo-square.png";

// ═══════════════════════════════════════════════════════════════════════════
// LoginPage — Écran d'accueil (login OU setup du premier utilisateur)
// Design : tuile logo + carte « verre dépoli », œil afficher/masquer le mot
// de passe, mode « mot de passe oublié » (web), footer discret.
// ═══════════════════════════════════════════════════════════════════════════

/** Coquille commune : logo + titre + carte + footer. */
function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-7">
      {/* Marque */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.35 }}
          className="mx-auto w-[4.5rem] h-[4.5rem] rounded-[1.35rem] overflow-hidden ring-1 ring-border/50 bg-white"
        >
          <img src={logoSquareUrl} alt="BatiDesk" className="w-full h-full object-contain" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
        </div>
      </div>

      {/* Carte — verre liquide */}
      <div className="bg-card/55 backdrop-blur-2xl backdrop-saturate-150 border border-border/50 rounded-3xl p-6 sm:p-8">
        {children}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground/60">
        BatiDesk · Gestion pour artisans du bâtiment
      </p>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, setupFirstUser, needsSetup, isLoading } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Mot de passe oublié (self-service, web). Le lien de réinitialisation est
  // envoyé par email et ouvre /reset-password.
  const canForgot = Boolean(window.btpAPI?.isWeb && window.btpAPI?.authRequestPasswordReset);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotId, setForgotId] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleForgot = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!forgotId.trim()) {
      setError("Renseignez votre identifiant ou votre email");
      return;
    }
    setError("");
    setForgotLoading(true);
    try {
      await window.btpAPI?.authRequestPasswordReset?.(forgotId.trim());
      // Toujours afficher le même message (anti-énumération).
      setForgotSent(true);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Tous les champs sont requis");
      return;
    }

    if (needsSetup) {
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas");
        return;
      }
      if (password.length < 4) {
        setError("Mot de passe trop court (minimum 4 caractères)");
        return;
      }
      const ok = await setupFirstUser(username.trim(), password);
      if (ok) navigate("/");
      else setError("Impossible de créer l'utilisateur");
    } else {
      const ok = await login(username.trim(), password);
      if (ok) navigate("/");
      else setError("Identifiants incorrects");
    }
  };

  // ─── Vue « Mot de passe oublié » ─────────────────────────────────────────
  if (forgotMode) {
    return (
      <AuthShell
        title={forgotSent ? "Vérifiez votre boîte mail" : "Mot de passe oublié"}
        subtitle={
          forgotSent
            ? "Le lien de réinitialisation est en route"
            : "Recevez un lien de réinitialisation par email"
        }
      >
        {forgotSent ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <MailCheck className="w-7 h-7" />
            </div>
            <p className="text-sm text-muted-foreground">
              Si un compte existe pour cet identifiant, un email contenant un lien de
              réinitialisation vient d'être envoyé. Le lien est valable 1 heure —
              pensez à vérifier vos spams.
            </p>
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => {
                setForgotMode(false);
                setForgotSent(false);
                setForgotId("");
                setError("");
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgotId">Identifiant ou email</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="forgotId"
                  type="text"
                  placeholder="Votre identifiant ou email"
                  value={forgotId}
                  onChange={(e) => setForgotId(e.target.value)}
                  className="pl-9 h-11"
                  autoFocus
                />
              </div>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full h-11" loading={forgotLoading}>
              <Mail className="w-4 h-4" />
              Envoyer le lien de réinitialisation
            </Button>
            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setError("");
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              ← Retour à la connexion
            </button>
          </form>
        )}
      </AuthShell>
    );
  }

  // ─── Vue connexion / création du premier compte ──────────────────────────
  return (
    <AuthShell
      title={needsSetup ? "Bienvenue sur BatiDesk" : "Connexion"}
      subtitle={
        needsSetup
          ? "Créez votre compte administrateur pour démarrer"
          : "Connectez-vous à votre espace de travail"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Identifiant</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="username"
              type="text"
              placeholder={needsSetup ? "Choisissez un identifiant" : "Votre identifiant"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pl-9 h-11"
              autoFocus
              autoComplete="username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            {!needsSetup && canForgot && (
              <button
                type="button"
                onClick={() => {
                  setForgotMode(true);
                  setForgotId(username.trim());
                  setError("");
                }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Mot de passe oublié ?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={needsSetup ? "Minimum 4 caractères" : "Votre mot de passe"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 pr-10 h-11"
              autoComplete={needsSetup ? "new-password" : "current-password"}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {needsSetup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-2"
          >
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Retapez le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 h-11"
                autoComplete="new-password"
              />
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
          >
            {error}
          </motion.div>
        )}

        <Button type="submit" className="w-full h-11 text-[15px]" loading={isLoading}>
          {needsSetup ? "Créer mon compte" : "Se connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}
