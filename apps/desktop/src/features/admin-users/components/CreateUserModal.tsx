import { useState, useMemo, useEffect } from "react";
import { UserPlus, Copy, Check, AlertCircle, Mail, MailX, Inbox, Send } from "lucide-react";
import { toast } from "sonner";

import { SideDrawer } from "@/components/shared/SideDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@btp/ui";

import { usersAdminApi, type Role, type CreatedUser } from "../api/usersAdminApi";
import { deriveProEmail } from "../lib/nameToEmail";

// Domaine pro où sont créées les mailboxes cPanel.
// (idéalement viendrait du serveur, mais on peut hardcoder ici pour l'instant
//  car c'est la valeur de CPANEL_EMAIL_DOMAIN côté server.)
const PRO_EMAIL_DOMAIN = "intranet.jacobhabitat-dev.fr";

// ═══════════════════════════════════════════════════════════════════════════
// CreateUserModal — Provisioning Admin Only d'un nouvel utilisateur
//
// Génère un mot de passe temporaire côté serveur, l'affiche UNE SEULE FOIS
// à l'admin pour transmission, puis force l'utilisateur à le changer au 1er
// login (mustChangePassword = 1).
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (user: CreatedUser) => void;
}

const ROLES: Array<{ value: Role; label: string; description: string }> = [
  { value: "admin", label: "Administrateur", description: "Accès total — gestion users, paramétrage, données" },
  { value: "manager", label: "Manager", description: "Gestion devis/factures/chantiers de toute l'équipe" },
  { value: "accountant", label: "Comptable", description: "Lecture globale, écriture factures et dépenses" },
  { value: "worker", label: "Collaborateur", description: "Accès uniquement à ses propres données" },
  { value: "viewer", label: "Lecteur", description: "Lecture seule sur les données assignées" },
];

