import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Shield, Lightbulb, Stamp, PenLine, Award, ScrollText, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SettingsSectionWrapper } from "./SettingsPage";
import { SiretLookup } from "@/components/shared/SiretLookup";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import { LogoUpload } from "@/components/shared/LogoUpload";
import { ImageDataUrlUpload } from "@/components/shared/ImageDataUrlUpload";
import { RoleSelect } from "@/components/shared/RoleSelect";
import { LegalFormSelect } from "@/components/shared/LegalFormSelect";
import { useCompanyStore } from "@/stores/companyStore";
import type { CompanyProfile } from "@btp/types";
import type { SireneCompany } from "@/lib/sireneService";

// ═══════════════════════════════════════════════════════════════════════════
// CompanySection — Profil de l'entreprise utilisatrice
// ═══════════════════════════════════════════════════════════════════════════

// Session S25 — type local pour qualifications RGE/Qualibat
interface RgeQualification {
  id: string;
  type: string;       // "Qualibat", "RGE Eco-Artisan", "Qualifelec"...
  number: string;     // Numéro de certificat
  validUntil: string; // Date de validité (format ISO ou texte libre)
}

const PRESET_QUALIFICATIONS = [
  "Qualibat",
  "RGE Eco-Artisan",
  "RGE Qualibat",
  "Qualifelec",
  "Qualit'EnR",
  "QualiPAC",
  "QualiSol",
  "QualiBois",
  "Handibat",
  "Pros de la performance énergétique",
];

const EMPTY_COMPANY: Partial<CompanyProfile> = {
  companyName: "", tradingName: "", legalForm: "",
  siret: "", siren: "", tvaIntracom: "", tvaApplicable: true,
  apeCode: "", apeLabel: "", rcs: "",
  leaderFirstName: "", leaderLastName: "", leaderRole: "Gérant",
  email: "", phoneMobile: "", phoneFixed: "", website: "",
  addressLine1: "", addressLine2: "", postalCode: "", city: "", country: "France",
  iban: "", bic: "", bankName: "",
  decennaleCompany: "", decennaleContract: "", decennaleZone: "France entière", decennaleActivities: "",
  rcProCompany: "", rcProContract: "",
  logoPath: "",
};

