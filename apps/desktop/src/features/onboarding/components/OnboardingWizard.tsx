import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Building, Users, Hammer, Check,
  ArrowRight, ArrowLeft, X, Rocket,
  Search, FileSignature, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanyStore } from "@/stores/companyStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useChantiersStore } from "@/stores/chantiersStore";

// ═══════════════════════════════════════════════════════════════════════════
// OnboardingWizard — Premier lancement (Session 19)
// 5 étapes : Bienvenue → Entreprise → 1er client → 1er chantier → Tour
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
}

type StepKey = "welcome" | "company" | "client" | "chantier" | "tour";
const STEPS: StepKey[] = ["welcome", "company", "client", "chantier", "tour"];

export function OnboardingWizard({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepKey>("welcome");

  const stepIndex = STEPS.indexOf(step);
  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  };
  const goPrev = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  };

  // Reset on open
  useEffect(() => {
    if (open) setStep("welcome");
  }, [open]);

  const handleFinish = () => {
    // Marquer comme terminé
    if (typeof window !== "undefined") {
      try { localStorage.setItem("batidesk.onboarding.done", "1"); } catch {}
    }
    onClose();
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      try { localStorage.setItem("batidesk.onboarding.done", "1"); } catch {}
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Header avec progression */}
            <div className="p-5 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Bienvenue dans BatiDesk</span>
                </div>
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Passer
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Progression */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((s, idx) => (
                  <div
                    key={s}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all",
                      idx <= stepIndex ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-1.5">
                Étape {stepIndex + 1} sur {STEPS.length}
              </p>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-6"
                >
                  {step === "welcome" && <WelcomeStep />}
                  {step === "company" && <CompanyStep onNext={goNext} />}
                  {step === "client" && <ClientStep onNext={goNext} />}
                  {step === "chantier" && <ChantierStep onNext={goNext} />}
                  {step === "tour" && <TourStep />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer navigation */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
              <div>
                {stepIndex > 0 && (
                  <Button variant="ghost" size="sm" onClick={goPrev}>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Précédent
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {step === "welcome" && (
                  <Button onClick={goNext}>
                    Commencer
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
                {(step === "client" || step === "chantier") && (
                  <Button variant="ghost" size="sm" onClick={goNext}>
                    Plus tard
                  </Button>
                )}
                {step === "tour" && (
                  <Button onClick={handleFinish}>
                    <Rocket className="w-4 h-4" />
                    Démarrer
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Étape 1 : Bienvenue ──────────────────────────────────────────────────
function WelcomeStep() {
  return (
    <div className="text-center py-4">
      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center mb-4">
        <Sparkles className="w-9 h-9 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Bienvenue dans BatiDesk</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        Ton outil tout-en-un pour gérer ton activité BTP : devis, factures, chantiers,
        comptabilité, sous-traitance, et bien plus.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left">
        <FeatureBubble
          icon={FileSignature}
          title="Devis & factures"
          description="Génération PDF avec mentions légales"
        />
        <FeatureBubble
          icon={Hammer}
          title="Chantiers"
          description="Suivi complet avec photos et timeline"
        />
        <FeatureBubble
          icon={ShieldCheck}
          title="Coffre-fort"
          description="Documents chiffrés AES-256"
        />
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        On va configurer ton espace en quelques minutes 👇
      </p>
    </div>
  );
}

// ─── Étape 2 : Entreprise ─────────────────────────────────────────────────
function CompanyStep({ onNext }: { onNext: () => void }) {
  const { company, fetch: fetchCompany, update } = useCompanyStore();
  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");
  const [tvaIntracom, setTvaIntracom] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phoneMobile, setPhoneMobile] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompany();
  }, []);

  useEffect(() => {
    if (company) {
      setCompanyName(company.companyName || "");
      setSiret(company.siret || "");
      setTvaIntracom(company.tvaIntracom || "");
      setAddressLine1(company.addressLine1 || "");
      setPostalCode(company.postalCode || "");
      setCity(company.city || "");
      setEmail(company.email || "");
      setPhoneMobile(company.phoneMobile || "");
    }
  }, [company.companyName, company.siret]);

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    setSaving(true);
    try {
      await update({
        companyName: companyName.trim(),
        siret: siret.trim(),
        tvaIntracom: tvaIntracom.trim(),
        addressLine1: addressLine1.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        email: email.trim(),
        phoneMobile: phoneMobile.trim(),
      });
      toast.success("Informations enregistrées");
      onNext();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
          <Building className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Ton entreprise</h2>
          <p className="text-xs text-muted-foreground">
            Ces informations apparaîtront sur tes devis et factures
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Raison sociale *</Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="JACOB HABITAT"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>SIRET</Label>
            <Input
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              placeholder="51068269300013"
              className="mt-1 tabular-nums"
            />
          </div>
          <div>
            <Label>N° TVA intracom.</Label>
            <Input
              value={tvaIntracom}
              onChange={(e) => setTvaIntracom(e.target.value)}
              placeholder="FR21510682693"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label>Adresse</Label>
          <Input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="12 rue de l'Église"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Code postal</Label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="55230"
              className="mt-1 tabular-nums"
            />
          </div>
          <div className="col-span-2">
            <Label>Ville</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Muzeray"
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email pro</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@jacobhabitat.fr"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input
              value={phoneMobile}
              onChange={(e) => setPhoneMobile(e.target.value)}
              placeholder="06 12 34 56 78"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <Button onClick={handleSave} loading={saving}>
          <Check className="w-4 h-4" />
          Enregistrer et continuer
        </Button>
      </div>
    </div>
  );
}

// ─── Étape 3 : Premier client ─────────────────────────────────────────────
function ClientStep({ onNext }: { onNext: () => void }) {
  const { create } = useClientsStore();
  const [type, setType] = useState<"particulier" | "pro">("particulier");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneMobile, setPhoneMobile] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (type === "particulier" && !lastName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (type === "pro" && !companyName.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    setSaving(true);
    try {
      const r = await create({
        type,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        phoneMobile: phoneMobile.trim(),
      } as any);
      if (r.success) {
        toast.success("Premier client créé");
        onNext();
      } else {
        toast.error(r.error || "Erreur");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-violet-500/15 text-violet-500 flex items-center justify-center">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Ton premier client</h2>
          <p className="text-xs text-muted-foreground">
            Pour démarrer rapidement. Tu pourras en ajouter d'autres après.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Type */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("particulier")}
            className={cn(
              "p-3 rounded-md border text-sm font-medium transition-all",
              type === "particulier"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-accent text-muted-foreground"
            )}
          >
            👤 Particulier
          </button>
          <button
            type="button"
            onClick={() => setType("pro")}
            className={cn(
              "p-3 rounded-md border text-sm font-medium transition-all",
              type === "pro"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-accent text-muted-foreground"
            )}
          >
            🏢 Professionnel
          </button>
        </div>

        {type === "particulier" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prénom</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Nom *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
            </div>
          </div>
        ) : (
          <div>
            <Label>Nom de l'entreprise *</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={phoneMobile} onChange={(e) => setPhoneMobile(e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <Button onClick={handleSave} loading={saving}>
          <Check className="w-4 h-4" />
          Créer le client
        </Button>
      </div>
    </div>
  );
}

// ─── Étape 4 : Premier chantier ───────────────────────────────────────────
function ChantierStep({ onNext }: { onNext: () => void }) {
  const { clients, fetch: fetchClients } = useClientsStore();
  const { create } = useChantiersStore();
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  // Pré-sélectionne le 1er client
  useEffect(() => {
    if (!clientId && clients.length > 0) {
      setClientId(clients[0].id);
    }
  }, [clients]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Le titre du chantier est requis");
      return;
    }
    setSaving(true);
    try {
      const r = await create({
        title: title.trim(),
        clientId,
        addressLine1: addressLine1.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
      } as any);
      if (r.success) {
        toast.success("Premier chantier créé");
        onNext();
      } else {
        toast.error(r.error || "Erreur");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
          <Hammer className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Ton premier chantier</h2>
          <p className="text-xs text-muted-foreground">
            Optionnel. Sert à organiser tes devis, factures et documents.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Titre du chantier *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rénovation salle de bain"
            className="mt-1"
          />
        </div>

        {clients.length > 0 && (
          <div>
            <Label>Client</Label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="">— Aucun —</option>
              {clients.map((c) => {
                const name = c.type === "particulier"
                  ? `${c.firstName || ""} ${c.lastName || ""}`.trim()
                  : c.companyName;
                return <option key={c.id} value={c.id}>{name}</option>;
              })}
            </select>
          </div>
        )}

        <div>
          <Label>Adresse du chantier</Label>
          <Input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Code postal</Label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="mt-1 tabular-nums"
            />
          </div>
          <div className="col-span-2">
            <Label>Ville</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <Button onClick={handleSave} loading={saving}>
          <Check className="w-4 h-4" />
          Créer le chantier
        </Button>
      </div>
    </div>
  );
}

// ─── Étape 5 : Tour ────────────────────────────────────────────────────────
function TourStep() {
  return (
    <div className="text-center py-4">
      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center mb-4">
        <Rocket className="w-9 h-9 text-emerald-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Tu es prêt(e) !</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        BatiDesk est configuré. Voici quelques astuces pour démarrer en force.
      </p>

      <div className="space-y-2 text-left max-w-md mx-auto">
        <TipRow
          icon={Search}
          title="Ctrl + K pour tout chercher"
          description="Une palette globale qui fouille dans tes clients, devis, factures, chantiers..."
        />
        <TipRow
          icon={FileSignature}
          title="Documents administratifs"
          description="Génère PV de réception, attestations TVA et DC4 en 1 clic"
        />
        <TipRow
          icon={ShieldCheck}
          title="Coffre-fort sécurisé"
          description="Tous tes PDF sont chiffrés AES-256-GCM avec ta clé maître"
        />
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Le tableau de bord t'attend. Bonne route ! 🚀
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function FeatureBubble({ icon: Icon, title, description }: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <Icon className="w-5 h-5 text-primary mb-1.5" />
      <p className="text-xs font-semibold">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function TipRow({ icon: Icon, title, description }: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border">
      <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
