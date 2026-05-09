import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Palette, Sparkles, FileText, Mail, Save, Info, Eye } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSectionWrapper } from "./SettingsPage";

// ═══════════════════════════════════════════════════════════════════════════
// DocumentsSection — Personnalisation PDF + Templates email
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "pdf" | "email";

const PRESET_COLORS = [
  { name: "Bleu", value: "#2563eb" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Émeraude", value: "#10b981" },
  { name: "Orange BTP", value: "#ea580c" },
  { name: "Rouge", value: "#dc2626" },
  { name: "Gris ardoise", value: "#475569" },
  { name: "Noir", value: "#111827" },
];

// Session S28 — Polices PDF disponibles
const PDF_FONTS = [
  { value: "Inter", label: "Inter", category: "Moderne sans serif", sample: "ABCabc 123" },
  { value: "Helvetica", label: "Helvetica", category: "Sans serif classique", sample: "ABCabc 123" },
  { value: "Roboto", label: "Roboto", category: "Sans serif Google", sample: "ABCabc 123" },
  { value: "Arial", label: "Arial", category: "Sans serif universel", sample: "ABCabc 123" },
  { value: "Georgia", label: "Georgia", category: "Serif élégant", sample: "ABCabc 123" },
  { value: "Times New Roman", label: "Times New Roman", category: "Serif traditionnel", sample: "ABCabc 123" },
  { value: "Garamond", label: "Garamond", category: "Serif raffiné", sample: "ABCabc 123" },
  { value: "Trebuchet MS", label: "Trebuchet MS", category: "Sans serif distinctif", sample: "ABCabc 123" },
];

type PdfStyle = "moderne" | "sobre" | "classique";

const STYLE_OPTIONS: Array<{ value: PdfStyle; label: string; description: string }> = [
  { value: "moderne",   label: "Moderne",          description: "Style Pennylane - En-tête coloré, design épuré" },
  { value: "sobre",     label: "Sobre",            description: "Minimaliste - Noir et blanc avec accent" },
  { value: "classique", label: "Classique BTP",    description: "Traditionnel - Bordures et serif" },
];

export function DocumentsSection() {
  const [tab, setTab] = useState<Tab>("pdf");

  // PDF settings
  const [pdfAccentColor, setPdfAccentColor] = useState("#2563eb");
  const [pdfStyle, setPdfStyle] = useState<PdfStyle>("moderne");
  const [pdfFooterText, setPdfFooterText] = useState("");
  const [pdfShowLogoInHeader, setPdfShowLogoInHeader] = useState(true);
  const [pdfShowCompanyAddress, setPdfShowCompanyAddress] = useState(true);
  const [pdfIbanShown, setPdfIbanShown] = useState(true);

  // Invoice settings
  const [invoicePaymentTermsDays, setInvoicePaymentTermsDays] = useState(30);
  const [invoicePrefix, setInvoicePrefix] = useState("FACT");

  // Session S25 — Quote settings
  const [quotePrefix, setQuotePrefix] = useState("DEV");
  const [quoteValidityDays, setQuoteValidityDays] = useState(90);

  // ─── Session S26.3 — Personnalisation visuelle PDF ────────────────────
  // Tailles en mm
  const [pdfLogoSizeMm, setPdfLogoSizeMm] = useState(35);
  const [pdfStampSizeMm, setPdfStampSizeMm] = useState(26);
  const [pdfSignatureSizeMm, setPdfSignatureSizeMm] = useState(22);
  // Position du bloc cachet/signature
  const [pdfStampPosition, setPdfStampPosition] = useState<"left" | "center" | "right">("right");
  // Densité
  const [pdfDensity, setPdfDensity] = useState<"compact" | "normal" | "comfortable">("normal");
  // Toggles d'affichage
  const [pdfShowAccordBlock, setPdfShowAccordBlock] = useState(true);
  const [pdfShowSignatureBlock, setPdfShowSignatureBlock] = useState(true);
  const [pdfShowQualifications, setPdfShowQualifications] = useState(true);

  // Session S28 — Police + Multi-style devis
  const [pdfFont, setPdfFont] = useState("Inter");
  const [pdfQuoteStyle, setPdfQuoteStyle] = useState<"moderne" | "sobre" | "classique">("moderne");

  // Session S28 — PDF Lab : indicateur de génération en cours
  const [previewLoading, setPreviewLoading] = useState<"quote" | "invoice" | null>(null);

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
      if (!window.btpAPI?.getSettings) { setLoading(false); return; }
      const s = await window.btpAPI.getSettings();
      const sExt = s as any; // Session S25 — accès aux clés non typées
      setPdfAccentColor(s.pdfAccentColor || "#2563eb");
      const savedStyle = s.pdfStyle;
      if (savedStyle === "moderne" || savedStyle === "sobre" || savedStyle === "classique") {
        setPdfStyle(savedStyle);
      } else {
        setPdfStyle("moderne");
      }
      setPdfFooterText(s.pdfFooterText || "");
      setPdfShowLogoInHeader(s.pdfShowLogoInHeader !== false);
      setPdfShowCompanyAddress(s.pdfShowCompanyAddress !== false);
      setPdfIbanShown(s.pdfIbanShown !== false);
      setInvoicePaymentTermsDays(Number(s.invoicePaymentTermsDays || 30));
      setInvoicePrefix(s.invoicePrefix || "FACT");
      // Session S25 — Quote settings
      setQuotePrefix(sExt.quotePrefix || "DEV");
      setQuoteValidityDays(Number(sExt.quoteValidityDays || 90));
      // Session S26.3 — Personnalisation PDF
      setPdfLogoSizeMm(Number(sExt.pdfLogoSizeMm || 35));
      setPdfStampSizeMm(Number(sExt.pdfStampSizeMm || 26));
      setPdfSignatureSizeMm(Number(sExt.pdfSignatureSizeMm || 22));
      const pos = sExt.pdfStampPosition;
      setPdfStampPosition(pos === "left" || pos === "center" ? pos : "right");
      const den = sExt.pdfDensity;
      setPdfDensity(den === "compact" || den === "comfortable" ? den : "normal");
      setPdfShowAccordBlock(sExt.pdfShowAccordBlock !== false);
      setPdfShowSignatureBlock(sExt.pdfShowSignatureBlock !== false);
      setPdfShowQualifications(sExt.pdfShowQualifications !== false);
      // Session S28 — Police + Multi-style devis
      setPdfFont(sExt.pdfFont || "Inter");
      const qs = sExt.pdfQuoteStyle;
      setPdfQuoteStyle(qs === "sobre" || qs === "classique" ? qs : "moderne");
      setEmailQuoteSubject(s.emailQuoteSubject || "");
      setEmailQuoteBody(s.emailQuoteBody || "");
      setEmailInvoiceSubject(s.emailInvoiceSubject || "");
      setEmailInvoiceBody(s.emailInvoiceBody || "");
      setEmailReminderSubject(s.emailReminderSubject || "");
      setEmailReminderBody(s.emailReminderBody || "");
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
      // Session S25 — Quote settings
      quotePrefix,
      quoteValidityDays,
      // Session S26.3 — Personnalisation PDF
      pdfLogoSizeMm,
      pdfStampSizeMm,
      pdfSignatureSizeMm,
      pdfStampPosition,
      pdfDensity,
      pdfShowAccordBlock,
      pdfShowSignatureBlock,
      pdfShowQualifications,
      // Session S28 — Police + Multi-style devis
      pdfFont,
      pdfQuoteStyle,
      emailQuoteSubject,
      emailQuoteBody,
      emailInvoiceSubject,
      emailInvoiceBody,
      emailReminderSubject,
      emailReminderBody,
    } as any);
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

  return (
    <SettingsSectionWrapper
      title="Documents"
      description="Personnalisation PDF et templates email"
    >
      {/* Tabs internes */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        <TabButton active={tab === "pdf"} onClick={() => setTab("pdf")} icon={FileText} label="PDF" />
        <TabButton active={tab === "email"} onClick={() => setTab("email")} icon={Mail} label="Emails" />
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {tab === "pdf" ? (
          <div className="space-y-5">
            {/* Couleur d'accent */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Couleur principale du PDF</Label>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setPdfAccentColor(c.value)}
                    className={cn(
                      "w-10 h-10 rounded-lg border-2 transition-all",
                      pdfAccentColor === c.value ? "border-foreground scale-110" : "border-border hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={pdfAccentColor}
                  onChange={(e) => setPdfAccentColor(e.target.value)}
                  className="w-12 h-9 p-1"
                />
                <Input
                  value={pdfAccentColor}
                  onChange={(e) => setPdfAccentColor(e.target.value)}
                  placeholder="#2563eb"
                  className="font-mono text-sm max-w-[140px]"
                />
                <span className="text-xs text-muted-foreground">
                  Utilisée pour l'en-tête du tableau, le total TTC, les accents
                </span>
              </div>
            </div>

            {/* Style du PDF */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Style du PDF</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPdfStyle(opt.value)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left transition-all",
                      pdfStyle === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border/80 hover:bg-accent/50"
                    )}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Affichage</Label>
              <div className="space-y-2">
                <CheckboxLine
                  checked={pdfShowLogoInHeader}
                  onChange={setPdfShowLogoInHeader}
                  label="Afficher le logo en en-tête du PDF"
                />
                <CheckboxLine
                  checked={pdfShowCompanyAddress}
                  onChange={setPdfShowCompanyAddress}
                  label="Afficher l'adresse de l'entreprise dans le pied de page"
                />
                <CheckboxLine
                  checked={pdfIbanShown}
                  onChange={setPdfIbanShown}
                  label="Afficher l'IBAN/BIC (pour virement)"
                />
              </div>
            </div>

            {/* Pied de page personnalisé */}
            <div>
              <Label htmlFor="footer-text">Pied de page personnalisé (optionnel)</Label>
              <Textarea
                id="footer-text"
                value={pdfFooterText}
                onChange={(e) => setPdfFooterText(e.target.value)}
                rows={3}
                placeholder="Ex: Membre de la FFB — Qualibat 2111 — RGE Eco-Artisan"
                className="mt-1.5 font-sans text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Apparaît en bas du PDF sous les mentions légales (SIRET, TVA...)
              </p>
            </div>

            {/* ─── Session S26.3 — Personnalisation visuelle ──────── */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Personnalisation visuelle
                </h3>
                {/* Session S28 — PDF Lab : aperçu rapide du rendu */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      const api = (window as any).btpAPI;
                      if (!api?.pdfGeneratePreview) {
                        toast.error("API d'aperçu indisponible");
                        return;
                      }
                      setPreviewLoading("quote");
                      try {
                        const r = await api.pdfGeneratePreview("quote");
                        if (r?.success) {
                          toast.success("Aperçu devis ouvert");
                        } else {
                          toast.error(r?.error || "Erreur lors de la génération");
                        }
                      } catch (e: any) {
                        toast.error(e?.message || "Erreur inattendue");
                      } finally {
                        setPreviewLoading(null);
                      }
                    }}
                    disabled={previewLoading !== null}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-medium flex items-center gap-1.5 transition-colors",
                      previewLoading === "quote" && "opacity-60 cursor-wait"
                    )}
                    title="Génère un PDF de devis avec données factices, en utilisant tes paramètres actuels"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {previewLoading === "quote" ? "Génération..." : "Aperçu devis"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const api = (window as any).btpAPI;
                      if (!api?.pdfGeneratePreview) {
                        toast.error("API d'aperçu indisponible");
                        return;
                      }
                      setPreviewLoading("invoice");
                      try {
                        const r = await api.pdfGeneratePreview("invoice");
                        if (r?.success) {
                          toast.success("Aperçu facture ouvert");
                        } else {
                          toast.error(r?.error || "Erreur lors de la génération");
                        }
                      } catch (e: any) {
                        toast.error(e?.message || "Erreur inattendue");
                      } finally {
                        setPreviewLoading(null);
                      }
                    }}
                    disabled={previewLoading !== null}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md border border-border hover:bg-accent text-xs font-medium flex items-center gap-1.5 transition-colors",
                      previewLoading === "invoice" && "opacity-60 cursor-wait"
                    )}
                    title="Génère un PDF de facture avec données factices, en utilisant tes paramètres actuels"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {previewLoading === "invoice" ? "Génération..." : "Aperçu facture"}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground mb-4 -mt-2">
                💡 Enregistrez vos modifications puis cliquez sur "Aperçu" pour voir le rendu (devis ou facture avec données factices).
              </p>

              {/* Sliders de tailles */}
              <div className="space-y-4 mb-5">
                <SliderRow
                  label="Taille du logo"
                  value={pdfLogoSizeMm}
                  onChange={setPdfLogoSizeMm}
                  min={15}
                  max={60}
                  unit="mm"
                />
                <SliderRow
                  label="Taille du cachet"
                  value={pdfStampSizeMm}
                  onChange={setPdfStampSizeMm}
                  min={15}
                  max={50}
                  unit="mm"
                />
                <SliderRow
                  label="Taille de la signature"
                  value={pdfSignatureSizeMm}
                  onChange={setPdfSignatureSizeMm}
                  min={10}
                  max={40}
                  unit="mm"
                />
              </div>

              {/* Position cachet */}
              <div className="mb-4">
                <Label className="mb-2 block">Position du bloc cachet/signature</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "left", label: "Gauche" },
                    { value: "center", label: "Centré" },
                    { value: "right", label: "Droite" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPdfStampPosition(opt.value as any)}
                      className={cn(
                        "px-3 py-2 rounded-md border text-sm transition-colors",
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

              {/* Densité */}
              <div className="mb-4">
                <Label className="mb-2 block">Densité d'affichage</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "compact", label: "Compact", desc: "Plus dense, gain de place" },
                    { value: "normal", label: "Normal", desc: "Équilibré" },
                    { value: "comfortable", label: "Aéré", desc: "Plus de respiration" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPdfDensity(opt.value as any)}
                      className={cn(
                        "px-3 py-2 rounded-md border text-left transition-colors",
                        pdfDensity === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <div className={cn("text-sm font-medium", pdfDensity === opt.value && "text-primary")}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Session S28 — Police d'écriture */}
              <div className="mb-4">
                <Label className="mb-2 block">Police d'écriture du PDF</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PDF_FONTS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setPdfFont(f.value)}
                      className={cn(
                        "px-3 py-2 rounded-md border text-left transition-colors",
                        pdfFont === f.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <div
                        className={cn("text-sm font-medium leading-tight", pdfFont === f.value && "text-primary")}
                        style={{ fontFamily: `"${f.value}", sans-serif` }}
                      >
                        {f.label}
                      </div>
                      <div
                        className="text-[10px] text-muted-foreground mt-0.5"
                        style={{ fontFamily: `"${f.value}", sans-serif` }}
                      >
                        {f.sample}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  S'applique aux devis et factures PDF.
                </p>
              </div>

              {/* Session S28 — Style du devis (multi-template) */}
              <div className="mb-4">
                <Label className="mb-2 block">
                  Style du devis
                  <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">
                    (le style des factures se règle plus haut)
                  </span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "moderne", label: "Moderne", desc: "Pennylane / Tolteck — En-tête coloré, design épuré" },
                    { value: "sobre", label: "Sobre", desc: "Minimaliste — Noir et blanc avec accent" },
                    { value: "classique", label: "Classique BTP", desc: "Traditionnel — Bordures et serif" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPdfQuoteStyle(opt.value as any)}
                      className={cn(
                        "px-3 py-2 rounded-md border text-left transition-colors",
                        pdfQuoteStyle === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <div className={cn("text-sm font-medium", pdfQuoteStyle === opt.value && "text-primary")}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles affichage */}
              <div className="space-y-2">
                <Label className="block">Blocs à afficher sur les PDF</Label>
                <CheckboxLine
                  label="Bloc « Bon pour accord du client » (devis)"
                  checked={pdfShowAccordBlock}
                  onChange={setPdfShowAccordBlock}
                />
                <CheckboxLine
                  label="Bloc « Pour mon entreprise » (cachet/signature)"
                  checked={pdfShowSignatureBlock}
                  onChange={setPdfShowSignatureBlock}
                />
                <CheckboxLine
                  label="Qualifications RGE / Qualibat en pied de page"
                  checked={pdfShowQualifications}
                  onChange={setPdfShowQualifications}
                />
              </div>
            </div>

            {/* Session S25 — Paramètres devis */}
            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-medium mb-3">Devis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="quote-prefix">Préfixe de numérotation</Label>
                  <Input
                    id="quote-prefix"
                    value={quotePrefix}
                    onChange={(e) => setQuotePrefix(e.target.value.toUpperCase())}
                    placeholder="DEV"
                    maxLength={10}
                    className="mt-1.5 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemple : {quotePrefix || "DEV"}-{new Date().getFullYear()}-0001
                  </p>
                </div>
                <div>
                  <Label htmlFor="quote-validity">Durée de validité (jours)</Label>
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
                    Validité par défaut affichée sur le devis
                  </p>
                </div>
              </div>
            </div>

            {/* Paramètres factures */}
            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-medium mb-3">Factures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="prefix">Préfixe de numérotation</Label>
                  <Input
                    id="prefix"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    placeholder="FACT"
                    maxLength={10}
                    className="mt-1.5 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemple : {invoicePrefix}-{new Date().getFullYear()}-0001
                  </p>
                </div>
                <div>
                  <Label htmlFor="terms">Délai de paiement par défaut (jours)</Label>
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
                    Utilisé pour calculer la date d'échéance
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Tab Emails ─── */
          <div className="space-y-5">
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="font-medium mb-1">Variables disponibles</p>
                <p className="text-muted-foreground">
                  <code className="text-foreground">{"{client}"}</code> · <code className="text-foreground">{"{reference}"}</code> · <code className="text-foreground">{"{title}"}</code> · <code className="text-foreground">{"{company}"}</code> · <code className="text-foreground">{"{totalTTC}"}</code> · <code className="text-foreground">{"{validUntil}"}</code> (devis) · <code className="text-foreground">{"{dueDate}"}</code> (facture) · <code className="text-foreground">{"{daysOverdue}"}</code> (relance)
                </p>
              </div>
            </div>

            <EmailTemplateBlock
              title="Devis"
              subject={emailQuoteSubject}
              onSubjectChange={setEmailQuoteSubject}
              body={emailQuoteBody}
              onBodyChange={setEmailQuoteBody}
              placeholderSubject="Votre devis {reference} - {company}"
              placeholderBody={`Bonjour {client},\n\nVous trouverez ci-joint le devis {reference} d'un montant de {totalTTC}.\nCe devis est valable jusqu'au {validUntil}.\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{company}`}
            />

            <EmailTemplateBlock
              title="Facture"
              subject={emailInvoiceSubject}
              onSubjectChange={setEmailInvoiceSubject}
              body={emailInvoiceBody}
              onBodyChange={setEmailInvoiceBody}
              placeholderSubject="Votre facture {reference} - {company}"
              placeholderBody={`Bonjour {client},\n\nVous trouverez ci-joint la facture {reference} d'un montant de {totalTTC}.\nÉchéance : {dueDate}\n\nJe reste à votre disposition.\n\nCordialement,\n{company}`}
            />

            <EmailTemplateBlock
              title="Relance"
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

      {/* Save button */}
      <div className="flex justify-end pt-4 mt-6 border-t border-border">
        <Button onClick={handleSave} loading={saving}>
          <Save className="w-4 h-4" />
          Enregistrer les paramètres
        </Button>
      </div>
    </SettingsSectionWrapper>
  );
}

function TabButton({
  active, onClick, icon: Icon, label,
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

function CheckboxLine({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer hover:bg-accent/40 px-2 py-2 rounded-md transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function EmailTemplateBlock({
  title, subject, onSubjectChange, body, onBodyChange, placeholderSubject, placeholderBody,
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
      <h3 className="text-sm font-semibold">{title}</h3>
      <div>
        <Label className="text-xs">Objet</Label>
        <Input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder={placeholderSubject}
          className="mt-1 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">Corps</Label>
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

// ─── Session S26.3 — Helper Slider avec affichage de valeur ────────────
function SliderRow({
  label, value, onChange, min, max, unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {value} {unit} <span className="text-muted-foreground/60">({min}–{max})</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}
