import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Trash2, Leaf, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RGE_DOCUMENT_TYPE_META,
  RGE_QUALIFICATIONS,
  type RgeDocumentType,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useClientsStore } from "@/stores/clientsStore";

// ═══════════════════════════════════════════════════════════════════════════
// RgeFormModal — Création / édition d'un document RGE
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  documentId: string | null;
  onClose: () => void;
}

export function RgeFormModal({ open, documentId, onClose }: Props) {
  const { createRge, removeRge, rgeDocuments } = useAdministrativeDocsStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();
  const { clients, fetch: fetchClients } = useClientsStore();

  const isEdit = Boolean(documentId);
  const existing = documentId ? rgeDocuments.find((d) => d.id === documentId) : null;

  const [type, setType] = useState<RgeDocumentType>("qualification");
  const [chantierId, setChantierId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [rgeQualification, setRgeQualification] = useState<string>("Qualibat RGE");
  const [rgeQualificationNumber, setRgeQualificationNumber] = useState("");
  const [rgeValidUntil, setRgeValidUntil] = useState("");
  const [worksDescription, setWorksDescription] = useState("");
  const [totalAmountTtc, setTotalAmountTtc] = useState(0);
  const [primeRenovExpected, setPrimeRenovExpected] = useState(0);
  const [primeRenovActual, setPrimeRenovActual] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchChantiers();
    fetchClients();
    if (existing) {
      setType(existing.type);
      setChantierId(existing.chantierId);
      setClientId(existing.clientId);
      setClientName(existing.clientName);
      setRgeQualification(existing.rgeQualification || "Qualibat RGE");
      setRgeQualificationNumber(existing.rgeQualificationNumber);
      setRgeValidUntil(existing.rgeValidUntil || "");
      setWorksDescription(existing.worksDescription);
      setTotalAmountTtc(existing.totalAmountTtc);
      setPrimeRenovExpected(existing.primeRenovExpected);
      setPrimeRenovActual(existing.primeRenovActual || 0);
      setNotes(existing.notes);
    } else {
      setType("qualification");
      setRgeQualification("Qualibat RGE");
    }
  }, [open, existing, fetchChantiers, fetchClients]);

  // Auto-remplissage clientName quand on sélectionne un client
  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (c) {
      const name =
        c.type === "pro" && c.companyName
          ? c.companyName
          : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
      if (name) setClientName(name);
    }
  }, [clientId, clients]);

  const handleSave = async () => {
    if (type !== "qualification" && type !== "fiche_technique") {
      if (!chantierId) {
        toast.error("Sélectionnez un chantier");
        return;
      }
    }
    if (!rgeQualification.trim()) {
      toast.error("Indiquez la qualification RGE");
      return;
    }
    setSaving(true);
    try {
      const res = await createRge({
        type,
        chantierId,
        clientId,
        clientName: clientName.trim(),
        rgeQualification: rgeQualification.trim(),
        rgeQualificationNumber: rgeQualificationNumber.trim(),
        rgeValidUntil,
        worksDescription: worksDescription.trim(),
        totalAmountTtc: Number(totalAmountTtc) || 0,
        primeRenovExpected: Number(primeRenovExpected) || 0,
        primeRenovActual: Number(primeRenovActual) || 0,
        notes: notes.trim(),
      });
      if (res.success) {
        toast.success(isEdit ? "Document modifié" : "Document créé");
        onClose();
      } else {
        toast.error(res.error || "Erreur");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!documentId) return;
    if (!confirm("Supprimer définitivement ce document RGE ?")) return;
    const r = await removeRge(documentId);
    if (r.success) {
      toast.success("Document supprimé");
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  // Validité expirée ?
  const validityWarning =
    rgeValidUntil && new Date(rgeValidUntil) < new Date()
      ? "⚠️ Cette qualification est expirée. Renouvelez avant tout nouveau devis RGE."
      : null;

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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-3xl w-full max-h-[95vh] flex flex-col"
          >
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {isEdit ? "Modifier le document RGE" : "Nouveau document RGE"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mentions RGE obligatoires : art. R. 181-38 du Code de l'énergie
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Type de document */}
              <div>
                <Label>Type de document</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mt-1.5">
                  {(Object.keys(RGE_DOCUMENT_TYPE_META) as RgeDocumentType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-all border ${
                        type === t
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                          : "bg-card border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {RGE_DOCUMENT_TYPE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qualification */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Qualification *</Label>
                    <select
                      value={rgeQualification}
                      onChange={(e) => setRgeQualification(e.target.value)}
                      className="w-full mt-1.5 px-3 py-1.5 text-sm rounded-md border border-border bg-card"
                    >
                      {RGE_QUALIFICATIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>N° de certification</Label>
                    <Input
                      value={rgeQualificationNumber}
                      onChange={(e) => setRgeQualificationNumber(e.target.value)}
                      placeholder="ex : E168293.1"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label>Validité jusqu'au</Label>
                  <Input
                    type="date"
                    value={rgeValidUntil}
                    onChange={(e) => setRgeValidUntil(e.target.value)}
                    className="mt-1.5"
                  />
                  {validityWarning && (
                    <p className="text-xs text-amber-700 mt-1.5 font-medium">
                      {validityWarning}
                    </p>
                  )}
                </div>
              </div>

              {/* Liens client / chantier */}
              {type !== "qualification" && type !== "fiche_technique" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Chantier *</Label>
                    <select
                      value={chantierId}
                      onChange={(e) => setChantierId(e.target.value)}
                      className="w-full mt-1.5 px-3 py-1.5 text-sm rounded-md border border-border bg-card"
                    >
                      <option value="">— Sélectionner —</option>
                      {chantiers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.reference} · {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Client</Label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full mt-1.5 px-3 py-1.5 text-sm rounded-md border border-border bg-card"
                    >
                      <option value="">— Aucun —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.type === "pro" && c.companyName
                            ? c.companyName
                            : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <Label>Description / Notes</Label>
                <Textarea
                  value={worksDescription}
                  onChange={(e) => setWorksDescription(e.target.value)}
                  placeholder="Travaux concernés, équipements, surface…"
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              {/* Montants */}
              {(type === "devis_rge" || type === "facture_rge" || type === "attestation_rge") && (
                <div className="bg-card border border-border rounded-md p-3">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Montants
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Montant TTC</Label>
                      <Input
                        type="number"
                        value={totalAmountTtc}
                        onChange={(e) => setTotalAmountTtc(Number(e.target.value))}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>MaPrimeRénov' estimée</Label>
                      <Input
                        type="number"
                        value={primeRenovExpected}
                        onChange={(e) => setPrimeRenovExpected(Number(e.target.value))}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>MaPrimeRénov' versée</Label>
                      <Input
                        type="number"
                        value={primeRenovActual}
                        onChange={(e) => setPrimeRenovActual(Number(e.target.value))}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes libres */}
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                />
              </div>

              {/* Rappel mentions obligatoires */}
              <div className="bg-blue-500/5 border-l-4 border-blue-500 p-3 rounded-r-md">
                <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Mentions RGE obligatoires sur devis/facture (art. R. 181-38 Code de l'énergie)
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-4 list-disc">
                  <li>Nom et qualification RGE de l'entreprise + n° de certification</li>
                  <li>Date de fin de validité de la qualification</li>
                  <li>SIREN / SIRET de l'entreprise</li>
                  <li>Description précise des travaux et équipements (référence fabricant)</li>
                  <li>Performance énergétique des équipements installés</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
              <div>
                {isEdit && (
                  <Button variant="ghost" onClick={handleDelete} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button onClick={handleSave} loading={saving}>
                  <Save className="w-4 h-4" />
                  {isEdit ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
