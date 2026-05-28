// ═══════════════════════════════════════════════════════════════════════════
// pdfHelpers — informations entreprise réutilisables pour les templates PDF.
//
// Mentions légales BTP : l'assurance décennale est OBLIGATOIRE sur les
// devis et factures (art. L.241-1 Code des assurances). L'IBAN est utile
// pour les factures (paiement) et les acomptes de devis.
// ═══════════════════════════════════════════════════════════════════════════

function val(company: Record<string, unknown>, key: string): string {
  const v = company[key];
  return typeof v === "string" ? v.trim() : "";
}

function boolVal(company: Record<string, unknown>, key: string, dflt: boolean): boolean {
  const v = company[key];
  if (v === undefined || v === null) return dflt;
  return !!v && v !== 0 && v !== "false";
}

export interface CompanyLegalOptions {
  /** Afficher les coordonnées bancaires (IBAN/BIC). Défaut : true. */
  showBank?: boolean;
}

/**
 * Construit les lignes de mentions légales / assurances / banque à afficher
 * en pied de devis ou facture. Renvoie un tableau de { label, value } ;
 * les entrées vides (champs non renseignés) sont automatiquement omises.
 */
export function companyLegalLines(
  company: Record<string, unknown>,
  opts: CompanyLegalOptions = {}
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];

  // Assurance décennale (obligatoire BTP)
  const decCompany = val(company, "decennaleCompany");
  const decContract = val(company, "decennaleContract");
  const decZone = val(company, "decennaleZone");
  if (decCompany || decContract) {
    const parts = [
      decCompany,
      decContract && `contrat n° ${decContract}`,
      decZone && `zone : ${decZone}`,
    ].filter(Boolean);
    lines.push({ label: "Assurance décennale", value: parts.join(" — ") });
  }

  // RC Pro
  const rcCompany = val(company, "rcProCompany");
  const rcContract = val(company, "rcProContract");
  if (rcCompany || rcContract) {
    const parts = [rcCompany, rcContract && `contrat n° ${rcContract}`].filter(Boolean);
    lines.push({ label: "Responsabilité civile pro", value: parts.join(" — ") });
  }

  // Coordonnées bancaires (réglage pdfIbanShown, défaut true)
  const showBank = opts.showBank ?? boolVal(company, "pdfIbanShown", true);
  if (showBank) {
    const iban = val(company, "iban");
    const bic = val(company, "bic");
    const bankName = val(company, "bankName");
    if (iban) {
      const parts = [
        bankName,
        `IBAN ${iban}`,
        bic && `BIC ${bic}`,
      ].filter(Boolean);
      lines.push({ label: "Coordonnées bancaires", value: parts.join(" — ") });
    }
  }

  return lines;
}
