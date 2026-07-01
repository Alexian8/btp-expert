import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  ShieldCheck,
  KeyRound,
  Power,
  PowerOff,
  Trash2,
  Mail,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  X,
  Lock,
  LockOpen,
  Pencil,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@btp/ui";

import { CreateUserModal } from "./CreateUserModal";
import { EditUserModal } from "./EditUserModal";
import {
  usersAdminApi,
  type AdminUser,
  type Role,
} from "../api/usersAdminApi";

// ═══════════════════════════════════════════════════════════════════════════
// UsersAdminPage — Panel admin de gestion des utilisateurs
//
// Accessible uniquement aux users de rôle "admin" (gardé côté serveur).
// Responsive : cartes empilées en mobile (md:hidden) + tableau en desktop.
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_META: Record<Role, { label: string; color: string }> = {
  admin: {
    label: "Administrateur",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
  manager: {
    label: "Manager",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  },
  accountant: {
    label: "Comptable",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  worker: {
    label: "Collaborateur",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  viewer: {
    label: "Lecteur",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
};

type StatusFilter = "all" | "active" | "disabled" | "locked" | "mustchange";

function fullName(u: AdminUser): string {
  const n = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return n || u.username;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

function lockedMinutesLeft(u: AdminUser): number {
  return Math.max(1, Math.ceil(((u.lockedUntil ?? 0) - Date.now()) / 60_000));
}

export function UsersAdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | Role>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await usersAdminApi.list();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filtered = users.filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (filterStatus === "active" && (u.disabled || u.locked)) return false;
    if (filterStatus === "disabled" && !u.disabled) return false;
    if (filterStatus === "locked" && !u.locked) return false;
    if (filterStatus === "mustchange" && !u.mustChangePassword) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      fullName(u).toLowerCase().includes(q)
    );
  });

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    actifs: users.filter((u) => !u.disabled).length,
    verrouilles: users.filter((u) => u.locked).length,
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Utilisateurs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Provisioning interne — créez et gérez les comptes de votre équipe
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={Users} />
        <StatCard label="Actifs" value={stats.actifs} icon={Power} accent="emerald" />
        <StatCard label="Administrateurs" value={stats.admins} icon={ShieldCheck} accent="rose" />
        <StatCard label="Verrouillés" value={stats.verrouilles} icon={Lock} accent="amber" />
      </div>

      {/* Search + filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, email, identifiant)…"
            className="pl-10"
          />
        </div>
        <NativeSelect
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as "all" | Role)}
          className="w-auto min-w-[150px]"
        >
          <option value="all">Tous rôles</option>
          {(Object.keys(ROLE_META) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className="w-auto min-w-[150px]"
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="locked">Verrouillés</option>
          <option value="mustchange">MdP à changer</option>
          <option value="disabled">Désactivés</option>
        </NativeSelect>
      </div>

      {/* List */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{error}</p>
            {error.includes("Accès refusé") && (
              <p className="text-xs mt-1">
                Vous n'avez pas les droits d'accéder à cette page.
              </p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {search || filterRole !== "all" || filterStatus !== "all"
            ? "Aucun résultat"
            : "Aucun utilisateur"}
        </div>
      ) : (
        <>
          {/* ─── Cartes mobile (< md) ─────────────────────────────────── */}
          <div className="md:hidden space-y-2">
            {filtered.map((u) => (
              <UserItem key={u.id} user={u} variant="card" onChanged={loadUsers} />
            ))}
          </div>

          {/* ─── Tableau desktop (≥ md) ───────────────────────────────── */}
          <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_150px_130px_130px_190px] gap-2 px-4 py-2.5 bg-muted/40 text-xs font-medium text-muted-foreground border-b border-border">
              <div>Utilisateur</div>
              <div>Rôle</div>
              <div>Dernière connexion</div>
              <div>Statut</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((u) => (
                <UserItem key={u.id} user={u} variant="row" onChanged={loadUsers} />
              ))}
            </div>
          </div>
        </>
      )}

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void loadUsers();
        }}
      />
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: "emerald" | "rose" | "amber";
}) {
  const accentClass =
    accent === "emerald"
      ? "bg-emerald-500/10 text-emerald-600"
      : accent === "rose"
        ? "bg-rose-500/10 text-rose-600"
        : accent === "amber"
          ? "bg-amber-500/10 text-amber-600"
          : "bg-primary/10 text-primary";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4"
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-md flex items-center justify-center", accentClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

/** Badge de statut (partagé carte mobile / ligne desktop). */
function StatusBadge({ user }: { user: AdminUser }) {
  if (user.disabled) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
        <PowerOff className="w-3 h-3" />
        Désactivé
      </span>
    );
  }
  if (user.locked) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-rose-500/10 text-rose-600 dark:text-rose-400"
        title={`Trop de tentatives — déverrouillage auto dans ${lockedMinutesLeft(user)} min`}
      >
        <Lock className="w-3 h-3" />
        Verrouillé ({lockedMinutesLeft(user)} min)
      </span>
    );
  }
  if (user.mustChangePassword) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <KeyRound className="w-3 h-3" />
        MdP à changer
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <Power className="w-3 h-3" />
      Actif
    </span>
  );
}

