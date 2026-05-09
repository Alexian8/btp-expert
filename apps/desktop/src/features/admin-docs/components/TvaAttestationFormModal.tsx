import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, Receipt, Home, User, Hammer,
  CheckCircle2, FileText, Calendar,
  FilePlus, Eye, Download,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TVA_RATE_META, TVA_ATTESTATION_STATUS_META, LOGEMENT_TYPE_META,
  TVA_5_5_COMMITMENTS, TVA_10_COMMITMENTS,
  type TvaRate, type LogementType,
  type TvaAttestationType, type TvaAttestationStatus, type TvaAttestationCategory,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useClientsStore } from "@/stores/clientsStore";

// ═══════════════════════════════════════════════════════════════════════════
// TvaAttestationFormModal — Création / édition d'une attestation TVA
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  attestationId: string | null;
  onClose: () => void;
}

export function TvaAttestationFormModal({ open, attestationId, onClose }: Props) {
  const { createTvaAttestation, updateTvaAttestation, removeTvaAttestation, getTvaById } = useAdministrativeDocsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();
  const { clients, fetch: fetchClients } = useClientsStore();

  const [reference, setReference] = useState("");
  const [attestationType, setAttestationType] = useState<TvaAttestationType>("simplifiee");
  const [tvaRate, setTvaRate] = useState<TvaRate>(10);
  const [chantierId, setChantierId] = useState("");
  const [clientId, setClientId] = useState("");

  // Logement
  const [logementType, setLogementType] = useState<LogementType>("residence_principale");
  const [logementBuiltOver2Years, setLogementBuiltOver2Years] = useState(true);
  const [logementYearOfConstruction, setLogementYearOfConstruction] = useState("");
  const [logementAddress, setLogementAddress] = useState("");

  // Owner (client)
  const [ownerCivilite, setOwnerCivilite] = useState<"M." | "Mme" | "M. et Mme" | "">("M.");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  // Travaux
  const [category, setCategory] = useState<TvaAttestationCategory>("amelioration_qualite");
  const [worksDescription, setWorksDescription] = useState("");
  const [worksStartDate, setWorksStartDate] = useState("");
  const [worksEndDate, setWorksEndDate] = useState("");
  const [totalAmountHt, setTotalAmountHt] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");

  // Engagements
  const [clientCommitments, setClientCommitments] = useState<string[]>([]);

  // Signature
  const [signedDate, setSignedDate] = useState("");
  const [signedLocation, setSignedLocation] = useState("");
  const [status, setStatus] = useState<TvaAttestationStatus>("brouillon");

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isEditing = !!attestationId;

  const handleExportPdfPreview = async () => {
    if (!attestationId) return;
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    setGeneratingPdf(true);
    try {
      const r = await window.btpAPI.adminTvaExportPdfPreview(attestationId);
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
    if (!attestationId) return;
    if (!window.btpAPI) { toast.error("API non disponible"); return; }
    setGeneratingPdf(true);
    try {
      const r = await window.btpAPI.adminTvaExportPdfSaveAs(attestationId);
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
      if (attestationId) {
        const a = await getTvaById(attestationId);
        if (!a) {
          toast.error("Attestation introuvable");
          onClose();
          return;
        }
        setReference(a.reference);
        setAttestationType(a.attestationType);
        setTvaRate(a.tvaRate);
        setChantierId(a.chantierId);
        setClientId(a.clientId);
        setLogementType(a.logementType);
        setLogementBuiltOver2Years(a.logementBuiltOver2Years);
        setLogementYearOfConstruction(a.logementYearOfConstruction);
        setLogementAddress(a.logementAddress);
        setOwnerCivilite(a.ownerCivilite as any);
        setOwnerLastName(a.ownerLastName);
        setOwnerFirstName(a.ownerFirstName);
        setOwnerEmail(a.ownerEmail);
        setOwnerPhone(a.ownerPhone);
        setCategory(a.category);
        setWorksDescription(a.worksDescription);
        setWorksStartDate(a.worksStartDate);
        setWorksEndDate(a.worksEndDate);
        setTotalAmountHt(String(a.totalAmountHt).replace(".", ","));
        setInvoiceReference(a.invoiceReference);
        setClientCommitments(a.clientCommitments);
        setSignedDate(a.signedDate);
        setSignedLocation(a.signedLocation);
        setStatus(a.status);
      } else {
        setReference("");
        setAttestationType("simplifiee");
        setTvaRate(10);
        setChantierId("");
        setClientId("");
        setLogementType("residence_principale");
        setLogementBuiltOver2Years(true);
        setLogementYearOfConstruction("");
        setLogementAddress("");
        setOwnerCivilite("M.");
        setOwnerLastName("");
        setOwnerFirstName("");
        setOwnerEmail("");
        setOwnerPhone("");
        setCategory("amelioration_qualite");
        setWorksDescription("");
        setWorksStartDate("");
        setWorksEndDate("");
        setTotalAmountHt("");
        setInvoiceReference("");
        // Pré-cocher tous les engagements par défaut
        setClientCommitments(TVA_10_COMMITMENTS);
        setSignedDate(new Date().toISOString().slice(0, 10));
        setSignedLocation("");
        setStatus("brouillon");
      }
      setConfirmDelete(false);
    };
    load();
  }, [open, attestationId]);

  // Adapter catégorie + commitments selon le taux TVA
  useEffect(() => {
    if (isEditing) return;
    if (tvaRate === 5.5) {
      setCategory("renovation_energetique");
      setClientCommitments(TVA_5_5_COMMITMENTS);
    } else if (tvaRate === 10) {
      setCategory("amelioration_qualite");
      setClientCommitments(TVA_10_COMMITMENTS);
    }
  }, [tvaRate, isEditing]);

  // Auto-fill client info
  useEffect(() => {
    if (!clientId || isEditing) return;
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      if (client.type === "particulier") {
        if (!ownerLastName) setOwnerLastName(client.lastName || "");
        if (!ownerFirstName) setOwnerFirstName(client.firstName || "");
      }
      if (!ownerEmail) setOwnerEmail(client.email || "");
      if (!ownerPhone) setOwnerPhone(client.phoneMobile || client.phoneFixed || "");
      if (!logementAddress && client.addressLine1) {
        setLogementAddress([
          client.addressLine1,
          [client.postalCode, client.city].filter(Boolean).join(" "),
        ].filter(Boolean).join(", "));
      }
    }
  }, [clientId, isEditing]);

  // Auto-fill via chantier
  useEffect(() => {
    if (!chantierId || isEditing) return;
    const chantier = chantiers.find((c) => c.id === chantierId);
    if (chantier) {
      if (chantier.clientId && !clientId) setClientId(chantier.clientId);
      const chantierAddress = [
        chantier.addressLine1,
        chantier.addressLine2,
        [chantier.postalCode, chantier.city].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");
      if (chantierAddress && !logementAddress) setLogementAddress(chantierAddress);
      if (chantier.title && !worksDescription) setWorksDescription(chantier.title);
    }
  }, [chantierId, isEditing]);

  const toggleCommitment = (text: string) => {
    setClientCommitments((prev) =>
      prev.includes(text) ? prev.filter((c) => c !== text) : [...prev, text]
    );
  };

  const availableCommitments = tvaRate === 5.5 ? TVA_5_5_COMMITMENTS : TVA_10_COMMITMENTS;

  const handleSubmit = async () => {
    if (!chantierId) { toast.error("Sélectionnez un chantier"); return; }
    if (!ownerLastName) { toast.error("Nom du client requis"); return; }
    if (!logementAddress) { toast.error("Adresse du logement requise"); return; }
    if (!worksDescription) { toast.error("Description des travaux requise"); return; }
    if (!logementBuiltOver2Years) {
      toast.error("Le logement doit être achevé depuis +2 ans pour cette TVA réduite");
      return;
    }

    const client = clients.find((c) => c.id === clientId);
    const clientName = client
      ? (client.type === "particulier"
          ? `${client.firstName || ""} ${client.lastName || ""}`.trim()
          : client.companyName)
      : `${ownerFirstName} ${ownerLastName}`.trim();

    const payload = {
      attestationType, tvaRate,
      chantierId, clientId, clientName,
      logementType, logementBuiltOver2Years,
      logementYearOfConstruction: logementYearOfConstruction.trim(),
      logementAddress: logementAddress.trim(),
      ownerCivilite, ownerLastName: ownerLastName.trim(), ownerFirstName: ownerFirstName.trim(),
      ownerEmail: ownerEmail.trim(), ownerPhone: ownerPhone.trim(),
      category,
      worksDescription: worksDescription.trim(),
      worksStartDate, worksEndDate,
      totalAmountHt: parseFloat(totalAmountHt.replace(",", ".")) || 0,
      invoiceReference: invoiceReference.trim(),
      clientCommitments,
      signedDate, signedLocation: signedLocation.trim(),
      status,
    };

    setSaving(true);
    if (isEditing && attestationId) {
      const r = await updateTvaAttestation(attestationId, payload);
      setSaving(false);
      if (r.success) {
        toast.success("Attestation mise à jour");
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await createTvaAttestation(payload);
      setSaving(false);
      if (r.success) {
        toast.success(r.reference ? `Attestation créée (${r.reference})` : "Attestation créée");
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (!attestationId) return;
    setSaving(true);
    const r = await removeTvaAttestation(attestationId);
    setSaving(false);
    if (r.success) {
      toast.success("Attestation supprimée");
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
                  <Receipt className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold truncate">
                  {isEditing ? `Attestation ${reference}` : "Nouvelle attestation TVA"}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Type & taux */}
              <Section title="Type d'attestation et taux TVA" icon={Receipt}>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setTvaRate(5.5)}
                    className={cn(
                      "p-3 rounded-md border text-left transition-all",
                      tvaRate === 5.5
                        ? TVA_RATE_META["5.5"].colorTw + " border-transparent"
                        : "border-border bg-card hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <p className="text-sm font-bold">TVA 5,5%</p>
                    <p className="text-[10.5px] mt-0.5 opacity-80">{TVA_RATE_META["5.5"].description}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTvaRate(10)}
                    className={cn(
                      "p-3 rounded-md border text-left transition-all",
                      tvaRate === 10
                        ? TVA_RATE_META["10"].colorTw + " border-transparent"
                        : "border-border bg-card hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <p className="text-sm font-bold">TVA 10%</p>
                    <p className="text-[10.5px] mt-0.5 opacity-80">{TVA_RATE_META["10"].description}</p>
                  </button>
                </div>

                <div>
                  <Label>Format de l'attestation</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setAttestationType("simplifiee")}
                      className={cn(
                        "p-2.5 rounded-md border text-xs text-left transition-all",
                        attestationType === "simplifiee"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      <p className="font-semibold">Modèle simplifié</p>
                      <p className="text-[10.5px] opacity-80">Format libre, plus rapide</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttestationType("cerfa_1300")}
                      className={cn(
                        "p-2.5 rounded-md border text-xs text-left transition-all",
                        attestationType === "cerfa_1300"
                          ? "border-violet-500 bg-violet-500/10 text-violet-600"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      <p className="font-semibold">CERFA 1300-SD</p>
                      <p className="text-[10.5px] opacity-80">Format officiel DGFIP</p>
                    </button>
                  </div>
                </div>
              </Section>

              {/* Liens */}
              <Section title="Chantier et client" icon={FileText}>
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

              {/* Maître d'ouvrage */}
              <Section title="Maître d'ouvrage" icon={User}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Civilité</Label>
                    <select
                      value={ownerCivilite}
                      onChange={(e) => setOwnerCivilite(e.target.value as any)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                      <option value="M. et Mme">M. et Mme</option>
                      <option value="">—</option>
                    </select>
                  </div>
                  <div>
                    <Label>Prénom</Label>
                    <Input value={ownerFirstName} onChange={(e) => setOwnerFirstName(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Nom *</Label>
                    <Input value={ownerLastName} onChange={(e) => setOwnerLastName(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="mt-1.5" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Téléphone</Label>
                    <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
              </Section>

              {/* Logement */}
              <Section title="Logement concerné" icon={Home}>
                <div className="space-y-3">
                  <div>
                    <Label>Adresse complète *</Label>
                    <Textarea
                      value={logementAddress}
                      onChange={(e) => setLogementAddress(e.target.value)}
                      rows={2}
                      placeholder="Adresse, code postal, ville"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Type de logement</Label>
                      <select
                        value={logementType}
                        onChange={(e) => setLogementType(e.target.value as LogementType)}
                        className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                      >
                        {Object.entries(LOGEMENT_TYPE_META).map(([k, m]) => (
                          <option key={k} value={k}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Année construction</Label>
                      <Input
                        value={logementYearOfConstruction}
                        onChange={(e) => setLogementYearOfConstruction(e.target.value)}
                        placeholder="1985"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div className={cn(
                    "p-3 rounded-md border-2",
                    logementBuiltOver2Years
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-red-500/40 bg-red-500/5"
                  )}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logementBuiltOver2Years}
                        onChange={(e) => setLogementBuiltOver2Years(e.target.checked)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-semibold">
                          Logement achevé depuis plus de 2 ans à la date de début des travaux
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Condition obligatoire pour la TVA réduite. Sans cela, taux normal 20% applicable.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </Section>

              {/* Travaux */}
              <Section title="Travaux" icon={Hammer}>
                <div className="space-y-3">
                  <div>
                    <Label>Description des travaux *</Label>
                    <Textarea
                      value={worksDescription}
                      onChange={(e) => setWorksDescription(e.target.value)}
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Début travaux</Label>
                      <Input type="date" value={worksStartDate} onChange={(e) => setWorksStartDate(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Fin travaux</Label>
                      <Input type="date" value={worksEndDate} onChange={(e) => setWorksEndDate(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Montant HT (€)</Label>
                      <Input
                        value={totalAmountHt}
                        onChange={(e) => setTotalAmountHt(e.target.value)}
                        placeholder="0,00"
                        className="mt-1.5 tabular-nums"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Référence facture (si déjà émise)</Label>
                    <Input value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} placeholder="FA-2026-0001" className="mt-1.5" />
                  </div>
                </div>
              </Section>

              {/* Engagements client */}
              <Section title="Engagements du client" icon={CheckCircle2}>
                <div className="space-y-2">
                  {availableCommitments.map((commitment) => (
                    <label key={commitment} className="flex items-start gap-2 p-2.5 rounded-md hover:bg-accent/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clientCommitments.includes(commitment)}
                        onChange={() => toggleCommitment(commitment)}
                        className="mt-0.5"
                      />
                      <span className="text-xs flex-1">{commitment}</span>
                    </label>
                  ))}
                </div>
              </Section>

              {/* Signature */}
              <Section title="Signature" icon={Calendar}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Date de signature</Label>
                    <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Lieu</Label>
                    <Input value={signedLocation} onChange={(e) => setSignedLocation(e.target.value)} placeholder="Ville" className="mt-1.5" />
                  </div>
                </div>
              </Section>

              {/* Statut */}
              <Section title="Statut" icon={FileText}>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(TVA_ATTESTATION_STATUS_META) as TvaAttestationStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "py-2 px-2 rounded-md border text-xs font-medium transition-all",
                        status === s
                          ? TVA_ATTESTATION_STATUS_META[s].colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {TVA_ATTESTATION_STATUS_META[s].label}
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
                      {attestationType === "cerfa_1300" ? "Aperçu CERFA + coffre" : "Aperçu PDF + coffre"}
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
