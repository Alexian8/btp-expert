import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, KeyRound, Check, AlertCircle, Mail, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSectionWrapper } from "./SettingsPage";
import { useAuthStore } from "@/stores/authStore";

// ═══════════════════════════════════════════════════════════════════════════
// AccountSection — Mon compte : profil (prénom/nom/email), identifiant,
// mot de passe, session.
//
// Web  : routes REST self-service (PATCH /api/auth/me, /change-username,
//        /change-password) — token révoqué après changement d'identifiant ou
//        de mot de passe → reconnexion.
// Desktop : conserve les canaux IPC historiques (updateUsername/updatePassword,
//        hash SHA-256 local) ; l'édition du profil est masquée si l'API REST
//        n'est pas disponible.
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Manager",
  accountant: "Comptable",
  worker: "Ouvrier",
  viewer: "Lecture seule",
  user: "Utilisateur",
};

/** Politique de mot de passe — identique au serveur (validatePasswordPolicy). */
function passwordPolicyError(pw: string): string | null {
  if (pw.length < 10) return "Au moins 10 caractères";
  if (!/[A-Z]/.test(pw)) return "Au moins une majuscule";
  if (!/[a-z]/.test(pw)) return "Au moins une minuscule";
  if (!/[0-9]/.test(pw)) return "Au moins un chiffre";
  return null;
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AccountSection() {
  const { user, logout, restoreSession } = useAuthStore();
  const isWeb = Boolean((window.btpAPI as { isWeb?: boolean } | undefined)?.isWeb);
  const canEditProfile = Boolean(window.btpAPI?.authUpdateProfile);

  // ─── Profil (prénom / nom / email) ────────────────────────────────────
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setEmail(user?.email ?? "");
  }, [user?.firstName, user?.lastName, user?.email]);

  const profileDirty =
    firstName !== (user?.firstName ?? "") ||
    lastName !== (user?.lastName ?? "") ||
    email !== (user?.email ?? "");

  const handleProfileSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!window.btpAPI?.authUpdateProfile) return;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Adresse email invalide");
      return;
    }
    setProfileLoading(true);
    const r = await window.btpAPI.authUpdateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    });
    setProfileLoading(false);
    if (r.success) {
      toast.success("Profil mis à jour");
      // Recharge le user depuis /api/auth/me pour rafraîchir le store
      void restoreSession();
    } else {
      toast.error(r.error || "Échec de la mise à jour du profil");
    }
  };

  // ─── Identifiant ──────────────────────────────────────────────────────
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  const handleUsernameSubmit = async (e: React.FormEvent): Promise<void> => {
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
      if (isWeb && window.btpAPI?.authChangeUsername) {
        const r = await window.btpAPI.authChangeUsername({
          newUsername: newUsername.trim(),
          password: usernamePassword,
        });
        if (r.success) {
          toast.success("Identifiant modifié. Reconnectez-vous avec le nouvel identifiant.");
          setTimeout(() => void logout(), 1500);
        } else {
          toast.error(r.error || "Échec du changement d'identifiant");
        }
      } else if (window.btpAPI?.updateUsername) {
        // Desktop : canal IPC historique (hash local)
        const passwordHash = await sha256(usernamePassword + user.username);
        const result = await window.btpAPI.updateUsername({
          currentUsername: user.username,
          newUsername: newUsername.trim(),
          passwordHash,
        });
        if (result?.success) {
          toast.success("Identifiant modifié. Vous allez être déconnecté.");
          setTimeout(() => void logout(), 1500);
        } else {
          toast.error(result?.error || "Erreur inconnue");
        }
      } else {
        toast.error("Fonction indisponible sur cette plateforme");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setUsernameLoading(false);
      setNewUsername("");
      setUsernamePassword("");
    }
  };

  // ─── Mot de passe ─────────────────────────────────────────────────────
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const newPasswordError = newPassword ? passwordPolicyError(newPassword) : null;

  const handlePasswordSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!user || !oldPassword || !newPassword || !confirmPassword) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    const policyErr = passwordPolicyError(newPassword);
    if (policyErr) {
      toast.error(`Mot de passe trop faible : ${policyErr.toLowerCase()}`);
      return;
    }
    if (newPassword === oldPassword) {
      toast.error("Le nouveau mot de passe doit être différent");
      return;
    }
    setPasswordLoading(true);
    try {
      if (isWeb && window.btpAPI?.authChangePassword) {
        const r = await window.btpAPI.authChangePassword({ oldPassword, newPassword });
        if (r.success) {
          toast.success("Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.");
          // Le serveur révoque le token courant → reconnexion nécessaire.
          setTimeout(() => void logout(), 1500);
        } else {
          toast.error(r.error || "Échec du changement de mot de passe");
        }
      } else if (window.btpAPI?.updatePassword) {
        // Desktop : canal IPC historique (hash local)
        const oldPasswordHash = await sha256(oldPassword + user.username);
        const newPasswordHash = await sha256(newPassword + user.username);
        const result = await window.btpAPI.updatePassword({
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
      } else {
        toast.error("Fonction indisponible sur cette plateforme");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setPasswordLoading(false);
    }
  };

  // ─── Affichage profil ─────────────────────────────────────────────────
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    user?.username?.[0]?.toUpperCase() ||
    "?";
  const roleLabel = ROLE_LABELS[user?.role ?? "user"] ?? "Utilisateur";

  return (
    <div className="space-y-6">
      {/* Profil */}
      <SettingsSectionWrapper title="Mon profil" description="Informations sur votre compte utilisateur">
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-xl font-bold text-primary uppercase shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{fullName || user?.username}</p>
            <p className="text-sm text-muted-foreground truncate">
              @{user?.username}
              {user?.email ? ` · ${user.email}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5 text-primary" />
              {roleLabel}
              {user?.companyName ? ` · ${user.companyName}` : ""}
            </p>
          </div>
        </div>
      </SettingsSectionWrapper>

      {/* Informations personnelles (web : API REST self-service) */}
      {canEditProfile && (
        <SettingsSectionWrapper
          title="Informations personnelles"
          description="Prénom, nom et adresse email associés à votre compte."
        >
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-firstname">Prénom</Label>
                <Input
                  id="profile-firstname"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  autoComplete="given-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-lastname">Nom</Label>
                <Input
                  id="profile-lastname"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-email">Adresse email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Utilisée pour la réinitialisation de mot de passe (« Mot de passe oublié ? »).
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={profileLoading} disabled={!profileDirty}>
                Enregistrer le profil
              </Button>
            </div>
          </form>
        </SettingsSectionWrapper>
      )}

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
        description="Minimum 10 caractères, avec majuscule, minuscule et chiffre."
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
                placeholder="10+ caractères, maj, min, chiffre"
                className="pl-9"
                autoComplete="new-password"
              />
            </div>
            <AnimatePresence>
              {newPassword && newPasswordError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs flex items-center gap-1.5 text-destructive"
                >
                  <AlertCircle className="w-3 h-3" /> {newPasswordError}
                </motion.p>
              )}
            </AnimatePresence>
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
              disabled={!oldPassword || !newPassword || !confirmPassword || !!newPasswordError}
            >
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </SettingsSectionWrapper>

      {/* Session */}
      <SettingsSectionWrapper title="Session" description="Actions sur votre session actuelle">
        <div className="flex items-center justify-between p-4 border border-border rounded-lg gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium">Se déconnecter</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vous devrez vous reconnecter pour accéder à l'application
            </p>
          </div>
          <Button variant="destructive" onClick={() => void logout()}>
            Déconnexion
          </Button>
        </div>
      </SettingsSectionWrapper>
    </div>
  );
}
