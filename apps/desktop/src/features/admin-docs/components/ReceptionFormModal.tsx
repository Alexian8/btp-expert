import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, ClipboardCheck, Plus, Calendar,
  MapPin, Users, FileText, AlertTriangle, ShieldCheck,
  FilePlus, Eye, Download,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RECEPTION_TYPE_META, RECEPTION_STATUS_META,
  type ReceptionType, type ReceptionStatus,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useCompanyStore } from "@/stores/companyStore";

// ═══════════════════════════════════════════════════════════════════════════
// ReceptionFormModal — Création/édition d'un PV de réception
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  reportId: string | null;
  onClose: () => void;
}

interface DraftReserve {
  id?: string;
  description: string;
  location: string;
  category: string;
  toBeFixedBefore: string;
  fixed: boolean;
  fixedDate: string;
}

const RESERVE_CATEGORIES = ["finition", "défaut", "non-conforme", "fonctionnement", "autre"];

export function ReceptionFormModal({ open, reportId, onClose }: Props) {
  const { createReception, updateReception, removeReception, getReceptionById } = useAdministrativeDocsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();
  const { clients, fetch: fetchClients } = useClientsStore();
  const { company } = useCompanyStore();

  const [chantierId, setChantierId] = useState("");
  const [clientId, setClientId] = useState("");
  const [receptionType, setReceptionType] = useState<ReceptionType>("sans_reserves");
  const [receptionDate, setReceptionDate] = useState("");
  const [guaranteeStartDate, setGuaranteeStartDate] = useState("");
  const [location, setLocation] = useState("");
  const [ownerPresent, setOwnerPresent] = useState("");
  const [contractorPresent, setContractorPresent] = useState("");
  const [worksDescription, setWorksDescription] = useState("");
  const [observations, setObservations] = useState("");
  const [retentionAmount, setRetentionAmount] = useState("");
  const [retentionReleaseDate, setRetentionReleaseDate] = useState("");
  const [ownerSigned, setOwnerSigned] = useState(false);
  const [ownerSignedDate, setOwnerSignedDate] = useState("");
  const [contractorSigned, setContractorSigned] = useState(false);
  const [contractorSignedDate, setContractorSignedDate] = useState("");
  const [status, setStatus] = useState<ReceptionStatus>("brouillon");

  const [reserves, setReserves] = useState<DraftReserve[]>([]);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reference, setReference] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isEditing = !!reportId;

  const handleExportPdfPreview = async () => {
    if (!reportId) return;
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    setGeneratingPdf(true);
    try {
      const r = await window.btpAPI.adminReceptionExportPdfPreview(reportId);
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
    if (!reportId) return;
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    setGeneratingPdf(true);
    try {
      const r = await window.btpAPI.adminReceptionExportPdfSaveAs(reportId);
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
    fetchChantiers();
    fetchClients();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      if (reportId) {
        const r = await getReceptionById(reportId);
        if (!r) {
          toast.error("PV introuvable");
          onClose();
          return;
        }
        setReference(r.reference);
        setChantierId(r.chantierId);
        setClientId(r.clientId);
        setReceptionType(r.receptionType);
        setReceptionDate(r.receptionDate);
        setGuaranteeStartDate(r.guaranteeStartDate);
        setLocation(r.location);
        setOwnerPresent(r.ownerPresent);
        setContractorPresent(r.contractorPresent);
        setWorksDescription(r.worksDescription);
        setObservations(r.observations);
        setRetentionAmount(String(r.retentionAmount).replace(".", ","));
        setRetentionReleaseDate(r.retentionReleaseDate);
        setOwnerSigned(r.ownerSigned);
        setOwnerSignedDate(r.ownerSignedDate);
        setContractorSigned(r.contractorSigned);
        setContractorSignedDate(r.contractorSignedDate);
        setStatus(r.status);
        setReserves(r.reserves.map((res) => ({
          id: res.id,
          description: res.description,
          location: res.location,
          category: res.category,
          toBeFixedBefore: res.toBeFixedBefore,
          fixed: res.fixed,
          fixedDate: res.fixedDate,
        })));
      } else {
        const today = new Date().toISOString().slice(0, 10);
        setReference("");
        setChantierId("");
        setClientId("");
        setReceptionType("sans_reserves");
        setReceptionDate(today);
        setGuaranteeStartDate(today);
        setLocation("");
        setOwnerPresent("");
        setContractorPresent(company ? `${company.companyName}` : "");
        setWorksDescription("");
        setObservations("");
        setRetentionAmount("0");
        setRetentionReleaseDate("");
        setOwnerSigned(false);
        setOwnerSignedDate("");
        setContractorSigned(false);
        setContractorSignedDate("");
        setStatus("brouillon");
        setReserves([]);
      }
      setConfirmDelete(false);
    };
    load();
  }, [open, reportId]);

  // Auto-update guarantee date = reception date
  useEffect(() => {
    if (!isEditing && receptionDate) {
      setGuaranteeStartDate(receptionDate);
    }
  }, [receptionDate, isEditing]);

  // Auto-populate based on chantier selection
  useEffect(() => {
    if (!chantierId || isEditing) return;
    const chantier = chantiers.find((c) => c.id === chantierId);
    if (chantier) {
      if (chantier.clientId && !clientId) setClientId(chantier.clientId);
      // Composer l'adresse à partir des champs Chantier
      const chantierAddress = [
        chantier.addressLine1,
        chantier.addressLine2,
        [chantier.postalCode, chantier.city].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");
      if (chantierAddress && !location) setLocation(chantierAddress);
      if (chantier.title && !worksDescription) setWorksDescription(chantier.title);
    }
  }, [chantierId, isEditing]);

  // Auto-fill ownerPresent from client
  useEffect(() => {
    if (!clientId || isEditing) return;
    const client = clients.find((c) => c.id === clientId);
    if (client && !ownerPresent) {
      const name = client.type === "particulier"
        ? `${client.firstName || ""} ${client.lastName || ""}`.trim()
        : client.companyName;
      if (name) setOwnerPresent(name);
    }
  }, [clientId, isEditing]);

  // Switch reception type → adapt status workflow
  const isAvecReserves = receptionType === "avec_reserves";

  const addReserve = () => {
    setReserves([...reserves, {
      description: "",
      location: "",
      category: "finition",
      toBeFixedBefore: "",
      fixed: false,
      fixedDate: "",
    }]);
  };

  const updateReserve = (idx: number, key: keyof DraftReserve, value: any) => {
    setReserves((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r));
  };

  const removeReserveAt = (idx: number) => {
    setReserves((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!chantierId) { toast.error("Sélectionnez un chantier"); return; }
    if (!receptionDate) { toast.error("Date de réception requise"); return; }
    if (isAvecReserves && reserves.length === 0) {
      toast.error("Ajoutez au moins une réserve ou changez le type de réception");
      return;
    }

    const client = clients.find((c) => c.id === clientId);
    const clientName = client
      ? (client.type === "particulier"
          ? `${client.firstName || ""} ${client.lastName || ""}`.trim()
          : client.companyName)
      : "";

    const payload = {
      chantierId,
      clientId,
      clientName,
      receptionType,
      receptionDate,
      guaranteeStartDate,
      location: location.trim(),
      ownerPresent: ownerPresent.trim(),
      contractorPresent: contractorPresent.trim(),
      worksDescription: worksDescription.trim(),
      observations: observations.trim(),
      retentionAmount: parseFloat(retentionAmount.replace(",", ".")) || 0,
      retentionReleaseDate,
      ownerSigned, ownerSignedDate,
      contractorSigned, contractorSignedDate,
      status,
      reserves: isAvecReserves ? reserves : [],
    };

    setSaving(true);
    if (isEditing && reportId) {
      const r = await updateReception(reportId, payload);
      setSaving(false);
      if (r.success) {
        toast.success("PV mis à jour");
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await createReception(payload);
      setSaving(false);
      if (r.success) {
        toast.success(r.reference ? `PV créé (${r.reference})` : "PV créé");
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (!reportId) return;
    setSaving(true);
    const r = await removeReception(reportId);
    setSaving(false);
    if (r.success) {
      toast.success("PV supprimé");
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
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold truncate">
                  {isEditing ? `PV ${reference}` : "Nouveau PV de réception"}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Type de réception */}
              <Section title="Type de réception" icon={ClipboardCheck}>
                <div className="grid grid-cols-3 gap-2">
                  {(["sans_reserves", "avec_reserves", "refusee"] as ReceptionType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setReceptionType(t)}
                      className={cn(
                        "p-3 rounded-md border text-left transition-all",
                        receptionType === t
                          ? RECEPTION_TYPE_META[t].colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      <p className="text-sm font-semibold">{RECEPTION_TYPE_META[t].label}</p>
                      <p className="text-[10.5px] mt-0.5 opacity-80">{RECEPTION_TYPE_META[t].description}</p>
                    </button>
                  ))}
                </div>
              </Section>

              {/* Liens */}
              <Section title="Liens" icon={FileText}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div>
                    <Label>Client</Label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">—</option>
                      {clients.map((c) => {
                        const name = c.type === "particulier"
                          ? `${c.firstName || ""} ${c.lastName || ""}`.trim()
                          : c.companyName;
                        return <option key={c.id} value={c.id}>{name}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </Section>

              {/* Dates */}
              <Section title="Dates" icon={Calendar}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Date de réception *</Label>
                    <Input type="date" value={receptionDate} onChange={(e) => setReceptionDate(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Début garantie décennale</Label>
                    <Input type="date" value={guaranteeStartDate} onChange={(e) => setGuaranteeStartDate(e.target.value)} className="mt-1.5" />
                    <p className="text-[10.5px] text-muted-foreground mt-1">Généralement = date de réception</p>
                  </div>
                </div>
              </Section>

              {/* Lieu et personnes */}
              <Section title="Lieu et personnes" icon={MapPin}>
                <div className="space-y-3">
                  <div>
                    <Label>Adresse du chantier</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Maître d'ouvrage présent</Label>
                      <Input value={ownerPresent} onChange={(e) => setOwnerPresent(e.target.value)} placeholder="Nom du client" className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Entreprise représentée par</Label>
                      <Input value={contractorPresent} onChange={(e) => setContractorPresent(e.target.value)} className="mt-1.5" />
                    </div>
                  </div>
                </div>
              </Section>

              {/* Description */}
              <Section title="Travaux réceptionnés" icon={FileText}>
                <div>
                  <Label>Description des travaux *</Label>
                  <Textarea
                    value={worksDescription}
                    onChange={(e) => setWorksDescription(e.target.value)}
                    rows={3}
                    placeholder="Résumé des travaux réceptionnés..."
                    className="mt-1.5"
                  />
                </div>
                <div className="mt-3">
                  <Label>Observations</Label>
                  <Textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    rows={2}
                    className="mt-1.5"
                  />
                </div>
              </Section>

              {/* Réserves (si avec_reserves) */}
              {isAvecReserves && (
                <Section title={`Réserves (${reserves.length})`} icon={AlertTriangle}>
                  {reserves.length === 0 ? (
                    <Button variant="outline" size="sm" onClick={addReserve} className="w-full">
                      <Plus className="w-4 h-4" />
                      Ajouter la première réserve
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {reserves.map((res, idx) => (
                          <div key={idx} className="p-3 rounded-md bg-amber-500/5 border border-amber-500/20">
                            <div className="grid grid-cols-12 gap-2 mb-2">
                              <div className="col-span-12 md:col-span-7">
                                <Input
                                  value={res.description}
                                  onChange={(e) => updateReserve(idx, "description", e.target.value)}
                                  placeholder="Description de la réserve"
                                  className="h-9"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-3">
                                <Input
                                  value={res.location}
                                  onChange={(e) => updateReserve(idx, "location", e.target.value)}
                                  placeholder="Localisation"
                                  className="h-9"
                                />
                              </div>
                              <div className="col-span-6 md:col-span-2">
                                <select
                                  value={res.category}
                                  onChange={(e) => updateReserve(idx, "category", e.target.value)}
                                  className="h-9 w-full px-2 rounded-md border border-input bg-background text-xs"
                                >
                                  {RESERVE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-5">
                                <Label className="text-[10.5px]">À lever avant</Label>
                                <Input
                                  type="date"
                                  value={res.toBeFixedBefore}
                                  onChange={(e) => updateReserve(idx, "toBeFixedBefore", e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="col-span-3 self-end">
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={res.fixed}
                                    onChange={(e) => updateReserve(idx, "fixed", e.target.checked)}
                                  />
                                  Levée
                                </label>
                              </div>
                              {res.fixed && (
                                <div className="col-span-3">
                                  <Input
                                    type="date"
                                    value={res.fixedDate}
                                    onChange={(e) => updateReserve(idx, "fixedDate", e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              )}
                              <div className={cn("flex justify-end", res.fixed ? "col-span-1" : "col-span-4")}>
                                <Button variant="ghost" size="icon" onClick={() => removeReserveAt(idx)}>
                                  <X className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" onClick={addReserve} className="w-full mt-2">
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une réserve
                      </Button>
                    </>
                  )}
                </Section>
              )}

              {/* Retenue garantie */}
              <Section title="Retenue de garantie" icon={ShieldCheck}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Montant retenu (€)</Label>
                    <Input
                      value={retentionAmount}
                      onChange={(e) => setRetentionAmount(e.target.value)}
                      placeholder="0,00"
                      className="mt-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <Label>Date prévue libération</Label>
                    <Input
                      type="date"
                      value={retentionReleaseDate}
                      onChange={(e) => setRetentionReleaseDate(e.target.value)}
                      className="mt-1.5"
                    />
                    <p className="text-[10.5px] text-muted-foreground mt-1">Habituellement +1 an après la réception</p>
                  </div>
                </div>
              </Section>

              {/* Signatures */}
              <Section title="Signatures" icon={Users}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-md border border-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={ownerSigned} onChange={(e) => setOwnerSigned(e.target.checked)} />
                      <span className="text-sm font-medium">Maître d'ouvrage</span>
                    </label>
                    {ownerSigned && (
                      <Input
                        type="date"
                        value={ownerSignedDate}
                        onChange={(e) => setOwnerSignedDate(e.target.value)}
                        className="mt-2 text-xs"
                      />
                    )}
                  </div>
                  <div className="p-3 rounded-md border border-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={contractorSigned} onChange={(e) => setContractorSigned(e.target.checked)} />
                      <span className="text-sm font-medium">Entreprise</span>
                    </label>
                    {contractorSigned && (
                      <Input
                        type="date"
                        value={contractorSignedDate}
                        onChange={(e) => setContractorSignedDate(e.target.value)}
                        className="mt-2 text-xs"
                      />
                    )}
                  </div>
                </div>
              </Section>

              {/* Statut */}
              <Section title="Statut" icon={ClipboardCheck}>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(RECEPTION_STATUS_META) as ReceptionStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "py-2 px-2 rounded-md border text-xs font-medium transition-all",
                        status === s
                          ? RECEPTION_STATUS_META[s].colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {RECEPTION_STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            {/* Footer */}
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