export function CreateUserModal({ open, onClose, onCreated }: Props) {
  const [username, setUsername] = useState("");
  const [emailManual, setEmailManual] = useState<string | null>(null); // null = auto
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<Role>("worker");
  const [createMailbox, setCreateMailbox] = useState(true); // coché par défaut
  // Choix de destination du welcome email
  const [notifyMode, setNotifyMode] = useState<"pro" | "personal">("personal");
  const [personalEmail, setPersonalEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState(false);

  // Email pro auto-généré : nom.prenom@domaine
  const autoEmail = useMemo(
    () => deriveProEmail(firstName, lastName, PRO_EMAIL_DOMAIN),
    [firstName, lastName]
  );
  const email = emailManual ?? autoEmail;

  // Si on crée pas de mailbox, on bascule sur "pro" par défaut (l'utilisateur
  // a déjà accès à son email perso = email pro)
  useEffect(() => {
    if (!createMailbox && notifyMode === "personal" && !personalEmail) {
      setNotifyMode("pro");
    }
  }, [createMailbox, notifyMode, personalEmail]);

  function reset() {
    setUsername("");
    setEmailManual(null);
    setFirstName("");
    setLastName("");
    setRole("worker");
    setCreateMailbox(true);
    setNotifyMode("personal");
    setPersonalEmail("");
    setError(null);
    setLoading(false);
    setCreatedUser(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (notifyMode === "personal" && !personalEmail.trim()) {
      setError("Renseigne l'email de destination, ou choisis 'Adresse pro'.");
      return;
    }
    setLoading(true);
    try {
      const created = await usersAdminApi.create({
        username: username.trim(),
        email: email.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role,
        createMailbox: createMailbox && Boolean(email.trim()),
        notificationEmail:
          notifyMode === "personal" && personalEmail.trim()
            ? personalEmail.trim()
            : undefined, // serveur fallback sur created.email (pro)
      });
      setCreatedUser(created);
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  async function copyPassword() {
    if (!createdUser?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(createdUser.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Mot de passe copié dans le presse-papiers");
    } catch {
      toast.error("Impossible de copier — note-le manuellement");
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  const footer = createdUser?.tempPassword ? (
    <div className="flex items-center justify-end gap-2">
      <Button onClick={handleClose}>J'ai noté le mot de passe</Button>
    </div>
  ) : (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={handleClose} disabled={loading}>
        Annuler
      </Button>
      <Button
        type="submit"
        form="create-user-form"
        loading={loading}
        disabled={!username.trim()}
      >
        <UserPlus className="w-4 h-4" />
        Créer l'utilisateur
      </Button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={handleClose}
      widthClass="max-w-xl"
      title={createdUser ? "Utilisateur créé" : "Nouvel utilisateur"}
      subtitle={
        createdUser
          ? "Transmettez le mot de passe temporaire"
          : "Provisioning interne — l'utilisateur ne peut pas s'inscrire seul"
      }
      footer={footer}
    >
      {/* Body */}
      <div className="p-5">
        {createdUser?.tempPassword ? (
                <div className="space-y-4">
                  {/* Statut de l'envoi email */}
                  {createdUser.email ? (
                    createdUser.emailSent ? (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                        <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <strong>Email envoyé automatiquement</strong>
                          <p className="mt-0.5 opacity-90">
                            Un email avec les identifiants a été envoyé à{" "}
                            <strong>{createdUser.emailSentTo ?? createdUser.email}</strong>
                            . Tu peux quand même copier le mot de passe ci-dessous au cas
                            où.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                        <MailX className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <strong>Email non envoyé</strong>
                          <p className="mt-0.5 opacity-90">
                            {createdUser.emailError === "SMTP non configuré"
                              ? "SMTP pas configuré côté serveur — transmets le mot de passe manuellement."
                              : `Erreur : ${createdUser.emailError ?? "raison inconnue"}. Transmets le mot de passe manuellement.`}
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-slate-500/10 border border-slate-500/30 text-slate-700 dark:text-slate-400">
                      <MailX className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-xs">
                        <strong>Aucun email saisi</strong> — transmets le mot de passe
                        manuellement à l'utilisateur.
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-xs">
                      <strong>Ce mot de passe ne sera plus visible.</strong>{" "}
                      Copie-le maintenant et transmets-le à{" "}
                      <strong>{createdUser.firstName || createdUser.username}</strong> par
                      un canal sécurisé. Il sera obligé de le changer à sa première
                      connexion.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">Identifiant</Label>
                    <div className="mt-1 px-3 py-2 rounded-md bg-muted font-mono text-sm">
                      {createdUser.username}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Mot de passe temporaire</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm break-all">
                        {createdUser.tempPassword}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copyPassword}
                        title="Copier"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Rôle</Label>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                        {ROLES.find((r) => r.value === createdUser.role)?.label ??
                          createdUser.role}
                      </span>
                    </div>
                  </div>

                  {/* Résultat création mailbox cPanel */}
                  {createdUser.mailboxCreated && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400">
                      <Inbox className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong>Boîte mail cPanel créée</strong>
                        <p className="mt-0.5 opacity-90">
                          La mailbox <strong>{createdUser.email}</strong> est active.
                          Les paramètres IMAP/SMTP sont inclus dans l'email envoyé à
                          l'utilisateur.
                        </p>
                      </div>
                    </div>
                  )}
                  {createdUser.mailboxAlreadyExists && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong>Mailbox déjà existante</strong>
                        <p className="mt-0.5 opacity-90">
                          Une boîte mail à cette adresse existait déjà sur cPanel.
                          Le password n'a PAS été modifié — l'utilisateur garde son
                          mot de passe mailbox actuel.
                        </p>
                      </div>
                    </div>
                  )}
                  {createdUser.mailboxError && !createdUser.mailboxAlreadyExists && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong>Échec création mailbox</strong>
                        <p className="mt-0.5 opacity-90">{createdUser.mailboxError}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" id="create-user-form">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Jean"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Dupont"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="username">Identifiant de connexion *</Label>
                    <Input
                      id="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="jdupont"
                      pattern="[a-zA-Z0-9._-]+"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Lettres, chiffres, points, tirets uniquement
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="email">Email professionnel</Label>
                      {emailManual !== null && (
                        <button
                          type="button"
                          onClick={() => setEmailManual(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline"
                        >
                          Auto-générer depuis Nom.Prénom
                        </button>
                      )}
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmailManual(e.target.value)}
                      placeholder={`nom.prenom@${PRO_EMAIL_DOMAIN}`}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {emailManual === null && autoEmail
                        ? `Auto-généré depuis Nom.Prénom (${autoEmail}) — modifiable`
                        : `Format : nom.prenom@${PRO_EMAIL_DOMAIN}`}
                    </p>
                  </div>

                  {/* Création mailbox cPanel — visible uniquement si email rempli */}
                  {email.trim() && (
                    <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-border hover:bg-accent/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={createMailbox}
                        onChange={(e) => setCreateMailbox(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Inbox className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">
                            Créer également une boîte mail cPanel
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Une vraie mailbox sera créée sur ton serveur (IMAP + SMTP).
                          L'utilisateur pourra envoyer/recevoir des emails depuis{" "}
                          <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">
                            {email.trim()}
                          </code>
                          . Le mot de passe sera identique à celui de BatiDesk au
                          départ.
                        </p>
                      </div>
                    </label>
                  )}

                  {/* Destination du welcome email */}
                  {email.trim() && (
                    <div className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-primary" />
                        <Label className="text-sm font-medium">
                          Envoyer les accès par email à
                        </Label>
                      </div>

                      <label className="flex items-start gap-3 p-2 rounded hover:bg-accent/30 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="notify-mode"
                          checked={notifyMode === "pro"}
                          onChange={() => setNotifyMode("pro")}
                          className="mt-1 shrink-0 accent-primary"
                          disabled={createMailbox}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            L'adresse pro
                          </p>
                          <p className="text-xs text-muted-foreground break-all">
                            {email.trim() || "(aucune)"}
                          </p>
                          {createMailbox && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                              ⚠️ Désactivé : la mailbox vient d'être créée, l'utilisateur
                              n'y a pas encore accès. Préfère une adresse perso.
                            </p>
                          )}
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-2 rounded hover:bg-accent/30 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="notify-mode"
                          checked={notifyMode === "personal"}
                          onChange={() => setNotifyMode("personal")}
                          className="mt-1 shrink-0 accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Une autre adresse</p>
                          <p className="text-xs text-muted-foreground mb-1.5">
                            Email perso de l'utilisateur (Gmail, Outlook…)
                          </p>
                          {notifyMode === "personal" && (
                            <Input
                              type="email"
                              value={personalEmail}
                              onChange={(e) => setPersonalEmail(e.target.value)}
                              placeholder="jean.dupont@gmail.com"
                              className="mt-1"
                              required={notifyMode === "personal"}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      </label>
                    </div>
                  )}

                  <div>
                    <Label className="block mb-2">Rôle *</Label>
                    <div className="space-y-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRole(r.value)}
                          className={cn(
                            "w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                            role === r.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-border/80 hover:bg-accent/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center",
                              role === r.value
                                ? "border-primary bg-primary"
                                : "border-border"
                            )}
                          >
                            {role === r.value && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{r.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {r.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Un mot de passe temporaire sera généré et affiché une seule fois
                    après création. L'utilisateur devra le changer à sa première
                    connexion.
                  </p>
                </form>
              )}
      </div>
    </SideDrawer>
  );
}
