import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Search, X,
  Users, Hammer, Receipt, FileText, ClipboardCheck,
  CreditCard, Lock, Calendar, Activity, FileSignature,
  Building, Plus, ArrowRight,
} from "lucide-react";

import { cn } from "@btp/ui";
import { useClientsStore } from "@/stores/clientsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useInvoicesStore } from "@/stores/invoicesStore";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";
import { useSuppliersStore } from "@/stores/suppliersStore";
import { usePurchaseOrdersStore } from "@/stores/purchaseOrdersStore";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";

// ═══════════════════════════════════════════════════════════════════════════
// CommandPalette — Cmd+K / Ctrl+K (Session 19)
// Recherche fuzzy partout : clients, chantiers, devis, factures, BdC,
// PV, attestations TVA, DC4, sous-traitants, fournisseurs
// + actions rapides ("Nouveau devis", etc.)
// ═══════════════════════════════════════════════════════════════════════════

type ResultType =
  | "client" | "chantier" | "quote" | "invoice"
  | "subcontractor" | "supplier" | "purchase-order"
  | "reception" | "tva" | "dc4"
  | "navigate" | "action";

interface PaletteResult {
  type: ResultType;
  id: string;            // unique pour key React
  label: string;         // texte principal
  sublabel?: string;     // texte secondaire (référence, infos)
  icon: any;
  to: string;            // chemin de navigation
  iconColor: string;     // tailwind classes
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { clients, fetch: fetchClients } = useClientsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();
  const { quotes, fetch: fetchQuotes } = useQuotesStore();
  const { invoices, fetch: fetchInvoices } = useInvoicesStore();
  const { subcontractors, fetch: fetchST } = useSubcontractorsStore();
  const { suppliers, fetch: fetchSuppliers } = useSuppliersStore();
  const { purchaseOrders, fetchPos } = usePurchaseOrdersStore();
  const { receptions, tvaAttestations, dc4Declarations,
    fetchReceptions, fetchTvaAttestations, fetchDc4 } = useAdministrativeDocsStore();

