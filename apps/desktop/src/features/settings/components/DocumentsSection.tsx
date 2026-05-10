import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSectionWrapper } from "./SettingsPage";

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
  preview: string; // mini-preview ASCII pour donner une idée
  available: boolean;
}> = [
  {
    value: "moderne",
    label: "Moderne",
    description: "En-tête coloré, design épuré façon Pennylane / Tolteck",
    preview: "▓▓▓ HEADER\n  ━━━━━\n  ▌ ▌ ▌\n  ─────",
    available: true,
  },
  {
    value: "sobre",
    label: "Sobre",
    description: "Noir & blanc minimaliste façon classique BTP",
    preview: "ENTREPRISE\n┌───┬───┐\n│ │ │ │ │\n└───┴───┘",
    available: true,
  },
  {
    value: "classique",
    label: "Classique BTP",
    description: "Bientôt — bordures épaisses + serif traditionnel",
    preview: "═══════════\n║ ║ ║ ║ ║\n═══════════",
    available: false,
  },
];

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

  if (loading) {
    return (
      <SettingsSectionWrapper title="Documents" description="Personnalisation PDF et templates email">
        <div className="text-center py-12 text-muted-foreground text-sm">Chargement...</div>
      </SettingsSectionWrapper>
    );
  }

  const showAccent = pdfStyle !== "sobre"; // le sobre est noir & blanc, pas de couleur

  return (
    <SettingsSectionWrapper
      title="Documents"
      description="Personnalisation PDF, numérotation et templates email"
    >
      {/* ─── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        <TabButton active={tab === "pdf"} onClick={() => setTab("pdf")} icon={FileText} label="Style PDF" />
        <TabButton
          active={tab === "numbering"}
          onClick={() => setTab("numbering")}
          icon={Hash}
          label="Numérotation"
        />
        <TabButton active={tab === "email"} onClick={() => setTab("email")} icon={Mail} label="Emails" />
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ─── Tab PDF ──────────────────────────────────────────────── */}
        {tab === "pdf" && (
          <div className="space-y-5">
            {/* Card 1 — Style global */}
            <Card icon={Sparkles} title="Style général" description="Aspect visuel de tes devis et factures">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-5">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => opt.available && setPdfStyle(opt.value)}
                    disabled={!opt.available}
                    className={cn(
                      "relative p-3 rounded-lg border-2 text-left transition-all overflow-hidden",
                      pdfStyle === opt.value && opt.available
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border/80 hover:bg-accent/50",
                      !opt.available && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="font-medium text-sm flex items-center gap-2">
                      {opt.label}
                      {!opt.available && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                          Bientôt
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {opt.description}
                    </div>
                    <pre className="mt-2 text-[8px] text-muted-foreground/60 font-mono leading-tight whitespace-pre-wrap">
                      {opt.preview}
                    </pre>
                  </button>
                ))}
              </div>

              {/* Couleur (visible si style avec accent couleur) */}
              {showAccent && (
                <div>
                  <Label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    Couleur d'accent
                  </Label>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setPdfAccentColor(c.value)}
                        className={cn(
                          "w-9 h-9 rounded-md border-2 transition-all",
                          pdfAccentColor === c.value
                            ? "border-foreground scale-110 shadow-sm"
                            : "border-border hover:scale-105"
                        )}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                    <div className="ml-2 flex items-center gap-2">
                      <input
                        type="color"
                        value={pdfAccentColor}
                        onChange={(e) => setPdfAccentColor(e.target.value)}
                        className="w-9 h-9 rounded-md border border-border cursor-pointer p-0.5"
                      />
                      <Input
                        value={pdfAccentColor}
                        onChange={(e) => setPdfAccentColor(e.target.value)}
                        placeholder="#2563eb"
                        className="font-mono text-xs w-28 h-9"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Utilisée pour l'en-tête du tableau, le total TTC et les accents.
                  </p>
                </div>
              )}
            </Card>

            {/* Card 2 — Police */}
            <Card icon={Type} title="Police d'écriture" description="Famille de typographie pour le texte">
              <div className="flex items-center gap-3">
                <select
                  value={pdfFont}
                  onChange={(e) => setPdfFont(e.target.value)}
                  className="flex-1 max-w-xs px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  {PDF_FONTS.map((f) => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <span
                  className="text-sm text-muted-foreground italic"
                  style={{ fontFamily: pdfFont }}
                >
                  Aperçu : Devis · Facture · Total HT
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Helvetica est recommandé (universel, intégré à @react-pdf). Les autres polices
                seront utilisées si elles sont installées sur l'appareil qui ouvre le PDF.
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
