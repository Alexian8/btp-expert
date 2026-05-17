import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, Building2, Calendar, FileText, Eye, Download, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DAACT_PERMIT_TYPE_META, DAACT_STATUS_META,
  type DaactPermitType, type DaactStatus,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useCompanyStore } from "@/stores/companyStore";
import { DocSignatureField } from "./DocSignatureField";

// ═══════════════════════════════════════════════════════════════════════════
// DaactFormModal — Création/édition d'une DAACT (CERFA 13408*13)
// Pré-remplissage automatique depuis le chantier sélectionné + entreprise.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  declarationId: string | null;
  onClose: () => void;
}

export function DaactFormModal({ open, declarationId, onClose }: Props) {
  const { createDaact, updateDaact, removeDaact, getDaactById } = useAdministrativeDocsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();
  const { company, fetch: fetchCompany } = useCompanyStore();

  const isEditing = Boolean(declarationId);

  const [chantierId, setChantierId] = useState("");
  const [permitType, setPermitType] = useState<DaactPermitType>("permis_construire");
  const [permitNumber, setPermitNumber] = useState("");
  const [voiriesDifferees, setVoiriesDifferees] = useState(false);
  const [voiriesDate, setVoiriesDate] = useState("");

  // Identité déclarant — auto-rempli depuis entreprise
  const [denomination, setDenomination] = useState("");
  const [siret, setSiret] = useState("");
  const [representantNom, setRepresentantNom] = useState("");
  const [representantPrenom, setRepresentantPrenom] = useState("");
  const [email, setEmail] = useState("");

  // Achèvement
  const [achievementDate, setAchievementDate] = useState("");
  const [destinationChangeDate, setDestinationChangeDate] = useState("");
  const [partialWorks, setPartialWorks] = useState(false);
  const [partialWorksDescription, setPartialWorksDescription] = useState("");
  const [surfaceCreated, setSurfaceCreated] = useState(0);
  const [nbLogementsTotal, setNbLogementsTotal] = useState(0);
  const [nbIndividuels, setNbIndividuels] = useState(0);
  const [nbCollectifs, setNbCollectifs] = useState(0);

  // Signatures
  const [signedDate, setSignedDate] = useState("");
  const [signedLocation, setSignedLocation] = useState("");
  const [declarantSignatureDataUrl, setDeclarantSignatureDataUrl] = useState("");

  // Statut
  const [status, setStatus] = useState<DaactStatus>("brouillon");

  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Boot
  useEffect(() => {
    if (!open) return;
    fetchChantiers();
    fetchCompany();
    if (declarationId) {
      void (async () => {
        const d = await getDaactById(declarationId);
        if (!d) return;
        setChantierId(d.chantierId);
        setPermitType(d.permitType);
        setPermitNumber(d.permitNumber);
        setVoiriesDifferees(d.voiriesDifferees);
        setVoiriesDate(d.voiriesDate);
        setDenomination(d.denomination);
        setSiret(d.siret);
        setRepresentantNom(d.representantNom);
        setRepresentantPrenom(d.representantPrenom);
        setEmail(d.email);
        setAchievementDate(d.achievementDate);
        setDestinationChangeDate(d.destinationChangeDate);
        setPartialWorks(d.partialWorks);
        setPartialWorksDescription(d.partialWorksDescription);
        setSurfaceCreated(d.surfaceCreated);
        setNbLogementsTotal(d.nbLogementsTotal);
        setNbIndividuels(d.nbIndividuels);
        setNbCollectifs(d.nbCollectifs);
        setSignedDate(d.signedDate);
        setSignedLocation(d.signedLocation);
        setDeclarantSignatureDataUrl(d.declarantSignatureDataUrl);
        setStatus(d.status);
      })();
    } else {
      // Reset pour nouveau
      setChantierId("");
      setPermitType("permis_construire");
      setPermitNumber("");
      setVoiriesDifferees(false);
      setVoiriesDate("");
      setAchievementDate(new Date().toISOString().slice(0, 10));
      setDestinationChangeDate("");
      setPartialWorks(false);
      setPartialWorksDescription("");
      setSurfaceCreated(0);
      setNbLogementsTotal(0);
      setNbIndividuels(0);
      setNbCollectifs(0);
      setSignedDate(new Date().toISOString().slice(0, 10));
      setDeclarantSignatureDataUrl("");
      setStatus("brouillon");
    }
  }, [open, declarationId]);

  // Auto-remplissage depuis entreprise (pour nouveau)
  useEffect(() => {
    if (!open || declarationId) return;
    if (company) {
      setDenomination(company.companyName || "");
      setSiret(company.siret || "");
      setRepresentantNom(company.leaderLastName || "");
      setRepresentantPrenom(company.leaderFirstName || "");
      setEmail(company.email || "");
      setSignedLocation(company.city || "");
    }
  }, [open, declarationId, company]);

  // Auto-remplissage permitNumber + surface + dates depuis le chantier sélectionné
  function applyChantierAutofill(cId: string) {
    setChantierId(cId);
    const c = chantiers.find((x) => x.id === cId);
    if (!c) return;
    const cExt = c as unknown as Record<string, unknown>;
    // Le chantier peut avoir un n° de permis stocké en champ libre
    const pNum = (cExt.permitNumber as string) || (cExt.numeroPermis as string) || "";
    if (pNum) setPermitNumber(pNum);
    const surf = Number(cExt.surface ?? cExt.surfacePlancher ?? 0);
    if (surf > 0) setSurfaceCreated(surf);
    const endDate = (cExt.endDate as string) || (cExt.dateFin as string) || "";
    if (endDate) setAchievementDate(endDate.slice(0, 10));
  }

  const handleSave = async () => {
    if (!chantierId) {
      toast.error("Sélectionnez un chantier");
      return;
    }
    if (!permitNumber.trim()) {
      toast.error("Le N° du permis est obligatoire");
      return;
    }
    if (!achievementDate) {
      toast.error("La date d'achèvement est obligatoire");
      return;
    }

    const payload = {
      chantierId,
      permitType,
      permitNumber: permitNumber.trim(),
      voiriesDifferees,
      voiriesDate,
      titulaireNom: "",
      titulairePrenom: "",
      denomination: denomination.trim(),
      siret: siret.trim(),
      representantNom: representantNom.trim(),
      representantPrenom: representantPrenom.trim(),
      email: email.trim(),
      achievementDate,
      destinationChangeDate,
      partialWorks,
      partialWorksDescription: partialWorksDescription.trim(),
      surfaceCreated: Number(surfaceCreated) || 0,
      nbLogementsTotal: Number(nbLogementsTotal) || 0,
      nbIndividuels: Number(nbIndividuels) || 0,
      nbCollectifs: Number(nbCollectifs) || 0,
      signedDate,
      signedLocation: signedLocation.trim(),
      declarantSignatureDataUrl,
      status,
    };

    setSaving(true);
    const res = isEditing && declarationId
      ? await updateDaact(declarationId, payload)
      : await createDaact(payload);
    setSaving(false);

    if (res.success) {
      toast.success(isEditing ? "DAACT mise à jour" : "DAACT créée");
      onClose();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!declarationId) return;
    const r = await removeDaact(declarationId);
    if (r.success) {
      toast.success("DAACT supprimée");
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleExportPdf = async (mode: "preview" | "save") => {
    if (!declarationId) return;
    setGeneratingPdf(true);
    const r = mode === "preview"
      ? await window.btpAPI?.adminDaactExportPdfPreview?.(declarationId)
      : await window.btpAPI?.adminDaactExportPdfSaveAs?.(declarationId);
    setGeneratingPdf(false);
    if (!r) return;
    const cancelled = (r as { cancelled?: boolean }).cancelled === true;
    if (r.success) toast.success("CERFA généré");
    else if (!cancelled) toast.error(r.error || "Erreur PDF");
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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-4xl w-full max-h-[95vh] flex flex-col"
          >
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {isEditing ? "Modifier la DAACT" : "Nouvelle DAACT"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    CERFA 13408*13 — Déclaration attestant l'achèvement et la conformité
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Chantier — déclenche l'autofill */}
              <Section title="Chantier" icon={Building2}>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-md p-2.5 mb-3 text-xs flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <strong>Pré-remplissage automatique :</strong> la sélection d'un chantier
                    remplit automatiquement le n° de permis, la surface créée et la date
                    d'achèvement quand ces données existent.
                  </div>
                </div>
                <Label>Chantier *</Label>
                <select
                  value={chantierId}
                  onChange={(e) => applyChantierAutofill(e.target.value)}
                  className="w-full mt-1.5 px-3 py-1.5 text-sm rounded-md border border-border bg-card"
                >
                  <option value="">— Sélectionner un chantier —</option>
                  {chantiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.reference} · {c.title}
                    </option>
                  ))}
                </select>
              </Section>

              {/* Permis */}
              <Section title="Désignation du permis" icon={FileText}>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(Object.keys(DAACT_PERMIT_TYPE_META) as DaactPermitType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPermitType(t)}
                      className={cn(
                        "p-2 rounded-md border text-xs font-medium transition-all",
                        permitType === t
                          ? "bg-blue-500/10 border-blue-500 text-blue-600"
                          : "bg-card border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <p className="font-semibold">{DAACT_PERMIT_TYPE_META[t].short}</p>
                      <p className="text-[10px] opacity-80">{DAACT_PERMIT_TYPE_META[t].label}</p>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>N° du permis *</Label>
                    <Input
                      value={permitNumber}
                      onChange={(e) => setPermitNumber(e.target.value)}
                      placeholder="ex : PC 075 056 23 X0001"
                      className="mt-1.5 font-mono"
                    />
                  </div>
                  {permitType === "permis_amenager" && (
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={voiriesDifferees}
                          onChange={(e) => setVoiriesDifferees(e.target.checked)}
                        />
                        <span>Travaux de finition des voiries différés</span>
                      </label>
                      {voiriesDifferees && (
                        <Input
                          type="date"
                          value={voiriesDate}
                          onChange={(e) => setVoiriesDate(e.target.value)}
                          className="text-xs"
                        />
                      )}
                    </div>
                  )}
                </div>
              </Section>

              {/* Déclarant (personne morale) */}
              <Section title="Déclarant — personne morale" icon={Building2}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Dénomination / Raison sociale</Label>
                    <Input
                      value={denomination}
                      onChange={(e) => setDenomination(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>N° SIRET</Label>
                    <Input
                      value={siret}
                      onChange={(e) => setSiret(e.target.value)}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <Label>Représentant — Nom</Label>
                    <Input
                      value={representantNom}
                      onChange={(e) => setRepresentantNom(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Représentant — Prénom</Label>
                    <Input
                      value={representantPrenom}
                      onChange={(e) => setRepresentantPrenom(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </Section>

              {/* Achèvement */}
              <Section title="Achèvement des travaux" icon={Calendar}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label>Date d'achèvement *</Label>
                    <Input
                      type="date"
                      value={achievementDate}
                      onChange={(e) => setAchievementDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Date du changement de destination</Label>
                    <Input
                      type="date"
                      value={destinationChangeDate}
                      onChange={(e) => setDestinationChangeDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={partialWorks}
                    onChange={(e) => setPartialWorks(e.target.checked)}
                  />
                  <span>Achèvement partiel (tranche de travaux)</span>
                </label>
                {partialWorks && (
                  <Textarea
                    value={partialWorksDescription}
                    onChange={(e) => setPartialWorksDescription(e.target.value)}
                    placeholder="Précisez quels aménagements ou constructions sont achevés…"
                    rows={2}
                    className="mb-3"
                  />
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label>Surface créée (m²)</Label>
                    <Input
                      type="number"
                      value={surfaceCreated}
                      onChange={(e) => setSurfaceCreated(Number(e.target.value))}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Logements (total)</Label>
                    <Input
                      type="number"
                      value={nbLogementsTotal}
                      onChange={(e) => setNbLogementsTotal(Number(e.target.value))}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>dont individuels</Label>
                    <Input
                      type="number"
                      value={nbIndividuels}
                      onChange={(e) => setNbIndividuels(Number(e.target.value))}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>dont collectifs</Label>
                    <Input
                      type="number"
                      value={nbCollectifs}
                      onChange={(e) => setNbCollectifs(Number(e.target.value))}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </Section>

              {/* Signature */}
              <Section title="Signature" icon={Calendar}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label>Date de signature</Label>
                    <Input
                      type="date"
                      value={signedDate}
                      onChange={(e) => setSignedDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Fait à</Label>
                    <Input
                      value={signedLocation}
                      onChange={(e) => setSignedLocation(e.target.value)}
                      placeholder="Ville"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <DocSignatureField
                  label="Signature du déclarant"
                  description="Le déclarant atteste que les travaux sont achevés et conformes à l'autorisation."
                  value={declarantSignatureDataUrl}
                  onChange={setDeclarantSignatureDataUrl}
                />
              </Section>

              {/* Statut */}
              <Section title="Statut" icon={FileText}>
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.keys(DAACT_STATUS_META) as DaactStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "p-2 rounded-md border text-xs font-medium transition-all",
                        status === s
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {DAACT_STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
              <div className="flex items-center gap-2 flex-wrap">
                {isEditing && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleExportPdf("preview")} loading={generatingPdf}>
                      <Eye className="w-3.5 h-3.5" />
                      Aperçu CERFA
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportPdf("save")} loading={generatingPdf}>
                      <Download className="w-3.5 h-3.5" />
                      Télécharger
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing && (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive">Confirmer ?</span>
                      <Button variant="destructive" size="sm" onClick={handleDelete}>Oui</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Non</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      Supprimer
                    </Button>
                  )
                )}
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button onClick={handleSave} loading={saving}>
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

function Section({
  title, icon: Icon, children,
}: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="pl-5 border-l-2 border-border">{children}</div>
    </div>
  );
}
