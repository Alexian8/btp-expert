import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PDFViewer } from "@react-pdf/renderer";
import {
  Palette,
  Sparkles,
  FileText,
  Mail,
  Save,
  Info,
  Hash,
  Type,
  Layout,
  Eye,
  Wrench,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSectionWrapper } from "./SettingsPage";
import { useCompanyStore } from "@/stores/companyStore";
import { QuotePdfDocument } from "@/features/pdf/QuotePdfDocument";
import { QuotePdfMinimal } from "@/features/pdf/QuotePdfMinimal";
import { QuotePdfClassique } from "@/features/pdf/QuotePdfClassique";
import type { Quote, Client } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// DocumentsSection — Personnalisation PDF + numérotation + templates email
// 3 onglets : Style PDF · Numérotation · Emails
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "pdf" | "numbering" | "email";

const PRESET_COLORS = [
  { name: "Bleu", value: "#2563eb" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Émeraude", value: "#10b981" },
  { name: "Orange", value: "#ea580c" },
  { name: "Rouge", value: "#dc2626" },
  { name: "Ardoise", value: "#475569" },
  { name: "Noir", value: "#111827" },
];

const PDF_FONTS = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia (serif)" },
  { value: "Times New Roman", label: "Times New Roman (serif)" },
  { value: "Garamond", label: "Garamond (serif)" },
];

type PdfStyle = "moderne" | "sobre" | "classique";

const STYLE_OPTIONS: Array<{
  value: PdfStyle;
  label: string;
  description: string;
  preview: string;
}> = [
  {
    value: "moderne",
    label: "Moderne",
    description: "En-tête coloré, design épuré façon Pennylane / Tolteck",
    preview: "▓▓▓ HEADER\n  ━━━━━\n  ▌ ▌ ▌\n  ─────",
  },
  {
    value: "sobre",
    label: "Sobre",
    description: "Noir & blanc minimaliste façon TerréA",
    preview: "ENTREPRISE\n┌───┬───┐\n│ │ │ │ │\n└───┴───┘",
  },
  {
    value: "classique",
    label: "Classique BTP",
    description: "Bordures épaisses + Times serif, esprit traditionnel",
    preview: "╔═══════╗\n║ ║ ║ ║ ║\n╚═══════╝",
  },
];

// ─── Préréglages métiers ──────────────────────────────────────────────
interface Preset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  pdfStyle: PdfStyle;
  pdfAccentColor: string;
  pdfFont: string;
}

const PRESETS: Preset[] = [
  {
    id: "default",
    label: "BatiDesk standard",
    emoji: "🏗️",
    description: "Bleu pro, moderne — par défaut",
    pdfStyle: "moderne",
    pdfAccentColor: "#2563eb",
    pdfFont: "Helvetica",
  },
  {
    id: "macon",
    label: "Maçon",
    emoji: "🧱",
    description: "Brun terre, classique BTP",
    pdfStyle: "classique",
    pdfAccentColor: "#7c2d12",
    pdfFont: "Times New Roman",
  },
  {
    id: "plombier",
    label: "Plombier",
    emoji: "🔧",
    description: "Bleu turquoise, moderne",
    pdfStyle: "moderne",
    pdfAccentColor: "#0891b2",
    pdfFont: "Helvetica",
  },
  {
    id: "electricien",
    label: "Électricien",
    emoji: "⚡",
    description: "Jaune ambre, moderne",
    pdfStyle: "moderne",
    pdfAccentColor: "#ea580c",
    pdfFont: "Helvetica",
  },
  {
    id: "peintre",
    label: "Peintre",
    emoji: "🎨",
    description: "Violet créatif, moderne",
    pdfStyle: "moderne",
    pdfAccentColor: "#7c3aed",
    pdfFont: "Inter",
  },
  {
    id: "architecte",
    label: "Architecte",
    emoji: "📐",
    description: "Sobre noir & blanc, élégant",
    pdfStyle: "sobre",
    pdfAccentColor: "#111827",
    pdfFont: "Helvetica",
  },
  {
    id: "couvreur",
    label: "Couvreur",
    emoji: "🏠",
    description: "Émeraude, classique",
    pdfStyle: "classique",
    pdfAccentColor: "#10b981",
    pdfFont: "Times New Roman",
  },
];

