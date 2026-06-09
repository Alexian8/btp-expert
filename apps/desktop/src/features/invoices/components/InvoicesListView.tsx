import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Receipt, Plus, Search, FileText, AlertCircle, MoreHorizontal, Trash2, Copy, Download } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { UserBadge } from "@/components/UserBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInvoicesStore } from "@/stores/invoicesStore";
import { useClientsStore } from "@/stores/clientsStore";
import {
  INVOICE_STATUS_META,
  INVOICE_STATUS_ORDER,
  INVOICE_TYPE_META,
  type InvoiceStatus,
} from "@btp/types";
import { formatEuros } from "@/features/quotes/quoteEngine";
import { isInvoiceOverdue, daysOverdue, formatDateFR } from "../invoiceEngine";
import { downloadCsv } from "@/lib/exportCsv";

// ═══════════════════════════════════════════════════════════════════════════
// InvoicesListView — Vue liste des factures (intégrée dans QuotesAndInvoicesPage)
// ═══════════════════════════════════════════════════════════════════════════

export function InvoicesListView() {
  const navigate = useNavigate();
  const { invoices, fetch } = useInvoicesStore();
  const { fetch: fetchClients, getById: getClient } = useClientsStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | InvoiceStatus | "overdue">("all");

  useEffect(() => {
    fetch();
    fetchClients();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filterStatus === "overdue") {
        if (!isInvoiceOverdue(inv)) return false;
      } else if (filterStatus !== "all" && inv.status !== filterStatus) {
        return false;
      }
      if (q) {
        const client = getClient(inv.clientId);
        const clientName = client
          ? (client.type === "pro" && client.companyName
            ? client.companyName
            : `${client.firstName} ${client.lastName}`.trim())
          : "";
        const hay = `${inv.reference} ${inv.title} ${clientName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, search, filterStatus, getClient]);

  const stats = useMemo(() => {
    let totalUnpaid = 0;
    let countUnpaid = 0;
    let countOverdue = 0;
    let totalOverdue = 0;
    const byStatus: Record<InvoiceStatus, { count: number; total: number }> = {
      brouillon: { count: 0, total: 0 },
      envoyee:   { count: 0, total: 0 },
      "partiellement-payee": { count: 0, total: 0 },
      payee:     { count: 0, total: 0 },
      annulee:   { count: 0, total: 0 },
    };
    for (const inv of invoices) {
      byStatus[inv.status].count++;
      byStatus[inv.status].total += inv.totalTTC || 0;
      if (inv.status === "envoyee" || inv.status === "partiellement-payee") {
        const remaining = (inv.totalTTC || 0) - (inv.totalPaid || 0);
        totalUnpaid += remaining;
        countUnpaid++;
        if (isInvoiceOverdue(inv)) {
          countOverdue++;
          totalOverdue += remaining;
        }
      }
    }
    return { byStatus, totalUnpaid, countUnpaid, countOverdue, totalOverdue };
  }, [invoices]);

  const handleExportCsv = () => {
    downloadCsv(
      "factures",
      ["Référence", "Type", "Titre", "Client", "Statut", "Émise le", "Échéance", "Retard (j)", "Total HT", "Total TTC", "Payé", "Reste dû"],
      filtered.map((inv) => {
        const client = getClient(inv.clientId);
        const clientName = client
          ? (client.type === "pro" && client.companyName
            ? client.companyName
            : `${client.firstName} ${client.lastName}`.trim())
          : "";
        const remaining = (inv.totalTTC || 0) - (inv.totalPaid || 0);
        return [
          inv.reference,
          INVOICE_TYPE_META[inv.type].label,
          inv.title || "",
          clientName,
          INVOICE_STATUS_META[inv.status].label,
          inv.issueDate || "",
          inv.dueDate || "",
          isInvoiceOverdue(inv) ? daysOverdue(inv) : "",
          (inv.totalHT || 0).toFixed(2),
          (inv.totalTTC || 0).toFixed(2),
          (inv.totalPaid || 0).toFixed(2),
          remaining.toFixed(2),
        ];
      })
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {invoices.length} facture{invoices.length !== 1 ? "s" : ""}
            {stats.totalUnpaid > 0 && (
              <span className="text-sm text-amber-500 font-medium ml-2">
                · {formatEuros(stats.totalUnpaid)} à encaisser
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Suivre vos encaissements et relancer les retards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button onClick={() => navigate("/invoices/new")}>
            <Plus className="w-4 h-4" />
            Nouvelle facture
          </Button>
        </div>
      </div>

      {/* Alerte retards */}
      {stats.countOverdue > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 mb-4"
        >
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
              {stats.countOverdue} facture{stats.countOverdue > 1 ? "s en retard" : " en retard"} de paiement
            </p>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/80">
              {formatEuros(stats.totalOverdue)} impayés — pensez à relancer
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilterStatus("overdue")}>
            Voir les retards
          </Button>
        </motion.div>
      )}

      {/* Stats par statut */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {INVOICE_STATUS_ORDER.map((s) => {
          if (s === "annulee") return null;
          const meta = INVOICE_STATUS_META[s];
          const c = stats.byStatus[s];
          return (
            <div key={s} className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{meta.label}</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">{c.count}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                {formatEuros(c.total, 0)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (référence, titre, client...)"
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="w-auto min-w-[160px]"
        >
          <option value="all">Tous statuts</option>
          <option value="overdue">⚠ En retard</option>
          {INVOICE_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{INVOICE_STATUS_META[s].label}</option>
          ))}
        </NativeSelect>
      </div>

      {/* Liste */}
      {invoices.length === 0 ? (
        <EmptyState onNew={() => navigate("/invoices/new")} />
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border rounded-lg">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucune facture ne correspond aux filtres</p>
        </div>
      ) : (
        <>
          {/* ─── Cartes mobile (< md) ──────────────────────────────────── */}
          <div className="md:hidden space-y-2">
            {filtered.map((inv, idx) => {
              const meta = INVOICE_STATUS_META[inv.status];
              const typeMeta = INVOICE_TYPE_META[inv.type];
              const client = getClient(inv.clientId);
              const clientName = client
                ? client.type === "pro" && client.companyName
                  ? client.companyName
                  : `${client.firstName} ${client.lastName}`.trim() || "—"
                : "—";
              const remaining = (inv.totalTTC || 0) - (inv.totalPaid || 0);
              const overdue = isInvoiceOverdue(inv);
              const daysLate = daysOverdue(inv);
              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className="bg-card border border-border rounded-lg p-3 active:bg-accent/40 cursor-pointer flex items-start gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {inv.reference}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] uppercase font-semibold px-1 py-0.5 rounded",
                          inv.type === "standard" && "bg-slate-500/15 text-slate-500",
                          inv.type === "acompte" && "bg-amber-500/15 text-amber-500",
                          inv.type === "avoir" && "bg-rose-500/15 text-rose-500"
                        )}
                      >
                        {typeMeta.shortLabel}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded",
                          meta.color === "slate" && "bg-slate-500/15 text-slate-500",
                          meta.color === "blue" && "bg-blue-500/15 text-blue-500",
                          meta.color === "amber" && "bg-amber-500/15 text-amber-500",
                          meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                          meta.color === "rose" && "bg-rose-500/15 text-rose-500"
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="font-medium text-sm leading-tight truncate">
                      {inv.title || "Sans titre"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {clientName}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span
                        className={cn(
                          "text-muted-foreground",
                          overdue && "text-rose-500 font-medium"
                        )}
                      >
                        {inv.dueDate ? (
                          overdue ? `Retard +${daysLate}j` : `Échéance ${formatDateFR(inv.dueDate)}`
                        ) : "—"}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {inv.status === "payee" ? (
                          <span className="text-emerald-500">✓ {formatEuros(inv.totalTTC, 0)}</span>
                        ) : (
                          <>
                            {formatEuros(inv.totalTTC, 0)}
                            {remaining > 0 && remaining < inv.totalTTC && (
                              <span className="text-primary ml-1.5">
                                (reste {formatEuros(remaining, 0)})
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <InvoiceRowMenu invoiceId={inv.id} reference={inv.reference} />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ─── Tableau desktop (≥ md) ────────────────────────────────── */}
          <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Réf.</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Titre</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Client</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Statut</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Échéance</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Créé par</th>
                  <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">TTC</th>
                  <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Reste dû</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, idx) => {
                  const meta = INVOICE_STATUS_META[inv.status];
                  const typeMeta = INVOICE_TYPE_META[inv.type];
                  const client = getClient(inv.clientId);
                  const clientName = client
                    ? (client.type === "pro" && client.companyName
                      ? client.companyName
                      : `${client.firstName} ${client.lastName}`.trim() || "—")
                    : "—";
                  const remaining = (inv.totalTTC || 0) - (inv.totalPaid || 0);
                  const overdue = isInvoiceOverdue(inv);
                  const daysLate = daysOverdue(inv);
                  return (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.reference}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded",
                          inv.type === "standard" && "bg-slate-500/15 text-slate-500",
                          inv.type === "acompte"  && "bg-amber-500/15 text-amber-500",
                          inv.type === "avoir"    && "bg-rose-500/15 text-rose-500",
                        )}>
                          {typeMeta.shortLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <p className="font-medium truncate">{inv.title || "Sans titre"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{clientName}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded",
                          meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                          meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                          meta.color === "amber"   && "bg-amber-500/15 text-amber-500",
                          meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                          meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                        )}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.dueDate ? (
                          <div>
                            <p className={cn("text-xs", overdue && "text-rose-500 font-medium")}>
                              {formatDateFR(inv.dueDate)}
                            </p>
                            {overdue && (
                              <p className="text-[10px] text-rose-500">+{daysLate}j de retard</p>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <UserBadge userId={(inv as { createdBy?: number | string }).createdBy} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatEuros(inv.totalTTC, 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {inv.status === "payee" ? (
                          <span className="text-emerald-500 text-xs font-medium">✓ Payée</span>
                        ) : (
                          <span className={cn("font-medium", remaining > 0 && "text-primary")}>
                            {formatEuros(remaining, 0)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <InvoiceRowMenu invoiceId={inv.id} reference={inv.reference} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="p-16 text-center bg-card border border-dashed border-border rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Receipt className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Aucune facture pour l'instant</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        Créez une nouvelle facture ou convertissez un de vos devis en facture.
      </p>
      <Button onClick={onNew}>
        <Plus className="w-4 h-4" />
        Créer une facture
      </Button>
    </div>
  );
}

// ─── InvoiceRowMenu : menu d'actions ⋯ pour chaque ligne (Session 20) ──────
function InvoiceRowMenu({ invoiceId, reference }: { invoiceId: string; reference: string }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeInvoice = useInvoicesStore((s) => s.delete);
  const fetchInvoices = useInvoicesStore((s) => s.fetch);

  const handleDelete = async () => {
    const r = await removeInvoice(invoiceId);
    if (r.success) {
      toast.success(`Facture ${reference} supprimée`);
      await fetchInvoices();
    } else {
      toast.error(r.error || "Erreur lors de la suppression");
    }
    setConfirmDelete(false);
  };

  const handleDuplicate = async () => {
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    const r = await window.btpAPI.invoicesDuplicate(invoiceId);
    if (r.success && r.id) {
      toast.success(`Facture dupliquée (${r.reference})`);
      await fetchInvoices();
      navigate(`/invoices/${r.id}`);
    } else {
      toast.error(r.error || "Erreur lors de la duplication");
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-2 rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
            title="Actions"
          >
            <MoreHorizontal className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="w-4 h-4" />
            <span>Dupliquer</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Supprimer cette facture ?"
        description={<span>La facture <strong>{reference}</strong> sera définitivement supprimée. Cette action est irréversible.</span>}
        destructive
        confirmLabel="Supprimer"
      />
    </div>
  );
}
