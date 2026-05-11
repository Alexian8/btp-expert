import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, User, Building2, MapPin, Phone, Mail, Pencil,
  Hammer, Receipt, Tag, ExternalLink, ArrowRight, FolderOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatSiret } from "@/lib/sireneService";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { LinkedEventsList } from "@/features/agenda/components/LinkedEventsList";
import { InlineDocumentsSection } from "@/features/vault/components/InlineDocumentsSection";
import { CHANTIER_STATUS_META, QUOTE_STATUS_META, type Client } from "@btp/types";
import { CHANTIER_STATUS_ICON } from "@/features/chantiers/statusIcons";
import { formatEuros } from "@/features/quotes/quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// ClientDetailModal — Vue détaillée d'un client (lecture + actions)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  client: Client | null;
  onClose: () => void;
  onEdit: () => void;
}

export function ClientDetailModal({ client, onClose, onEdit }: Props) {
  const navigate = useNavigate();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();
  const { quotes, fetch: fetchQuotes } = useQuotesStore();

  useEffect(() => {
    fetchChantiers();
    fetchQuotes();
  }, []);

  if (!client) return null;

  // Ouvrir le coffre-fort filtré sur ce client
  const handleOpenVaultDocuments = async () => {
    if (window.btpAPI?.vaultEnsureClientFolder) {
      const displayName = client.type === "pro" && client.companyName
        ? client.companyName
        : `${client.firstName} ${client.lastName}`.trim();
      // Crée le dossier s'il n'existe pas (idempotent)
      await window.btpAPI.vaultEnsureClientFolder(client.id, displayName);
    }
    onClose();
    navigate(`/vault?clientId=${client.id}`);
  };

  const isPro = client.type === "pro";
  const displayName = isPro && client.companyName
    ? client.companyName
    : `${client.firstName} ${client.lastName}`.trim();
  const contactName = `${client.civility || ""} ${client.firstName} ${client.lastName}`.trim();

  const fullAddress = [client.addressLine1, client.addressLine2, client.postalCode, client.city, client.country]
    .filter(Boolean)
    .join(", ");

  // Chantiers liés à ce client
  const clientChantiers = chantiers.filter((c) => c.clientId === client.id);
  // Devis liés à ce client
  const clientQuotes = quotes.filter((q) => q.clientId === client.id);

  return (
    <AnimatePresence>
      {client && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                  isPro ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/15 text-violet-500"
                )}>
                  {isPro ? <Building2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold truncate">{displayName || "—"}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider",
                      isPro ? "bg-blue-500/15 text-blue-600" : "bg-violet-500/15 text-violet-600"
                    )}>
                      {isPro ? "Pro" : "Particulier"}
                    </span>
                    {isPro && contactName && (
                      <span className="text-xs text-muted-foreground">
                        · Contact : {contactName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => handleOpenVaultDocuments()}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Documents
                </Button>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 p-3 border-b border-border bg-muted/20 overflow-x-auto">
              {client.phoneMobile && (
                <a
                  href={`tel:${client.phoneMobile}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <Phone className="w-3.5 h-3.5" /> Appeler
                </a>
              )}
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              )}
              {fullAddress && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Voir sur la carte
                </a>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Contact */}
              <Section title="Contact" icon={Phone}>
                <Row label="Email" value={client.email || "—"} />
                <Row label="Mobile" value={client.phoneMobile || "—"} mono />
                <Row label="Fixe" value={client.phoneFixed || "—"} mono />
              </Section>

              {/* Adresse */}
              <Section title="Adresse" icon={MapPin}>
                {client.addressLine1 || client.city ? (
                  <div className="space-y-0.5 text-sm">
                    {client.addressLine1 && <p>{client.addressLine1}</p>}
                    {client.addressLine2 && <p>{client.addressLine2}</p>}
                    {(client.postalCode || client.city) && (
                      <p>{client.postalCode} {client.city}</p>
                    )}
                    {client.country && client.country !== "France" && <p>{client.country}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune adresse renseignée</p>
                )}

                {!client.billingAddressSame && client.billingAddressLine1 && (
                  <>
                    <Separator className="my-3" />
                    <p className="text-xs font-medium text-muted-foreground mb-1">Adresse de facturation</p>
                    <div className="space-y-0.5 text-sm">
                      {client.billingAddressLine1 && <p>{client.billingAddressLine1}</p>}
                      {client.billingAddressLine2 && <p>{client.billingAddressLine2}</p>}
                      {(client.billingPostalCode || client.billingCity) && (
                        <p>{client.billingPostalCode} {client.billingCity}</p>
                      )}
                    </div>
                  </>
                )}
              </Section>

              {/* Pro infos */}
              {isPro && (client.siret || client.tvaIntracom || client.legalForm) && (
                <Section title="Informations légales" icon={Building2}>
                  <Row label="Raison sociale" value={client.companyName || "—"} />
                  <Row label="SIRET" value={client.siret ? formatSiret(client.siret) : "—"} mono />
                  <Row label="TVA intra" value={client.tvaIntracom || "—"} mono />
                  <Row label="Forme" value={client.legalForm || "—"} />
                  {client.apeCode && <Row label="APE" value={`${client.apeCode} — ${client.apeLabel || ""}`} />}
                </Section>
              )}

              {/* Métadonnées */}
              {(client.source || client.firstContactAt || client.notes) && (
                <Section title="Informations complémentaires" icon={Tag}>
                  {client.source && <Row label="Source" value={client.source} />}
                  {client.firstContactAt && (
                    <Row label="Premier contact" value={formatDate(client.firstContactAt)} />
                  )}
                  {client.notes && (
                    <div className="mt-2 p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">
                      {client.notes}
                    </div>
                  )}
                </Section>
              )}

              {/* Chantiers liés (Session 7) */}
              <Section title={`Chantiers (${clientChantiers.length})`} icon={Hammer}>
                {clientChantiers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
                    Aucun chantier pour ce client. Créez-en un depuis la page Chantiers.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clientChantiers.map((ch) => {
                      const meta = CHANTIER_STATUS_META[ch.status];
                      const StatusIcon = CHANTIER_STATUS_ICON[ch.status];
                      return (
                        <button
                          key={ch.id}
                          onClick={() => {
                            onClose();
                            navigate(`/chantiers/${ch.id}`);
                          }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-md border border-border hover:bg-accent/40 transition-colors text-left"
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                            meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                            meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                            meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                            meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                          )}>
                            <StatusIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{ch.title || "Sans titre"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{ch.reference}</p>
                          </div>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                            meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                            meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                            meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                          )}>{meta.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Devis liés (Session 8) */}
              <Section title={`Devis (${clientQuotes.length})`} icon={Receipt}>
                {clientQuotes.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
                    Aucun devis pour ce client. Créez-en un depuis la page Devis.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clientQuotes.map((q) => {
                      const meta = QUOTE_STATUS_META[q.status];
                      return (
                        <button
                          key={q.id}
                          onClick={() => {
                            onClose();
                            navigate(`/quotes/${q.id}`);
                          }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-md border border-border hover:bg-accent/40 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Receipt className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{q.title || "Sans titre"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{q.reference}</p>
                          </div>
                          <div className="text-right shrink-0 mr-2">
                            <p className="text-sm font-semibold tabular-nums">{formatEuros(q.totalTTC, 0)}</p>
                            <span className={cn(
                              "inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5",
                              meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                              meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                              meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                              meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                            )}>{meta.label}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Documents du client */}
              <div className="pt-2">
                <InlineDocumentsSection
                  clientId={client.id}
                  defaultCategory="client"
                  title="Documents du client"
                  description="Devis signés, courriers, échanges, factures…"
                />
              </div>

              {/* Agenda lié (Session 12) */}
              <div className="pt-2">
                <LinkedEventsList clientId={client.id} title="Agenda lié" />
              </div>

              {/* Meta footer */}
              <div className="pt-3 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Créé le {formatDate(client.createdAt)}</span>
                <span>Modifié le {formatDate(client.updatedAt)}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Utilitaires ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className={cn("truncate", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
}