// ─── Devis fictif pour le live preview ──────────────────────────────
const SAMPLE_CLIENT: Client = {
  id: "sample-client",
  type: "particulier",
  civility: "M.",
  firstName: "Jean",
  lastName: "Dupont",
  companyName: "",
  email: "jean.dupont@example.com",
  phoneMobile: "06 12 34 56 78",
  phoneFixed: "",
  addressLine1: "12 rue de la République",
  addressLine2: "",
  postalCode: "55700",
  city: "Stenay",
  country: "France",
  billingAddressSame: 1 as unknown as boolean,
  billingAddressLine1: "",
  billingAddressLine2: "",
  billingPostalCode: "",
  billingCity: "",
  billingCountry: "",
  siret: "",
  siren: "",
  tvaIntracom: "",
  legalForm: "",
  apeCode: "",
  apeLabel: "",
  tags: [],
  source: "",
  notes: "",
  firstContactAt: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as Client;

const SAMPLE_QUOTE: Quote = {
  id: "sample-quote",
  reference: "DEV-2026-0001",
  status: "brouillon",
  title: "Rénovation salle de bain",
  clientId: "sample-client",
  chantierId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10),
  acceptedAt: "",
  sentAt: "",
  items: [
    {
      id: "s1",
      kind: "section",
      title: "Travaux préparatoires",
      description: "",
      quantity: 0,
      unit: "",
      unitPriceHT: 0,
      vatRate: 20,
      discountPercent: 0,
      discountAmount: 0,
      discountMode: "none",
    },
    {
      id: "1",
      kind: "line",
      title: "Dépose de l'existant",
      description: "Évacuation comprise",
      quantity: 1,
      unit: "forfait",
      unitPriceHT: 500,
      vatRate: 20,
      discountPercent: 0,
      discountAmount: 0,
      discountMode: "none",
    },
    {
      id: "s2",
      kind: "section",
      title: "Pose et finitions",
      description: "",
      quantity: 0,
      unit: "",
      unitPriceHT: 0,
      vatRate: 20,
      discountPercent: 0,
      discountAmount: 0,
      discountMode: "none",
    },
    {
      id: "2",
      kind: "line",
      title: "Carrelage mural",
      description: "Faïence 25×40 — pose droite",
      quantity: 28,
      unit: "m²",
      unitPriceHT: 95,
      vatRate: 10,
      discountPercent: 0,
      discountAmount: 0,
      discountMode: "none",
    },
    {
      id: "3",
      kind: "line",
      title: "Plomberie",
      description: "Installation douche italienne, mitigeur thermostatique",
      quantity: 1,
      unit: "forfait",
      unitPriceHT: 1850,
      vatRate: 10,
      discountPercent: 0,
      discountAmount: 0,
      discountMode: "none",
    },
    {
      id: "4",
      kind: "line",
      title: "Meuble vasque",
      description: "Suspendu 80 cm, 1 vasque, miroir",
      quantity: 1,
      unit: "u",
      unitPriceHT: 720,
      vatRate: 10,
      discountPercent: 0,
      discountAmount: 0,
      discountMode: "none",
    },
  ],
  globalDiscountMode: "none",
  globalDiscountPercent: 0,
  globalDiscountAmount: 0,
  introText: "Suite à votre demande, voici le devis détaillé pour la rénovation de votre salle de bain.",
  conditionsText: "Devis gratuit valable 90 jours. Acompte de 30 % à la commande.",
  footerText: "",
  internalNotes: "",
  companySnapshot: {},
  totalHT: 0,
  totalTTC: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as Quote;

export function DocumentsSection() {
  const [tab, setTab] = useState<Tab>("pdf");

  // ─── PDF state (gardé tel quel pour compat avec les settings sauvegardés)
  const [pdfAccentColor, setPdfAccentColor] = useState("#2563eb");
  const [pdfStyle, setPdfStyle] = useState<PdfStyle>("moderne");
  const [pdfFooterText, setPdfFooterText] = useState("");
  const [pdfShowLogoInHeader, setPdfShowLogoInHeader] = useState(true);
  const [pdfShowCompanyAddress, setPdfShowCompanyAddress] = useState(true);
  const [pdfIbanShown, setPdfIbanShown] = useState(true);

  // Numérotation
  const [invoicePaymentTermsDays, setInvoicePaymentTermsDays] = useState(30);
  const [invoicePrefix, setInvoicePrefix] = useState("FACT");
  const [quotePrefix, setQuotePrefix] = useState("DEV");
  const [quoteValidityDays, setQuoteValidityDays] = useState(90);

  // Mise en page
  const [pdfStampPosition, setPdfStampPosition] =
    useState<"left" | "center" | "right">("right");
  const [pdfDensity, setPdfDensity] =
    useState<"compact" | "normal" | "comfortable">("normal");
  const [pdfShowAccordBlock, setPdfShowAccordBlock] = useState(true);
  const [pdfShowSignatureBlock, setPdfShowSignatureBlock] = useState(true);
  const [pdfShowQualifications, setPdfShowQualifications] = useState(true);

  const [pdfFont, setPdfFont] = useState("Helvetica");
  // Compat : sauvegardé mais pas affiché (le style devis est piloté
  // depuis la modal d'aperçu PDF directement, pas depuis Settings)
  const [pdfQuoteStyle, setPdfQuoteStyle] = useState<PdfStyle>("moderne");
  // Compat : tailles cachet/signature/logo (defaults sensibles)
  const [pdfLogoSizeMm, setPdfLogoSizeMm] = useState(35);
  const [pdfStampSizeMm, setPdfStampSizeMm] = useState(26);
  const [pdfSignatureSizeMm, setPdfSignatureSizeMm] = useState(22);

  // Email templates
  const [emailQuoteSubject, setEmailQuoteSubject] = useState("");
  const [emailQuoteBody, setEmailQuoteBody] = useState("");
  const [emailInvoiceSubject, setEmailInvoiceSubject] = useState("");
  const [emailInvoiceBody, setEmailInvoiceBody] = useState("");
  const [emailReminderSubject, setEmailReminderSubject] = useState("");
  const [emailReminderBody, setEmailReminderBody] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!window.btpAPI?.getSettings) {
        setLoading(false);
        return;
      }
      const s = await window.btpAPI.getSettings();
      const sExt = s as Record<string, unknown>;
      setPdfAccentColor((s.pdfAccentColor as string) || "#2563eb");
      const savedStyle = s.pdfStyle as string | undefined;
      if (savedStyle === "moderne" || savedStyle === "sobre" || savedStyle === "classique") {
        setPdfStyle(savedStyle);
      }
      setPdfFooterText((s.pdfFooterText as string) || "");
      setPdfShowLogoInHeader(s.pdfShowLogoInHeader !== false);
      setPdfShowCompanyAddress(s.pdfShowCompanyAddress !== false);
      setPdfIbanShown(s.pdfIbanShown !== false);
      setInvoicePaymentTermsDays(Number(s.invoicePaymentTermsDays || 30));
      setInvoicePrefix((s.invoicePrefix as string) || "FACT");
      setQuotePrefix((sExt.quotePrefix as string) || "DEV");
      setQuoteValidityDays(Number(sExt.quoteValidityDays || 90));
      setPdfLogoSizeMm(Number(sExt.pdfLogoSizeMm || 35));
      setPdfStampSizeMm(Number(sExt.pdfStampSizeMm || 26));
      setPdfSignatureSizeMm(Number(sExt.pdfSignatureSizeMm || 22));
      const pos = sExt.pdfStampPosition as string | undefined;
      setPdfStampPosition(pos === "left" || pos === "center" ? pos : "right");
      const den = sExt.pdfDensity as string | undefined;
      setPdfDensity(den === "compact" || den === "comfortable" ? den : "normal");
      setPdfShowAccordBlock(sExt.pdfShowAccordBlock !== false);
      setPdfShowSignatureBlock(sExt.pdfShowSignatureBlock !== false);
      setPdfShowQualifications(sExt.pdfShowQualifications !== false);
      setPdfFont((sExt.pdfFont as string) || "Helvetica");
      const qs = sExt.pdfQuoteStyle as string | undefined;
      setPdfQuoteStyle(qs === "sobre" || qs === "classique" ? qs : "moderne");
      setEmailQuoteSubject((s.emailQuoteSubject as string) || "");
      setEmailQuoteBody((s.emailQuoteBody as string) || "");
      setEmailInvoiceSubject((s.emailInvoiceSubject as string) || "");
      setEmailInvoiceBody((s.emailInvoiceBody as string) || "");
      setEmailReminderSubject((s.emailReminderSubject as string) || "");
      setEmailReminderBody((s.emailReminderBody as string) || "");
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await window.btpAPI?.updateSettings({
      pdfAccentColor,
      pdfStyle,
      pdfFooterText,
      pdfShowLogoInHeader,
      pdfShowCompanyAddress,
      pdfIbanShown,
      invoicePaymentTermsDays,
      invoicePrefix,
      quotePrefix,
      quoteValidityDays,
      pdfLogoSizeMm,
      pdfStampSizeMm,
      pdfSignatureSizeMm,
      pdfStampPosition,
      pdfDensity,
      pdfShowAccordBlock,
      pdfShowSignatureBlock,
      pdfShowQualifications,
      pdfFont,
      pdfQuoteStyle,
      emailQuoteSubject,
      emailQuoteBody,
      emailInvoiceSubject,
      emailInvoiceBody,
      emailReminderSubject,
      emailReminderBody,
    } as Record<string, unknown>);
    setSaving(false);
    toast.success("Paramètres enregistrés");
  };

  // ⚠️ Tous les hooks DOIVENT être appelés AVANT le early return (loading).
  // Sinon React error #310 "Rendered more hooks than during the previous render".
  const company = useCompanyStore((s) => s.company) as Record<string, unknown>;
  const [previewOpen, setPreviewOpen] = useState(false);

  // Preview PDF avec les paramètres en cours
  const previewDocument = useMemo(() => {
    const co = { ...company, pdfAccentColor, pdfFooterText, pdfFont };
    if (pdfStyle === "sobre") {
      return <QuotePdfMinimal quote={SAMPLE_QUOTE} client={SAMPLE_CLIENT} company={co} />;
    }
    if (pdfStyle === "classique") {
      return <QuotePdfClassique quote={SAMPLE_QUOTE} client={SAMPLE_CLIENT} company={co} />;
    }
    return <QuotePdfDocument quote={SAMPLE_QUOTE} client={SAMPLE_CLIENT} company={co} />;
  }, [pdfStyle, pdfAccentColor, pdfFooterText, pdfFont, company]);

  if (loading) {
    return (
      <SettingsSectionWrapper title="Documents" description="Personnalisation PDF et templates email">
        <div className="text-center py-12 text-muted-foreground text-sm">Chargement...</div>
      </SettingsSectionWrapper>
    );
  }

  const showAccent = pdfStyle !== "sobre"; // le sobre est noir & blanc, pas de couleur

  function applyPreset(p: Preset): void {
    setPdfStyle(p.pdfStyle);
    setPdfAccentColor(p.pdfAccentColor);
    setPdfFont(p.pdfFont);
    toast.success(`Préréglage "${p.label}" appliqué — pense à enregistrer`);
  }

  return (
    <SettingsSectionWrapper
      title="Documents"
      description="Personnalisation PDF, numérotation et templates email"
    >
      {/* ─── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <TabButton active={tab === "pdf"} onClick={() => setTab("pdf")} icon={FileText} label="Style PDF" />
          <TabButton
            active={tab === "numbering"}
            onClick={() => setTab("numbering")}
            icon={Hash}
            label="Numérotation"
          />
          <TabButton active={tab === "email"} onClick={() => setTab("email")} icon={Mail} label="Emails" />
        </div>
        {tab === "pdf" && (
          <Button
            variant={previewOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewOpen ? "Cacher l'aperçu" : "Aperçu temps réel"}
          </Button>
        )}
      </div>

      <div className={cn("grid gap-5", previewOpen && tab === "pdf" ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]" : "grid-cols-1")}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-w-0"
        >
        {/* ─── Tab PDF ──────────────────────────────────────────────── */}
        {tab === "pdf" && (
          <div className="space-y-5">
            {/* Card 0 — Préréglages métier */}
            <Card
              icon={Wrench}
              title="Préréglages métier"
              description="Un click pour configurer style, couleur et police"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESETS.map((p) => {
                  const matches =
                    pdfStyle === p.pdfStyle &&
                    pdfAccentColor.toLowerCase() === p.pdfAccentColor.toLowerCase() &&
                    pdfFont === p.pdfFont;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      title={`${p.label} — ${p.description}`}
                      className={cn(
                        "relative flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all min-w-0",
                        matches
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80 hover:bg-accent/50"
                      )}
                    >
                      <span
                        className="w-8 h-8 rounded-md border border-border/60 flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: `${p.pdfAccentColor}15` }}
                      >
                        {p.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium leading-tight truncate">
                          {p.label}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: p.pdfAccentColor }}
                          />
                          <span className="text-[10px] text-muted-foreground truncate">
                            {p.pdfStyle === "moderne"
                              ? "Moderne"
                              : p.pdfStyle === "sobre"
                                ? "Sobre"
                                : "Classique"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Card 1 — Style global */}
            <Card
              icon={Sparkles}
              title="Style général"
              description="Aspect visuel de tes devis et factures"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPdfStyle(opt.value)}
                    title={opt.description}
                    className={cn(
                      "relative px-3 py-2.5 rounded-lg border-2 text-left transition-all min-w-0",
                      pdfStyle === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border/80 hover:bg-accent/50"
                    )}
                  >
                    <div className="text-sm font-medium leading-tight truncate">
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                      {opt.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Couleur (visible si style avec accent couleur) */}
              {showAccent && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    Couleur d'accent
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setPdfAccentColor(c.value)}
                          className={cn(
                            "w-7 h-7 rounded-full border-2 transition-all shrink-0",
                            pdfAccentColor.toLowerCase() === c.value.toLowerCase()
                              ? "border-foreground scale-110 shadow-sm"
                              : "border-border/40 hover:scale-105"
                          )}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 ml-1">
                      <input
                        type="color"
                        value={pdfAccentColor}
                        onChange={(e) => setPdfAccentColor(e.target.value)}
                        className="w-7 h-7 rounded-full border border-border/40 cursor-pointer p-0.5"
                        title="Couleur personnalisée"
                      />
                      <Input
                        value={pdfAccentColor}
                        onChange={(e) => setPdfAccentColor(e.target.value)}
                        placeholder="#2563eb"
                        className="font-mono text-[11px] w-24 h-7"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Utilisée pour l'en-tête du tableau, le total TTC et les accents.
                  </p>
                </div>
              )}
            </Card>

            {/* Card 2 — Police */}
            <Card
              icon={Type}
              title="Police d'écriture"
              description="Famille de typographie pour le texte"
            >
              <select
                value={pdfFont}
                onChange={(e) => setPdfFont(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                {PDF_FONTS.map((f) => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div
                className="mt-3 p-3 rounded-md bg-muted/40 border border-border/50 text-sm leading-relaxed"
                style={{ fontFamily: pdfFont }}
              >
                <div className="font-bold mb-1" style={{ fontFamily: pdfFont }}>
                  Aperçu de la police
                </div>
                <div className="text-muted-foreground" style={{ fontFamily: pdfFont }}>
                  Devis · Facture · Total HT · Acompte 30 % · 1 234,56 €
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Helvetica est recommandé (intégré à @react-pdf, identique partout). Les
                autres polices nécessitent qu'elles soient installées sur l'appareil
                lecteur du PDF.
              </p>
            </Card>

            {/* Card 3 — Mise en page */}
            <Card icon={Layout} title="Mise en page" description="Densité et position des éléments">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label className="text-xs mb-2 block uppercase tracking-wider text-muted-foreground">
                    Densité
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: "compact", label: "Compact" },
                      { value: "normal", label: "Normal" },
                      { value: "comfortable", label: "Aéré" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPdfDensity(opt.value as typeof pdfDensity)}
                        className={cn(
                          "px-2 py-2 rounded-md border text-xs font-medium transition-colors",
                          pdfDensity === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-2 block uppercase tracking-wider text-muted-foreground">
                    Position cachet/signature
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: "left", label: "Gauche" },
                      { value: "center", label: "Centré" },
                      { value: "right", label: "Droite" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPdfStampPosition(opt.value as typeof pdfStampPosition)}
                        className={cn(
                          "px-2 py-2 rounded-md border text-xs font-medium transition-colors",
                          pdfStampPosition === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 4 — Contenu */}
            <Card
              icon={FileText}
              title="Contenu affiché"
              description="Ce qui apparaît sur tes devis et factures"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                <CheckboxLine
                  checked={pdfShowLogoInHeader}
                  onChange={setPdfShowLogoInHeader}
                  label="Logo en en-tête"
                />
                <CheckboxLine
                  checked={pdfShowCompanyAddress}
                  onChange={setPdfShowCompanyAddress}
                  label="Adresse de l'entreprise (pied)"
                />
                <CheckboxLine
                  checked={pdfIbanShown}
                  onChange={setPdfIbanShown}
                  label="IBAN/BIC pour virement"
                />
                <CheckboxLine
                  checked={pdfShowQualifications}
                  onChange={setPdfShowQualifications}
                  label="Qualifications RGE / Qualibat"
                />
                <CheckboxLine
                  checked={pdfShowAccordBlock}
                  onChange={setPdfShowAccordBlock}
                  label='Bloc "Bon pour accord" (devis)'
                />
                <CheckboxLine
                  checked={pdfShowSignatureBlock}
                  onChange={setPdfShowSignatureBlock}
                  label='Bloc cachet/signature (entreprise)'
                />
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <Label htmlFor="footer-text" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Pied de page personnalisé
                </Label>
                <Textarea
                  id="footer-text"
                  value={pdfFooterText}
                  onChange={(e) => setPdfFooterText(e.target.value)}
                  rows={2}
                  placeholder="Ex : Membre de la FFB — Qualibat 2111 — RGE Eco-Artisan"
                  className="mt-1.5 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  S'affiche sous les mentions légales (SIRET, TVA…)
                </p>
              </div>
            </Card>

            {/* Astuce aperçu */}
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40 text-xs">
              <Eye className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="font-medium mb-0.5">Voir le rendu</p>
                <p className="text-muted-foreground">
                  Pour visualiser tes paramètres, ouvre n'importe quel devis ou facture
                  et clique sur le bouton <strong>Aperçu</strong>. Le PDF est généré en
                  direct avec tes réglages.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab Numérotation ─────────────────────────────────────── */}
        {tab === "numbering" && (
          <div className="space-y-5">
            <Card
              icon={FileText}
              title="Devis"
              description="Format des références et durée de validité"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="quote-prefix">Préfixe</Label>
                  <Input
                    id="quote-prefix"
                    value={quotePrefix}
                    onChange={(e) => setQuotePrefix(e.target.value.toUpperCase())}
                    placeholder="DEV"
                    maxLength={10}
                    className="mt-1.5 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemple : <code className="font-mono text-foreground">{quotePrefix || "DEV"}-{new Date().getFullYear()}-0001</code>
                  </p>
                </div>
                <div>
                  <Label htmlFor="quote-validity">Validité (jours)</Label>
                  <Input
                    id="quote-validity"
                    type="number"
                    min="0"
                    max="365"
                    value={quoteValidityDays}
                    onChange={(e) => setQuoteValidityDays(Number(e.target.value) || 90)}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Date "valable jusqu'au" sur le devis
                  </p>
                </div>
              </div>
            </Card>

            <Card
              icon={FileText}
              title="Factures"
              description="Format des références et délai de paiement"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="prefix">Préfixe</Label>
                  <Input
                    id="prefix"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    placeholder="FACT"
                    maxLength={10}
                    className="mt-1.5 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemple : <code className="font-mono text-foreground">{invoicePrefix}-{new Date().getFullYear()}-0001</code>
                  </p>
                </div>
                <div>
                  <Label htmlFor="terms">Délai de paiement (jours)</Label>
                  <Input
                    id="terms"
                    type="number"
                    min="0"
                    max="365"
                    value={invoicePaymentTermsDays}
                    onChange={(e) => setInvoicePaymentTermsDays(Number(e.target.value) || 30)}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Date d'échéance auto-calculée (date d'émission + N jours)
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ─── Tab Emails ───────────────────────────────────────────── */}
        {tab === "email" && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="font-medium mb-1">Variables disponibles dans tes templates</p>
                <p className="text-muted-foreground leading-relaxed">
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{client}"}</code>
                  {" · "}
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{reference}"}</code>
                  {" · "}
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{title}"}</code>
                  {" · "}
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{company}"}</code>
                  {" · "}
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{totalTTC}"}</code>
                  {" · "}
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{validUntil}"}</code>
                  {" devis · "}
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{dueDate}"}</code>
                  {" facture · "}
                  <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{daysOverdue}"}</code>
                  {" relance"}
                </p>
              </div>
            </div>

            <EmailTemplateBlock
              title="Email d'envoi devis"
              subject={emailQuoteSubject}
              onSubjectChange={setEmailQuoteSubject}
              body={emailQuoteBody}
              onBodyChange={setEmailQuoteBody}
              placeholderSubject="Votre devis {reference} - {company}"
              placeholderBody={`Bonjour {client},\n\nVous trouverez ci-joint le devis {reference} d'un montant de {totalTTC}.\nCe devis est valable jusqu'au {validUntil}.\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{company}`}
            />

            <EmailTemplateBlock
              title="Email d'envoi facture"
              subject={emailInvoiceSubject}
              onSubjectChange={setEmailInvoiceSubject}
              body={emailInvoiceBody}
              onBodyChange={setEmailInvoiceBody}
              placeholderSubject="Votre facture {reference} - {company}"
              placeholderBody={`Bonjour {client},\n\nVous trouverez ci-joint la facture {reference} d'un montant de {totalTTC}.\nÉchéance : {dueDate}\n\nJe reste à votre disposition.\n\nCordialement,\n{company}`}
            />

            <EmailTemplateBlock
              title="Email de relance"
              subject={emailReminderSubject}
              onSubjectChange={setEmailReminderSubject}
              body={emailReminderBody}
              onBodyChange={setEmailReminderBody}
              placeholderSubject="Relance : facture {reference}"
              placeholderBody={`Bonjour {client},\n\nSauf erreur de notre part, votre facture {reference} d'un montant de {totalTTC} reste impayée.\nÉchéance : {dueDate} ({daysOverdue} jours de retard)\n\nMerci de régulariser dans les meilleurs délais.\n\nCordialement,\n{company}`}
            />
          </div>
        )}
        </motion.div>

        {/* ─── Side panel : aperçu PDF live ───────────────────────────── */}
        {previewOpen && tab === "pdf" && (
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-5rem)] flex flex-col bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">Aperçu temps réel — devis fictif</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewOpen(false)} title="Fermer">
                <EyeOff className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex-1 bg-muted/20 min-h-[600px]">
              <PDFViewer
                key={`${pdfStyle}-${pdfAccentColor}-${pdfFont}-${(company.logoDataUrl as string ?? "").slice(0, 50)}`}
                style={{ width: "100%", height: "100%", border: "none" }}
                showToolbar={false}
              >
                {previewDocument as React.ReactElement}
              </PDFViewer>
            </div>
            <div className="px-3 py-2 border-t border-border bg-muted/40 shrink-0">
              <p className="text-[10px] text-muted-foreground">
                💡 L'aperçu se met à jour automatiquement quand tu changes les paramètres.
                Données fictives — utilise un vrai devis pour tester sur tes données.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save button sticky en bas */}
      <div className="flex justify-end pt-4 mt-6 border-t border-border">
        <Button onClick={handleSave} loading={saving}>
          <Save className="w-4 h-4" />
          Enregistrer les paramètres
        </Button>
      </div>
    </SettingsSectionWrapper>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
        active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function CheckboxLine({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/40 px-2 py-1.5 rounded-md transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary shrink-0"
      />
      <span className="text-xs">{label}</span>
    </label>
  );
}

function EmailTemplateBlock({
  title,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  placeholderSubject,
  placeholderBody,
}: {
  title: string;
  subject: string;
  onSubjectChange: (s: string) => void;
  body: string;
  onBodyChange: (s: string) => void;
  placeholderSubject: string;
  placeholderBody: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Mail className="w-4 h-4 text-muted-foreground" />
        {title}
      </h3>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Objet
        </Label>
        <Input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder={placeholderSubject}
          className="mt-1 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Corps du message
        </Label>
        <Textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={placeholderBody}
          rows={6}
          className="mt-1 text-sm font-sans"
        />
      </div>
    </div>
  );
}
