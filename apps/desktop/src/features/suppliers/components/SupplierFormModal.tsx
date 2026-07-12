import { useEffect, useState } from "react";
import { Building2, MapPin, CreditCard, FileText, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { SideDrawer } from "@/components/shared/SideDrawer";
import { SiretLookup } from "@/components/shared/SiretLookup";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import { useSuppliersStore } from "@/stores/suppliersStore";
import { EMPTY_SUPPLIER, SUPPLIER_CATEGORIES, type Supplier } from "@btp/types";
import type { SireneCompany } from "@/lib/sireneService";

// ═══════════════════════════════════════════════════════════════════════════
// SupplierFormModal
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
}

export function SupplierFormModal({ open, supplier, onClose }: Props) {
  const { create, update } = useSuppliersStore();
  const isEdit = !!supplier;

  const [formData, setFormData] = useState<Omit<Supplier, "id" | "createdAt" | "updatedAt">>({ ...EMPTY_SUPPLIER });
  const [activeSection, setActiveSection] = useState<"identity" | "address" | "legal" | "payment" | "notes">("identity");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (supplier) {
        const { id, createdAt, updatedAt, ...rest } = supplier;
        setFormData({ ...EMPTY_SUPPLIER, ...rest });
      } else {
        setFormData({ ...EMPTY_SUPPLIER });
      }
      setActiveSection("identity");
    }
  }, [open, supplier]);

  const update_ = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((d) => ({ ...d, [key]: value }));
  };

  const handleSireneSelect = (c: SireneCompany) => {
    setFormData((d) => ({
      ...d,
      companyName: c.nom,
      siret: c.siret,
      siren: c.siren,
      tvaIntracom: c.tvaIntracom || "",
      legalForm: c.formeJuridique || "",
      apeCode: c.codeAPE || "",
      apeLabel: c.libelleAPE || "",
      addressLine1: d.addressLine1 || c.adresse || "",
      postalCode: d.postalCode || c.codePostal || "",
      city: d.city || c.ville || "",
    }));
    toast.success(`Données récupérées : ${c.nom}`);
  };

  const handleSave = async () => {
    if (!formData.companyName.trim()) {
      toast.error("Veuillez renseigner la raison sociale");
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Format d'email invalide");
      return;
    }

    setSaving(true);
    const result = isEdit && supplier
      ? await update(supplier.id, formData)
      : await create(formData);
    setSaving(false);

    if (result.success) {
      toast.success(isEdit ? "Fournisseur mis à jour" : "Fournisseur créé");
      onClose();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const sections = [
    { key: "identity" as const, label: "Identité", icon: Building2 },
    { key: "address" as const, label: "Adresse", icon: MapPin },
    { key: "legal" as const, label: "Infos légales", icon: FileText },
    { key: "payment" as const, label: "Paiement", icon: CreditCard },
    { key: "notes" as const, label: "Notes", icon: FileText },
  ];

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Annuler</Button>
      <Button onClick={handleSave} loading={saving}>
        <Save className="w-4 h-4" />
        {isEdit ? "Enregistrer" : "Créer le fournisseur"}
      </Button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      widthClass="max-w-2xl"
      title={isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}
      footer={footer}
    >
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Side nav — vertical sur desktop, tabs horizontales scrollables sur mobile */}
        <div className="md:w-48 md:border-r border-b md:border-b-0 border-border p-2 shrink-0 md:overflow-y-auto">
          <div className="flex md:flex-col gap-1 md:gap-0 overflow-x-auto md:overflow-x-visible -mx-2 px-2 md:mx-0 md:px-0">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={cn(
                  "shrink-0 md:w-full flex items-center gap-2 px-3 md:px-2 py-2 rounded-md text-sm text-left transition-colors whitespace-nowrap",
                  activeSection === s.key ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"
                )}
              >
                <s.icon className="w-4 h-4 shrink-0" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {activeSection === "identity" && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  <Search className="w-3 h-3" />
                  Auto-remplissage via SIRENE
                </p>
                <SiretLookup onSelect={handleSireneSelect} />
              </div>

              <div>
                <Label>Raison sociale *</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => update_("companyName", e.target.value)}
                  placeholder="BIGMAT, POINT.P, ..."
                />
              </div>
              <div>
                <Label>Catégorie</Label>
                <NativeSelect
                  value={formData.category}
                  onChange={(e) => update_("category", e.target.value)}
                >
                  {SUPPLIER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </NativeSelect>
              </div>

              <div className="pt-3 border-t border-border space-y-4">
                <p className="text-xs font-medium text-muted-foreground">Interlocuteur principal</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Prénom</Label>
                    <Input
                      value={formData.contactFirstName}
                      onChange={(e) => update_("contactFirstName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input
                      value={formData.contactLastName}
                      onChange={(e) => update_("contactLastName", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => update_("email", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mobile</Label>
                    <Input
                      value={formData.phoneMobile}
                      onChange={(e) => update_("phoneMobile", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Fixe</Label>
                    <Input
                      value={formData.phoneFixed}
                      onChange={(e) => update_("phoneFixed", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Site web</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => update_("website", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "address" && (
            <div className="space-y-4">
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
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-3">
                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => update_("postalCode", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ville</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => update_("city", e.target.value)}
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

          {activeSection === "legal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SIRET</Label>
                  <Input
                    value={formData.siret}
                    onChange={(e) => update_("siret", e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>TVA Intracom.</Label>
                  <Input
                    value={formData.tvaIntracom}
                    onChange={(e) => update_("tvaIntracom", e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <div>
                <Label>Forme juridique</Label>
                <Input
                  value={formData.legalForm}
                  onChange={(e) => update_("legalForm", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-3">
                <div>
                  <Label>Code APE</Label>
                  <Input
                    value={formData.apeCode}
                    onChange={(e) => update_("apeCode", e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Activité</Label>
                  <Input
                    value={formData.apeLabel}
                    onChange={(e) => update_("apeLabel", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "payment" && (
            <div className="space-y-4">
              <div>
                <Label>IBAN</Label>
                <Input
                  value={formData.iban}
                  onChange={(e) => update_("iban", e.target.value.toUpperCase())}
                  placeholder="FR76 ..."
                  className="font-mono"
                />
              </div>
              <div>
                <Label>BIC / SWIFT</Label>
                <Input
                  value={formData.bic}
                  onChange={(e) => update_("bic", e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Délai de paiement (jours)</Label>
                  <Input
                    type="number"
                    value={formData.paymentTermsDays}
                    onChange={(e) => update_("paymentTermsDays", Number(e.target.value))}
                    min={0}
                    max={365}
                  />
                </div>
                <div>
                  <Label>Mode de paiement</Label>
                  <NativeSelect
                    value={formData.paymentMethod}
                    onChange={(e) => update_("paymentMethod", e.target.value)}
                  >
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Prélèvement">Prélèvement</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Carte bancaire">Carte bancaire</option>
                  </NativeSelect>
                </div>
              </div>
            </div>
          )}

          {activeSection === "notes" && (
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => update_("notes", e.target.value)}
                rows={8}
                placeholder="Rappels, contraintes, tarifs négociés..."
              />
            </div>
          )}
        </div>
      </div>
    </SideDrawer>
  );
}
