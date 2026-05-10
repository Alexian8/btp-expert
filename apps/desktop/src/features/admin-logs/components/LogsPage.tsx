import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  RefreshCw,
  Search,
  Filter,
  Download,
  Pause,
  Play,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@btp/ui";

import { logsApi, type AuditLog, type LogUser } from "../api/logsApi";

// ═══════════════════════════════════════════════════════════════════════════
// LogsPage — Audit log temps réel (admin only)
//
// • Table paginée (50 par page, max 500 par requête)
// • Filtres : user, action, resource, search, plage de date
// • Auto-refresh toutes les 5s (toggleable)
// • Format human-readable des actions
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 50;
const REFRESH_MS = 5000;

// Lookup pour rendu lisible des actions
const ACTION_META: Record<string, { label: string; color: string; icon?: string }> = {
  login_ok: { label: "Connexion réussie", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  login_fail: { label: "Échec de connexion", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  login_blocked: { label: "Connexion bloquée", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  logout: { label: "Déconnexion", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  change_password: { label: "Mot de passe changé", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  bootstrap: { label: "Bootstrap admin", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  user_created: { label: "Utilisateur créé", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  user_updated: { label: "Utilisateur modifié", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  user_disabled: { label: "Utilisateur désactivé", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  user_enabled: { label: "Utilisateur réactivé", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  user_role_changed: { label: "Rôle modifié", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  user_password_reset: { label: "MdP régénéré", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  create: { label: "Création", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  update: { label: "Modification", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  delete: { label: "Suppression", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ms_connect: { label: "Microsoft connecté", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  ms_disconnect: { label: "Microsoft déconnecté", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  email_send: { label: "Email envoyé", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  backup_run: { label: "Backup exécuté", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

const RESOURCE_LABELS: Record<string, string> = {
  quotes: "Devis",
  invoices: "Factures",
  invoice_payments: "Paiements",
  clients: "Clients",
  suppliers: "Fournisseurs",
  chantiers: "Chantiers",
  expenses: "Dépenses",
  expense_notes: "Notes de frais",
  subcontractors: "Sous-traitants",
  agenda_events: "Agenda",
  users: "Utilisateurs",
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("fr-FR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function timeAgo(ts: string): string {
  const now = Date.now();
  const d = new Date(ts).getTime();
  const diff = Math.max(0, now - d);
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

function describeAction(log: AuditLog): string {
  const meta = (log.meta ?? {}) as Record<string, unknown>;
  switch (log.action) {
    case "login_ok":
      return `s'est connecté(e)`;
    case "login_fail":
      return `tentative de connexion échouée (${meta.reason ?? "?"})`;
    case "login_blocked":
      return `compte désactivé bloqué`;
    case "logout":
      return `s'est déconnecté(e)`;
    case "change_password":
      return `a changé son mot de passe`;
    case "user_created":
      return `a créé l'utilisateur ${meta.username ?? log.resourceId} (${meta.role ?? ""})`;
    case "user_disabled":
      return `a désactivé ${meta.username ?? log.resourceId}`;
    case "user_enabled":
      return `a réactivé ${meta.username ?? log.resourceId}`;
    case "user_role_changed":
      return `a changé le rôle de ${meta.username ?? log.resourceId} : ${meta.oldRole} → ${meta.newRole}`;
    case "user_password_reset":
      return `a régénéré le mot de passe de ${meta.username ?? log.resourceId}`;
    case "user_updated":
      return `a modifié ${meta.username ?? log.resourceId} (${(meta.changedFields as string[] | undefined)?.join(", ") ?? "?"})`;
    case "create": {
      const ref = (meta.reference as string | undefined) ?? (meta.title as string | undefined) ?? (meta.label as string | undefined) ?? log.resourceId;
      return `a créé ${RESOURCE_LABELS[log.resource] ?? log.resource} "${ref}"`;
    }
    case "update": {
      const fields = (meta.changedFields as string[] | undefined)?.join(", ") ?? "?";
      return `a modifié ${RESOURCE_LABELS[log.resource] ?? log.resource} #${log.resourceId} (${fields})`;
    }
    case "delete": {
      const snapshot = meta.snapshot as Record<string, unknown> | undefined;
      const ref = snapshot ? (snapshot.reference ?? snapshot.title ?? snapshot.label ?? snapshot.companyName) : log.resourceId;
      return `a supprimé ${RESOURCE_LABELS[log.resource] ?? log.resource} "${ref ?? log.resourceId}"`;
    }
    default:
      return log.action;
  }
}

export function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterResource, setFilterResource] = useState<string>("");
  const [filterUserId, setFilterUserId] = useState<string>("");

  // Lookup data
  const [actions, setActions] = useState<string[]>([]);
  const [users, setUsers] = useState<LogUser[]>([]);

  // Refs pour timer
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Charge la lookup data une fois
  useEffect(() => {
    void Promise.all([logsApi.actions(), logsApi.users()])
      .then(([a, u]) => {
        setActions(a);
        setUsers(u);
      })
      .catch(() => {
        /* silent */
      });
  }, []);

  // Debounce du search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page si les filtres changent
  useEffect(() => {
    setPage(0);
  }, [filterAction, filterResource, filterUserId, debouncedSearch]);

  const loadLogs = useCallback(async () => {
    setError(null);
    try {
      const r = await logsApi.list({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: filterAction || undefined,
        resource: filterResource || undefined,
        userId: filterUserId ? Number(filterUserId) : undefined,
        search: debouncedSearch || undefined,
        order: "desc",
      });
      setLogs(r.rows);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterResource, filterUserId, debouncedSearch]);

  // Initial + après filtre changement
  useEffect(() => {
    setLoading(true);
    void loadLogs();
  }, [loadLogs]);

  // Auto-refresh
  useEffect(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
    if (autoRefresh && page === 0) {
      // ne refresh que sur la 1ère page (les nouvelles entrées arrivent en haut)
      refreshTimer.current = setInterval(() => {
        void loadLogs();
      }, REFRESH_MS);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, page, loadLogs]);

  function clearFilters() {
    setSearch("");
    setFilterAction("");
    setFilterResource("");
    setFilterUserId("");
  }

  const hasFilters =
    Boolean(search) ||
    Boolean(filterAction) ||
    Boolean(filterResource) ||
    Boolean(filterUserId);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function exportCsv() {
    const header = ["timestamp", "user", "action", "resource", "resourceId", "ip", "details"];
    const rows = logs.map((l) => [
      l.timestamp,
      l.username,
      l.action,
      l.resource,
      l.resourceId,
      l.ip,
      JSON.stringify(l.meta ?? {}).replace(/"/g, '""'),
    ]);
    const csv = [
      header.join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Journal d'activité
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Audit log temps réel — toutes les actions des utilisateurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh((v) => !v)}
            title={autoRefresh ? "Pause l'auto-refresh" : "Reprendre l'auto-refresh"}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-4 h-4" />
                Live
                <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Pause
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => void loadLogs()} title="Rafraîchir">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
            <Download className="w-4 h-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_180px_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (user, ID ressource, IP)…"
              className="pl-10"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="">Toutes les actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_META[a]?.label ?? a}
              </option>
            ))}
          </select>

          <select
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="">Toutes les ressources</option>
            {Object.entries(RESOURCE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName || u.lastName
                  ? `${u.firstName} ${u.lastName}`.trim()
                  : u.username}
              </option>
            ))}
          </select>

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} title="Effacer les filtres">
              <X className="w-4 h-4" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[150px_180px_1fr_120px_60px] gap-3 px-4 py-2.5 bg-muted/40 text-xs font-medium text-muted-foreground border-b border-border">
          <div>Date</div>
          <div>Utilisateur</div>
          <div>Action</div>
          <div>IP</div>
          <div className="text-right">Détails</div>
        </div>
        {loading && logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Chargement…</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {hasFilters ? "Aucun résultat avec ces filtres" : "Aucune entrée"}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div>
            {total.toLocaleString("fr-FR")} entrée{total > 1 ? "s" : ""} ·{" "}
            Page {page + 1} / {pageCount}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[log.action] ?? {
    label: log.action,
    color: "bg-slate-500/10 text-slate-600",
  };
  const userLabel = log.username || "(anonyme)";
  const initials = userLabel[0]?.toUpperCase() ?? "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="grid grid-cols-[150px_180px_1fr_120px_60px] gap-3 px-4 py-3 items-start hover:bg-accent/40 transition-colors text-sm"
    >
      {/* Date */}
      <div className="text-xs">
        <div className="font-mono">{formatTime(log.timestamp)}</div>
        <div className="text-muted-foreground mt-0.5">{timeAgo(log.timestamp)}</div>
      </div>

      {/* User */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-medium shrink-0">
          {initials}
        </div>
        <span className="truncate text-xs">{userLabel}</span>
      </div>

      {/* Action description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 text-[10px] rounded font-medium",
              meta.color
            )}
          >
            {meta.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{describeAction(log)}</div>
      </div>

      {/* IP */}
      <div className="text-xs font-mono text-muted-foreground truncate" title={log.ip}>
        {log.ip || "—"}
      </div>

      {/* Detail toggle */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded((v) => !v)}
          title="Détails"
        >
          <Filter className="w-3.5 h-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="col-span-5 mt-2 p-3 rounded bg-muted/40 text-xs font-mono whitespace-pre-wrap break-all">
          <div>
            <span className="text-muted-foreground">Resource:</span> {log.resource} #
            {log.resourceId || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">User-Agent:</span> {log.userAgent || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Meta:</span>{" "}
            {log.meta ? JSON.stringify(log.meta, null, 2) : "—"}
          </div>
        </div>
      )}
    </motion.div>
  );
}
