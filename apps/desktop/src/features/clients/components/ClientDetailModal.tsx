import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Building2, User as UserIcon, MapPin, Pencil, Receipt, FileText,
  ChevronDown, FolderOpen, Navigation, Tag as TagIcon, HardHat,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useInvoicesStore } from "@/stores/invoicesStore";
import { useClientTagsStore } from "@/stores/clientTagsStore";
import {
  CHANTIER_STATUS_META, QUOTE_STATUS_META, INVOICE_STATUS_META,
  type Client, type Chantier, type Quote, type Invoice,
} from "@btp/types";
import { formatEuros } from "@/features/quotes/quoteEngine";
import {
  clientDisplayName, clientInitials, avatarColorClass, tagChipClass,
  googleMapsUrl, hasAddress,
} from "@/lib/clientHelpers";
import { telHref, smsHref } from "@/lib/phoneFormat";

// ═══════════════════════════════════════════════════════════════════════════
// ClientDetailModal — fiche client : contact (appel/mail/SMS/Maps), étiquettes,
// et données COMPARTIMENTÉES par dossier de chantier (accordéons), chaque bloc
// regroupant les devis + factures qui lui sont propres.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  client: Client | null;
  onClose: () => void;
  onEdit: () => void;
}

function statusColorClass(color: string): string {
  switch (color) {
    case "emerald": return "bg-emerald-500/15 text-emerald-400";
    case "blue": return "bg-blue-500/15 text-blue-400";
    case "amber": return "bg-amber-500/15 text-amber-400";
    case "rose": return "bg-rose-500/15 text-rose-400";
    default: return "bg-slate-500/20 text-slate-200";
  }
}

