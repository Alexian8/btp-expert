import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Edit, FileText, Hammer, Calendar,
  Lock, Unlock, RefreshCw, Plus, CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import {
  PO_STATUS_META, SITUATION_STATUS_META, formatEuro,
  type PurchaseOrder, type PurchaseOrderLine, type Situation,
} from "@btp/types";
import { usePurchaseOrdersStore } from "@/stores/purchaseOrdersStore";
import { SituationEditorModal } from "./SituationEditorModal";

// ═══════════════════════════════════════════════════════════════════════════
// PurchaseOrderDetailPage — Vue lecture d'un BdC + ses situations
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "lines" | "situations" | "retention";

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getPoById, releasePoRetention,
    situations, fetchSituations, markSituationPaid,
  } = usePurchaseOrdersStore();

  const [po, setPo] = useState<(PurchaseOrder & { lines: PurchaseOrderLine[] }) | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("lines");
  const [loading, setLoading] = useState(true);

  const [situationModalOpen, setSituationModalOpen] = useState(false);
  const [editingSituationId, setEditingSituationId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const data = await getPoById(id);
      setPo(data);
      setLoading(false);
      if (data?.hasSituations) {
        fetchSituations({ purchaseOrderId: id });
      }
    };
    load();
  }, [id]);

  const reload = async () => {
    if (!id) return;
    const data = await getPoById(id);
    setPo(data);
    if (data?.hasSituations) {
      fetchSituations({ purchaseOrderId: id });
    }
  };

  const handleReleaseRetention = async () => {
    if (!po) return;
    if (!confirm(`Libérer la retenue de garantie de ${formatEuro(po.retentionAmount)} ?`)) return;
    const r = await releasePoRetention(po.id);
    if (r.success) {
      toast.success("Retenue libérée");
      reload();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleMarkPaid = async (sitId: string) => {
    const r = await markSituationPaid(sitId);
    if (r.success) {
      toast.success("Situation marquée payée");
      reload();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Chargement...</div>;
  }

  if (!po) {
    return (
      <div className="p-8 text-center">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Bon de commande introuvable</h2>
        <Button onClick={() => navigate("/purchase-orders")} className="mt-4">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
      </div>
    );
  }

  const statusMeta = PO_STATUS_META[po.status];
  const today = new Date().toISOString().slice(0, 10);
  const retentionReleasable = po.retentionEnabled && !po.retentionReleased
    && po.retentionReleaseDate && po.retentionReleaseDate <= today;

  const tabs: Array<{ key: Tab; label: string; icon: any; badge?: number }> = [
    { key: "lines", label: "Lignes", icon: Hammer, badge: po.lines.length },
  ];
  if (po.hasSituations) {
    tabs.push({ key: "situations", label: "Situations", icon: RefreshCw, badge: situations.length });
  }
  if (po.retentionEnabled) {
    tabs.push({ key: "retention", label: "Retenue", icon: Lock });
  }

  return (
    <div className="max-w-5xl mx-auto pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold truncate">{po.title || "(sans titre)"}</h1>
                <span className={cn("text-[10.5px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {po.reference} · {po.subcontractorName}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}>
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

      <div className="p-4">
        {/* Bandeau résumé */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <SummaryCard label="Total HT" value={formatEuro(po.totalHt)} />
          <SummaryCard label="TVA" value={formatEuro(po.totalVat)} />
          <SummaryCard label="Total TTC" value={formatEuro(po.totalTtc)} primary />
          {po.retentionEnabled ? (
            <SummaryCard
              label="Retenue garantie"
              value={formatEuro(po.retentionAmount)}
              icon={po.retentionReleased ? Unlock : Lock}
              warning={!po.retentionReleased}
            />
          ) : (
            <SummaryCard label="Net à payer" value={formatEuro(po.totalTtc)} />
          )}
        </div>

        {/* Bandeau alerte retenue libérable */}
        {retentionReleasable && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700">Retenue de garantie libérable</p>
                <p className="text-xs text-emerald-600">
                  La date de libération du {formatDate(po.retentionReleaseDate)} est dépassée.
                </p>
              </div>
            </div>
            <Button onClick={handleReleaseRetention} size="sm">
              <Unlock className="w-3.5 h-3.5" />
              Libérer {formatEuro(po.retentionAmount)}
            </Button>
          </div>
        )}

        {/* Onglet Lignes */}
        {activeTab === "lines" && (
          <div className="space-y-3">
            {po.description && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-xs text-muted-foreground mb-2">Description</h3>
                <p className="text-sm whitespace-pre-wrap">{po.description}</p>
              </div>
            )}

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Désignation</th>
                    <th className="p-3 font-semibold text-right">Qté</th>
                    <th className="p-3 font-semibold">Unité</th>
                    <th className="p-3 font-semibold text-right">PU HT</th>
                    <th className="p-3 font-semibold text-center">TVA</th>
                    <th className="p-3 font-semibold text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-3">{l.designation}</td>
                      <td className="p-3 text-right tabular-nums">{l.quantity}</td>
                      <td className="p-3 text-muted-foreground">{l.unit}</td>
                      <td className="p-3 text-right tabular-nums">{formatEuro(l.unitPriceHt)}</td>
                      <td className="p-3 text-center text-xs">{l.vatRate}%</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatEuro(l.totalHt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 border-t-2 border-border">
                  <tr>
                    <td colSpan={5} className="p-3 text-right font-semibold">Total HT</td>
                    <td className="p-3 text-right tabular-nums font-bold">{formatEuro(po.totalHt)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Infos complémentaires */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard title="Dates" icon={Calendar}>
                <Info label="Date BdC" value={formatDate(po.poDate)} />
                <Info label="Début travaux" value={formatDate(po.startDate)} />
                <Info label="Fin prévue" value={formatDate(po.endDate)} />
                <Info label="Date signature" value={formatDate(po.signedDate)} />
                <Info label="Délai paiement" value={`${po.paymentDelay} jours`} />
              </InfoCard>

              <InfoCard title="Documents" icon={FileText}>
                {po.vaultDocumentId ? (
                  <p className="text-sm text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    BdC signé chiffré
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pas de BdC scanné</p>
                )}
                {po.cautionRequired && (
                  <p className="text-sm mt-2">
                    Caution :{" "}
                    {po.cautionReceived ? (
                      <span className="text-emerald-600">reçue</span>
                    ) : (
                      <span className="text-amber-600">en attente</span>
                    )}
                  </p>
                )}
                {po.notes && (
                  <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{po.notes}</p>
                )}
              </InfoCard>
            </div>
          </div>
        )}

        {/* Onglet Situations */}
        {activeTab === "situations" && po.hasSituations && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Situations d'avancement de ce BdC.{" "}
                {po.retentionEnabled && `Retenue ${po.retentionPct}% appliquée.`}
              </p>
              <Button onClick={() => { setEditingSituationId(null); setSituationModalOpen(true); }} size="sm">
                <Plus className="w-4 h-4" />
                Nouvelle situation
              </Button>
            </div>

            {situations.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-md bg-muted/30 border border-dashed border-border">
                <RefreshCw className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground mb-3">Aucune situation</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
                  Les situations permettent de facturer le ST par avancement (ex: 30% en mois 1, 60% en mois 2, 100% en mois 3).
                </p>
                <Button variant="outline" size="sm" onClick={() => { setEditingSituationId(null); setSituationModalOpen(true); }}>
                  <Plus className="w-4 h-4" />
                  Créer la première situation
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {situations.map((sit) => (
                  <SituationRow
                    key={sit.id}
                    situation={sit}
                    onClick={() => { setEditingSituationId(sit.id); setSituationModalOpen(true); }}
                    onMarkPaid={() => handleMarkPaid(sit.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onglet Retenue */}
        {activeTab === "retention" && po.retentionEnabled && (
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center",
                po.retentionReleased ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
              )}>
                {po.retentionReleased ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-semibold">
                  Retenue de garantie {po.retentionReleased ? "libérée" : "en cours"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {po.retentionPct}% du montant TTC
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Montant retenu</p>
                <p className="text-2xl font-bold tabular-nums">{formatEuro(po.retentionAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date de libération prévue</p>
                <p className="text-base font-semibold">{formatDate(po.retentionReleaseDate)}</p>
                {!po.retentionReleased && retentionReleasable && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-emerald-600">
                    <AlertTriangle className="w-3 h-3" />
                    Date dépassée — retenue libérable
                  </span>
                )}
              </div>
            </div>

            {!po.retentionReleased && (
              <div className="pt-3 border-t border-border">
                <Button onClick={handleReleaseRetention} variant={retentionReleasable ? "default" : "outline"}>
                  <Unlock className="w-4 h-4" />
                  Libérer la retenue
                </Button>
                <p className="text-[11px] text-muted-foreground mt-2">
                  La libération marque le BdC comme "soldé" et permet le règlement final au sous-traitant.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <SituationEditorModal
        open={situationModalOpen}
        purchaseOrder={po}
        situationId={editingSituationId}
        onClose={() => setSituationModalOpen(false)}
        onSaved={() => {
          reload();
        }}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon: Icon, primary, warning }: {
  label: string;
  value: string;
  icon?: any;
  primary?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={cn(
      "border rounded-lg p-3",
      primary ? "bg-primary/5 border-primary/30" : warning ? "bg-amber-500/5 border-amber-500/30" : "bg-card border-border"
    )}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={cn("text-lg font-bold tabular-nums truncate", primary && "text-primary")}>{value}</p>
    </div>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start py-1 gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm flex-1">{value}</span>
    </div>
  );
}

function SituationRow({ situation, onClick, onMarkPaid }: {
  situation: Situation;
  onClick: () => void;
  onMarkPaid: () => void;
}) {
  const statusMeta = SITUATION_STATUS_META[situation.status];
  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0 font-bold text-xs">
        N°{situation.number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold truncate">{situation.reference}</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 bg-violet-500/15 text-violet-500">
            Avancement {situation.globalAdvancementPct.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDate(situation.situationDate)}</span>
          {situation.paidDate && (
            <>
              <span>·</span>
              <span className="text-emerald-600">Payée le {formatDate(situation.paidDate)}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums">{formatEuro(situation.netToPay)}</p>
        <p className="text-[10.5px] text-muted-foreground">Net à payer</p>
      </div>
      {situation.status === "validee" && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onMarkPaid(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Marquer payée
        </Button>
      )}
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
