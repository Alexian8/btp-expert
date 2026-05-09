import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, RefreshCw, Calendar,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SITUATION_STATUS_META, formatEuro,
  type PurchaseOrder, type PurchaseOrderLine, type SituationStatus,
} from "@btp/types";
import { usePurchaseOrdersStore } from "@/stores/purchaseOrdersStore";

// ═══════════════════════════════════════════════════════════════════════════
// SituationEditorModal — Création/édition d'une situation d'avancement
//
// Pour chaque ligne du BdC, on saisit le % d'avancement cumulé
// (ex: ligne déjà à 30%, on passe à 50% → on facture les 20% nouveaux)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  purchaseOrder: (PurchaseOrder & { lines: PurchaseOrderLine[] }) | null;
  situationId: string | null;     // null = création
  onClose: () => void;
  onSaved: () => void;
}

interface DraftSituationLine {
  id?: string;
  poLineId: string;
  designation: string;
  totalHt: number;
  cumulPctPrevious: number;
  cumulPctNow: string;     // string pour saisie facile
  vatRate: number;
}

export function SituationEditorModal({ open, purchaseOrder, situationId, onClose, onSaved }: Props) {
  const {
    createSituation, updateSituation, removeSituation,
    getSituationById, getPreviousCumulPcts,
  } = usePurchaseOrdersStore();

  const [situationDate, setSituationDate] = useState("");
  const [status, setStatus] = useState<SituationStatus>("brouillon");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftSituationLine[]>([]);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reference, setReference] = useState("");
  const [number, setNumber] = useState(1);

  const isEditing = !!situationId;

  useEffect(() => {
    if (!open || !purchaseOrder) return;

    const load = async () => {
      if (situationId) {
        // Édition
        const sit = await getSituationById(situationId);
        if (!sit) {
          toast.error("Situation introuvable");
          onClose();
          return;
        }
        setReference(sit.reference);
        setNumber(sit.number);
        setSituationDate(sit.situationDate);
        setStatus(sit.status);
        setNotes(sit.notes);
        setLines(sit.lines.map((l) => ({
          id: l.id,
          poLineId: l.poLineId,
          designation: l.designation,
          totalHt: l.totalHt,
          cumulPctPrevious: l.cumulPctPrevious,
          cumulPctNow: String(l.cumulPctNow).replace(".", ","),
          vatRate: l.vatRate,
        })));
      } else {
        // Nouvelle situation : récupérer les % cumulés des situations précédentes
        const today = new Date().toISOString().slice(0, 10);
        setSituationDate(today);
        setStatus("brouillon");
        setNotes("");
        const previousPcts = await getPreviousCumulPcts(purchaseOrder.id);
        setLines(purchaseOrder.lines.map((pol) => {
          const prev = previousPcts[pol.id] || 0;
          return {
            poLineId: pol.id,
            designation: pol.designation,
            totalHt: pol.totalHt,
            cumulPctPrevious: prev,
            cumulPctNow: String(prev).replace(".", ","), // pré-rempli au cumul précédent
            vatRate: pol.vatRate,
          };
        }));
      }
    };
    load();
    setConfirmDelete(false);
  }, [open, purchaseOrder?.id, situationId]);

  // Calculs en live
  const computed = useMemo(() => {
    let totalHt = 0, totalVat = 0;
    let weightedAdvancement = 0;
    const poTotal = lines.reduce((s, l) => s + l.totalHt, 0) || 1;

    const enrichedLines = lines.map((l) => {
      const cumulNowNum = parseFloat(l.cumulPctNow.replace(",", ".")) || 0;
      const newPct = cumulNowNum - l.cumulPctPrevious;
      const newAmountHt = l.totalHt * (newPct / 100);
      totalHt += newAmountHt;
      totalVat += newAmountHt * (l.vatRate / 100);
      weightedAdvancement += (cumulNowNum * l.totalHt) / poTotal;
      return { ...l, cumulNowNum, newPct, newAmountHt };
    });

    const totalTtc = totalHt + totalVat;
    const retentionPct = purchaseOrder?.retentionEnabled ? purchaseOrder.retentionPct : 0;
    const retentionAmount = (totalTtc * retentionPct) / 100;
    const netToPay = totalTtc - retentionAmount;

    return {
      enrichedLines,
      totalHt: +totalHt.toFixed(2),
      totalVat: +totalVat.toFixed(2),
      totalTtc: +totalTtc.toFixed(2),
      retentionAmount: +retentionAmount.toFixed(2),
      netToPay: +netToPay.toFixed(2),
      globalAdvancementPct: +weightedAdvancement.toFixed(2),
    };
  }, [lines, purchaseOrder]);

  const updateLinePct = (idx: number, value: string) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, cumulPctNow: value } : l));
  };

  const handleSubmit = async () => {
    if (!purchaseOrder) return;

    // Vérifier qu'au moins une ligne progresse
    const hasProgress = computed.enrichedLines.some((l) => l.newPct > 0);
    if (!hasProgress && !isEditing) {
      toast.error("Aucune progression saisie");
      return;
    }
    // Vérifier qu'aucun cumul ne dépasse 100% ou ne régresse
    for (const l of computed.enrichedLines) {
      if (l.cumulNowNum < l.cumulPctPrevious) {
        toast.error(`Régression interdite sur "${l.designation}"`);
        return;
      }
      if (l.cumulNowNum > 100) {
        toast.error(`Cumul > 100% sur "${l.designation}"`);
        return;
      }
    }

    const payload = {
      purchaseOrderId: purchaseOrder.id,
      subcontractorId: purchaseOrder.subcontractorId,
      subcontractorName: purchaseOrder.subcontractorName,
      chantierId: purchaseOrder.chantierId,
      poReference: purchaseOrder.reference,
      situationDate,
      status,
      notes: notes.trim(),
      lines: lines.map((l) => ({
        id: l.id,
        poLineId: l.poLineId,
        designation: l.designation,
        totalHt: l.totalHt,
        cumulPctPrevious: l.cumulPctPrevious,
        cumulPctNow: parseFloat(l.cumulPctNow.replace(",", ".")) || 0,
        vatRate: l.vatRate,
      })),
    };

    setSaving(true);
    if (isEditing && situationId) {
      const r = await updateSituation(situationId, payload);
      setSaving(false);
      if (r.success) {
        toast.success("Situation mise à jour");
        onSaved();
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await createSituation(payload);
      setSaving(false);
      if (r.success) {
        toast.success(r.reference ? `Situation créée (${r.reference})` : "Situation créée");
        onSaved();
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (!situationId) return;
    setSaving(true);
    const r = await removeSituation(situationId);
    setSaving(false);
    if (r.success) {
      toast.success("Situation supprimée");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  if (!purchaseOrder) return null;

  return (
    <AnimatePresence>
      {open && (
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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-4xl w-full max-h-[92vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {isEditing ? `Situation ${reference}` : `Situation N°${number}`}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {purchaseOrder.reference} · {purchaseOrder.subcontractorName}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Date + statut */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Date situation
                  </Label>
                  <Input
                    type="date"
                    value={situationDate}
                    onChange={(e) => setSituationDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Statut</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SituationStatus)}
                    className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    {Object.entries(SITUATION_STATUS_META).map(([k, m]) => (
                      <option key={k} value={k}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lignes */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Avancement par ligne</h3>
                <div className="bg-muted/20 border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-[11px]">
                      <tr className="text-left">
                        <th className="p-2 font-semibold">Désignation</th>
                        <th className="p-2 font-semibold text-right">Total HT</th>
                        <th className="p-2 font-semibold text-right">% précédent</th>
                        <th className="p-2 font-semibold text-right w-24">% cumulé *</th>
                        <th className="p-2 font-semibold text-right">% nouveau</th>
                        <th className="p-2 font-semibold text-right">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.enrichedLines.map((l, idx) => (
                        <tr key={l.poLineId} className="border-t border-border">
                          <td className="p-2 truncate max-w-xs">{l.designation}</td>
                          <td className="p-2 text-right tabular-nums">{formatEuro(l.totalHt)}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">
                            {l.cumulPctPrevious.toFixed(0)}%
                          </td>
                          <td className="p-2">
                            <Input
                              value={lines[idx].cumulPctNow}
                              onChange={(e) => updateLinePct(idx, e.target.value)}
                              className="h-7 text-right tabular-nums"
                              placeholder="0"
                            />
                          </td>
                          <td className={cn(
                            "p-2 text-right tabular-nums",
                            l.newPct > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"
                          )}>
                            +{l.newPct.toFixed(0)}%
                          </td>
                          <td className="p-2 text-right tabular-nums font-semibold">
                            {formatEuro(l.newAmountHt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  * Saisissez le % cumulé total après cette situation (ex: 50% au total).
                  Le % nouveau est calculé automatiquement.
                </p>
              </div>

              {/* Totaux */}
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avancement global</p>
                    <p className="text-2xl font-bold tabular-nums text-violet-600">
                      {computed.globalAdvancementPct.toFixed(0)}%
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total HT :</span>
                      <span className="tabular-nums font-semibold">{formatEuro(computed.totalHt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TVA :</span>
                      <span className="tabular-nums">{formatEuro(computed.totalVat)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border">
                      <span className="font-semibold">TTC :</span>
                      <span className="tabular-nums font-bold">{formatEuro(computed.totalTtc)}</span>
                    </div>
                    {purchaseOrder.retentionEnabled && (
                      <>
                        <div className="flex justify-between text-amber-600">
                          <span>Retenue {purchaseOrder.retentionPct}% :</span>
                          <span className="tabular-nums">− {formatEuro(computed.retentionAmount)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 font-semibold pt-1 border-t border-border">
                          <span>Net à payer :</span>
                          <span className="tabular-nums">{formatEuro(computed.netToPay)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (optionnel)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
              <div>
                {isEditing && (
                  <>
                    {confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-destructive">Confirmer ?</span>
                        <Button variant="destructive" size="sm" onClick={handleDelete} loading={saving}>Oui</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Non</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        Supprimer
                      </Button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button onClick={handleSubmit} loading={saving}>
                  <Save className="w-4 h-4" />
                  {isEditing ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
