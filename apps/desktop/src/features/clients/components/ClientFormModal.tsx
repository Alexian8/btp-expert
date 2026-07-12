import { useEffect, useState } from "react";
import { User, Building2, MapPin, FileText, Tag, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { SideDrawer } from "@/components/shared/SideDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SiretLookup } from "@/components/shared/SiretLookup";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { EmailInput } from "@/components/shared/EmailInput";
import { useClientsStore } from "@/stores/clientsStore";
import { useClientTagsStore } from "@/stores/clientTagsStore";
import { toUpperName, capitalizeName, tagChipClass } from "@/lib/clientHelpers";
import { EMPTY_CLIENT, type Client, type Civility } from "@btp/types";
import type { SireneCompany } from "@/lib/sireneService";

// ═══════════════════════════════════════════════════════════════════════════
// ClientFormModal — Création / édition d'un client
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  client: Client | null;
  onClose: () => void;
}

export function ClientFormModal({ open, client, onClose }: Props) {
  const { create, update } = useClientsStore();
  const availableTags = useClientTagsStore((s) => s.tags);
  const loadTags = useClientTagsStore((s) => s.load);
  const isEdit = !!client;

  const [formData, setFormData] = useState<Omit<Client, "id" | "createdAt" | "updatedAt">>({ ...EMPTY_CLIENT });
  const [activeSection, setActiveSection] = useState<"identity" | "contact" | "address" | "pro" | "notes">("identity");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      void loadTags();
      if (client) {
        const { id, createdAt, updatedAt, ...rest } = client;
        setFormData({ ...EMPTY_CLIENT, ...rest });
      } else {
        setFormData({ ...EMPTY_CLIENT });
      }
      setActiveSection("identity");
    }
  }, [open, client, loadTags]);

  const toggleTag = (id: string) => {
    setFormData((d) => {
      const cur = d.tags ?? [];
      return { ...d, tags: cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id] };
    });
  };

  const update_ = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((d) => ({ ...d, [key]: value }));
  };

  // ─── Appliquer les données SIRENE au formulaire ──────────────────────────
  const handleSireneSelect = (c: SireneCompany) => {
    setFormData((d) => ({
      ...d,
      type: "pro",
      companyName: c.nom,
      siret: c.siret,
      siren: c.siren,
      tvaIntracom: c.tvaIntracom || "",
      legalForm: c.formeJuridique || "",
      apeCode: c.codeAPE || "",
      apeLabel: c.libelleAPE || "",
      // Si adresse SIRENE disponible et l'adresse actuelle est vide, on pré-remplit
      addressLine1: d.addressLine1 || c.adresse || "",
      postalCode: d.postalCode || c.codePostal || "",
      city: d.city || c.ville || "",
    }));
    toast.success(`Données récupérées : ${c.nom}`);
  };

  const handleSave = async () => {
    // Validation basique
    if (formData.type === "particulier" && !formData.firstName.trim() && !formData.lastName.trim()) {
      toast.error("Veuillez renseigner au moins un nom ou prénom");
      return;
    }
    if (formData.type === "pro" && !formData.companyName.trim()) {
      toast.error("Veuillez renseigner la raison sociale");
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Format d'email invalide");
      return;
    }

    setSaving(true);
    let result;
    if (isEdit && client) {
      result = await update(client.id, formData);
    } else {
      result = await create(formData);
    }
    setSaving(false);

    if (result.success) {
      toast.success(isEdit ? "Client mis à jour" : "Client créé");
      onClose();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const sections: Array<{ key: typeof activeSection; label: string; icon: React.ElementType }> = [
    { key: "identity", label: "Identité", icon: User },
    { key: "contact", label: "Contact", icon: FileText },
    { key: "address", label: "Adresse", icon: MapPin },
    ...(formData.type === "pro" ? [{ key: "pro" as const, label: "Infos pro", icon: Building2 }] : []),
    { key: "notes", label: "Notes", icon: Tag },
  ];

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Annuler</Button>
      <Button onClick={handleSave} loading={saving}>
        <Save className="w-4 h-4" />
        {isEdit ? "Enregistrer" : "Créer le client"}
      </Button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      widthClass="max-w-3xl"
      title={isEdit ? "Modifier le client" : "Nouveau client"}
      subtitle={isEdit ? (client?.companyName || `${client?.firstName} ${client?.lastName}`) : "Créer une nouvelle fiche client"}
      footer={footer}
    >
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row min-h-full">
              {/* Side nav — vertical sur desktop, horizontale scrollable sur mobile */}
              <div className="md:w-48 md:border-r border-b md:border-b-0 border-border p-2 shrink-0 md:overflow-y-auto">
                {/* Type toggle (toujours visible) */}
                <div className="mb-2 md:mb-3">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Type</Label>
                  <div className="inline-flex rounded-md border border-border p-0.5 w-full">
                    <button
                      type="button"
                      onClick={() => update_("type", "particulier")}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded text-xs transition-colors",
                        formData.type === "particulier" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      )}
                    >
                      Particulier
                    </button>
                    <button
                      type="button"
                      onClick={() => update_("type", "pro")}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded text-xs transition-colors",
                        formData.type === "pro" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      )}
                    >
                      Pro
                    </button>
                  </div>
                </div>

                {/* Separator vertical sur desktop, rien sur mobile (border-b suffit) */}
                <Separator className="my-2 hidden md:block" />

                {/* Section tabs : row scrollable sur mobile, column sur desktop */}
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
                    {formData.type === "pro" && (
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/20 mb-4">
                        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                          <Search className="w-3 h-3" />
                          Auto-remplissage via SIRENE
                        </p>
                        <SiretLookup onSelect={handleSireneSelect} />
                      </div>
                    )}

                    {formData.type === "particulier" ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-3">
                          <div>
                            <Label>Civilité</Label>
                            <NativeSelect
                              value={formData.civility}
                              onChange={(e) => update_("civility", e.target.value as Civility)}
                            >
                              <option value="M.">M.</option>
                              <option value="Mme">Mme</option>
                              <option value="M. et Mme">M. et Mme</option>
                              <option value="Mlle">Mlle</option>
                              <option value="">—</option>
                            </NativeSelect>
                          </div>
                          <div>
                            <Label>Prénom</Label>
                            <Input
                              value={formData.firstName}
                              onChange={(e) => update_("firstName", capitalizeName(e.target.value))}
                              placeholder="Jean"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Nom *</Label>
                          <Input
                            value={formData.lastName}
                            onChange={(e) => update_("lastName", toUpperName(e.target.value))}
                            placeholder="Dupont"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label>Raison sociale *</Label>
                          <Input
                            value={formData.companyName}
                            onChange={(e) => update_("companyName", e.target.value)}
                            placeholder="SARL DUPONT CONSTRUCTION"
                          />
                        </div>
                        <Separator />
                        <p className="text-xs font-medium text-muted-foreground">Interlocuteur principal</p>
                        <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr] gap-3">
                          <div>
                            <Label>Civilité</Label>
                            <NativeSelect
                              value={formData.civility}
                              onChange={(e) => update_("civility", e.target.value as Civility)}
                            >
                              <option value="M.">M.</option>
                              <option value="Mme">Mme</option>
                              <option value="M. et Mme">M. et Mme</option>
                              <option value="Mlle">Mlle</option>
                              <option value="">—</option>
                            </NativeSelect>
                          </div>
                          <div>
                            <Label>Prénom</Label>
                            <Input
                              value={formData.firstName}
                              onChange={(e) => update_("firstName", capitalizeName(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Nom</Label>
                            <Input
                              value={formData.lastName}
                              onChange={(e) => update_("lastName", toUpperName(e.target.value))}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeSection === "contact" && (
                  <div className="space-y-4">
                    <div>
                      <Label>Email</Label>
                      <EmailInput value={formData.email} onChange={(v) => update_("email", v)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Téléphone mobile</Label>
                        <PhoneInput value={formData.phoneMobile} onChange={(v) => update_("phoneMobile", v)} />
                      </div>
                      <div>
                        <Label>Téléphone fixe</Label>
                        <PhoneInput value={formData.phoneFixed} onChange={(v) => update_("phoneFixed", v)} placeholder="1 23 45 67 89" />
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
                            city: (addr.city || d.city).toUpperCase(),
                          }));
                        }}
                        placeholder="Tapez 3 lettres pour suggestions..."
                      />
                    </div>
                    <div>
                      <Label>Adresse ligne 2 (bât, appart...)</Label>
                      <Input
                        value={formData.addressLine2}
                        onChange={(e) => update_("addressLine2", e.target.value)}
                        placeholder="Bâtiment A, appart. 3"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-3">
                      <div>
                        <Label>Code postal</Label>
                        <Input
                          value={formData.postalCode}
                          onChange={(e) => update_("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                          onBlur={() => formData.city && update_("city", formData.city.toUpperCase())}
                          inputMode="numeric"
                          placeholder="55230"
                        />
                      </div>
                      <div>
                        <Label>Ville</Label>
                        <Input
                          value={formData.city}
                          onChange={(e) => update_("city", e.target.value.toUpperCase())}
                          placeholder="MUZERAY"
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

                    <Separator />

                    <div className="flex items-center justify-between">
                      <Label>Adresse de facturation identique</Label>
                      <Switch
                        checked={formData.billingAddressSame}
                        onCheckedChange={(v) => update_("billingAddressSame", v)}
                      />
                    </div>

                    {!formData.billingAddressSame && (
                      <div className="space-y-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground">Adresse de facturation</p>
                        <div>
                          <Label>Adresse ligne 1</Label>
                          <AddressAutocomplete
                            value={formData.billingAddressLine1}
                            onChange={(v) => update_("billingAddressLine1", v)}
                            onSelect={(addr) => {
                              setFormData((d) => ({
                                ...d,
                                billingPostalCode: addr.postcode || d.billingPostalCode,
                                billingCity: addr.city || d.billingCity,
                              }));
                            }}
                            placeholder="Tapez 3 lettres pour suggestions..."
                          />
                        </div>
                        <div>
                          <Label>Adresse ligne 2</Label>
                          <Input
                            value={formData.billingAddressLine2}
                            onChange={(e) => update_("billingAddressLine2", e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-3">
                          <div>
                            <Label>Code postal</Label>
                            <Input
                              value={formData.billingPostalCode}
                              onChange={(e) => update_("billingPostalCode", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Ville</Label>
                            <Input
                              value={formData.billingCity}
                              onChange={(e) => update_("billingCity", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Pays</Label>
                            <Input
                              value={formData.billingCountry}
                              onChange={(e) => update_("billingCountry", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSection === "pro" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>SIRET</Label>
                        <Input
                          value={formData.siret}
                          onChange={(e) => update_("siret", e.target.value)}
                          placeholder="123 456 789 00012"
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <Label>TVA Intracom.</Label>
                        <Input
                          value={formData.tvaIntracom}
                          onChange={(e) => update_("tvaIntracom", e.target.value)}
                          placeholder="FR12345678900"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Forme juridique</Label>
                      <Input
                        value={formData.legalForm}
                        onChange={(e) => update_("legalForm", e.target.value)}
                        placeholder="SAS, SARL, EI..."
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
                          placeholder="Construction de maisons individuelles"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "notes" && (
                  <div className="space-y-4">
                    <div>
                      <Label>Étiquettes</Label>
                      {availableTags.length === 0 ? (
                        <p className="text-sm text-muted-foreground mt-1">
                          Aucune étiquette définie. Créez-en depuis le bouton « Étiquettes » de la page Clients.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {availableTags.map((t) => {
                            const active = (formData.tags ?? []).includes(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => toggleTag(t.id)}
                                className={cn(
                                  "text-sm px-3 py-1.5 rounded-full border transition-all",
                                  active ? tagChipClass(t.color) + " ring-1 ring-current" : "border-border text-muted-foreground hover:bg-accent/50"
                                )}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div>
                      <Label>Source (comment il nous a connu)</Label>
                      <Input
                        value={formData.source}
                        onChange={(e) => update_("source", e.target.value)}
                        placeholder="Bouche à oreille, Google, Pages Jaunes..."
                      />
                    </div>
                    <div>
                      <Label>Date de premier contact</Label>
                      <Input
                        type="date"
                        value={formData.firstContactAt ? formData.firstContactAt.slice(0, 10) : ""}
                        onChange={(e) => update_("firstContactAt", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Notes libres</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => update_("notes", e.target.value)}
                        placeholder="Préférences, contraintes, rappels..."
                        rows={5}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
    </SideDrawer>
  );
}
