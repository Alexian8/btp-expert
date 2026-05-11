import { motion, AnimatePresence } from "framer-motion";
import { X, Building2, Phone, Mail, MapPin, CreditCard, ExternalLink, Pencil, Globe } from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { formatSiret } from "@/lib/sireneService";
import type { Supplier } from "@btp/types";

interface Props {
  supplier: Supplier | null;
  onClose: () => void;
  onEdit: () => void;
}

export function SupplierDetailModal({ supplier, onClose, onEdit }: Props) {
  if (!supplier) return null;

  const contactName = `${supplier.contactFirstName} ${supplier.contactLastName}`.trim();
  const fullAddress = [supplier.addressLine1, supplier.addressLine2, supplier.postalCode, supplier.city, supplier.country]
    .filter(Boolean).join(", ");

  return (
    <AnimatePresence>
      {supplier && (
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
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold truncate">{supplier.companyName || "—"}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium uppercase tracking-wider">
                      {supplier.category}
                    </span>
                    {contactName && <span className="text-xs text-muted-foreground">Contact : {contactName}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
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
              {supplier.phoneMobile && (
                <a
                  href={`tel:${supplier.phoneMobile}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium whitespace-nowrap"
                >
                  <Phone className="w-3.5 h-3.5" /> Appeler
                </a>
              )}
              {supplier.email && (
                <a
                  href={`mailto:${supplier.email}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium whitespace-nowrap"
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              )}
              {supplier.website && (
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium whitespace-nowrap"
                >
                  <Globe className="w-3.5 h-3.5" /> Site web
                </a>
              )}
              {fullAddress && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Carte
                </a>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <Section title="Coordonnées" icon={Phone}>
                <Row label="Email" value={supplier.email || "—"} />
                <Row label="Mobile" value={supplier.phoneMobile || "—"} mono />
                <Row label="Fixe" value={supplier.phoneFixed || "—"} mono />
                <Row label="Site web" value={supplier.website || "—"} />
              </Section>

              <Section title="Adresse" icon={MapPin}>
                {supplier.addressLine1 || supplier.city ? (
                  <div className="space-y-0.5 text-sm">
                    {supplier.addressLine1 && <p>{supplier.addressLine1}</p>}
                    {supplier.addressLine2 && <p>{supplier.addressLine2}</p>}
                    {(supplier.postalCode || supplier.city) && <p>{supplier.postalCode} {supplier.city}</p>}
                    {supplier.country && supplier.country !== "France" && <p>{supplier.country}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune adresse renseignée</p>
                )}
              </Section>

              {(supplier.siret || supplier.tvaIntracom || supplier.legalForm) && (
                <Section title="Informations légales" icon={Building2}>
                  <Row label="SIRET" value={supplier.siret ? formatSiret(supplier.siret) : "—"} mono />
                  <Row label="TVA intra" value={supplier.tvaIntracom || "—"} mono />
                  <Row label="Forme" value={supplier.legalForm || "—"} />
                  {supplier.apeCode && <Row label="APE" value={`${supplier.apeCode} — ${supplier.apeLabel || ""}`} />}
                </Section>
              )}

              <Section title="Conditions de paiement" icon={CreditCard}>
                <Row label="IBAN" value={supplier.iban || "—"} mono />
                <Row label="BIC" value={supplier.bic || "—"} mono />
                <Row label="Mode" value={supplier.paymentMethod || "—"} />
                <Row label="Délai" value={`${supplier.paymentTermsDays} jours`} />
              </Section>

              {supplier.notes && (
                <Section title="Notes" icon={Building2}>
                  <div className="p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">{supplier.notes}</div>
                </Section>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
