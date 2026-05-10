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
  Mail,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@btp/ui";

import { CreateUserModal } from "./CreateUserModal";
import {
  usersAdminApi,
  type AdminUser,
  type Role,
} from "../api/usersAdminApi";

// ═══════════════════════════════════════════════════════════════════════════
// UsersAdminPage — Panel admin de gestion des utilisateurs
//
// Accessible uniquement aux users de rôle "admin" (gardé côté serveur).
// Le menu de navigation devra cacher cette page pour les autres rôles.
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

export function UsersAdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={Users} />
        <StatCard label="Actifs" value={stats.actifs} icon={Power} accent="emerald" />
        <StatCard label="Administrateurs" value={stats.admins} icon={ShieldCheck} accent="rose" />
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, email, identifiant)…"
          className="pl-10"
        />
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
          {search ? "Aucun résultat" : "Aucun utilisateur"}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_140px_140px_120px] gap-2 px-4 py-2.5 bg-muted/40 text-xs font-medium text-muted-foreground border-b border-border">
            <div>Utilisateur</div>
            <div>Rôle</div>
            <div>Dernière connexion</div>
            <div>Statut</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((u) => (
              <UserRow key={u.id} user={u} onChanged={loadUsers} />
            ))}
          </div>
        </div>
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
  accent?: "emerald" | "rose";
}) {
  const accentClass =
    accent === "emerald"
      ? "bg-emerald-500/10 text-emerald-600"
      : accent === "rose"
        ? "bg-rose-500/10 text-rose-600"
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

function UserRow({
  user,
  onChanged,
}: {
  user: AdminUser;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleReset() {
    if (busy) return;
    if (!confirm(`Régénérer un mot de passe temporaire pour ${user.username} ?`)) return;
    setBusy(true);
    try {
      const r = await usersAdminApi.resetPassword(user.id);
      setResetPassword(r.tempPassword);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleDisabled() {
    if (busy) return;
    const verb = user.disabled ? "Réactiver" : "Désactiver";
    if (!confirm(`${verb} le compte ${user.username} ?`)) return;
    setBusy(true);
    try {
      if (user.disabled) {
        await usersAdminApi.update(user.id, { disabled: false });
        toast.success("Compte réactivé");
      } else {
        await usersAdminApi.disable(user.id);
        toast.success("Compte désactivé");
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

  async function copyResetPwd() {
    if (!resetPassword) return;
    try {
      await navigator.clipboard.writeText(resetPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  const meta = ROLE_META[user.role] ?? ROLE_META.viewer;
  const initials = (user.firstName?.[0] ?? user.username[0] ?? "?").toUpperCase();

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[1fr_140px_140px_140px_120px] gap-2 px-4 py-3 items-center",
          user.disabled && "opacity-50",
          busy && "pointer-events-none"
        )}
      >
        {/* Identité */}
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

        {/* Rôle (select inline) */}
        <select
          value={user.role}
          onChange={(e) => handleRoleChange(e.target.value as Role)}
          className={cn(
            "px-2 py-1 text-xs rounded border font-medium",
            meta.color
          )}
        >
          {(Object.keys(ROLE_META) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_META[r].label}
            </option>
          ))}
        </select>

        {/* Last login */}
        <div className="text-xs text-muted-foreground">
          {formatDate(user.lastLoginAt)}
        </div>

        {/* Statut */}
        <div>
          {user.disabled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
              <PowerOff className="w-3 h-3" />
              Désactivé
            </span>
          ) : user.mustChangePassword ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <KeyRound className="w-3 h-3" />
              MdP à changer
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Power className="w-3 h-3" />
              Actif
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="icon"
            title="Régénérer mot de passe"
            onClick={handleReset}
            disabled={busy || user.disabled}
          >
            <KeyRound className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title={user.disabled ? "Réactiver" : "Désactiver"}
            onClick={handleToggleDisabled}
            disabled={busy}
          >
            {user.disabled ? (
              <Power className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <PowerOff className="w-3.5 h-3.5 text-destructive" />
            )}
          </Button>
        </div>
      </div>

      {/* Modal de display du nouveau temp password */}
      {resetPassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-soft-xl max-w-md w-full p-5">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Mot de passe régénéré
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Pour <strong>{user.username}</strong>. Transmets-le par un canal sécurisé,
              il sera obligé de le changer à sa prochaine connexion.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm break-all">
                {resetPassword}
              </code>
              <Button variant="outline" size="icon" onClick={copyResetPwd}>
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setResetPassword(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