  // Charger toutes les données au premier ouverture
  useEffect(() => {
    if (!open) return;
    fetchClients();
    fetchChantiers();
    fetchQuotes();
    fetchInvoices();
    fetchST();
    fetchSuppliers();
    fetchPos();
    fetchReceptions();
    fetchTvaAttestations();
    fetchDc4();
    setQuery("");
    setSelectedIdx(0);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ─── Construction des résultats ─────────────────────────────────────────
  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim().toLowerCase();
    const all: PaletteResult[] = [];

    // ─── Actions rapides (toujours visibles si query vide ou correspond) ──
    const quickActions: PaletteResult[] = [
      {
        type: "action", id: "act:quote", label: "Nouveau devis", sublabel: "Créer un nouveau devis",
        icon: Plus, to: "/quotes/new", iconColor: "bg-violet-500/15 text-violet-500",
      },
      {
        type: "action", id: "act:invoice", label: "Nouvelle facture", sublabel: "Créer une facture",
        icon: Plus, to: "/invoices/new", iconColor: "bg-emerald-500/15 text-emerald-500",
      },
    ];

    // ─── Pages ────────────────────────────────────────────────────────────
    const navigationItems: PaletteResult[] = [
      { type: "navigate", id: "nav:dashboard", label: "Tableau de bord", icon: Activity, to: "/", iconColor: "bg-primary/15 text-primary" },
      { type: "navigate", id: "nav:clients", label: "Clients", icon: Users, to: "/clients", iconColor: "bg-violet-500/15 text-violet-500" },
      { type: "navigate", id: "nav:chantiers", label: "Chantiers", icon: Hammer, to: "/chantiers", iconColor: "bg-blue-500/15 text-blue-500" },
      { type: "navigate", id: "nav:quotes", label: "Devis", icon: Receipt, to: "/quotes", iconColor: "bg-violet-500/15 text-violet-500" },
      { type: "navigate", id: "nav:invoices", label: "Factures", icon: CreditCard, to: "/invoices", iconColor: "bg-emerald-500/15 text-emerald-500" },
      { type: "navigate", id: "nav:po", label: "Bons de commande", icon: FileText, to: "/purchase-orders", iconColor: "bg-amber-500/15 text-amber-500" },
      { type: "navigate", id: "nav:st", label: "Sous-traitants", icon: Hammer, to: "/subcontractors", iconColor: "bg-orange-500/15 text-orange-500" },
      { type: "navigate", id: "nav:suppliers", label: "Fournisseurs", icon: Building, to: "/suppliers", iconColor: "bg-rose-500/15 text-rose-500" },
      { type: "navigate", id: "nav:expenses", label: "Notes de frais", icon: CreditCard, to: "/expense-notes", iconColor: "bg-blue-500/15 text-blue-500" },
      { type: "navigate", id: "nav:agenda", label: "Agenda", icon: Calendar, to: "/agenda", iconColor: "bg-blue-500/15 text-blue-500" },
      { type: "navigate", id: "nav:finances", label: "Finances", icon: Activity, to: "/finances", iconColor: "bg-emerald-500/15 text-emerald-500" },
      { type: "navigate", id: "nav:stats", label: "Statistiques", icon: Activity, to: "/statistics", iconColor: "bg-violet-500/15 text-violet-500" },
      { type: "navigate", id: "nav:admin", label: "Documents administratifs", icon: FileSignature, to: "/admin-docs", iconColor: "bg-violet-500/15 text-violet-500" },
      { type: "navigate", id: "nav:vault", label: "Coffre-fort", icon: Lock, to: "/vault", iconColor: "bg-rose-500/15 text-rose-500" },
    ];

    // ─── Données ────────────────────────────────────────────────────────
    // Clients
    for (const c of clients) {
      const name = c.type === "particulier"
        ? `${c.firstName || ""} ${c.lastName || ""}`.trim()
        : c.companyName;
      all.push({
        type: "client", id: `cli:${c.id}`,
        label: name || "Client sans nom",
        sublabel: c.type === "pro" ? "Pro" : "Particulier",
        icon: Users, to: `/clients`, iconColor: "bg-violet-500/15 text-violet-500",
      });
    }

    // Chantiers
    for (const c of chantiers) {
      all.push({
        type: "chantier", id: `cha:${c.id}`,
        label: c.title || c.reference,
        sublabel: c.reference + (c.city ? " · " + c.city : ""),
        icon: Hammer, to: `/chantiers`, iconColor: "bg-blue-500/15 text-blue-500",
      });
    }

    // Devis
    for (const qq of quotes) {
      all.push({
        type: "quote", id: `quo:${qq.id}`,
        label: qq.reference,
        sublabel: qq.title || (qq.status === "brouillon" ? "Brouillon" : qq.status === "envoye" ? "Envoyé" : qq.status === "accepte" ? "Accepté" : "Refusé"),
        icon: Receipt, to: `/quotes/${qq.id}`, iconColor: "bg-violet-500/15 text-violet-500",
      });
    }

    // Factures
    for (const i of invoices) {
      all.push({
        type: "invoice", id: `inv:${i.id}`,
        label: i.reference,
        sublabel: i.title || `Facture · ${i.status}`,
        icon: CreditCard, to: `/invoices/${i.id}`, iconColor: "bg-emerald-500/15 text-emerald-500",
      });
    }

    // BdC
    for (const po of purchaseOrders) {
      all.push({
        type: "purchase-order", id: `po:${po.id}`,
        label: po.reference,
        sublabel: po.title || po.subcontractorName,
        icon: FileText, to: `/purchase-orders/${po.id}`, iconColor: "bg-amber-500/15 text-amber-500",
      });
    }

    // Sous-traitants
    for (const s of subcontractors) {
      all.push({
        type: "subcontractor", id: `st:${s.id}`,
        label: s.companyName,
        sublabel: "Sous-traitant" + (s.contactFirstName ? ` · ${s.contactFirstName} ${s.contactLastName || ""}`.trim() : ""),
        icon: Hammer, to: `/subcontractors`, iconColor: "bg-orange-500/15 text-orange-500",
      });
    }

    // Fournisseurs
    for (const s of suppliers) {
      all.push({
        type: "supplier", id: `sup:${s.id}`,
        label: s.companyName,
        sublabel: "Fournisseur",
        icon: Building, to: `/suppliers`, iconColor: "bg-rose-500/15 text-rose-500",
      });
    }

    // PV de réception
    for (const r of receptions) {
      all.push({
        type: "reception", id: `rcp:${r.id}`,
        label: r.reference,
        sublabel: `PV · ${r.clientName || ""}`,
        icon: ClipboardCheck, to: `/admin-docs`, iconColor: "bg-emerald-500/15 text-emerald-500",
      });
    }

    // Attestations TVA
    for (const a of tvaAttestations) {
      all.push({
        type: "tva", id: `tva:${a.id}`,
        label: a.reference,
        sublabel: `TVA ${String(a.tvaRate).replace(".", ",")}% · ${a.clientName || ""}`,
        icon: Receipt, to: `/admin-docs`, iconColor: "bg-blue-500/15 text-blue-500",
      });
    }

    // DC4
    for (const d of dc4Declarations) {
      all.push({
        type: "dc4", id: `dc4:${d.id}`,
        label: d.reference,
        sublabel: `DC4 · ${d.subcontractorName || ""}`,
        icon: FileText, to: `/admin-docs`, iconColor: "bg-blue-500/15 text-blue-500",
      });
    }

    // ─── Filtrer ─────────────────────────────────────────────────────────
    if (!q) {
      // Vue par défaut : actions + nav + 5 derniers items pertinents
      return [
        ...quickActions,
        ...navigationItems.slice(0, 8), // les pages principales
      ];
    }

    // Recherche fuzzy
    const matchScore = (item: PaletteResult): number => {
      const haystack = `${item.label} ${item.sublabel || ""}`.toLowerCase();
      if (haystack.startsWith(q)) return 3;       // début exact
      if (haystack.includes(" " + q)) return 2;   // début de mot
      if (haystack.includes(q)) return 1;         // n'importe où
      return 0;
    };

    const allCandidates = [...quickActions, ...navigationItems, ...all];
    const filtered = allCandidates
      .map((item) => ({ item, score: matchScore(item) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item)
      .slice(0, 25);

    return filtered;
  }, [query, clients, chantiers, quotes, invoices, purchaseOrders,
      subcontractors, suppliers, receptions, tvaAttestations, dc4Declarations]);

  // ─── Navigation clavier ─────────────────────────────────────────────────
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const result = results[selectedIdx];
        if (result) {
          navigate(result.to);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selectedIdx, navigate, onClose]);

  // Scroll auto vers l'élément sélectionné
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`palette-result-${selectedIdx}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center p-4 pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-2xl w-full max-h-[70vh] flex flex-col overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 p-3 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher partout : clients, devis, factures, chantiers..."
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground/60"
              />
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground/60 px-1.5 py-0.5 rounded border border-border hover:bg-accent flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Esc
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {results.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Aucun résultat pour <strong>"{query}"</strong>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {results.map((result, idx) => (
                    <ResultRow
                      key={result.id}
                      result={result}
                      selected={idx === selectedIdx}
                      idx={idx}
                      onClick={() => {
                        navigate(result.to);
                        onClose();
                      }}
                      onHover={() => setSelectedIdx(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono">↑↓</kbd>
                  Naviguer
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono">↵</kbd>
                  Ouvrir
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono">Esc</kbd>
                  Fermer
                </span>
              </div>
              <span>{results.length} résultat{results.length !== 1 ? "s" : ""}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Sub-component ─────────────────────────────────────────────────────────
function ResultRow({ result, selected, idx, onClick, onHover }: {
  result: PaletteResult;
  selected: boolean;
  idx: number;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <button
      id={`palette-result-${idx}`}
      onClick={onClick}
      onMouseMove={onHover}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors",
        selected ? "bg-accent" : "hover:bg-accent/50"
      )}
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", result.iconColor)}>
        <result.icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{result.label}</p>
        {result.sublabel && (
          <p className="text-xs text-muted-foreground truncate">{result.sublabel}</p>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted shrink-0 hidden sm:block">
        {getTypeLabel(result.type)}
      </span>
      {selected && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
    </button>
  );
}

function getTypeLabel(type: ResultType): string {
  const labels: Record<ResultType, string> = {
    client: "Client",
    chantier: "Chantier",
    quote: "Devis",
    invoice: "Facture",
    "purchase-order": "BdC",
    subcontractor: "Sous-traitant",
    supplier: "Fournisseur",
    reception: "PV",
    tva: "TVA",
    dc4: "DC4",
    navigate: "Page",
    action: "Action",
  };
  return labels[type];
}
