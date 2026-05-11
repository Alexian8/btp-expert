import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, KeyRound, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSectionWrapper } from "./SettingsPage";
import { useAuthStore } from "@/stores/authStore";

// ═══════════════════════════════════════════════════════════════════════════
// AccountSection — Gestion du compte + changement identifiants
// ═══════════════════════════════════════════════════════════════════════════

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AccountSection() {
  const { user, logout } = useAuthStore();

  // Username form
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newUsername.trim() || !usernamePassword) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (newUsername.trim() === user.username) {
      toast.error("Le nouvel identifiant est identique à l'actuel");
      return;
    }
    setUsernameLoading(true);
    try {
      const passwordHash = await sha256(usernamePassword + user.username);
      const result = await window.btpAPI?.updateUsername({
        currentUsername: user.username,
        newUsername: newUsername.trim(),
        passwordHash,
      });
      if (result?.success) {
        toast.success("Identifiant modifié. Vous allez être déconnecté pour vous reconnecter.");
        setNewUsername("");
        setUsernamePassword("");
        setTimeout(() => logout(), 1500);
      } else {
        toast.error(result?.error || "Erreur inconnue");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setUsernameLoading(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !oldPassword || !newPassword || !confirmPassword) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("Le nouveau mot de passe est trop court (minimum 4 caractères)");
      return;
    }
    if (newPassword === oldPassword) {
      toast.error("Le nouveau mot de passe doit être différent");
      return;
    }
    setPasswordLoading(true);
    try {
      const oldPasswordHash = await sha256(oldPassword + user.username);
      const newPasswordHash = await sha256(newPassword + user.username);
      const result = await window.btpAPI?.updatePassword({
        username: user.username,
        oldPasswordHash,
        newPasswordHash,
      });
      if (result?.success) {
        toast.success("Mot de passe modifié avec succès");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result?.error || "Erreur inconnue");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setPasswordLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Profil */}
      <SettingsSectionWrapper title="Mon profil" description="Informations sur votre compte utilisateur">
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-xl font-bold text-primary">
            {user?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-semibold">{user?.username}</p>
            <p className="text-sm text-muted-foreground">
              {user?.role === "admin" ? "Administrateur" : "Utilisateur"}
            </p>
          </div>
        </div>
      </SettingsSectionWrapper>

      {/* Changer identifiant */}
      <SettingsSectionWrapper
        title="Changer d'identifiant"
        description="Modifier votre nom d'utilisateur. Vous serez déconnecté après la modification."
      >
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="new-username">Nouvel identifiant</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="new-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Nouveau nom d'utilisateur"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username-password">Mot de passe actuel (pour confirmer)</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="username-password"
                type="password"
                value={usernamePassword}
                onChange={(e) => setUsernamePassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="pl-9"
                autoComplete="current-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={usernameLoading} disabled={!newUsername.trim() || !usernamePassword}>
              Changer l'identifiant
            </Button>
          </div>
        </form>
      </SettingsSectionWrapper>

      {/* Changer mot de passe */}
      <SettingsSectionWrapper
        title="Changer de mot de passe"
        description="Modifier votre mot de passe. Minimum 4 caractères."
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="old-password">Mot de passe actuel</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="pl-9"
                autoComplete="current-password"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 4 caractères"
                className="pl-9"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9"
                autoComplete="new-password"
              />
            </div>
            <AnimatePresence>
              {confirmPassword && newPassword && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-xs flex items-center gap-1.5 ${
                    newPassword === confirmPassword ? "text-success" : "text-destructive"
                  }`}
                >
                  {newPassword === confirmPassword ? (
                    <><Check className="w-3 h-3" /> Les mots de passe correspondent</>
                  ) : (
                    <><AlertCircle className="w-3 h-3" /> Les mots de passe ne correspondent pas</>
                  )}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              loading={passwordLoading}
              disabled={!oldPassword || !newPassword || !confirmPassword}
            >
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </SettingsSectionWrapper>

      {/* Session */}
      <SettingsSectionWrapper title="Session" description="Actions sur votre session actuelle">
        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
          <div>
            <p className="text-sm font-medium">Se déconnecter</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vous devrez vous reconnecter pour accéder à l'application
            </p>
          </div>
          <Button variant="destructive" onClick={() => logout()}>
            Déconnexion
          </Button>
        </div>
      </SettingsSectionWrapper>
    </div>
  );
}
