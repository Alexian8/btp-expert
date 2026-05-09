import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Receipt, Plus, Search, FileText, Calendar } from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useQuotesStore } from "@/stores/quotesStore";
import { useClientsStore } from "@/stores/clientsStore";
import { QUOTE_STATUS_META, QUOTE_STATUS_ORDER, type QuoteStatus } from "@btp/types";
import { formatEuros } from "../quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// QuotesPage — Liste des devis
// ═══════════════════════════════════════════════════════════════════════════

export function QuotesPage() {
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

  // Stats
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

  // Total accepté
  const totalAccepted = counts.accepte.total;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            Devis
          </h1>
          <p className="text-muted-foreground mt-1">
            {quotes.length} devis au total
            {totalAccepted > 0 && (
              <>
                {" · "}
                <span className="text-emerald-500 font-medium">
                  {formatEuros(totalAccepted)} HT acceptés
                </span>
              </>
            )}
          </p>
        </div>
        <Button onClick={() => navigate("/quotes/new")}>
          <Plus className="w-4 h-4" />
          Nouveau devis
        </Button>
      </div>

      {/* Stats par statut */}
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
                      className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
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
