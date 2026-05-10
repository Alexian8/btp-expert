import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, AlertCircle, Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";

// ═══════════════════════════════════════════════════════════════════════════
// ChangePasswordModal — Forçage du changement de mot de passe à la 1ère
// connexion d'un user créé via /admin/users (mustChangePassword = 1).
//
// Modal BLOQUANT (z-index très haut, pas de bouton fermer) : l'utilisateur
// ne peut RIEN faire d'autre tant qu'il n'a pas changé son mot de passe.
// La seule échappatoire : se déconnecter.
// ═══════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = "btp.web.token";

interface PasswordChecks {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  different: boolean;
  matches: boolean;
}

function checkPassword(oldPwd: string, newPwd: string, confirm: string): PasswordChecks {
  return {
    minLength: newPwd.length >= 10,
    hasUpper: /[A-Z]/.test(newPwd),
    hasLower: /[a-z]/.test(newPwd),
    hasDigit: /[0-9]/.test(newPwd),
    different: newPwd.length > 0 && newPwd !== oldPwd,
    matches: confirm.length > 0 && newPwd === confirm,
  };
}

export function ChangePasswordModal() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pas de mustChangePassword → ne rien afficher
  if (!user || (user as { mustChangePassword?: boolean }).mustChangePassword !== true) {
    return null;
  }

  const checks = checkPassword(oldPassword, newPassword, confirm);
  const allValid =
    checks.minLength &&
    checks.hasUpper &&
    checks.hasLower &&
    checks.hasDigit &&
    checks.different &&
    checks.matches &&
    Boolean(oldPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allValid) {
      setError("Vérifie que tous les critères sont validés.");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const d = (await res.json()) as { message?: string };
          if (d.message) msg = d.message;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      // Met à jour le user local pour que ce modal disparaisse
      useAuthStore.setState({
        user: { ...user, mustChangePassword: false } as typeof user,
      });
      toast.success("Mot de passe changé. Bienvenue !");
      // Reset des inputs
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du changement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4"
        // Pas de onClick={onClose} — modal bloquant
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-card border border-border rounded-xl shadow-soft-xl max-w-md w-full max-h-[95vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Changement de mot de passe</h2>
                <p className="text-xs text-muted-foreground">
                  Obligatoire à la première connexion
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-sm text-muted-foreground mb-4">
              Pour la sécurité de ton compte, choisis un nouveau mot de passe
              différent de celui que ton administrateur t'a transmis.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" id="change-pwd-form">
              <div>
                <Label htmlFor="old-pwd">Mot de passe temporaire actuel</Label>
                <div className="relative mt-1">
                  <Input
                    id="old-pwd"
                    type={showPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Celui reçu par email"
                    autoFocus
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
                <div className="relative mt-1">
                  <Input
                    id="new-pwd"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 10 caractères"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
                    title={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-pwd">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="confirm-pwd"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-tape le nouveau mot de passe"
                  required
                  autoComplete="new-password"
                  className="mt-1"
                />
              </div>

              {/* Critères de validation */}
              <div className="bg-muted/40 rounded-md p-3 space-y-1.5 text-xs">
                <Criterion ok={checks.minLength} label="Au moins 10 caractères" />
                <Criterion ok={checks.hasUpper} label="Une majuscule (A-Z)" />
                <Criterion ok={checks.hasLower} label="Une minuscule (a-z)" />
                <Criterion ok={checks.hasDigit} label="Un chiffre (0-9)" />
                <Criterion
                  ok={checks.different}
                  label="Différent du mot de passe temporaire"
                />
                <Criterion ok={checks.matches} label="Confirmation identique" />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
            <Button
              variant="ghost"
              onClick={() => void logout()}
              className="text-muted-foreground"
            >
              Se déconnecter
            </Button>
            <Button
              type="submit"
              form="change-pwd-form"
              loading={loading}
              disabled={!allValid}
            >
              <KeyRound className="w-4 h-4" />
              Confirmer
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Criterion({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={
        ok
          ? "flex items-center gap-2 text-emerald-600 dark:text-emerald-400"
          : "flex items-center gap-2 text-muted-foreground"
      }
    >
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-40 shrink-0" />
      )}
      <span>{label}</span>
    </div>
  );
}
