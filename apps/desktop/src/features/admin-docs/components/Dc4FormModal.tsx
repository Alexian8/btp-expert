import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, FileText, Building, Hammer, CreditCard, ShieldCheck, Calendar,
  FilePlus, Eye, Download,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DC4_STATUS_META,
  type Dc4Status,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { usePurchaseOrdersStore } from "@/stores/purchaseOrdersStore";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { DocSignatureField } from "./DocSignatureField";

// ═══════════════════════════════════════════════════════════════════════════
// Dc4FormModal — Création / édition d'un DC4
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  declarationId: string | null;
  onClose: () => void;
}

export function Dc4FormModal({ open, declarationId, onClose }: Props) {
  const { createDc4, updateDc4, removeDc4, getDc4ById } = useAdministrativeDocsStore();
  const { purchaseOrders, fetchPos } = usePurchaseOrdersStore();
  const { subcontractors, fetch: fetchST } = useSubcontractorsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  const [reference, setReference] = useState("");

  // Liens
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [chantierId, setChantierId] = useState("");

  // Marché public
  const [publicMarketReference, setPublicMarketReference] = useState("");
  const [publicMarketObject, setPublicMarketObject] = useState("");
  const [publicAuthorityName, setPublicAuthorityName] = useState("");
  const [publicAuthorityAddress, setPublicAuthorityAddress] = useState("");

  // Sous-traitance
  const [subcontractedWorksDescription, setSubcontractedWorksDescription] = useState("");
  const [subcontractedAmountHt, setSubcontractedAmountHt] = useState("");
  const [subcontractedAmountTtc, setSubcontractedAmountTtc] = useState("");
  const [subcontractedDuration, setSubcontractedDuration] = useState("");

  // Conditions de paiement
  const [paymentMethod, setPaymentMethod] = useState("Paiement direct par le maître d'ouvrage");
  const [paymentDelay, setPaymentDelay] = useState(30);

  // Caution
  const [cautionType, setCautionType] = useState("Aucune");
  const [cautionRequired, setCautionRequired] = useState(false);
  const [cautionReceived, setCautionReceived] = useState(false);

  // Signature
  const [signedDate, setSignedDate] = useState("");
  const [signedLocation, setSignedLocation] = useState("");
  const [acteSpecialNumber, setActeSpecialNumber] = useState("");
  const [acceptanceDeadline, setAcceptanceDeadline] = useState("");
  const [contractorSignatureDataUrl, setContractorSignatureDataUrl] = useState("");
  const [ownerSignatureDataUrl, setOwnerSignatureDataUrl] = useState("");
  const [authoritySignatureDataUrl, setAuthoritySignatureDataUrl] = useState("");
  const [status, setStatus] = useState<Dc4Status>("brouillon");

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isEditing = !!declarationId;

  const handleExportPdfPreview = async () => {
    if (!declarationId) return;
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    setGeneratingPdf(true);
    try {
      const r = await window.btpAPI.adminDc4ExportPdfPreview(declarationId);
      if (r.success && r.path) {
        toast.success(r.vault?.documentId
          ? "PDF généré et stocké dans le coffre-fort"
          : "PDF généré");
        await window.btpAPI.adminOpenPdfExternal(r.path);
      } else {
        toast.error(r.error || "Erreur de génération");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportPdfSaveAs = async () => {
    if (!declarationId) return;
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    setGeneratingPdf(true);
    try {
      const r = await window.btpAPI.adminDc4ExportPdfSaveAs(declarationId);
      if (r.cancelled) return;
      if (r.success && r.path) {
        toast.success("PDF enregistré");
        await window.btpAPI.adminOpenPdfExternal(r.path);
      } else {
        toast.error(r.error || "Erreur");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setGeneratingPdf(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchPos();
    fetchST();
    fetchChantiers();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      if (declarationId) {
        const d = await getDc4ById(declarationId);
        if (!d) {
          toast.error("DC4 introuvable");
          onClose();
          return;
        }
        setReference(d.reference);
        setPurchaseOrderId(d.purchaseOrderId);
        setSubcontractorId(d.subcontractorId);
        setChantierId(d.chantierId);
        setPublicMarketReference(d.publicMarketReference);
        setPublicMarketObject(d.publicMarketObject);
        setPublicAuthorityName(d.publicAuthorityName);
        setPublicAuthorityAddress(d.publicAuthorityAddress);
        setSubcontractedWorksDescription(d.subcontractedWorksDescription);
        setSubcontractedAmountHt(String(d.subcontractedAmountHt).replace(".", ","));
        setSubcontractedAmountTtc(String(d.subcontractedAmountTtc).replace(".", ","));
        setSubcontractedDuration(d.subcontractedDuration);
        setPaymentMethod(d.paymentMethod);
        setPaymentDelay(d.paymentDelay);
        setCautionType(d.cautionType);
        setCautionRequired(d.cautionRequired);
        setCautionReceived(d.cautionReceived);
        setSignedDate(d.signedDate);
        setSignedLocation(d.signedLocation);
        const dExt = d as {
          acteSpecialNumber?: string;
          acceptanceDeadline?: string;
          contractorSignatureDataUrl?: string;
          ownerSignatureDataUrl?: string;
          authoritySignatureDataUrl?: string;
        };
        setActeSpecialNumber(dExt.acteSpecialNumber ?? "");
        setAcceptanceDeadline(dExt.acceptanceDeadline ?? "");
        setContractorSignatureDataUrl(dExt.contractorSignatureDataUrl ?? "");
        setOwnerSignatureDataUrl(dExt.ownerSignatureDataUrl ?? "");
        setAuthoritySignatureDataUrl(dExt.authoritySignatureDataUrl ?? "");
        setStatus(d.status);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        setReference("");
        setPurchaseOrderId("");
        setSubcontractorId("");
        setChantierId("");
        setPublicMarketReference("");
        setPublicMarketObject("");
        setPublicAuthorityName("");
        setPublicAuthorityAddress("");
        setSubcontractedWorksDescription("");
        setSubcontractedAmountHt("0");
        setSubcontractedAmountTtc("0");
        setSubcontractedDuration("");
        setPaymentMethod("Paiement direct par le maître d'ouvrage");
        setPaymentDelay(30);
        setCautionType("Aucune");
        setCautionRequired(false);
        setCautionReceived(false);
        setSignedDate(today);
        setSignedLocation("");
        setStatus("brouillon");
      }
      setConfirmDelete(false);
    };
    load();
  }, [open, declarationId]);

  // Auto-fill depuis le BdC sélectionné
  useEffect(() => {
    if (!purchaseOrderId || isEditing) return;
    const po = purchaseOrders.find((p) => p.id === purchaseOrderId);
    if (po) {
      if (po.subcontractorId && !subcontractorId) setSubcontractorId(po.subcontractorId);
      if (po.chantierId && !chantierId) setChantierId(po.chantierId);
      if (po.title && !subcontractedWorksDescription) setSubcontractedWorksDescription(po.title);
      if (po.totalHt && subcontractedAmountHt === "0") setSubcontractedAmountHt(String(po.totalHt).replace(".", ","));
      if (po.totalTtc && subcontractedAmountTtc === "0") setSubcontractedAmountTtc(String(po.totalTtc).replace(".", ","));
      if (po.cautionRequired) setCautionRequired(true);
      if (po.cautionReceived) setCautionReceived(true);
      if (po.paymentDelay) setPaymentDelay(po.paymentDelay);
    }
  }, [purchaseOrderId, isEditing, purchaseOrders.length]);

  const handleSubmit = async () => {
    if (!subcontractorId) { toast.error("Sélectionnez un sous-traitant"); return; }
    if (!publicMarketReference.trim()) { toast.error("Référence du marché public requise"); return; }
    if (!publicAuthorityName.trim()) { toast.error("Pouvoir adjudicateur requis"); return; }
    if (!subcontractedWorksDescription.trim()) { toast.error("Description des travaux sous-traités requise"); return; }

    const st = subcontractors.find((s) => s.id === subcontractorId);

    const payload = {
      purchaseOrderId,
      subcontractorId,
      subcontractorName: st?.companyName || "",
      chantierId,
      publicMarketReference: publicMarketReference.trim(),
      publicMarketObject: publicMarketObject.trim(),
      publicAuthorityName: publicAuthorityName.trim(),
      publicAuthorityAddress: publicAuthorityAddress.trim(),
      subcontractedWorksDescription: subcontractedWorksDescription.trim(),
      subcontractedAmountHt: parseFloat(subcontractedAmountHt.replace(",", ".")) || 0,
      subcontractedAmountTtc: parseFloat(subcontractedAmountTtc.replace(",", ".")) || 0,
      subcontractedDuration: subcontractedDuration.trim(),
      paymentMethod: paymentMethod.trim(),
      paymentDelay,
      cautionType: cautionType.trim(),
      cautionRequired,
      cautionReceived,
      signedDate,
      signedLocation: signedLocation.trim(),
      acteSpecialNumber: acteSpecialNumber.trim(),
      acceptanceDeadline,
      contractorSignatureDataUrl,
      ownerSignatureDataUrl,
      authoritySignatureDataUrl,
      status,
    };

    setSaving(true);
    if (isEditing && declarationId) {
      const r = await updateDc4(declarationId, payload);
      setSaving(false);
      if (r.success) {
        toast.success("DC4 mis à jour");
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await createDc4(payload);
      setSaving(false);
      if (r.success) {
        toast.success(r.reference ? `DC4 créé (${r.reference})` : "DC4 créé");
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (!declarationId) return;
    setSaving(true);
    const r = await removeDc4(declarationId);
    setSaving(false);
    if (r.success) {
      toast.success("DC4 supprimé");
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-3xl w-full max-h-[92vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold truncate">
                  {isEditing ? `DC4 ${reference}` : "Nouveau DC4"}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Liens BdC + ST + Chantier */}
              <Section title="Liens" icon={FileText}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>Bon de commande sous-traitant</Label>
                    <select
                      value={purchaseOrderId}
                      onChange={(e) => setPurchaseOrderId(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">— Sélectionnez un BdC pour pré-remplir —</option>
                      {purchaseOrders.map((po) => (
                        <option key={po.id} value={po.id}>{po.reference} · {po.title} · {po.subcontractorName}</option>
                      ))}
                    </select>
                    <p className="text-[10.5px] text-muted-foreground mt-1">
                      Sélectionnez un BdC pour auto-remplir le ST, le chantier et les montants
                    </p>
                  </div>
                  <div>
                    <Label>Sous-traitant *</Label>
                    <select
                      value={subcontractorId}
                      onChange={(e) => setSubcontractorId(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Sélectionnez</option>
                      {subcontractors.map((s) => (
                        <option key={s.id} value={s.id}>{s.companyName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Chantier</Label>
                    <select
                      value={chantierId}
                      onChange={(e) => setChantierId(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">—</option>
                      {chantiers.map((c) => (
                        <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Section>

              {/* Marché public */}
              <Section title="Marché public" icon={Building}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Référence du marché *</Label>
                    <Input
                      value={publicMarketReference}
                      onChange={(e) => setPublicMarketReference(e.target.value)}
                      placeholder="MAPA-2026-001"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Pouvoir adjudicateur *</Label>
                    <Input
                      value={publicAuthorityName}
                      onChange={(e) => setPublicAuthorityName(e.target.value)}
                      placeholder="Mairie de Muzeray"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Objet du marché</Label>
                    <Textarea
                      value={publicMarketObject}
                      onChange={(e) => setPublicMarketObject(e.target.value)}
                      rows={2}
                      placeholder="Rénovation de la salle des fêtes..."
                      className="mt-1.5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Adresse du pouvoir adjudicateur</Label>
                    <Textarea
                      value={publicAuthorityAddress}
                      onChange={(e) => setPublicAuthorityAddress(e.target.value)}
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </Section>

              {/* Sous-traitance */}
              <Section title="Sous-traitance déclarée" icon={Hammer}>
                <div className="space-y-3">
                  <div>
                    <Label>Description des travaux sous-traités *</Label>
                    <Textarea
                      value={subcontractedWorksDescription}
                      onChange={(e) => setSubcontractedWorksDescription(e.target.value)}
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Montant HT (€)</Label>
                      <Input
                        value={subcontractedAmountHt}
                        onChange={(e) => setSubcontractedAmountHt(e.target.value)}
                        placeholder="0,00"
                        className="mt-1.5 tabular-nums"
                      />
                    </div>
                    <div>
                      <Label>Montant TTC (€)</Label>
                      <Input
                        value={subcontractedAmountTtc}
                        onChange={(e) => setSubcontractedAmountTtc(e.target.value)}
                        placeholder="0,00"
                        className="mt-1.5 tabular-nums"
                      />
                    </div>
                    <div>
                      <Label>Durée prévue</Label>
                      <Input
                        value={subcontractedDuration}
                        onChange={(e) => setSubcontractedDuration(e.target.value)}
                        placeholder="3 mois"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              </Section>

              {/* Conditions paiement */}
              <Section title="Conditions de paiement" icon={CreditCard}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Modalité de paiement</Label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option>Paiement direct par le maître d'ouvrage</option>
                      <option>Paiement par l'entrepreneur principal</option>
                      <option>Paiement mixte</option>
                    </select>
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
                </div>
              </Section>

              {/* Caution */}
              <Section title="Caution / garantie" icon={ShieldCheck}>
                <div className="space-y-3">
                  <div>
                    <Label>Type de caution</Label>
                    <select
                      value={cautionType}
                      onChange={(e) => setCautionType(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option>Aucune</option>
                      <option>Caution bancaire</option>
                      <option>Caution personnelle et solidaire</option>
                      <option>Garantie à première demande</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 rounded-md border border-border cursor-pointer">
                      <input type="checkbox" checked={cautionRequired} onChange={(e) => setCautionRequired(e.target.checked)} />
                      <span className="text-sm">Caution requise</span>
                    </label>
                    <label className={cn(
                      "flex items-center gap-2 p-3 rounded-md border cursor-pointer",
                      !cautionRequired && "opacity-50"
                    )}>
                      <input
                        type="checkbox"
                        checked={cautionReceived}
                        onChange={(e) => setCautionReceived(e.target.checked)}
                        disabled={!cautionRequired}
                      />
                      <span className="text-sm">Caution reçue</span>
                    </label>
                  </div>
                </div>
              </Section>

              {/* Acte spécial */}
              <Section title="Acte spécial" icon={FileText}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>N° de l'acte spécial</Label>
                    <Input
                      value={acteSpecialNumber}
                      onChange={(e) => setActeSpecialNumber(e.target.value)}
                      placeholder="ex : AS-2025-001"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Date limite d'acceptation par le pouvoir adjudicateur</Label>
                    <Input
                      type="date"
                      value={acceptanceDeadline}
                      onChange={(e) => setAcceptanceDeadline(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </Section>

              {/* Signature */}
              <Section title="Signature" icon={Calendar}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <Label>Date de signature</Label>
                    <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Lieu</Label>
                    <Input value={signedLocation} onChange={(e) => setSignedLocation(e.target.value)} placeholder="Ville" className="mt-1.5" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <DocSignatureField
                    label="Signature de l'entrepreneur principal (titulaire du marché)"
                    value={contractorSignatureDataUrl}
                    onChange={setContractorSignatureDataUrl}
                  />
                  <DocSignatureField
                    label="Signature du sous-traitant"
                    value={ownerSignatureDataUrl}
                    onChange={setOwnerSignatureDataUrl}
                  />
                  <DocSignatureField
                    label="Signature du pouvoir adjudicateur (maître d'ouvrage public)"
                    description="Réservée à l'administration. Marque l'acceptation officielle du sous-traitant et l'agrément des conditions de paiement (art. L. 2193-3 Code de la commande publique)."
                    value={authoritySignatureDataUrl}
                    onChange={setAuthoritySignatureDataUrl}
                  />
                </div>
              </Section>

              {/* Statut */}
              <Section title="Statut" icon={FileText}>
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.keys(DC4_STATUS_META) as Dc4Status[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "py-2 px-2 rounded-md border text-xs font-medium transition-all",
                        status === s
                          ? DC4_STATUS_META[s].colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {DC4_STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
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
              <div className="flex items-center gap-2 flex-wrap">
                {isEditing && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleExportPdfPreview} loading={generatingPdf}>
                      <Eye className="w-3.5 h-3.5" />
                      Aperçu PDF + coffre
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPdfSaveAs} loading={generatingPdf}>
                      <Download className="w-3.5 h-3.5" />
                      Télécharger
                    </Button>
                    <span className="text-xs text-muted-foreground mx-1">·</span>
                  </>
                )}
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button onClick={handleSubmit} loading={saving}>
                  {isEditing ? <Save className="w-4 h-4" /> : <FilePlus className="w-4 h-4" />}
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

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
