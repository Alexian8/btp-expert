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
  /** Style visuel global de l'app (réglé par l'admin, appliqué à tous) :
   *  classique · epure · liquid (verre dépoli) · techno. */
  themeStyle?: "classique" | "epure" | "liquid" | "techno";
  /** Réglages fins du thème Liquid glass (admin, appliqués à tous). */
  themeLiquidBlur?: number;        // flou du verre en px (0–30, défaut 18)
  themeLiquidCardOpacity?: number; // opacité des cartes en % (35–90, défaut 60)
  themeLiquidGlow?: number;        // intensité du fond coloré en % (0–200, défaut 100)
}

export interface SecuritySettings {
  /** Durée d'inactivité (en minutes) avant déconnexion automatique.
   *  0 ou non défini avec valeur 0 = désactivé. Défaut applicatif : 30. */
  sessionInactivityMinutes?: number;
}

/** Étiquette client personnalisable (créée par l'admin, partagée). */
export interface ClientTag {
  id: string;
  label: string;
  /** Clé de couleur (voir CLIENT_TAG_COLORS) : red, amber, yellow, emerald,
   *  blue, violet, slate, rose. */
  color: string;
}

/** Étiquettes proposées par défaut si l'admin n'en a pas encore défini. */
export const DEFAULT_CLIENT_TAGS: ClientTag[] = [
  { id: "vip", label: "VIP", color: "amber" },
  { id: "architecte", label: "Architecte / Apporteur", color: "yellow" },
  { id: "mauvais-payeur", label: "Mauvais payeur", color: "red" },
  { id: "prospect", label: "Prospect", color: "blue" },
  { id: "fidele", label: "Fidèle", color: "emerald" },
  { id: "litige", label: "Litige", color: "rose" },
];

export interface ClientSettings {
  /** Étiquettes personnalisables des clients (partagées, admin). */
  clientTags?: ClientTag[];
}

export type AppSettings = EntrepriseSettings &
  AssuranceSettings &
  PdfSettings &
  CGVSettings &
  AppearanceSettings &
  EmailTemplateSettings &
  SecuritySettings &
  ClientSettings &
  InvoiceSettings & {
    // Autres settings divers
    conditions?: string;
    devisValidite?: string;
    acompteDefaut?: string;
    autoBackupFrequency?: number;
  };

/** Durée d'inactivité par défaut (minutes) si non configurée. */
export const DEFAULT_SESSION_INACTIVITY_MINUTES = 30;
