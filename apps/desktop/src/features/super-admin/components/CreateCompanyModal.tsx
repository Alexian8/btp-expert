import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Building2, Copy, Check, AlertCircle, Mail, MailX, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { superAdminApi, type CreatedCompany } from "../api/superAdminApi";

// ═══════════════════════════════════════════════════════════════════════════
// CreateCompanyModal — Provisioning d'une nouvelle entreprise cliente
//
// Crée la company + son 1er admin en une étape. L'admin reçoit ses creds
// par email (si SMTP configuré) ou via la modal pour transmission manuelle.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (created: CreatedCompany) => void;
}

export function CreateCompanyModal({ open, onClose, onCreated }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCompany | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setCompanyName("");
    setAdminFirstName("");
    setAdminLastName("");
    setAdminUsername("");
    setAdminEmail("");
    setLoading(false);
    setError(null);
    setCreated(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await superAdminApi.createCompany({
        companyName: companyName.trim(),
        adminUsername: adminUsername.trim(),
        adminEmail: adminEmail.trim(),
        adminFirstName: adminFirstName.trim() || undefined,
        adminLastName: adminLastName.trim() || undefined,
      });
      setCreated(r);
      onCreated(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  async function copyPassword() {
    if (!created?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(created.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Mot de passe copié");
    } catch {
      toast.error("Impossible de copier");
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
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {created ? "Entreprise créée" : "Nouvelle entreprise"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {created
                      ? "Transmettez les accès au dirigeant"
                      : "Crée le tenant + son 1er admin"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {created ? (
                <div className="space-y-4">
                  {created.emailSent ? (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong>Email envoyé automatiquement</strong>
                        <p className="mt-0.5 opacity-90">
                          Un email avec les identifiants a été envoyé à{" "}
                          <strong>{created.admin.email}</strong>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                      <MailX className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong>Email non envoyé</strong>
                        <p className="mt-0.5 opacity-90">
                          {created.emailError === "SMTP non configuré"
                            ? "SMTP pas configuré côté serveur. Transmets le mot de passe manuellement."
                            : `Erreur : ${created.emailError ?? "raison inconnue"}.`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Entreprise</Label>
                    <div className="mt-1 px-3 py-2 rounded-md bg-muted text-sm font-medium">
                      {created.name}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Email admin</Label>
                    <div className="mt-1 px-3 py-2 rounded-md bg-muted text-sm">
                      {created.admin.email}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Identifiant</Label>
                    <div className="mt-1 px-3 py-2 rounded-md bg-muted font-mono text-sm">
                      {created.admin.username}
                    </div>
                  </div>

                  {created.tempPassword && (
                    <div>
                      <Label className="text-xs">Mot de passe temporaire</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm break-all">
                          {created.tempPassword}
                        </code>
                        <Button variant="outline" size="icon" onClick={copyPassword}>
                          {copied ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        L'admin sera obligé de le changer à sa 1ère connexion. Il verra
                        ensuite le tutoriel d'onboarding pour remplir SIRET/TVA/logo.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" id="create-company-form">
                  <div>
                    <Label htmlFor="company-name">Nom de l'entreprise *</Label>
                    <Input
                      id="company-name"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Jacob Habitat SARL"
                      autoFocus
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      Premier administrateur de l'entreprise (recevra ses accès par email) :
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label htmlFor="admin-first">Prénom</Label>
                        <Input
                          id="admin-first"
                          value={adminFirstName}
                          onChange={(e) => setAdminFirstName(e.target.value)}
                          placeholder="Jean"
                        />
                      </div>
                      <div>
                        <Label htmlFor="admin-last">Nom</Label>
                        <Input
                          id="admin-last"
                          value={adminLastName}
                          onChange={(e) => setAdminLastName(e.target.value)}
                          placeholder="Dupont"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <Label htmlFor="admin-username">Identifiant de connexion *</Label>
                      <Input
                        id="admin-username"
                        required
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="jdupont"
                        pattern="[a-zA-Z0-9._-]+"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lettres, chiffres, points, tirets uniquement
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="admin-email">Email *</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="dirigeant@jacobhabitat.fr"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Les identifiants seront envoyés à cet email automatiquement
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Un mot de passe temporaire de 16 caractères sera généré et envoyé par
                    email à l'admin. Il devra le changer à sa première connexion, puis
                    sera guidé par le tutoriel d'onboarding pour configurer son entreprise.
                  </p>
                </form>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              {created ? (
                <Button onClick={handleClose}>Fermer</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleClose} disabled={loading}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    form="create-company-form"
                    loading={loading}
                    disabled={!companyName.trim() || !adminUsername.trim() || !adminEmail.trim()}
                  >
                    <Building2 className="w-4 h-4" />
                    Créer l'entreprise
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
