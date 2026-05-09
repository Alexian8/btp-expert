import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Plus, X, FileText, Building2, Hammer,
  Calendar, Lock, RefreshCw, Receipt, Upload, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PO_STATUS_META, formatEuro,
  type PurchaseOrderStatus,
} from "@btp/types";
import { usePurchaseOrdersStore } from "@/stores/purchaseOrdersStore";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";
import { useChantiersStore } from "@/stores/chantiersStore";

// ═══════════════════════════════════════════════════════════════════════════
// PurchaseOrderEditorPage — Édition complète d'un BdC avec lignes
// ═══════════════════════════════════════════════════════════════════════════

interface DraftLine {
  id?: string;
  designation: string;
  quantity: string;
  unit: string;
  unitPriceHt: string;
  vatRate: number;
  notes: string;
}

const VAT_RATES = [20, 10, 5.5, 2.1, 0];
const COMMON_UNITS = ["forfait", "h", "j", "m²", "m³", "ml", "u", "ens"];

export function PurchaseOrderEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createPo, updatePo, removePo, getPoById } = usePurchaseOrdersStore();
  const { subcontractors, fetch: fetchST } = useSubcontractorsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  const isNew = id === "new";

  // Champs principaux
  const [subcontractorId, setSubcontractorId] = useState("");
  const [chantierId, setChantierId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [poDate, setPoDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [signedDate, setSignedDate] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus>("brouillon");
  const [paymentDelay, setPaymentDelay] = useState(30);
  const [notes, setNotes] = useState("");

  // Retenue
  const [retentionEnabled, setRetentionEnabled] = useState(false);
  const [retentionPct, setRetentionPct] = useState(5);
  const [retentionReleaseDate, setRetentionReleaseDate] = useState("");

  // Situations toggle
  const [hasSituations, setHasSituations] = useState(false);

  // Caution
  const [cautionRequired, setCautionRequired] = useState(false);
  const [cautionReceived, setCautionReceived] = useState(false);
  const [cautionVaultDocumentId, setCautionVaultDocumentId] = useState("");

  // Doc BdC signé
  const [vaultDocumentId, setVaultDocumentId] = useState("");

  // Lignes
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reference, setReference] = useState("");

  // Loaders
  useEffect(() => {
    fetchST();
    fetchChantiers();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (isNew) {
        const today = new Date().toISOString().slice(0, 10);
        setPoDate(today);
        // Pré-sélection ST si fourni en query param
        const stIdParam = searchParams.get("subcontractorId");
        if (stIdParam) setSubcontractorId(stIdParam);
        return;
      }
      if (!id) return;
      setLoading(true);
      const po = await getPoById(id);
      setLoading(false);
      if (!po) {
        toast.error("Bon de commande introuvable");
        navigate("/purchase-orders");
        return;
      }
      setReference(po.reference);
      setSubcontractorId(po.subcontractorId);
      setChantierId(po.chantierId);
      setTitle(po.title);
      setDescription(po.description);
      setPoDate(po.poDate);
      setStartDate(po.startDate);
      setEndDate(po.endDate);
      setSignedDate(po.signedDate);
      setStatus(po.status);
      setPaymentDelay(po.paymentDelay);
      setNotes(po.notes);
      setRetentionEnabled(po.retentionEnabled);
      setRetentionPct(po.retentionPct);
      setRetentionReleaseDate(po.retentionReleaseDate);
      setHasSituations(po.hasSituations);
      setCautionRequired(po.cautionRequired);
      setCautionReceived(po.cautionReceived);
      setCautionVaultDocumentId(po.cautionVaultDocumentId);
      setVaultDocumentId(po.vaultDocumentId);
      setLines(po.lines.map((l) => ({
        id: l.id,
        designation: l.designation,
        quantity: String(l.quantity).replace(".", ","),
        unit: l.unit,
        unitPriceHt: String(l.unitPriceHt).replace(".", ","),
        vatRate: l.vatRate,
        notes: l.notes,
      })));
    };
    load();
  }, [id]);

  // Auto-fill subcontractorName + endDate retentionRelease
  const selectedST = subcontractors.find((s) => s.id === subcontractorId);

  // Totaux calculés
  const totals = useMemo(() => {
    let totalHt = 0, totalVat = 0;
    for (const l of lines) {
      const q = parseFloat(l.quantity.replace(",", ".")) || 0;
      const u = parseFloat(l.unitPriceHt.replace(",", ".")) || 0;
      const lineHt = q * u;
      totalHt += lineHt;
      totalVat += lineHt * (l.vatRate / 100);
    }
    const totalTtc = totalHt + totalVat;
    const retentionAmount = retentionEnabled ? totalTtc * (retentionPct / 100) : 0;
    return {
      totalHt: +totalHt.toFixed(2),
      totalVat: +totalVat.toFixed(2),
      totalTtc: +totalTtc.toFixed(2),
      retentionAmount: +retentionAmount.toFixed(2),
      netToPay: +(totalTtc - retentionAmount).toFixed(2),
    };
  }, [lines, retentionEnabled, retentionPct]);

  // Auto-calcul date libération retenue (1 an après endDate)
  useEffect(() => {
    if (retentionEnabled && endDate && !retentionReleaseDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setFullYear(end.getFullYear() + 1);
        setRetentionReleaseDate(end.toISOString().slice(0, 10));
      }
    }
  }, [retentionEnabled, endDate]);

  // Auto-suggestion caution si > 600€ HT
  useEffect(() => {
    if (totals.totalHt > 600 && !cautionRequired && isNew) {
      setCautionRequired(true);
    }
  }, [totals.totalHt]);

  const addLine = () => {
    setLines([...lines, {
      designation: "",
      quantity: "1",
      unit: "forfait",
      unitPriceHt: "0",
      vatRate: selectedST?.defaultVatRate ?? 20,
      notes: "",
    }]);
  };

  const updateLine = (idx: number, key: keyof DraftLine, value: any) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!subcontractorId) { toast.error("Sélectionnez un sous-traitant"); return; }
    if (!chantierId) { toast.error("Sélectionnez un chantier"); return; }
    if (!title.trim()) { toast.error("Saisissez un titre"); return; }
    if (lines.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }

    const payload = {
      subcontractorId,
      subcontractorName: selectedST?.companyName || "",
      chantierId,
      title: title.trim(),
      description: description.trim(),
      poDate, startDate, endDate, signedDate,
      status,
      paymentDelay,
      notes: notes.trim(),
      retentionEnabled,
      retentionPct,
      retentionReleaseDate,
      hasSituations,
      cautionRequired,
      cautionReceived,
      cautionVaultDocumentId,
      vaultDocumentId,
      lines: lines.map((l) => ({
        id: l.id,
        designation: l.designation,
        quantity: parseFloat(l.quantity.replace(",", ".")) || 0,
        unit: l.unit,
        unitPriceHt: parseFloat(l.unitPriceHt.replace(",", ".")) || 0,
        vatRate: l.vatRate,
        notes: l.notes,
      })),
    };

    setSaving(true);
    if (isNew) {
      const r = await createPo(payload);
      setSaving(false);
      if (r.success) {
        toast.success(`BdC créé (${r.reference})`);
        if (r.id) {
          navigate(`/purchase-orders/${r.id}`);
        } else {
          navigate("/purchase-orders");
        }
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await updatePo(id!, payload);
      setSaving(false);
      if (r.success) {
        toast.success("BdC mis à jour");
        navigate("/purchase-orders");
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    setSaving(true);
    const r = await removePo(id);
    setSaving(false);
    if (r.success) {
      toast.success("BdC supprimé");
      navigate("/purchase-orders");
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const uploadToVault = async (folderName: string, description: string, setter: (id: string) => void, setUploading: (b: boolean) => void) => {
    if (!window.btpAPI?.vaultPickFiles) {
      toast.error("Coffre-fort non disponible");
      return;
    }
    setUploading(true);
    const pickResult = await window.btpAPI.vaultPickFiles();
    if (!pickResult.success || pickResult.paths.length === 0) {
      setUploading(false);
      return;
    }
    let folderId = "root_company";
    try {
      const folders = await window.btpAPI.vaultListFolders!();
      const existing = folders.find((f: any) => f.name === folderName && f.parentId === "root_company");
      if (existing) folderId = existing.id;
      else {
        const r = await window.btpAPI.vaultCreateFolder!({
          name: folderName, iconKey: "fileText", colorKey: "blue", parentId: "root_company",
        });
        if (r.success && r.id) folderId = r.id;
      }
    } catch {}

    const sourcePath = pickResult.paths[0];
    const fileName = sourcePath.split(/[/\\]/).pop() || "Document";
    const r = await window.btpAPI.vaultUploadDocument!({
      folderId, sourcePath, fileName, description, tags: [{ name: "Sous-traitance" }],
    });
    setUploading(false);
    if (r.success && r.id) {
      setter(r.id);
      toast.success("Document chiffré dans le coffre-fort");
    } else {
      toast.error(r.error || "Erreur upload");
    }
  };

  const [uploadingPo, setUploadingPo] = useState(false);
  const [uploadingCaution, setUploadingCaution] = useState(false);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-8">
      {/* Header sticky */}
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
              <h1 className="text-xl font-bold truncate">
                {isNew ? "Nouveau bon de commande" : `BdC ${reference}`}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isNew ? "Créez un nouvel engagement avec un sous-traitant" : "Modifier le bon de commande"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && (
              <>
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-destructive">Confirmer ?</span>
                    <Button variant="destructive" size="sm" onClick={handleDelete} loading={saving}>Oui</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Non</Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </>
            )}
            <Button onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4" />
              {isNew ? "Créer le BdC" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Header BdC : ST + Chantier + dates */}
        <Card title="Engagement" icon={Building2}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Sous-traitant *</Label>
              <select
                value={subcontractorId}
                onChange={(e) => setSubcontractorId(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Sélectionnez un sous-traitant</option>
                {subcontractors.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.companyName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Chantier *</Label>
              <select
                value={chantierId}
                onChange={(e) => setChantierId(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Sélectionnez un chantier</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Titre *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Lot Maçonnerie - Résidence Les Tilleuls"
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Description détaillée des travaux confiés..."
                className="mt-1.5"
              />
            </div>
          </div>
        </Card>

        {/* Dates + statut */}
        <Card title="Dates et statut" icon={Calendar}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Date BdC *</Label>
              <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Début travaux</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Fin prévue</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Date signature ST</Label>
              <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Délai de paiement (jours)</Label>
              <select
                value={paymentDelay}
                onChange={(e) => setPaymentDelay(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value={30}>30 jours</option>
                <option value={45}>45 jours</option>
                <option value={60}>60 jours</option>
              </select>
            </div>
            <div>
              <Label>Statut</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus)}
                className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                {Object.entries(PO_STATUS_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Lignes */}
        <Card title={`Lignes (${lines.length})`} icon={Hammer}>
          <div className="space-y-2">
            {lines.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-md bg-muted/30 border border-dashed border-border">
                <p className="text-sm text-muted-foreground mb-3">Aucune ligne</p>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4" />
                  Ajouter la première ligne
                </Button>
              </div>
            ) : (
              <>
                {lines.map((l, idx) => {
                  const q = parseFloat(l.quantity.replace(",", ".")) || 0;
                  const u = parseFloat(l.unitPriceHt.replace(",", ".")) || 0;
                  const lineHt = q * u;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 p-2 rounded-md bg-muted/20 border border-border items-start">
                      <div className="col-span-12 md:col-span-5">
                        <Input
                          value={l.designation}
                          onChange={(e) => updateLine(idx, "designation", e.target.value)}
                          placeholder="Désignation"
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <Input
                          value={l.quantity}
                          onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                          placeholder="Qté"
                          className="h-9 tabular-nums text-right"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <select
                          value={l.unit}
                          onChange={(e) => updateLine(idx, "unit", e.target.value)}
                          className="h-9 w-full px-2 rounded-md border border-input bg-background text-sm"
                        >
                          {COMMON_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <Input
                          value={l.unitPriceHt}
                          onChange={(e) => updateLine(idx, "unitPriceHt", e.target.value)}
                          placeholder="PU HT"
                          className="h-9 tabular-nums text-right"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-1">
                        <select
                          value={String(l.vatRate)}
                          onChange={(e) => updateLine(idx, "vatRate", parseFloat(e.target.value))}
                          className="h-9 w-full px-2 rounded-md border border-input bg-background text-sm"
                        >
                          {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                      <div className="col-span-10 md:col-span-1 text-right pr-1 pt-2 text-sm font-semibold tabular-nums">
                        {lineHt.toFixed(2)} €
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={addLine} className="w-full mt-2">
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une ligne
                </Button>
              </>
            )}

            {/* Totaux */}
            {lines.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="space-y-1 text-sm max-w-xs ml-auto">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT :</span>
                    <span className="tabular-nums font-semibold">{formatEuro(totals.totalHt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA :</span>
                    <span className="tabular-nums">{formatEuro(totals.totalVat)}</span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t border-border">
                    <span className="font-semibold">Total TTC :</span>
                    <span className="tabular-nums font-bold">{formatEuro(totals.totalTtc)}</span>
                  </div>
                  {retentionEnabled && (
                    <>
                      <div className="flex justify-between text-amber-600">
                        <span>Retenue {retentionPct}% :</span>
                        <span className="tabular-nums">− {formatEuro(totals.retentionAmount)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Net à payer :</span>
                        <span className="tabular-nums">{formatEuro(totals.netToPay)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Options : Retenue + Situations + Caution */}
        <Card title="Conditions" icon={Lock}>
          <div className="space-y-3">
            {/* Retenue */}
            <div className="p-3 rounded-md bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Retenue de garantie</p>
                    <p className="text-[11px] text-muted-foreground">5% par défaut, libérée 1 an après réception</p>
                  </div>
                </div>
                <Toggle checked={retentionEnabled} onChange={() => setRetentionEnabled(!retentionEnabled)} />
              </div>
              {retentionEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 grid grid-cols-2 gap-3 overflow-hidden"
                >
                  <div>
                    <Label className="text-xs">Pourcentage (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={retentionPct}
                      onChange={(e) => setRetentionPct(parseFloat(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Date libération</Label>
                    <Input
                      type="date"
                      value={retentionReleaseDate}
                      onChange={(e) => setRetentionReleaseDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Situations */}
            <div className="p-3 rounded-md bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-violet-500" />
                  <div>
                    <p className="text-sm font-medium">Facturation par situations</p>
                    <p className="text-[11px] text-muted-foreground">Le ST émettra des situations d'avancement (au lieu d'une facture unique)</p>
                  </div>
                </div>
                <Toggle checked={hasSituations} onChange={() => setHasSituations(!hasSituations)} />
              </div>
            </div>

            {/* Caution */}
            <div className="p-3 rounded-md bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Caution bancaire requise</p>
                    <p className="text-[11px] text-muted-foreground">
                      {totals.totalHt > 600 ? "Recommandée (montant > 600€ HT, loi 1975)" : "Optionnelle"}
                    </p>
                  </div>
                </div>
                <Toggle checked={cautionRequired} onChange={() => setCautionRequired(!cautionRequired)} />
              </div>
              {cautionRequired && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Caution reçue</span>
                    <Toggle checked={cautionReceived} onChange={() => setCautionReceived(!cautionReceived)} />
                  </div>
                  {cautionVaultDocumentId ? (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs flex-1">Caution chiffrée dans le coffre-fort</span>
                      <Button variant="ghost" size="sm" onClick={() => setCautionVaultDocumentId("")}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => uploadToVault("Cautions sous-traitants", `Caution BdC ${reference || "(nouveau)"}`, setCautionVaultDocumentId, setUploadingCaution)}
                      loading={uploadingCaution}
                      className="w-full"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Joindre la caution
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </Card>

        {/* Documents */}
        <Card title="Documents joints" icon={FileText}>
          <div className="space-y-2">
            <div>
              <Label>Bon de commande signé (PDF / scan)</Label>
              {vaultDocumentId ? (
                <div className="mt-1.5 flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs flex-1">BdC chiffré dans le coffre-fort</span>
                  <Button variant="ghost" size="sm" onClick={() => setVaultDocumentId("")}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => uploadToVault("Bons de commande", `BdC ${reference || "(nouveau)"}`, setVaultDocumentId, setUploadingPo)}
                  loading={uploadingPo}
                  className="mt-1.5 w-full"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Joindre le BdC signé
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card title="Notes internes" icon={FileText}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes, points d'attention, remarques..."
          />
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-soft-sm transform transition",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}
