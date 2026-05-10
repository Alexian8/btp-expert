import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Copy, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@btp/ui";

import { usersAdminApi, type Role, type CreatedUser } from "../api/usersAdminApi";

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
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<Role>("worker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setUsername("");
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("worker");
    setError(null);
    setLoading(false);
    setCreatedUser(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await usersAdminApi.create({
        username: username.trim(),
        email: email.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role,
        // pas de password fourni → le serveur en génère un
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-lg w-full max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {createdUser ? "Utilisateur créé" : "Nouvel utilisateur"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {createdUser
                      ? "Transmettez le mot de passe temporaire"
                      : "Provisioning interne — l'utilisateur ne peut pas s'inscrire seul"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {createdUser?.tempPassword ? (
                <div className="space-y-4">
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
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jdupont@jacobhabitat.fr"
                    />
                  </div>

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

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              {createdUser?.tempPassword ? (
                <Button onClick={handleClose}>J'ai noté le mot de passe</Button>
              ) : (
                <>
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
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