/**
 * Item utilisateur — un seul composant (état + modales partagés), deux
 * rendus : carte (mobile) ou ligne de tableau (desktop).
 */
function UserItem({
  user,
  variant,
  onChanged,
}: {
  user: AdminUser;
  variant: "card" | "row";
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{
    password: string;
    context: "reset" | "invite";
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [confirmResendOpen, setConfirmResendOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function handleReset() {
    setConfirmResetOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      const r = await usersAdminApi.resetPassword(user.id);
      setTempPasswordInfo({ password: r.tempPassword, context: "reset" });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    if (busy) return;
    setBusy(true);
    try {
      await usersAdminApi.unlock(user.id);
      toast.success(`Compte ${user.username} déverrouillé`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendInvite() {
    setConfirmResendOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      const r = await usersAdminApi.resendInvite(user.id);
      if (r.emailSent) {
        toast.success(`Invitation renvoyée à ${r.emailSentTo}`);
      } else {
        toast.warning(
          `Email non envoyé${r.emailError ? ` (${r.emailError})` : ""} — transmettez le mot de passe manuellement`
        );
      }
      setTempPasswordInfo({ password: r.tempPassword, context: "invite" });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleDisabled() {
    setConfirmToggleOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      if (user.disabled) {
        await usersAdminApi.update(user.id, { disabled: false });
        toast.success("Compte réactivé");
      } else {
        await usersAdminApi.disable(user.id);
        toast.success("Compte désactivé — ses sessions en cours sont coupées");
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(newRole: Role) {
    if (busy || newRole === user.role) return;
    setBusy(true);
    try {
      await usersAdminApi.update(user.id, { role: newRole });
      toast.success(`Rôle changé en ${ROLE_META[newRole].label}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function copyTempPwd() {
    if (!tempPasswordInfo) return;
    try {
      await navigator.clipboard.writeText(tempPasswordInfo.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  async function handleHardDelete() {
    if (busy) return;
    if (confirmText !== user.username) {
      toast.error("La confirmation ne correspond pas au nom d'utilisateur");
      return;
    }
    setBusy(true);
    try {
      await usersAdminApi.deletePermanent(user.id);
      toast.success(`Utilisateur ${user.username} supprimé définitivement`);
      setConfirmDeleteOpen(false);
      setConfirmText("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const meta = ROLE_META[user.role] ?? ROLE_META.viewer;
  const initials = (user.firstName?.[0] ?? user.username[0] ?? "?").toUpperCase();

  const identity = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-medium shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{fullName(user)}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span>@{user.username}</span>
          {user.email && (
            <>
              <span>·</span>
              <Mail className="w-3 h-3" />
              <span className="truncate">{user.email}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );

  const roleSelect = (
    <select
      value={user.role}
      onChange={(e) => handleRoleChange(e.target.value as Role)}
      className={cn("px-2 py-1 text-xs rounded border font-medium", meta.color)}
    >
      {(Object.keys(ROLE_META) as Role[]).map((r) => (
        <option key={r} value={r}>
          {ROLE_META[r].label}
        </option>
      ))}
    </select>
  );

  const actions = (
    <div className="flex items-center justify-end gap-1 flex-wrap">
      {user.locked && (
        <Button
          variant="outline"
          size="icon"
          title="Déverrouiller le compte"
          onClick={handleUnlock}
          disabled={busy}
          className="border-rose-500/40 hover:bg-rose-500/10"
        >
          <LockOpen className="w-3.5 h-3.5 text-rose-500" />
        </Button>
      )}
      <Button
        variant="outline"
        size="icon"
        title="Modifier (nom, email)"
        onClick={() => setEditOpen(true)}
        disabled={busy}
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        title="Renvoyer l'invitation (nouveau mot de passe + email)"
        onClick={() => setConfirmResendOpen(true)}
        disabled={busy || user.disabled}
      >
        <Send className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        title="Régénérer mot de passe"
        onClick={() => setConfirmResetOpen(true)}
        disabled={busy || user.disabled}
      >
        <KeyRound className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        title={user.disabled ? "Réactiver" : "Désactiver"}
        onClick={() => setConfirmToggleOpen(true)}
        disabled={busy}
      >
        {user.disabled ? (
          <Power className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <PowerOff className="w-3.5 h-3.5 text-destructive" />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon"
        title="Supprimer définitivement"
        onClick={() => {
          setConfirmText("");
          setConfirmDeleteOpen(true);
        }}
        disabled={busy}
        className="hover:bg-destructive/10 hover:border-destructive/40"
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
    </div>
  );

  return (
    <>
      {variant === "row" ? (
        <div
          className={cn(
            "grid grid-cols-[1fr_150px_130px_130px_190px] gap-2 px-4 py-3 items-center",
            user.disabled && "opacity-50",
            busy && "pointer-events-none"
          )}
        >
          {identity}
          {roleSelect}
          <div className="text-xs text-muted-foreground">{formatDate(user.lastLoginAt)}</div>
          <div>
            <StatusBadge user={user} />
          </div>
          {actions}
        </div>
      ) : (
        <div
          className={cn(
            "bg-card border border-border rounded-lg p-3 space-y-3",
            user.disabled && "opacity-60",
            busy && "pointer-events-none"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            {identity}
            <StatusBadge user={user} />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {roleSelect}
            <span className="text-[11px] text-muted-foreground">
              Dernière connexion : {formatDate(user.lastLoginAt)}
            </span>
          </div>
          {actions}
        </div>
      )}

      {/* Confirmations (reset / renvoi invitation / activer-désactiver) */}
      <ConfirmDialog
        open={confirmResetOpen}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={handleReset}
        title="Régénérer le mot de passe ?"
        description={
          <span>
            Un nouveau mot de passe temporaire sera généré pour <strong>{user.username}</strong>.
            Ses sessions en cours seront coupées et il devra le changer à sa prochaine connexion.
          </span>
        }
        confirmLabel="Régénérer"
      />
      <ConfirmDialog
        open={confirmResendOpen}
        onCancel={() => setConfirmResendOpen(false)}
        onConfirm={handleResendInvite}
        title="Renvoyer l'invitation ?"
        description={
          <span>
            Un <strong>nouveau mot de passe temporaire</strong> sera généré pour{" "}
            <strong>{user.username}</strong> et l'email d'accès sera renvoyé
            {user.email ? <> à <strong>{user.email}</strong></> : null}. Son mot de passe actuel
            ne fonctionnera plus.
          </span>
        }
        confirmLabel="Renvoyer"
      />
      <ConfirmDialog
        open={confirmToggleOpen}
        onCancel={() => setConfirmToggleOpen(false)}
        onConfirm={handleToggleDisabled}
        title={user.disabled ? "Réactiver ce compte ?" : "Désactiver ce compte ?"}
        description={
          user.disabled ? (
            <span>
              <strong>{user.username}</strong> pourra de nouveau se connecter.
            </span>
          ) : (
            <span>
              <strong>{user.username}</strong> ne pourra plus se connecter et ses sessions en
              cours seront immédiatement coupées. Ses données restent intactes.
            </span>
          )
        }
        confirmLabel={user.disabled ? "Réactiver" : "Désactiver"}
        destructive={!user.disabled}
      />

      {/* Modale d'édition (nom, email) */}
      <EditUserModal
        user={editOpen ? user : null}
        onClose={() => setEditOpen(false)}
        onSaved={onChanged}
      />

      {/* Modal de display du nouveau temp password */}
      {tempPasswordInfo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full p-5">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {tempPasswordInfo.context === "invite"
                ? "Invitation renvoyée"
                : "Mot de passe régénéré"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Pour <strong>{user.username}</strong>.{" "}
              {tempPasswordInfo.context === "invite"
                ? "L'email contient déjà ce mot de passe — gardez-en une copie au cas où."
                : "Transmets-le par un canal sécurisé, il sera obligé de le changer à sa prochaine connexion."}
            </p>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm break-all">
                {tempPasswordInfo.password}
              </code>
              <Button variant="outline" size="icon" onClick={copyTempPwd}>
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setTempPasswordInfo(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal hard-delete : confirmation par saisie du username */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Suppression définitive</h3>
                  <p className="text-xs text-muted-foreground">
                    Cette action est <strong>irréversible</strong>
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setConfirmText("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>
                    L'utilisateur{" "}
                    <strong>{fullName(user)}</strong> (@{user.username}) sera{" "}
                    <strong>supprimé de la base</strong>.
                  </p>
                  <p className="mt-1.5 opacity-90">
                    Ses devis/factures/clients existants resteront mais leur "Créé par"
                    affichera "—". Si tu veux juste l'empêcher de se connecter, utilise
                    plutôt <strong>Désactiver</strong>.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor={`confirm-input-${user.id}-${variant}`} className="text-xs">
                  Pour confirmer, tape{" "}
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                    {user.username}
                  </code>
                </Label>
                <Input
                  id={`confirm-input-${user.id}-${variant}`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={user.username}
                  className="mt-1.5 font-mono"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setConfirmText("");
                }}
                disabled={busy}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleHardDelete}
                disabled={busy || confirmText !== user.username}
                loading={busy}
              >
                <Trash2 className="w-4 h-4" />
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
