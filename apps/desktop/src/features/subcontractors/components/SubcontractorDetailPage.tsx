import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, HardHat, Edit, Phone, MapPin,
  Building2, CreditCard, Briefcase, Star,
  Plus, Trash2, FileText,
  ShieldCheck, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import {
  SUBCONTRACTOR_ACTIVITY_META, ATTESTATION_TYPE_META, ATTESTATION_STATUS_META,
  getAttestationStatus,
  PO_STATUS_META,
  type SubcontractorAttestation,
  type PurchaseOrder,
} from "@btp/types";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";
import { usePurchaseOrdersStore } from "@/stores/purchaseOrdersStore";
import { SubcontractorFormModal } from "./SubcontractorFormModal";
import { AttestationFormModal } from "./AttestationFormModal";

// ═══════════════════════════════════════════════════════════════════════════
// SubcontractorDetailPage — Fiche détaillée d'un sous-traitant
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "infos" | "attestations" | "po";

export function SubcontractorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { subcontractors, attestations, fetchAttestations, removeAttestation } = useSubcontractorsStore();
  const { purchaseOrders, fetchPos } = usePurchaseOrdersStore();

  const [activeTab, setActiveTab] = useState<Tab>("infos");
  const [editOpen, setEditOpen] = useState(false);

  const [attestOpen, setAttestOpen] = useState(false);
  const [editingAttestation, setEditingAttestation] = useState<SubcontractorAttestation | null>(null);

  const subcontractor = subcontractors.find((s) => s.id === id);

  useEffect(() => {
    if (id) {
      fetchAttestations(id);
      fetchPos({ subcontractorId: id });
    }
  }, [id]);

  if (!subcontractor) {
    return (
      <div className="p-8 text-center">
        <HardHat className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Sous-traitant introuvable</h2>
        <Button onClick={() => navigate("/subcontractors")} className="mt-4">
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </Button>
      </div>
    );
  }

  const activityMeta = SUBCONTRACTOR_ACTIVITY_META[subcontractor.activity];
  const fullAddress = [
    subcontractor.addressLine1, subcontractor.addressLine2,
    [subcontractor.postalCode, subcontractor.city].filter(Boolean).join(" "),
    subcontractor.country,
  ].filter(Boolean).join(", ");

  const handleDeleteAttestation = async (attId: string) => {
    if (!confirm("Supprimer cette attestation ?")) return;
    const r = await removeAttestation(attId);
    if (r.success) toast.success("Attestation supprimée");
    else toast.error(r.error || "Erreur");
  };

  const tabs: Array<{ key: Tab; label: string; icon: any; badge?: number }> = [
    { key: "infos", label: "Informations", icon: Briefcase },
    { key: "attestations", label: "Attestations", icon: ShieldCheck, badge: attestations.length },
    { key: "po", label: "Bons de commande", icon: FileText, badge: purchaseOrders.length },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/subcontractors")}>
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
              {subcontractor.companyName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{subcontractor.companyName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn("text-[10.5px] font-medium px-1.5 py-0.5 rounded", activityMeta.colorTw)}>
                  {activityMeta.label}
                </span>
                {!subcontractor.isActive && (
                  <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-slate-400/20 text-slate-600 dark:text-slate-200">
                    Archivé
                  </span>
                )}
                {subcontractor.rating > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-500">
                    <Star className="w-3 h-3 fill-current" />
                    {subcontractor.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="w-3.5 h-3.5" />
            Modifier
          </Button>
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1 mt-4 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4">
        {activeTab === "infos" && (
          <div className="space-y-4">
            <InfoSection title="Contact" icon={Phone}>
              <InfoRow label="Interlocuteur" value={`${subcontractor.contactFirstName} ${subcontractor.contactLastName}`.trim() || "—"} />
              <InfoRow label="Fonction" value={subcontractor.contactRole || "—"} />
              <InfoRow label="Email" value={subcontractor.email || "—"} />
              <InfoRow label="Téléphone" value={subcontractor.phone || "—"} />
              <InfoRow label="Mobile" value={subcontractor.mobile || "—"} />
              {subcontractor.website && (
                <InfoRow
                  label="Site web"
                  value={
                    <a href={subcontractor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      {subcontractor.website}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  }
                />
              )}
            </InfoSection>

            {fullAddress && (
              <InfoSection title="Adresse" icon={MapPin}>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  {fullAddress}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </InfoSection>
            )}

            <InfoSection title="Informations légales" icon={Building2}>
              <InfoRow label="SIRET" value={subcontractor.siret || "—"} mono />
              <InfoRow label="RCS" value={subcontractor.rcs || "—"} />
              <InfoRow label="Forme juridique" value={subcontractor.legalForm || "—"} />
              <InfoRow label="Capital social" value={subcontractor.capital || "—"} />
              <InfoRow label="N° TVA intracom" value={subcontractor.tvaNumber || "—"} mono />
            </InfoSection>

            <InfoSection title="Coordonnées bancaires" icon={CreditCard}>
              <InfoRow label="IBAN" value={subcontractor.iban || "—"} mono />
              <InfoRow label="BIC" value={subcontractor.bic || "—"} mono />
              <InfoRow label="Banque" value={subcontractor.bankName || "—"} />
            </InfoSection>

            {subcontractor.activityNotes && (
              <InfoSection title="Notes activité" icon={Briefcase}>
                <p className="text-sm whitespace-pre-wrap">{subcontractor.activityNotes}</p>
              </InfoSection>
            )}

            {subcontractor.notes && (
              <InfoSection title="Notes internes" icon={FileText}>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{subcontractor.notes}</p>
              </InfoSection>
            )}
          </div>
        )}

        {activeTab === "attestations" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Attestations légales du sous-traitant. URSSAF à renouveler tous les 6 mois.
              </p>
              <Button onClick={() => { setEditingAttestation(null); setAttestOpen(true); }} size="sm">
                <Plus className="w-4 h-4" />
                Ajouter
              </Button>
            </div>

            {attestations.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-md bg-muted/30 border border-dashed border-border">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground mb-3">Aucune attestation enregistrée</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
                  Ajoutez les attestations URSSAF, décennale, RC pro et fiscale.
                  Elles sont obligatoires si vous travaillez avec ce sous-traitant.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setEditingAttestation(null); setAttestOpen(true); }}>
                  <Plus className="w-4 h-4" />
                  Ajouter la première attestation
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {attestations.map((att) => (
                  <AttestationRow
                    key={att.id}
                    attestation={att}
                    onClick={() => { setEditingAttestation(att); setAttestOpen(true); }}
                    onDelete={() => handleDeleteAttestation(att.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "po" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Bons de commande passés à ce sous-traitant
              </p>
              <Button onClick={() => navigate(`/purchase-orders/new?subcontractorId=${subcontractor.id}`)} size="sm">
                <Plus className="w-4 h-4" />
                Nouveau BdC
              </Button>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-md bg-muted/30 border border-dashed border-border">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Aucun bon de commande</p>
              </div>
            ) : (
              <div className="space-y-2">
                {purchaseOrders.map((po) => (
                  <PoRow key={po.id} po={po} onClick={() => navigate(`/purchase-orders/${po.id}`)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <SubcontractorFormModal
        open={editOpen}
        subcontractor={subcontractor}
        onClose={() => setEditOpen(false)}
        onSaved={() => {}}
      />

      <AttestationFormModal
        open={attestOpen}
        subcontractorId={subcontractor.id}
        attestation={editingAttestation}
        onClose={() => setAttestOpen(false)}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function InfoSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start py-1 gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className={cn("text-sm flex-1 min-w-0", mono && "font-mono text-xs tabular-nums")}>{value}</span>
    </div>
  );
}

function AttestationRow({ attestation, onClick, onDelete }: {
  attestation: SubcontractorAttestation;
  onClick: () => void;
  onDelete: () => void;
}) {
  const meta = ATTESTATION_TYPE_META[attestation.type];
  const status = getAttestationStatus(attestation.expirationDate);
  const statusMeta = ATTESTATION_STATUS_META[status];
  const label = attestation.type === "autre" && attestation.customLabel
    ? attestation.customLabel
    : meta.label;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:border-primary/50 transition-all",
        status === "expiree" ? "border-red-500/40" : "border-border"
      )}
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", meta.colorTw)}>
        <ShieldCheck className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold truncate">{label}</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          {meta.required && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 shrink-0">
              Obligatoire
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {attestation.reference && <span>Réf : {attestation.reference}</span>}
          {attestation.issuedDate && (
            <>
              <span>·</span>
              <span>Émise le {formatDate(attestation.issuedDate)}</span>
            </>
          )}
          {attestation.expirationDate && (
            <>
              <span>·</span>
              <span className={cn(
                status === "expiree" && "text-red-500 font-semibold",
                status === "expire_bientot" && "text-amber-500 font-semibold"
              )}>
                Expire le {formatDate(attestation.expirationDate)}
              </span>
            </>
          )}
        </div>
      </div>
      {attestation.vaultDocumentId && (
        <span className="text-[10px] text-emerald-600 px-2 py-1 rounded bg-emerald-500/10 shrink-0">
          PDF chiffré
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function PoRow({ po, onClick }: { po: PurchaseOrder; onClick: () => void }) {
  const statusMeta = PO_STATUS_META[po.status];
  return (
    <div onClick={onClick} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-all">
      <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold truncate">{po.title || "(sans titre)"}</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {po.reference} · {formatDate(po.poDate)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums">{po.totalHt.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
        <p className="text-[10.5px] text-muted-foreground">HT</p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