export function ClientDetailModal({ client, onClose, onEdit }: Props) {
  const navigate = useNavigate();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();
  const { quotes, fetch: fetchQuotes } = useQuotesStore();
  const { invoices, fetch: fetchInvoices } = useInvoicesStore();
  const tags = useClientTagsStore((s) => s.tags);
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchChantiers();
    fetchQuotes();
    fetchInvoices();
  }, []);

  const clientChantiers = useMemo(
    () => (client ? chantiers.filter((c) => c.clientId === client.id) : []),
    [chantiers, client]
  );

  // Ouvre le premier chantier par défaut à l'ouverture de la fiche
  useEffect(() => {
    if (client && clientChantiers.length > 0) {
      setOpenBlocks(new Set([clientChantiers[0]!.id]));
    } else {
      setOpenBlocks(new Set(["_none"]));
    }
  }, [client?.id, clientChantiers.length]);

  if (!client) return null;

  const clientQuotes = quotes.filter((q) => q.clientId === client.id);
  const clientInvoices = invoices.filter((i) => i.clientId === client.id);
  const chantierIds = new Set(clientChantiers.map((c) => c.id));
  const orphanQuotes = clientQuotes.filter((q) => !q.chantierId || !chantierIds.has(q.chantierId));
  const orphanInvoices = clientInvoices.filter((i) => !i.chantierId || !chantierIds.has(i.chantierId));

  const phone = client.phoneMobile || client.phoneFixed;
  const displayName = clientDisplayName(client);
  const clientTagDefs = (client.tags ?? []).map((id) => tags.find((t) => t.id === id)).filter(Boolean) as { id: string; label: string; color: string }[];

  const toggle = (id: string) => setOpenBlocks((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const handleOpenVault = async () => {
    if (window.btpAPI?.vaultEnsureClientFolder) {
      await window.btpAPI.vaultEnsureClientFolder(client.id, displayName);
    }
    onClose();
    navigate(`/vault?clientId=${client.id}`);
  };

  return (
    <AnimatePresence>
      {client && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("w-14 h-14 rounded-full flex items-center justify-center font-semibold text-lg shrink-0 uppercase", avatarColorClass(client.id))}>
                  {clientInitials(client)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">{displayName}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    {client.type === "pro" ? <Building2 className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
                    {client.type === "pro" ? "Professionnel" : "Particulier"}
                    {clientChantiers.length > 0 && (
                      <span className="inline-flex items-center gap-1 ml-1 text-xs font-semibold px-2 py-0.5 rounded-full text-blue-200" style={{ backgroundColor: "#1e293b" }}>
                        <HardHat className="w-3 h-3" /> {clientChantiers.length} chantier{clientChantiers.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" onClick={onEdit} className="h-10"><Pencil className="w-4 h-4" /> Modifier</Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10"><X className="w-4 h-4" /></Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* Étiquettes */}
              {clientTagDefs.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <TagIcon className="w-4 h-4 text-muted-foreground" />
                  {clientTagDefs.map((t) => (
                    <span key={t.id} className={cn("text-sm px-2.5 py-0.5 rounded-full border", tagChipClass(t.color))}>{t.label}</span>
                  ))}
                </div>
              )}

              {/* Contact — raccourcis colorés massifs */}
              <div className="flex flex-wrap gap-2">
                {phone && (
                  <a href={telHref(phone)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-base" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                    <span className="i">📞</span> {phone}
                  </a>
                )}
                {phone && (
                  <a href={smsHref(phone)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-base" style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#f97316" }}>
                    💬 SMS
                  </a>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-base min-w-0" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
                    ✉️ <span className="truncate">{client.email}</span>
                  </a>
                )}
              </div>

              {/* Adresse + Google Maps */}
              {hasAddress(client) && (
                <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-base">
                      {[client.addressLine1, client.addressLine2].filter(Boolean).join(", ")}
                      {(client.addressLine1 || client.addressLine2) && <br />}
                      {[client.postalCode, client.city].filter(Boolean).join(" ")}
                    </p>
                  </div>
                  <a href={googleMapsUrl(client)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button variant="outline" className="h-11"><Navigation className="w-4 h-4" /> Voir sur la carte</Button>
                  </a>
                </div>
              )}

              {/* Dossiers de chantier (accordéons) */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dossiers de chantier</p>
                {clientChantiers.length === 0 && orphanQuotes.length === 0 && orphanInvoices.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun chantier, devis ou facture pour ce client.</p>
                )}

                {clientChantiers.map((ch) => (
                  <ChantierBlock
                    key={ch.id}
                    chantier={ch}
                    quotes={clientQuotes.filter((q) => q.chantierId === ch.id)}
                    invoices={clientInvoices.filter((i) => i.chantierId === ch.id)}
                    open={openBlocks.has(ch.id)}
                    onToggle={() => toggle(ch.id)}
                    onOpenChantier={() => { onClose(); navigate(`/chantiers/${ch.id}`); }}
                    onOpenQuote={(id) => { onClose(); navigate(`/quotes/${id}`); }}
                    onOpenInvoice={(id) => { onClose(); navigate(`/invoices/${id}`); }}
                  />
                ))}

                {/* Bloc "hors chantier" */}
                {(orphanQuotes.length > 0 || orphanInvoices.length > 0) && (
                  <DocsBlock
                    title="Sans chantier rattaché"
                    quotes={orphanQuotes}
                    invoices={orphanInvoices}
                    open={openBlocks.has("_none")}
                    onToggle={() => toggle("_none")}
                    onOpenQuote={(id) => { onClose(); navigate(`/quotes/${id}`); }}
                    onOpenInvoice={(id) => { onClose(); navigate(`/invoices/${id}`); }}
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20 flex-wrap">
              <Button variant="outline" onClick={handleOpenVault} className="h-11"><FolderOpen className="w-4 h-4" /> Documents (coffre-fort)</Button>
              <Button onClick={onClose} className="h-11">Fermer</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Bloc chantier (accordéon) ─────────────────────────────────────────────
function ChantierBlock({ chantier, quotes, invoices, open, onToggle, onOpenChantier, onOpenQuote, onOpenInvoice }: {
  chantier: Chantier; quotes: Quote[]; invoices: Invoice[]; open: boolean; onToggle: () => void;
  onOpenChantier: () => void; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void;
}) {
  const meta = CHANTIER_STATUS_META[chantier.status];
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 hover:bg-accent/40 text-left">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0",
          meta.color === "emerald" ? "bg-emerald-500" : meta.color === "amber" ? "bg-amber-500" : meta.color === "rose" ? "bg-rose-500" : "bg-slate-400")} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{chantier.title || chantier.reference}</p>
          <p className="text-xs text-muted-foreground">
            {meta.label} · {quotes.length} devis · {invoices.length} facture{invoices.length > 1 ? "s" : ""}
          </p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-3 border-t border-border">
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onOpenChantier} className="h-9"><HardHat className="w-3.5 h-3.5" /> Ouvrir le chantier</Button>
          </div>
          <DocLists quotes={quotes} invoices={invoices} onOpenQuote={onOpenQuote} onOpenInvoice={onOpenInvoice} />
        </div>
      )}
    </div>
  );
}

function DocsBlock({ title, quotes, invoices, open, onToggle, onOpenQuote, onOpenInvoice }: {
  title: string; quotes: Quote[]; invoices: Invoice[]; open: boolean; onToggle: () => void;
  onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 hover:bg-accent/40 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{title}</p>
          <p className="text-xs text-muted-foreground">{quotes.length} devis · {invoices.length} facture{invoices.length > 1 ? "s" : ""}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="p-3 pt-2 border-t border-border">
          <DocLists quotes={quotes} invoices={invoices} onOpenQuote={onOpenQuote} onOpenInvoice={onOpenInvoice} />
        </div>
      )}
    </div>
  );
}

function DocLists({ quotes, invoices, onOpenQuote, onOpenInvoice }: {
  quotes: Quote[]; invoices: Invoice[]; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {quotes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Devis</p>
          <div className="space-y-1">
            {quotes.map((q) => {
              const m = QUOTE_STATUS_META[q.status];
              return (
                <button key={q.id} onClick={() => onOpenQuote(q.id)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-accent text-left">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{q.reference}</span>
                  <span className="text-sm truncate flex-1">{q.title || "Sans titre"}</span>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full shrink-0", statusColorClass(m.color))}>{m.label}</span>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{formatEuros(q.totalTTC, 0)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {invoices.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Factures</p>
          <div className="space-y-1">
            {invoices.map((inv) => {
              const m = INVOICE_STATUS_META[inv.status];
              return (
                <button key={inv.id} onClick={() => onOpenInvoice(inv.id)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-accent text-left">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{inv.reference}</span>
                  <span className="text-sm truncate flex-1">{inv.title || "Sans titre"}</span>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full shrink-0", statusColorClass(m.color))}>{m.label}</span>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{formatEuros(inv.totalTTC, 0)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {quotes.length === 0 && invoices.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun devis ni facture.</p>
      )}
    </div>
  );
}