export function CompanySection() {
  const { company, fetch, update } = useCompanyStore();
  const [formData, setFormData] = useState<Partial<CompanyProfile>>({ ...EMPTY_COMPANY });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ─── Session S25 — Champs additionnels stockés dans settings (pas dans companyStore)
  // Ce mécanisme évite de modifier le type CompanyProfile et son backend.
  const [stampDataUrl, setStampDataUrl] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [rgeQualifications, setRgeQualifications] = useState<RgeQualification[]>([]);
  const [cgvText, setCgvText] = useState("");
  const [s25Dirty, setS25Dirty] = useState(false);

  useEffect(() => {
    fetch();
    // Charger les settings additionnels S25
    (async () => {
      if (!window.btpAPI?.getSettings) return;
      try {
        const s = (await window.btpAPI.getSettings()) as any;
        setStampDataUrl(s.companyStampDataUrl || "");
        setSignatureDataUrl(s.companySignatureDataUrl || "");
        try {
          const qualif = s.rgeQualifications ? JSON.parse(s.rgeQualifications) : [];
          setRgeQualifications(Array.isArray(qualif) ? qualif : []);
        } catch {
          setRgeQualifications([]);
        }
        setCgvText(s.cgvText || "");
      } catch (e) {
        console.warn("[S25] Erreur chargement settings :", e);
      }
    })();
  }, []);

  useEffect(() => {
    setFormData({ ...EMPTY_COMPANY, ...company });
    setDirty(false);
  }, [company]);

  const update_ = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => {
    setFormData((d) => ({ ...d, [key]: value }));
    setDirty(true);
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
    setDirty(true);
    toast.success(`Données récupérées : ${c.nom}`);
  };

  const handleSave = async () => {
    setSaving(true);
    // Sauvegarde profil entreprise (existant)
    if (dirty) {
      await update(formData);
    }
    // Session S25 — Sauvegarde settings additionnels (cachet, signature, RGE, CGV)
    if (s25Dirty && window.btpAPI?.updateSettings) {
      try {
        await window.btpAPI.updateSettings({
          companyStampDataUrl: stampDataUrl,
          companySignatureDataUrl: signatureDataUrl,
          rgeQualifications: JSON.stringify(rgeQualifications),
          cgvText,
        } as any);
      } catch (e) {
        console.warn("[S25] Erreur sauvegarde settings :", e);
      }
    }
    setSaving(false);
    setS25Dirty(false);
    toast.success("Informations enregistrées");
  };

  // Session S25 — Helpers pour la liste de qualifications
  const addQualification = () => {
    setRgeQualifications([
      ...rgeQualifications,
      { id: `q_${Date.now()}`, type: "", number: "", validUntil: "" },
    ]);
    setS25Dirty(true);
  };

  const updateQualification = (id: string, key: keyof RgeQualification, value: string) => {
    setRgeQualifications(
      rgeQualifications.map((q) => (q.id === id ? { ...q, [key]: value } : q))
    );
    setS25Dirty(true);
  };

  const removeQualification = (id: string) => {
    setRgeQualifications(rgeQualifications.filter((q) => q.id !== id));
    setS25Dirty(true);
  };

  return (
    <div className="space-y-6">
      {/* Auto-remplissage SIRENE */}
      <SettingsSectionWrapper
        title="Auto-remplissage via SIRENE"
        description="Récupérez automatiquement les informations officielles de votre entreprise"
      >
        <SiretLookup onSelect={handleSireneSelect} />
      </SettingsSectionWrapper>

      {/* Identité */}
      <SettingsSectionWrapper title="Identité de l'entreprise" description="Informations d'identification">
        <div className="grid gap-4">
          {/* Logo */}
          <LogoUpload
            logoPath={formData.logoPath || ""}
            onChange={(logoPath) => {
              update_("logoPath", logoPath);
              // Le backend a déjà enregistré en DB via company:uploadLogo,
              // on reset le dirty state (pas besoin de Save supplémentaire)
              setDirty(false);
            }}
          />

          {/* Session S25 — Guide pour un beau logo */}
          <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3">
            <div className="flex items-start gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Conseils pour un beau logo
                </p>
              </div>
            </div>
            <ul className="text-[11px] text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Format <strong>PNG avec fond transparent</strong> (idéal pour PDF)</li>
              <li>Résolution <strong>500×500 px minimum</strong> (sans pixellisation à l'impression)</li>
              <li>Logo carré ou paysage 16:9 (pour le placer en en-tête)</li>
              <li>Conservez 10% de marge autour du dessin (respiration)</li>
              <li>Évitez les fichiers JPG (fond blanc visible sur PDF)</li>
            </ul>
            <div className="mt-2 ml-6 flex flex-wrap gap-2">
              <a
                href="https://www.photopea.com"
                target="_blank"
                rel="noreferrer noopener"
                className="text-[10px] inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Photopea (gratuit, comme Photoshop)
              </a>
              <a
                href="https://www.remove.bg"
                target="_blank"
                rel="noreferrer noopener"
                className="text-[10px] inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Remove.bg (enlever le fond en 1 clic)
              </a>
            </div>
          </div>

          <div>
            <Label>Raison sociale</Label>
            <Input value={formData.companyName || ""} onChange={(e) => update_("companyName", e.target.value)} placeholder="JACOB HABITAT" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom commercial (si différent)</Label>
              <Input value={formData.tradingName || ""} onChange={(e) => update_("tradingName", e.target.value)} />
            </div>
            <div>
              <Label>Forme juridique</Label>
              <LegalFormSelect
                value={formData.legalForm || ""}
                onChange={(v) => update_("legalForm", v)}
                placeholder="SARL, SAS, EI, Auto-entrepreneur..."
              />
            </div>
          </div>
        </div>
      </SettingsSectionWrapper>

      {/* Identifiants légaux */}
      <SettingsSectionWrapper title="Identifiants légaux" description="SIRET, TVA, APE">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>SIRET</Label>
            <Input value={formData.siret || ""} onChange={(e) => update_("siret", e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>SIREN</Label>
            <Input value={formData.siren || ""} onChange={(e) => update_("siren", e.target.value)} className="font-mono" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>TVA intracommunautaire</Label>
            <Input value={formData.tvaIntracom || ""} onChange={(e) => update_("tvaIntracom", e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>RCS (si applicable)</Label>
            <Input value={formData.rcs || ""} onChange={(e) => update_("rcs", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <div>
            <Label>Code APE</Label>
            <Input value={formData.apeCode || ""} onChange={(e) => update_("apeCode", e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>Activité</Label>
            <Input value={formData.apeLabel || ""} onChange={(e) => update_("apeLabel", e.target.value)} />
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="tva-applicable">Assujetti à la TVA</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Désactivez si vous êtes en franchise en base (micro-entreprise)
            </p>
          </div>
          <Switch
            id="tva-applicable"
            checked={formData.tvaApplicable !== false}
            onCheckedChange={(v) => update_("tvaApplicable", v)}
          />
        </div>
      </SettingsSectionWrapper>

      {/* Dirigeant */}
      <SettingsSectionWrapper title="Dirigeant" description="Personne représentant l'entreprise (pour documents officiels)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prénom</Label>
            <Input value={formData.leaderFirstName || ""} onChange={(e) => update_("leaderFirstName", e.target.value)} />
          </div>
          <div>
            <Label>Nom</Label>
            <Input value={formData.leaderLastName || ""} onChange={(e) => update_("leaderLastName", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Fonction</Label>
          <RoleSelect
            value={formData.leaderRole || ""}
            onChange={(v) => update_("leaderRole", v)}
            placeholder="Gérant, Président, Entrepreneur individuel..."
          />
        </div>
      </SettingsSectionWrapper>

      {/* Coordonnées */}
      <SettingsSectionWrapper title="Coordonnées" description="Contact et adresse de votre entreprise">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={formData.email || ""} onChange={(e) => update_("email", e.target.value)} />
          </div>
          <div>
            <Label>Site web</Label>
            <Input value={formData.website || ""} onChange={(e) => update_("website", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mobile</Label>
            <Input value={formData.phoneMobile || ""} onChange={(e) => update_("phoneMobile", e.target.value)} />
          </div>
          <div>
            <Label>Fixe</Label>
            <Input value={formData.phoneFixed || ""} onChange={(e) => update_("phoneFixed", e.target.value)} />
          </div>
        </div>

        <Separator />

        <div>
          <Label>Adresse ligne 1</Label>
          <AddressAutocomplete
            value={formData.addressLine1 || ""}
            onChange={(v) => update_("addressLine1", v)}
            onSelect={(addr) => {
              setFormData((d) => ({
                ...d,
                postalCode: addr.postcode || d.postalCode,
                city: addr.city || d.city,
              }));
              setDirty(true);
            }}
            placeholder="Tapez 3 lettres pour suggestions..."
          />
        </div>
        <div>
          <Label>Adresse ligne 2</Label>
          <Input value={formData.addressLine2 || ""} onChange={(e) => update_("addressLine2", e.target.value)} />
        </div>
        <div className="grid grid-cols-[120px_1fr_1fr] gap-3">
          <div>
            <Label>CP</Label>
            <Input value={formData.postalCode || ""} onChange={(e) => update_("postalCode", e.target.value)} />
          </div>
          <div>
            <Label>Ville</Label>
            <Input value={formData.city || ""} onChange={(e) => update_("city", e.target.value)} />
          </div>
          <div>
            <Label>Pays</Label>
            <Input value={formData.country || ""} onChange={(e) => update_("country", e.target.value)} />
          </div>
        </div>
      </SettingsSectionWrapper>

      {/* ─── Session S25 — Cachet & Signature ─────────────────────────── */}
      <SettingsSectionWrapper
        title="Cachet et signature"
        description="Apparaîtront automatiquement en bas de vos devis et factures"
      >
        <div className="grid md:grid-cols-2 gap-6">
          {/* Cachet */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Stamp className="w-3.5 h-3.5 text-muted-foreground" />
              Cachet d'entreprise
            </Label>
            <ImageDataUrlUpload
              value={stampDataUrl}
              onChange={(v) => {
                setStampDataUrl(v);
                setS25Dirty(true);
              }}
              emptyLabel="Aucun cachet"
              aspectClass="aspect-square"
              tip="PNG transparent recommandé · ~300×300 px · forme ronde ou carrée"
            />
          </div>

          {/* Signature */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <PenLine className="w-3.5 h-3.5 text-muted-foreground" />
              Signature du dirigeant
            </Label>
            <ImageDataUrlUpload
              value={signatureDataUrl}
              onChange={(v) => {
                setSignatureDataUrl(v);
                setS25Dirty(true);
              }}
              emptyLabel="Aucune signature"
              aspectClass="aspect-[5/2]"
              tip="PNG transparent · format paysage ~400×150 px · scan ou photo nette"
            />
          </div>
        </div>

        <Separator />

        <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-3">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
            <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              <strong>Astuce :</strong> Pour un effet professionnel, scannez votre signature sur fond
              blanc, puis enlevez le fond avec <a href="https://www.remove.bg" target="_blank" rel="noreferrer noopener" className="underline">remove.bg</a>.
              Le résultat est meilleur qu'une signature dessinée à la souris.
            </span>
          </p>
        </div>
      </SettingsSectionWrapper>

      {/* ─── Session S25 — Qualifications RGE / Qualibat ──────────────── */}
      <SettingsSectionWrapper
        title="Qualifications & certifications"
        description="RGE, Qualibat, etc. — apparaîtront sur vos devis et factures"
      >
        {rgeQualifications.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-md">
            <Award className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground mb-3">
              Aucune qualification ajoutée
            </p>
            <Button size="sm" variant="outline" onClick={addQualification}>
              <Plus className="w-3.5 h-3.5" />
              Ajouter une qualification
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rgeQualifications.map((q) => (
              <div
                key={q.id}
                className="grid grid-cols-[1fr_1fr_140px_auto] gap-2 items-end p-2.5 border border-border rounded-md"
              >
                <div>
                  <Label className="text-[10px]">Type</Label>
                  <Input
                    list="qualif-presets"
                    value={q.type}
                    onChange={(e) => updateQualification(q.id, "type", e.target.value)}
                    placeholder="Qualibat, RGE..."
                  />
                </div>
                <div>
                  <Label className="text-[10px]">N° certificat</Label>
                  <Input
                    value={q.number}
                    onChange={(e) => updateQualification(q.id, "number", e.target.value)}
                    placeholder="123456789"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Validité</Label>
                  <Input
                    value={q.validUntil}
                    onChange={(e) => updateQualification(q.id, "validUntil", e.target.value)}
                    placeholder="12/2027"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQualification(q.id)}
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <datalist id="qualif-presets">
              {PRESET_QUALIFICATIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <Button size="sm" variant="outline" onClick={addQualification} className="w-full">
              <Plus className="w-3.5 h-3.5" />
              Ajouter une autre qualification
            </Button>
          </div>
        )}
      </SettingsSectionWrapper>

      {/* ─── Session S25 — Conditions Générales de Vente ─────────────── */}
      <SettingsSectionWrapper
        title="Conditions Générales de Vente"
        description="Apparaîtront en dernière page de vos devis"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5 text-muted-foreground" />
              Texte des CGV
            </Label>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCgvText(CGV_TEMPLATE_BTP);
                  setS25Dirty(true);
                  toast.success("Modèle BTP chargé");
                }}
              >
                Modèle BTP
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCgvText(CGV_TEMPLATE_SOBRE);
                  setS25Dirty(true);
                  toast.success("Modèle sobre chargé");
                }}
              >
                Modèle sobre
              </Button>
            </div>
          </div>
          <Textarea
            value={cgvText}
            onChange={(e) => {
              setCgvText(e.target.value);
              setS25Dirty(true);
            }}
            rows={10}
            placeholder="Saisissez vos CGV ou utilisez un modèle ci-dessus..."
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            {cgvText.length} caractère{cgvText.length > 1 ? "s" : ""} · environ {Math.ceil(cgvText.length / 1800)} page{Math.ceil(cgvText.length / 1800) > 1 ? "s" : ""}
          </p>
        </div>
      </SettingsSectionWrapper>

      {/* Bancaire */}
      <SettingsSectionWrapper title="Coordonnées bancaires" description="Apparaîtront sur vos factures">
        <div>
          <Label>Nom de la banque</Label>
          <Input value={formData.bankName || ""} onChange={(e) => update_("bankName", e.target.value)} />
        </div>
        <div className="grid grid-cols-[1fr_200px] gap-3">
          <div>
            <Label>IBAN</Label>
            <Input value={formData.iban || ""} onChange={(e) => update_("iban", e.target.value.toUpperCase())} className="font-mono" />
          </div>
          <div>
            <Label>BIC</Label>
            <Input value={formData.bic || ""} onChange={(e) => update_("bic", e.target.value.toUpperCase())} className="font-mono" />
          </div>
        </div>
      </SettingsSectionWrapper>

      {/* Assurances BTP (obligatoires) */}
      <SettingsSectionWrapper title="Assurances BTP" description="Informations obligatoires pour vos devis et factures (loi Spinetta)">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> Garantie décennale
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Compagnie</Label>
            <Input value={formData.decennaleCompany || ""} onChange={(e) => update_("decennaleCompany", e.target.value)} placeholder="SMABTP, MMA, ..." />
          </div>
          <div>
            <Label>N° de contrat</Label>
            <Input value={formData.decennaleContract || ""} onChange={(e) => update_("decennaleContract", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Zone géographique couverte</Label>
          <Input value={formData.decennaleZone || ""} onChange={(e) => update_("decennaleZone", e.target.value)} placeholder="France métropolitaine" />
        </div>
        <div>
          <Label>Activités couvertes</Label>
          <Textarea value={formData.decennaleActivities || ""} onChange={(e) => update_("decennaleActivities", e.target.value)} rows={2} placeholder="Maçonnerie, carrelage, plâtrerie..." />
        </div>

        <Separator />

        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> Responsabilité civile pro
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Compagnie</Label>
            <Input value={formData.rcProCompany || ""} onChange={(e) => update_("rcProCompany", e.target.value)} />
          </div>
          <div>
            <Label>N° de contrat</Label>
            <Input value={formData.rcProContract || ""} onChange={(e) => update_("rcProContract", e.target.value)} />
          </div>
        </div>
      </SettingsSectionWrapper>

      {/* Save button sticky */}
      <motion.div
        initial={false}
        animate={{ opacity: (dirty || s25Dirty) ? 1 : 0.5, y: (dirty || s25Dirty) ? 0 : 4 }}
        className="sticky bottom-4 flex justify-end gap-2 p-3 bg-card border border-border rounded-lg shadow-soft-md"
      >
        {(dirty || s25Dirty) && (
          <span className="text-xs text-muted-foreground flex items-center mr-auto">
            Modifications non enregistrées
          </span>
        )}
        <Button onClick={handleSave} loading={saving} disabled={!dirty && !s25Dirty}>
          <Save className="w-4 h-4" />
          Enregistrer
        </Button>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Session S25 — Modèles de CGV pré-remplis
// ═══════════════════════════════════════════════════════════════════════════

const CGV_TEMPLATE_BTP = `CONDITIONS GÉNÉRALES DE VENTE

Article 1 - Objet
Les présentes conditions générales de vente (CGV) régissent toutes les prestations de services réalisées par notre entreprise dans le cadre de travaux du bâtiment.

Article 2 - Devis
Le devis est valable 3 mois à compter de sa date d'émission. Au-delà de cette période, les prix peuvent être révisés. La signature du devis vaut acceptation sans réserve des présentes CGV.

Article 3 - Acompte
Un acompte de 30% du montant total TTC est exigé à la signature du devis. Le solde est dû selon les modalités définies au devis (situations intermédiaires, fin de chantier).

Article 4 - Délais d'exécution
Les délais sont donnés à titre indicatif. Tout retard imputable à des intempéries, à la défaillance de fournisseurs ou à des contraintes techniques ne peut donner lieu à pénalité.

Article 5 - Modifications du devis
Toute modification demandée par le client en cours de chantier fera l'objet d'un avenant écrit, signé par les deux parties.

Article 6 - Réception des travaux
La réception des travaux est constatée par un procès-verbal signé contradictoirement. À défaut de réserves émises lors de la réception, les travaux sont réputés conformes.

Article 7 - Paiement
Les factures sont payables à 30 jours date d'émission. Tout retard de paiement entraîne l'application de pénalités au taux légal en vigueur, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).

Article 8 - Garanties
Conformément à la loi du 4 janvier 1978 (loi Spinetta), nos travaux bénéficient de :
- la garantie de parfait achèvement (1 an)
- la garantie biennale (2 ans, équipements dissociables)
- la garantie décennale (10 ans, gros œuvre).

Article 9 - Médiation
En cas de litige, le client peut recourir à un médiateur de la consommation. Liste disponible sur www.economie.gouv.fr/mediation-conso.

Article 10 - Droit applicable
Les présentes CGV sont régies par le droit français. Tout litige sera de la compétence des tribunaux français.`;

const CGV_TEMPLATE_SOBRE = `CONDITIONS GÉNÉRALES DE VENTE

1. Le devis est valable 3 mois.

2. Un acompte de 30% est demandé à la signature, le solde à la livraison.

3. Les délais d'exécution sont indicatifs.

4. Toute modification donne lieu à un avenant écrit.

5. Les factures sont payables à 30 jours.

6. Tout retard entraîne des pénalités au taux légal et une indemnité de 40 €.

7. Garantie décennale conformément à la loi.

8. Litiges : médiation préalable, juridiction française.`;
