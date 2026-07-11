import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Building2,
  Users,
  Power,
  PowerOff,
  Trash2,
  AlertTriangle,
  KeyRound,
  Save,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@btp/ui";
import { superAdminApi, type Company, type CompanyAdminUser } from "../api/superAdminApi";

// ═══════════════════════════════════════════════════════════════════════════
// CompanyDetailModal — gestion d'une entreprise cliente (super-admin)
// Infos modifiables (nom), liste des utilisateurs, activation/désactivation,
// suppression définitive (cascade) protégée par saisie du nom.
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  manager: "Manager",
  accountant: "Comptable",
  worker: "Collaborateur",
  viewer: "Lecteur",
};

function formatDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(s);
  }
}

interface Props {
  companyId: number | null;
  onClose: () => void;
  onChanged: () => void;
}

export function CompanyDetailModal({ companyId, onClose, onChanged }: Props) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [busy, setBusy] = useState(false);

  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (companyId == null) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setCompany(null);
    setDeleteText("");
    superAdminApi
      .getCompany(companyId)
      .then((c) => {
        if (!alive) return;
        setCompany(c);
        setName(c.name ?? "");
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [companyId]);

  const reload = async (): Promise<void> => {
    if (companyId == null) return;
    try {
      const c = await superAdminApi.getCompany(companyId);
      setCompany(c);
      setName(c.name ?? "");
    } catch {
      /* ignore */
    }
    onChanged();
  };

  const handleSaveName = async (): Promise<void> => {
    if (!company || !name.trim() || name.trim() === company.name) return;
    setSavingName(true);
    try {
      await superAdminApi.updateCompany(company.id, { name: name.trim() });
      toast.success("Nom de l'entreprise mis à jour");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleActive = async (): Promise<void> => {
    if (!company) return;
    setBusy(true);
    try {
      await superAdminApi.updateCompany(company.id, { isActive: !company.isActive });
      toast.success(company.isActive ? "Entreprise désactivée" : "Entreprise réactivée");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!company || deleteText !== company.name) return;
    setDeleting(true);
    try {
      const r = await superAdminApi.deleteCompany(company.id);
      const total = Object.values(r.deletedRows ?? {}).reduce((a, b) => a + b, 0);
      toast.success(`Entreprise supprimée (${total} enregistrements effacés)`);
      onClose();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  };

  const users: CompanyAdminUser[] = company?.users ?? [];
  const isMainCompany = company?.id === 1;

  return (
    <AnimatePresence>
      {companyId != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold truncate">
                    {company?.name || `Entreprise #${companyId}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ID #{companyId}
                    {company && (company.isActive ? " · Active" : " · Désactivée")}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} disabled={deleting}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Chargement…</p>
              ) : error ? (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {error}
                </div>
              ) : company ? (
                <>
                  {/* Informations */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      Informations
                    </h4>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 grid gap-1.5">
                        <Label htmlFor="company-name" className="text-xs">
                          Nom de l'entreprise
                        </Label>
                        <Input
                          id="company-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => void handleSaveName()}
                        loading={savingName}
                        disabled={!name.trim() || name.trim() === company.name}
                      >
                        <Save className="w-4 h-4" />
                        Enregistrer
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Créée le {formatDateTime(company.createdAt)} · Setup{" "}
                      {company.isSetupComplete ? "terminé" : "en cours"}
                    </p>
                  </section>

                  {/* Utilisateurs */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Utilisateurs ({users.length})
                    </h4>
                    {users.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>
                    ) : (
                      <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                        {users.map((u) => {
                          const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
                          return (
                            <div
                              key={u.id}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5",
                                u.disabled ? "opacity-50" : undefined
                              )}
                            >
                              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-medium shrink-0 uppercase">
                                {(u.firstName?.[0] ?? u.username[0] ?? "?").toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {fullName || u.username}
                                  <span className="text-xs text-muted-foreground font-normal">
                                    {" "}
                                    @{u.username}
                                  </span>
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {u.email || "—"} · Dernière connexion :{" "}
                                  {formatDateTime(u.lastLoginAt)}
                                </p>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {ROLE_LABELS[u.role] ?? u.role}
                              </span>
                              {u.disabled ? (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 shrink-0 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  Désactivé
                                </span>
                              ) : (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 shrink-0">
                                  Actif
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <KeyRound className="w-3 h-3" />
                      La gestion fine (rôles, reset, invitations) se fait par l'admin de
                      l'entreprise, dans sa page Utilisateurs.
                    </p>
                  </section>

                  {/* Activation / désactivation */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold">État</h4>
                    <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg flex-wrap">
                      <div className="text-sm">
                        {company.isActive ? (
                          <>
                            <p className="font-medium">Entreprise active</p>
                            <p className="text-xs text-muted-foreground">
                              La désactiver bloque immédiatement la connexion de tous ses
                              utilisateurs.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">Entreprise désactivée</p>
                            <p className="text-xs text-muted-foreground">
                              Ses utilisateurs ne peuvent plus se connecter (ils restent
                              désactivés après réactivation).
                            </p>
                          </>
                        )}
                      </div>
                      <Button
                        variant={company.isActive ? "destructive" : "default"}
                        onClick={() => void handleToggleActive()}
                        loading={busy}
                      >
                        {company.isActive ? (
                          <>
                            <PowerOff className="w-4 h-4" />
                            Désactiver
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4" />
                            Réactiver
                          </>
                        )}
                      </Button>
                    </div>
                  </section>

                  {/* Zone dangereuse */}
                  {!isMainCompany && (
                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Zone dangereuse
                      </h4>
                      <div className="p-3 border border-destructive/40 bg-destructive/5 rounded-lg space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Supprime <strong>définitivement</strong> l'entreprise et{" "}
                          <strong>toutes ses données</strong> (utilisateurs, clients, devis,
                          factures, chantiers…). Irréversible.
                          {company.isActive && (
                            <span className="block mt-1 text-amber-600 dark:text-amber-400">
                              ⚠ Désactivez d'abord l'entreprise pour débloquer la suppression.
                            </span>
                          )}
                        </p>
                        <div className="grid gap-1.5">
                          <Label htmlFor="delete-confirm" className="text-xs">
                            Pour confirmer, tapez{" "}
                            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                              {company.name}
                            </code>
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="delete-confirm"
                              value={deleteText}
                              onChange={(e) => setDeleteText(e.target.value)}
                              placeholder={company.name}
                              className="font-mono"
                              disabled={company.isActive}
                            />
                            <Button
                              variant="destructive"
                              onClick={() => void handleDelete()}
                              loading={deleting}
                              disabled={company.isActive || deleteText !== company.name}
                            >
                              <Trash2 className="w-4 h-4" />
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                  {isMainCompany && (
                    <p className="text-[11px] text-muted-foreground">
                      L'entreprise principale (ID 1) ne peut pas être supprimée : c'est le
                      tenant par défaut de l'instance.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
