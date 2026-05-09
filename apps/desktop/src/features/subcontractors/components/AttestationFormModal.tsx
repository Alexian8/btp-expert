import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, ShieldCheck, Calendar, FileText, Upload, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ATTESTATION_TYPE_META,
  type SubcontractorAttestation, type AttestationType,
} from "@btp/types";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";

// ═══════════════════════════════════════════════════════════════════════════
// AttestationFormModal — Création / édition d'une attestation
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  subcontractorId: string;
  attestation: SubcontractorAttestation | null;
  onClose: () => void;
}

export function AttestationFormModal({ open, subcontractorId, attestation, onClose }: Props) {
  const { createAttestation, updateAttestation } = useSubcontractorsStore();

  const [type, setType] = useState<AttestationType>("urssaf");
  const [customLabel, setCustomLabel] = useState("");
  const [reference, setReference] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [vaultDocumentId, setVaultDocumentId] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!attestation;

  useEffect(() => {
    if (!open) return;
    if (attestation) {
      setType(attestation.type);
      setCustomLabel(attestation.customLabel);
      setReference(attestation.reference);
      setIssuedDate(attestation.issuedDate);
      setExpirationDate(attestation.expirationDate);
      setNotes(attestation.notes);
      setVaultDocumentId(attestation.vaultDocumentId);
    } else {
      setType("urssaf");
      setCustomLabel("");
      setReference("");
      const today = new Date().toISOString().slice(0, 10);
      setIssuedDate(today);
      // Auto-calcul expiration selon le type
      const meta = ATTESTATION_TYPE_META["urssaf"];
      const exp = new Date();
      exp.setMonth(exp.getMonth() + meta.defaultDurationMonths);
      setExpirationDate(exp.toISOString().slice(0, 10));
      setNotes("");
      setVaultDocumentId("");
    }
  }, [open, attestation?.id]);

  // Auto-recalculer expiration quand on change le type ET la date d'émission (en création)
  useEffect(() => {
    if (isEditing) return;
    if (!issuedDate) return;
    const meta = ATTESTATION_TYPE_META[type];
    const issued = new Date(issuedDate);
    if (isNaN(issued.getTime())) return;
    const exp = new Date(issued);
    exp.setMonth(exp.getMonth() + meta.defaultDurationMonths);
    setExpirationDate(exp.toISOString().slice(0, 10));
  }, [type, issuedDate, isEditing]);

  const handleSubmit = async () => {
    if (type === "autre" && !customLabel.trim()) {
      toast.error("Précisez le type d'attestation");
      return;
    }
    if (!issuedDate || !expirationDate) {
      toast.error("Dates d'émission et d'expiration requises");
      return;
    }

    const payload: Partial<SubcontractorAttestation> = {
      subcontractorId,
      type,
      customLabel: customLabel.trim(),
      reference: reference.trim(),
      issuedDate,
      expirationDate,
      notes: notes.trim(),
      vaultDocumentId,
    };

    setSaving(true);
    let r;
    if (isEditing && attestation) {
      r = await updateAttestation(attestation.id, payload);
    } else {
      r = await createAttestation(payload);
    }
    setSaving(false);

    if (r.success) {
      toast.success(isEditing ? "Attestation mise à jour" : "Attestation ajoutée");
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleUploadDoc = async () => {
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

    // Trouver/créer dossier "Attestations sous-traitants" sous Entreprise
    let folderId = "root_company";
    try {
      const folders = await window.btpAPI.vaultListFolders!();
      const existing = folders.find((f: any) => f.name === "Attestations sous-traitants" && f.parentId === "root_company");
      if (existing) {
        folderId = existing.id;
      } else {
        const r = await window.btpAPI.vaultCreateFolder!({
          name: "Attestations sous-traitants",
          iconKey: "shield",
          colorKey: "violet",
          parentId: "root_company",
        });
        if (r.success && r.id) folderId = r.id;
      }
    } catch {}

    const sourcePath = pickResult.paths[0];
    const fileName = sourcePath.split(/[/\\]/).pop() || "Attestation";
    const meta = ATTESTATION_TYPE_META[type];
    const label = type === "autre" && customLabel ? customLabel : meta.label;
    const uploadResult = await window.btpAPI.vaultUploadDocument!({
      folderId,
      sourcePath,
      fileName,
      description: `${label}${reference ? ` - ${reference}` : ""}`,
      tags: [{ name: "Attestation" }, { name: label }],
    });

    setUploading(false);
    if (uploadResult.success && uploadResult.id) {
      setVaultDocumentId(uploadResult.id);
      toast.success("Document chiffré dans le coffre-fort");
    } else {
      toast.error(uploadResult.error || "Erreur upload");
    }
  };

  const meta = ATTESTATION_TYPE_META[type];

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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-xl w-full max-h-[92vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", meta.colorTw)}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">
                  {isEditing ? "Modifier l'attestation" : "Nouvelle attestation"}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Type */}
              <div>
                <Label>Type d'attestation</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mt-1.5">
                  {Object.entries(ATTESTATION_TYPE_META).map(([key, m]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key as AttestationType)}
                      className={cn(
                        "py-2 px-2 rounded-md border text-xs font-medium transition-all text-left",
                        type === key
                          ? m.colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {m.label}
                      {m.required && <span className="text-[9px] text-red-500 ml-1">*</span>}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Validité par défaut : {meta.defaultDurationMonths} mois
                </p>
              </div>

              {/* Custom label si autre */}
              {type === "autre" && (
                <div>
                  <Label>Libellé *</Label>
                  <Input
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Ex: Carte BTP, Attestation FFB..."
                    className="mt-1.5"
                  />
                </div>
              )}

              {/* Référence */}
              <div>
                <Label>Référence / Numéro</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Numéro du document"
                  className="mt-1.5"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Date d'émission *
                  </Label>
                  <Input
                    type="date"
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Date d'expiration *</Label>
                  <Input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Document */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Document scanné
                </Label>
                <div className="mt-1.5">
                  {vaultDocumentId ? (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-xs flex-1">Document chiffré dans le coffre-fort</span>
                      <Button variant="ghost" size="sm" onClick={() => setVaultDocumentId("")}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleUploadDoc} loading={uploading} className="w-full">
                      <Upload className="w-3.5 h-3.5" />
                      Joindre le PDF / scan
                    </Button>
                  )}
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

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSubmit} loading={saving}>
                <Save className="w-4 h-4" />
                {isEditing ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
