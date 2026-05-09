import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Hammer, MapPin, Calendar, Euro, Tag, Camera, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ClientSelector } from "@/components/shared/ClientSelector";
import { TagsInput } from "@/components/shared/TagsInput";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import { CategorySelect } from "./CategorySelect";
import { ChantierCategoriesManager } from "./ChantierCategoriesManager";
import { useChantiersStore } from "@/stores/chantiersStore";
import {
  EMPTY_CHANTIER,
  COMMON_CHANTIER_TAGS,
  CHANTIER_STATUS_META,
  CHANTIER_STATUS_ORDER,
  CHANTIER_PRIORITY_META,
  type Chantier,
  type ChantierStatus,
  type ChantierPriority,
  type ChantierPhoto,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// ChantierFormModal — Création / édition
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  chantier: Chantier | null;
  onClose: () => void;
}

type Section = "infos" | "localisation" | "planning" | "photos" | "notes";

export function ChantierFormModal({ open, chantier, onClose }: Props) {
  const { create, update } = useChantiersStore();
  const isEdit = !!chantier;

  const [formData, setFormData] = useState<Omit<Chantier, "id" | "reference" | "createdAt" | "updatedAt">>({ ...EMPTY_CHANTIER });
  const [activeSection, setActiveSection] = useState<Section>("infos");
  const [saving, setSaving] = useState(false);
  const [categoriesManagerOpen, setCategoriesManagerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (chantier) {
        const { id, reference, createdAt, updatedAt, ...rest } = chantier;
        setFormData({ ...EMPTY_CHANTIER, ...rest });
      } else {
        setFormData({ ...EMPTY_CHANTIER });
      }
      setActiveSection("infos");
    }
  }, [open, chantier]);

  const update_ = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((d) => ({ ...d, [key]: value }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Veuillez renseigner un titre");
      setActiveSection("infos");
      return;
    }
    if (!formData.clientId) {
      toast.error("Veuillez sélectionner un client");
      setActiveSection("infos");
      return;
    }

    setSaving(true);
    const result = isEdit && chantier
      ? await update(chantier.id, formData)
      : await create(formData);
    setSaving(false);

    if (result.success) {
      toast.success(isEdit ? "Chantier mis à jour" : `Chantier créé : ${"reference" in result ? result.reference : ""}`);
      onClose();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  // ─── Photos ────────────────────────────────────────────────────────────
  const handleAddPhoto = async () => {
    const chantierId = chantier?.id || "new";
    if (!window.btpAPI?.chantiersUploadPhoto) return;
    const photo = await window.btpAPI.chantiersUploadPhoto({ chantierId });
    if (photo) {
      update_("photos", [...formData.photos, photo]);
      toast.success("Photo ajoutée");
    }
  };

  const handleRemovePhoto = async (photo: ChantierPhoto) => {
    await window.btpAPI?.chantiersDeletePhoto({ photoPath: photo.path });
    update_("photos", formData.photos.filter((p) => p.id !== photo.id));
  };

  const sections: Array<{ key: Section; label: string; icon: React.ElementType }> = [
    { key: "infos",        label: "Infos",        icon: Hammer },
    { key: "localisation", label: "Localisation", icon: MapPin },
    { key: "planning",     label: "Planning",     icon: Calendar },
    { key: "photos",       label: `Photos (${formData.photos.length})`, icon: Camera },
    { key: "notes",        label: "Notes & Tags", icon: Tag },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-5xl w-full max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">
                  {isEdit ? "Modifier le chantier" : "Nouveau chantier"}
                </h2>
                {isEdit && chantier?.reference && (
                  <p className="text-xs font-mono text-muted-foreground">{chantier.reference}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Side nav */}
              <div className="w-48 border-r border-border p-2 shrink-0 overflow-y-auto">
                {sections.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left transition-colors",
                      activeSection === s.key ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"
                    )}
                  >
                    <s.icon className="w-4 h-4 shrink-0" />
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {activeSection === "infos" && (
                  <div className="space-y-4">
                    <div>
                      <Label>Titre du chantier *</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => update_("title", e.target.value)}
                        placeholder="Rénovation salle de bain Dupont"
                      />
                    </div>

                    <div>
                      <Label>Client *</Label>
                      <ClientSelector
                        value={formData.clientId}
                        onChange={(id) => update_("clientId", id)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Statut</Label>
                        <NativeSelect
                          value={formData.status}
                          onChange={(e) => update_("status", e.target.value as ChantierStatus)}
                        >
                          {CHANTIER_STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {CHANTIER_STATUS_META[s].label}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div>
                        <Label>Priorité</Label>
                        <NativeSelect
                          value={formData.priority}
                          onChange={(e) => update_("priority", e.target.value as ChantierPriority)}
                        >
                          <option value="low">{CHANTIER_PRIORITY_META.low.label}</option>
                          <option value="normal">{CHANTIER_PRIORITY_META.normal.label}</option>
                          <option value="high">{CHANTIER_PRIORITY_META.high.label}</option>
                        </NativeSelect>
                      </div>
                    </div>

                    <div>
                      <Label>Nature des travaux</Label>
                      <Input
                        value={formData.nature}
                        onChange={(e) => update_("nature", e.target.value)}
                        placeholder="Plomberie, Carrelage, Rénovation totale..."
                      />
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => update_("description", e.target.value)}
                        rows={4}
                        placeholder="Détails du chantier, contraintes, objectifs..."
                      />
                    </div>
                  </div>
                )}

                {activeSection === "localisation" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Adresse du chantier (souvent différente de l'adresse du client)
                    </p>
                    <div>
                      <Label>Adresse ligne 1</Label>
                      <AddressAutocomplete
                        value={formData.addressLine1}
                        onChange={(v) => update_("addressLine1", v)}
                        onSelect={(addr) => {
                          setFormData((d) => ({
                            ...d,
                            postalCode: addr.postcode || d.postalCode,
                            city: addr.city || d.city,
                          }));
                        }}
                        placeholder="Tapez 3 lettres pour suggestions..."
                      />
                    </div>
                    <div>
                      <Label>Adresse ligne 2</Label>
                      <Input
                        value={formData.addressLine2}
                        onChange={(e) => update_("addressLine2", e.target.value)}
                        placeholder="Bâtiment A, 2ème étage..."
                      />
                    </div>
                    <div className="grid grid-cols-[120px_1fr_1fr] gap-3">
                      <div>
                        <Label>Code postal</Label>
                        <Input
                          value={formData.postalCode}
                          onChange={(e) => update_("postalCode", e.target.value)}
                          placeholder="55230"
                        />
                      </div>
                      <div>
                        <Label>Ville</Label>
                        <Input
                          value={formData.city}
                          onChange={(e) => update_("city", e.target.value)}
                          placeholder="Muzeray"
                        />
                      </div>
                      <div>
                        <Label>Pays</Label>
                        <Input
                          value={formData.country}
                          onChange={(e) => update_("country", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "planning" && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-muted-foreground">Dates prévues</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Début prévu</Label>
                        <Input
                          type="date"
                          value={formData.startDateEstimated ? formData.startDateEstimated.slice(0, 10) : ""}
                          onChange={(e) => update_("startDateEstimated", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Fin prévue</Label>
                        <Input
                          type="date"
                          value={formData.endDateEstimated ? formData.endDateEstimated.slice(0, 10) : ""}
                          onChange={(e) => update_("endDateEstimated", e.target.value)}
                        />
                      </div>
                    </div>

                    <p className="text-xs font-medium text-muted-foreground pt-2">Dates réelles</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Début réel</Label>
                        <Input
                          type="date"
                          value={formData.startDateActual ? formData.startDateActual.slice(0, 10) : ""}
                          onChange={(e) => update_("startDateActual", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Fin réelle</Label>
                        <Input
                          type="date"
                          value={formData.endDateActual ? formData.endDateActual.slice(0, 10) : ""}
                          onChange={(e) => update_("endDateActual", e.target.value)}
                        />
                      </div>
                    </div>

                    <p className="text-xs font-medium text-muted-foreground pt-2">Budget</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Budget HT (€)</Label>
                        <div className="relative">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.budgetEstimatedHT || ""}
                            onChange={(e) => update_("budgetEstimatedHT", Number(e.target.value))}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Budget TTC (€)</Label>
                        <div className="relative">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.budgetEstimatedTTC || ""}
                            onChange={(e) => update_("budgetEstimatedTTC", Number(e.target.value))}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "photos" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">
                        {formData.photos.length} photo{formData.photos.length > 1 ? "s" : ""}
                      </p>
                      <Button onClick={handleAddPhoto} size="sm">
                        <Plus className="w-4 h-4" />
                        Ajouter une photo
                      </Button>
                    </div>

                    {formData.photos.length === 0 ? (
                      <div className="p-12 text-center border border-dashed border-border rounded-lg">
                        <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Aucune photo pour l'instant</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          JPG, PNG, WebP. Les photos sont stockées localement.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {formData.photos.map((photo) => (
                          <PhotoCard
                            key={photo.id}
                            photo={photo}
                            onRemove={() => handleRemovePhoto(photo)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeSection === "notes" && (
                  <div className="space-y-4">
                    <div>
                      <Label className="flex items-center gap-2">
                        Catégorie / corps d'état
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
                        Classez le chantier par poste pour analyser votre activité
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <CategorySelect
                            value={formData.categoryId}
                            onChange={(id) => update_("categoryId", id)}
                            placeholder="Choisir une catégorie..."
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCategoriesManagerOpen(true)}
                        >
                          Gérer
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Tags</Label>
                      <TagsInput
                        value={formData.tags}
                        onChange={(tags) => update_("tags", tags)}
                        suggestions={COMMON_CHANTIER_TAGS}
                        placeholder="Ajouter un tag..."
                      />
                    </div>
                    <div>
                      <Label>Notes libres</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => update_("notes", e.target.value)}
                        rows={8}
                        placeholder="Remarques particulières, contacts, contraintes spécifiques..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} loading={saving}>
                <Save className="w-4 h-4" />
                {isEdit ? "Enregistrer" : "Créer le chantier"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <ChantierCategoriesManager
        open={categoriesManagerOpen}
        onClose={() => setCategoriesManagerOpen(false)}
      />
    </AnimatePresence>
  );
}

// ─── Carte photo avec lecture asynchrone ─────────────────────────────────
function PhotoCard({ photo, onRemove }: { photo: ChantierPhoto; onRemove: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.btpAPI?.chantiersReadPhoto) return;
      const url = await window.btpAPI.chantiersReadPhoto(photo.path);
      if (!cancelled) setDataUrl(url);
    })();
    return () => { cancelled = true; };
  }, [photo.path]);

  return (
    <div className="relative group">
      <div className="aspect-video bg-muted rounded-md overflow-hidden">
        {dataUrl ? (
          <img src={dataUrl} alt={photo.caption} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Chargement...
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Supprimer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
