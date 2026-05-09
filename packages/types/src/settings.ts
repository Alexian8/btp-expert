// ═══════════════════════════════════════════════════════════════════════════
// Types des paramètres de l'application
// ═══════════════════════════════════════════════════════════════════════════

export interface EntrepriseSettings {
  entreprise?: string;
  formeJuridique?: string;
  siret?: string;
  tva?: string;
  ape?: string;
  adresse?: string;
  codePostal?: string;
  commune?: string;
  tel?: string;
  email?: string;
  site?: string;
  logo?: string;
  rib?: string;
  bic?: string;
}

export interface AssuranceSettings {
  assuranceDecennaleCompagnie?: string;
  assuranceDecennaleContrat?: string;
  assuranceDecennaleZone?: string;
  assuranceDecennaleActivites?: string;
  assuranceRCCompagnie?: string;
  assuranceRCContrat?: string;
}

export interface PdfSettings {
  pdfTheme?: string;
  pdfTemplate?: string;
  pdfThemeCustom?: string;
  logoMode?: "auto" | "large" | "small";
  logoSize?: string;
  logoAlign?: "left" | "center" | "right";
  activeDevisModelId?: number;
  activeFactureModelId?: number;

  // Session 10 — Personnalisation PDF avancée
  pdfAccentColor?: string;          // hex ex: "#2563eb"
  pdfStyle?: "moderne" | "sobre" | "classique";
  pdfFooterText?: string;           // texte libre multiligne
  pdfShowLogoInHeader?: boolean;
  pdfShowCompanyAddress?: boolean;
  pdfIbanShown?: boolean;           // afficher IBAN/BIC pour virement
}

export interface EmailTemplateSettings {
  // Session 10 — Templates email personnalisables
  emailQuoteSubject?: string;       // sujet devis. Var: {reference}, {company}, {title}
  emailQuoteBody?: string;          // corps devis. Var: {client}, {reference}, {title}, {validUntil}, {company}, {totalTTC}
  emailInvoiceSubject?: string;
  emailInvoiceBody?: string;
  emailReminderSubject?: string;    // relance
  emailReminderBody?: string;       // Var: {client}, {reference}, {dueDate}, {totalTTC}, {daysOverdue}
}

export interface InvoiceSettings {
  // Session 10 — Paramètres factures
  invoicePaymentTermsDays?: number; // 30 par défaut
  invoicePrefix?: string;           // "FACT" par défaut
  invoiceConditions?: string;       // conditions de règlement par défaut
}

export interface CGVSettings {
  cgvText?: string;
  cgvMode?: "annexe" | "verso" | "summary" | "choice";
  cgvIncludeByDefault?: number;
  cgvAcceptanceMention?: string;
}

export interface AppearanceSettings {
  theme?: "light" | "dark" | "system";
  accentColor?: "blue" | "violet" | "emerald" | "amber" | "rose" | "slate";
  density?: "compact" | "normal" | "comfortable";
  radius?: "none" | "sm" | "md" | "lg" | "full";
}

export type AppSettings = EntrepriseSettings &
  AssuranceSettings &
  PdfSettings &
  CGVSettings &
  AppearanceSettings &
  EmailTemplateSettings &
  InvoiceSettings & {
    // Autres settings divers
    conditions?: string;
    devisValidite?: string;
    acompteDefaut?: string;
    autoBackupFrequency?: number;
  };
