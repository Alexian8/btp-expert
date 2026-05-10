import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Receipt, Plus, Search, FileText, MoreHorizontal, Trash2, Copy, Hammer } from "lucide-react";
import { toast } from "sonner";

import { ConvertQuoteToPoModal } from "./ConvertQuoteToPoModal";
import { ConvertToInvoiceModal } from "@/features/invoices/components/ConvertToInvoiceModal";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useQuotesStore } from "@/stores/quotesStore";
import { useClientsStore } from "@/stores/clientsStore";
import { QUOTE_STATUS_META, QUOTE_STATUS_ORDER, type QuoteStatus } from "@btp/types";
import { formatEuros } from "../quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// QuotesListView — Vue liste des devis (intégrée dans QuotesAndInvoicesPage)
// ═══════════════════════════════════════════════════════════════════════════

export function QuotesListView() {
  const navigate = useNavigate();
  const { quotes, fetch } = useQuotesStore();
  const { fetch: fetchClients, getById: getClient } = useClientsStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | QuoteStatus>("all");

  useEffect(() => {
    fetch();
    fetchClients();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (filterStatus !== "all" && quote.status !== filterStatus) return false;
      if (q) {
        const client = getClient(quote.clientId);
        const clientName = client
          ? (client.type === "pro" && client.companyName
            ? client.companyName
            : `${client.firstName} ${client.lastName}`.trim())
          : "";
        const hay = `${quote.reference} ${quote.title} ${clientName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [quotes, search, filterStatus, getClient]);

  const counts = useMemo(() => {
    const c: Record<QuoteStatus, { count: number; total: number }> = {
      brouillon: { count: 0, total: 0 },
      envoye:    { count: 0, total: 0 },
      accepte:   { count: 0, total: 0 },
      refuse:    { count: 0, total: 0 },
    };
    for (const q of quotes) {
      c[q.status].count++;
      c[q.status].total += q.totalHT || 0;
    }
    return c;
  }, [quotes]);

  const totalAccepted = counts.accepte.total;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {quotes.length} devis
            {totalAccepted > 0 && (
              <span className="text-sm text-emerald-500 font-medium ml-2">
                · {formatEuros(totalAccepted)} HT acceptés
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Éditer, envoyer et convertir vos devis en factures
          </p>
        </div>
        <Button onClick={() => navigate("/quotes/new")}>
          <Plus className="w-4 h-4" />
          Nouveau devis
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {QUOTE_STATUS_ORDER.map((s) => {
          const meta = QUOTE_STATUS_META[s];
          const c = counts[s];
          return (
            <div key={s} className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{meta.label}</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">{c.count}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                {formatEuros(c.total, 0)} HT
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
          className="w-auto min-w-[140px]"
        >
          <option value="all">Tous statuts</option>
          {QUOTE_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{QUOTE_STATUS_META[s].label}</option>
          ))}
        </NativeSelect>
      </div>

      {/* Liste */}
      {quotes.length === 0 ? (
        <EmptyState onNew={() => navigate("/quotes/new")} />
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border rounded-lg">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucun devis ne correspond aux filtres</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Réf.</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Titre</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Client</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Statut</th>
                  <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Émis le</th>
                  <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Total HT</th>
                  <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Total TTC</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, idx) => {
                  const meta = QUOTE_STATUS_META[q.status];
                  const client = getClient(q.clientId);
                  const clientName = client
                    ? (client.type === "pro" && client.companyName
                      ? client.companyName
                      : `${client.firstName} ${client.lastName}`.trim() || "—")
                    : "—";
                  return (
                    <motion.tr
                      key={q.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                      onClick={() => navigate(`/quotes/${q.id}`)}
                      className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{q.reference}</td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <p className="font-medium truncate">{q.title || "Sans titre"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{clientName}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded",
                          meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                          meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                          meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                          meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                        )}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(q.issueDate)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatEuros(q.totalHT, 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatEuros(q.totalTTC, 0)}</td>
                      <td className="px-2 py-3 text-right">
                        <RowMenu quoteId={q.id} reference={q.reference} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
      <h3 className="text-base font-semibold mb-1">Aucun devis pour l'instant</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        Créez votre premier devis pour commencer à facturer vos chantiers.
      </p>
      <Button onClick={onNew}>
        <Plus className="w-4 h-4" />
        Créer mon premier devis
      </Button>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return iso; }
}

// ─── RowMenu : menu d'actions ⋯ pour chaque ligne (Session 20) ─────────────
function RowMenu({ quoteId, reference }: { quoteId: string; reference: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertInvoiceOpen, setConvertInvoiceOpen] = useState(false);
  const removeQuote = useQuotesStore((s) => s.delete);
  const fetchQuotes = useQuotesStore((s) => s.fetch);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    const r = await removeQuote(quoteId);
    if (r.success) {
      toast.success(`Devis ${reference} supprimé`);
      await fetchQuotes();
    } else {
      toast.error(r.error || "Erreur lors de la suppression");
    }
    setOpen(false);
    setConfirming(false);
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    const r = await window.btpAPI.quotesDuplicate(quoteId);
    if (r.success && r.id) {
      toast.success(`Devis dupliqué (${r.reference})`);
      await fetchQuotes();
      setOpen(false);
      navigate(`/quotes/${r.id}`);
    } else {
      toast.error(r.error || "Erreur lors de la duplication");
    }
  };

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
        title="Actions"
      >
        <MoreHorizontal className="w-4 h-4" strokeWidth={2.5} />
      </button>

      {open && (
        <>
          {/* Click-outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setOpen(false); setConfirming(false); }}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-soft-lg py-1 min-w-[200px]">
            <button
              onClick={handleDuplicate}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-accent"
            >
              <Copy className="w-3.5 h-3.5" />
              Dupliquer
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); setConvertInvoiceOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-accent"
            >
              <Receipt className="w-3.5 h-3.5" />
              Convertir en facture
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); setConvertOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-accent"
            >
              <Hammer className="w-3.5 h-3.5" />
              Convertir en BdC sous-traitant
            </button>
            <div className="my-1 border-t border-border" />
            <button
              onClick={handleDelete}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                confirming
                  ? "bg-red-500/10 text-red-600 hover:bg-red-500/15"
                  : "hover:bg-accent text-destructive"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirming ? "Confirmer la suppression ?" : "Supprimer"}
            </button>
          </div>
        </>
      )}

      <ConvertQuoteToPoModal
        open={convertOpen}
        quoteId={quoteId}
        quoteReference={reference}
        onClose={() => setConvertOpen(false)}
      />
      <ConvertToInvoiceModalWrapper
        open={convertInvoiceOpen}
        quoteId={quoteId}
        onClose={() => setConvertInvoiceOpen(false)}
      />
    </div>
  );
}

// Wrapper pour ConvertToInvoiceModal (charge le devis en async)
function ConvertToInvoiceModalWrapper({ open, quoteId, onClose }: {
  open: boolean;
  quoteId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<any>(null);

  useEffect(() => {
    if (!open || !quoteId) {
      setQuote(null);
      return;
    }
    if (!window.btpAPI?.quotesGet) return;
    window.btpAPI.quotesGet(quoteId).then((q) => setQuote(q));
  }, [open, quoteId]);

  if (!open || !quote) return null;
  return (
    <ConvertToInvoiceModal
      quote={quote}
      open={open}
      onClose={onClose}
      onSuccess={(invoiceId) => {
        onClose();
        navigate(`/invoices/${invoiceId}`);
      }}
    />
  );
}
