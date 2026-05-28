import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, HardHat, Building2, Phone, Mail, MapPin,
  CreditCard, Star, Briefcase,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SUBCONTRACTOR_ACTIVITY_META,
  type Subcontractor, type SubcontractorActivity,
} from "@btp/types";
import { useSubcontractorsStore } from "@/stores/subcontractorsStore";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";

// ═══════════════════════════════════════════════════════════════════════════
// SubcontractorFormModal — Création / édition d'un sous-traitant
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  subcontractor: Subcontractor | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SubcontractorFormModal({ open, subcontractor, onClose, onSaved }: Props) {
  const { create, update, remove } = useSubcontractorsStore();

  // Identité
  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactRole, setContactRole] = useState("");

  // Activité
  const [activity, setActivity] = useState<SubcontractorActivity>("autre");
  const [activityNotes, setActivityNotes] = useState("");

  // Légal
  const [siret, setSiret] = useState("");
  const [rcs, setRcs] = useState("");
  const [legalForm, setLegalForm] = useState("");
  const [capital, setCapital] = useState("");
  const [tvaNumber, setTvaNumber] = useState("");

  // Coordonnées
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState("");

  // Adresse
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("France");

  // Bancaire
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [bankName, setBankName] = useState("");

  // Méta
  const [isActive, setIsActive] = useState(true);
  const [rating, setRating] = useState(0);
  const [defaultVatRate, setDefaultVatRate] = useState(20);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!subcontractor;

  useEffect(() => {
    if (!open) return;
    if (subcontractor) {
      setCompanyName(subcontractor.companyName);
      setContactFirstName(subcontractor.contactFirstName);
      setContactLastName(subcontractor.contactLastName);
      setContactRole(subcontractor.contactRole);
      setActivity(subcontractor.activity);
      setActivityNotes(subcontractor.activityNotes);
      setSiret(subcontractor.siret);
      setRcs(subcontractor.rcs);
      setLegalForm(subcontractor.legalForm);
      setCapital(subcontractor.capital);
      setTvaNumber(subcontractor.tvaNumber);
      setEmail(subcontractor.email);
      setPhone(subcontractor.phone);
      setMobile(subcontractor.mobile);
      setWebsite(subcontractor.website);
      setAddressLine1(subcontractor.addressLine1);
      setAddressLine2(subcontractor.addressLine2);
      setPostalCode(subcontractor.postalCode);
      setCity(subcontractor.city);
      setCountry(subcontractor.country);
      setIban(subcontractor.iban);
      setBic(subcontractor.bic);
      setBankName(subcontractor.bankName);
      setIsActive(subcontractor.isActive);
      setRating(subcontractor.rating);
      setDefaultVatRate(subcontractor.defaultVatRate);
      setNotes(subcontractor.notes);
    } else {
      setCompanyName("");
      setContactFirstName("");
      setContactLastName("");
      setContactRole("");
      setActivity("autre");
      setActivityNotes("");
      setSiret("");
      setRcs("");
      setLegalForm("");
      setCapital("");
      setTvaNumber("");
      setEmail("");
      setPhone("");
      setMobile("");
      setWebsite("");
      setAddressLine1("");
      setAddressLine2("");
      setPostalCode("");
      setCity("");
      setCountry("France");
      setIban("");
      setBic("");
      setBankName("");
      setIsActive(true);
      setRating(0);
      setDefaultVatRate(20);
      setNotes("");
    }
    setConfirmDelete(false);
  }, [open, subcontractor?.id]);

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      toast.error("Le nom de la société est obligatoire");
      return;
    }

    const payload: Partial<Subcontractor> = {
      companyName: companyName.trim(),
      contactFirstName: contactFirstName.trim(),
      contactLastName: contactLastName.trim(),
      contactRole: contactRole.trim(),
      activity,
      activityNotes: activityNotes.trim(),
      siret: siret.trim(),
      rcs: rcs.trim(),
      legalForm: legalForm.trim(),
      capital: capital.trim(),
      tvaNumber: tvaNumber.trim(),
      email: email.trim(),
      phone: phone.trim(),
      mobile: mobile.trim(),
      website: website.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      country: country.trim(),
      iban: iban.trim().replace(/\s/g, ""),
      bic: bic.trim(),
      bankName: bankName.trim(),
      isActive,
      rating,
      defaultVatRate,
      notes: notes.trim(),
    };

    setSaving(true);
    let r;
    if (isEditing && subcontractor) {
      r = await update(subcontractor.id, payload);
    } else {
      r = await create(payload);
    }
    setSaving(false);

    if (r.success) {
      toast.success(isEditing ? "Sous-traitant mis à jour" : "Sous-traitant créé");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!subcontractor) return;
    setSaving(true);
    const r = await remove(subcontractor.id);
    setSaving(false);
    if (r.success) {
      toast.success("Sous-traitant supprimé");
      onSaved();
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
                <div className="w-10 h-10 rounded-lg bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
                  <HardHat className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold truncate">
                  {isEditing ? "Modifier le sous-traitant" : "Nouveau sous-traitant"}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Identité */}
              <Section title="Identité" icon={Building2}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label htmlFor="companyName">Raison sociale *</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="SARL DUPONT MAÇONNERIE"
                      className="mt-1.5"
                      autoFocus={!isEditing}
                    />
                  </div>
                  <div>
                    <Label>Prénom interlocuteur</Label>
                    <Input
                      value={contactFirstName}
                      onChange={(e) => setContactFirstName(e.target.value)}
                      placeholder="Jean"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Nom interlocuteur</Label>
                    <Input
                      value={contactLastName}
                      onChange={(e) => setContactLastName(e.target.value)}
                      placeholder="Dupont"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Fonction</Label>
                    <Input
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      placeholder="Gérant, Conducteur de travaux..."
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </Section>

              {/* Activité */}
              <Section title="Activité" icon={Briefcase}>
                <Label>Spécialité principale</Label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 mt-1.5">
                  {Object.entries(SUBCONTRACTOR_ACTIVITY_META).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActivity(key as SubcontractorActivity)}
                      className={cn(
                        "py-1.5 px-2 rounded-md border text-xs font-medium transition-all",
                        activity === key
                          ? meta.colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <Label>Notes activité</Label>
                  <Textarea
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    rows={2}
                    placeholder="Ex: Spécialisé en restauration patrimoine, certifié RGE..."
                    className="mt-1.5"
                  />
                </div>
              </Section>

              {/* Coordonnées */}
              <Section title="Coordonnées" icon={Phone}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      Téléphone
                    </Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Mobile</Label>
                    <Input value={mobile} onChange={(e) => setMobile(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Site web</Label>
                    <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="mt-1.5" />
                  </div>
                </div>
              </Section>

              {/* Adresse */}
              <Section title="Adresse" icon={MapPin}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>Adresse</Label>
                    <div className="mt-1.5">
                      <AddressAutocomplete
                        value={addressLine1}
                        onChange={setAddressLine1}
                        onSelect={(addr) => {
                          if (addr.postcode) setPostalCode(addr.postcode);
                          if (addr.city) setCity(addr.city);
                        }}
                        placeholder="Tapez 3 lettres pour suggestions..."
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Complément d'adresse</Label>
                    <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Code postal</Label>
                    <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Ville</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Pays</Label>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
              </Section>

              {/* Légal */}
              <Section title="Informations légales" icon={Building2}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>SIRET</Label>
                    <Input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="12345678901234" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>RCS / Greffe</Label>
                    <Input value={rcs} onChange={(e) => setRcs(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Forme juridique</Label>
                    <Input value={legalForm} onChange={(e) => setLegalForm(e.target.value)} placeholder="SARL, EURL, SAS..." className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Capital social</Label>
                    <Input value={capital} onChange={(e) => setCapital(e.target.value)} className="mt-1.5" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>N° TVA intracommunautaire</Label>
                    <Input value={tvaNumber} onChange={(e) => setTvaNumber(e.target.value)} placeholder="FR12345678901" className="mt-1.5" />
                  </div>
                </div>
              </Section>

              {/* Bancaire */}
              <Section title="Coordonnées bancaires" icon={CreditCard}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>IBAN</Label>
                    <Input
                      value={iban}
                      onChange={(e) => setIban(e.target.value.toUpperCase())}
                      placeholder="FR76 1234 5678 9012 3456 7890 123"
                      className="mt-1.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>BIC</Label>
                    <Input
                      value={bic}
                      onChange={(e) => setBic(e.target.value.toUpperCase())}
                      className="mt-1.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>Banque</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
              </Section>

              {/* Méta */}
              <Section title="Préférences" icon={Star}>
                <div className="space-y-3">
                  <div>
                    <Label>Note (0-5)</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n === rating ? 0 : n)}
                          className="text-amber-500"
                        >
                          <Star className={cn("w-6 h-6", n <= rating ? "fill-current" : "fill-none")} />
                        </button>
                      ))}
                      {rating > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">{rating}/5</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Taux TVA habituel</Label>
                    <select
                      value={String(defaultVatRate)}
                      onChange={(e) => setDefaultVatRate(parseFloat(e.target.value))}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-muted/50 text-sm"
                    >
                      {[20, 10, 5.5, 2.1, 0].map((r) => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                    <div>
                      <p className="text-sm font-medium">Sous-traitant actif</p>
                      <p className="text-[11px] text-muted-foreground">Décocher pour archiver</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => setIsActive(!isActive)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        isActive ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-soft-sm transform transition",
                          isActive ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                  <div>
                    <Label>Notes internes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Remarques, points d'attention..."
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </Section>
            </div>

            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
              <div>
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
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button onClick={handleSubmit} loading={saving}>
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
