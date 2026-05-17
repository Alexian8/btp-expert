// ═══════════════════════════════════════════════════════════════════════════
// tvaAttestationCerfaTemplate.js — Format CERFA 1300-SD
// (approximation visuelle du formulaire officiel DGFIP)
// ═══════════════════════════════════════════════════════════════════════════

const {
  escapeHtml, formatDate, formatEuro,
  renderCompanyHeader,
} = require("./adminTemplateCommon");

const LOGEMENT_LABELS = {
  residence_principale: "Résidence principale",
  residence_secondaire: "Résidence secondaire",
  logement_loue: "Logement mis en location",
  ehpad: "Établissement médico-social (EHPAD)",
  autre: "Autre",
};

const CERFA_CSS = `
  @page {
    size: A4;
    margin: 12mm 12mm 18mm 12mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #000;
    margin: 0;
    padding: 0;
  }
  .cerfa-header {
    border: 2px solid #000;
    padding: 3mm 4mm;
    margin-bottom: 4mm;
    display: grid;
    grid-template-columns: 2fr 3fr 1fr;
    gap: 4mm;
    align-items: center;
  }
  .cerfa-header .republic {
    font-size: 9pt;
    line-height: 1.2;
  }
  .cerfa-header .republic strong {
    display: block;
    text-transform: uppercase;
    font-size: 9.5pt;
  }
  .cerfa-header .title {
    text-align: center;
  }
  .cerfa-header .title .ministry {
    font-size: 8pt;
    text-transform: uppercase;
  }
  .cerfa-header .title .doc-type {
    font-size: 11pt;
    font-weight: 700;
    margin: 1mm 0;
  }
  .cerfa-header .number {
    text-align: right;
    font-size: 9pt;
  }
  .cerfa-header .number .form-num {
    font-family: "Courier New", monospace;
    font-weight: 700;
    font-size: 12pt;
  }
  h1.cerfa-title {
    text-align: center;
    font-size: 13pt;
    font-weight: 700;
    margin: 0 0 2mm 0;
    text-transform: uppercase;
  }
  .cerfa-subtitle {
    text-align: center;
    font-size: 10pt;
    font-style: italic;
    margin-bottom: 4mm;
  }
  .cerfa-section {
    border: 1px solid #000;
    margin: 2mm 0;
  }
  .cerfa-section .section-title {
    background: #000;
    color: white;
    padding: 1.5mm 3mm;
    font-weight: 700;
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .cerfa-section .section-content {
    padding: 3mm;
  }
  .cerfa-field {
    margin: 1.5mm 0;
    display: grid;
    grid-template-columns: 70mm 1fr;
    gap: 3mm;
    align-items: baseline;
  }
  .cerfa-field .field-label {
    font-size: 9pt;
    font-weight: 600;
  }
  .cerfa-field .field-value {
    border-bottom: 1px dotted #000;
    padding: 0.5mm 1mm;
    font-size: 10pt;
    min-height: 5mm;
  }
  .cerfa-field-vertical {
    margin: 2mm 0;
  }
  .cerfa-field-vertical .field-label {
    font-size: 9pt;
    font-weight: 600;
    margin-bottom: 1mm;
  }
  .cerfa-field-vertical .field-value {
    border: 1px solid #000;
    padding: 1.5mm;
    font-size: 10pt;
    min-height: 6mm;
  }
  .cerfa-checkbox-line {
    margin: 1.5mm 0;
    font-size: 9.5pt;
    display: flex;
    align-items: flex-start;
    gap: 2mm;
  }
  .cerfa-checkbox {
    display: inline-block;
    width: 4mm;
    height: 4mm;
    border: 1.5px solid #000;
    text-align: center;
    line-height: 3.5mm;
    font-size: 11pt;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 0.3mm;
  }
  .cerfa-warning {
    background: #f0f0f0;
    border: 1px solid #000;
    padding: 2.5mm;
    margin: 3mm 0;
    font-size: 8.5pt;
    line-height: 1.4;
  }
  .cerfa-warning strong {
    text-transform: uppercase;
    font-size: 9pt;
  }
  .cerfa-signature-zone {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4mm;
    margin: 4mm 0 2mm 0;
  }
  .cerfa-signature-block {
    border: 1px solid #000;
    padding: 3mm;
    min-height: 28mm;
  }
  .cerfa-signature-block .sig-title {
    font-weight: 700;
    font-size: 9pt;
    text-transform: uppercase;
    margin-bottom: 1mm;
  }
  .cerfa-signature-block .sig-info {
    font-size: 9pt;
    margin: 0.5mm 0;
  }
  .cerfa-signature-block .sig-mention {
    font-size: 8.5pt;
    font-style: italic;
    margin-top: 1mm;
  }
  .cerfa-footer {
    position: fixed;
    bottom: 5mm;
    left: 12mm;
    right: 12mm;
    border-top: 1px solid #000;
    padding-top: 1.5mm;
    font-size: 7.5pt;
    text-align: center;
  }
  .cerfa-footer .form-info {
    font-weight: 600;
  }
`;

function renderTvaAttestationCerfaHtml({ attestation, company }) {
  const taux = attestation.tvaRate;
  const tauxLabel = taux === 5.5 ? "5,5 %" : (taux === 10 ? "10 %" : taux + " %");
  const isReducedRate = taux === 5.5;

  const ownerFullName = [
    attestation.ownerCivilite,
    attestation.ownerFirstName,
    attestation.ownerLastName,
  ].filter(Boolean).join(" ").trim();

  const commitments = Array.isArray(attestation.clientCommitments)
    ? attestation.clientCommitments
    : [];

  const checkbox = (checked) => `<span class="cerfa-checkbox">${checked ? "✗" : ""}</span>`;

  // Date d'achèvement (résidence principale ou non, +2 ans)
  const isOver2Years = attestation.logementBuiltOver2Years;

  // Type d'usage (case à cocher)
  const isPrincipale = attestation.logementType === "residence_principale";
  const isSecondaire = attestation.logementType === "residence_secondaire";
  const isLouee = attestation.logementType === "logement_loue";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CERFA n°1300-SD — ${escapeHtml(attestation.reference)}</title>
<style>${CERFA_CSS}</style>
</head>
<body>

<div class="cerfa-header">
  <div class="republic">
    <strong>République française</strong>
    Liberté · Égalité · Fraternité
  </div>
  <div class="title">
    <div class="ministry">Ministère de l'Économie<br>et des Finances</div>
    <div class="doc-type">Direction Générale<br>des Finances Publiques</div>
  </div>
  <div class="number">
    <div>N°</div>
    <div class="form-num">1300-SD</div>
    <div style="font-size:7.5pt;margin-top:1mm">(${isReducedRate ? "01-2025" : "01-2025"})</div>
  </div>
</div>

<h1 class="cerfa-title">Attestation simplifiée</h1>
<p class="cerfa-subtitle">
  Travaux ${isReducedRate ? "d'amélioration de la qualité énergétique" : "d'amélioration, transformation, aménagement et entretien"}
  portant sur des locaux à usage d'habitation achevés depuis plus de 2 ans —
  TVA au taux <strong>${tauxLabel}</strong>
</p>

<div class="cerfa-warning">
  <strong>À conserver pendant 5 ans</strong> — Ce document doit être conservé par le client (donneur d'ordre)
  et par l'entreprise pendant 5 ans à compter de la fin des travaux. Il pourra être réclamé
  par l'administration fiscale en cas de contrôle.
</div>

<div class="cerfa-section">
  <div class="section-title">1. Identité du client (donneur d'ordre)</div>
  <div class="section-content">
    <div class="cerfa-field">
      <div class="field-label">Nom et prénom</div>
      <div class="field-value">${escapeHtml(ownerFullName) || "&nbsp;"}</div>
    </div>
    <div class="cerfa-field">
      <div class="field-label">Adresse du logement concerné</div>
      <div class="field-value">${escapeHtml(attestation.logementAddress).replace(/\n/g, " — ") || "&nbsp;"}</div>
    </div>
    <div class="cerfa-field">
      <div class="field-label">Téléphone</div>
      <div class="field-value">${escapeHtml(attestation.ownerPhone) || "&nbsp;"}</div>
    </div>
    <div class="cerfa-field">
      <div class="field-label">Email</div>
      <div class="field-value">${escapeHtml(attestation.ownerEmail) || "&nbsp;"}</div>
    </div>
  </div>
</div>

<div class="cerfa-section">
  <div class="section-title">2. Logement concerné par les travaux</div>
  <div class="section-content">
    <div class="cerfa-checkbox-line">
      ${checkbox(isOver2Years)}
      <span>Le logement est <strong>achevé depuis plus de 2 ans</strong> à la date de début des travaux</span>
    </div>
    ${attestation.logementYearOfConstruction ? `
      <div class="cerfa-field">
        <div class="field-label">Année d'achèvement</div>
        <div class="field-value">${escapeHtml(attestation.logementYearOfConstruction)}</div>
      </div>
    ` : ""}
    <div style="margin-top:2mm">
      <div style="font-size:9pt;font-weight:600;margin-bottom:1mm">Le logement est utilisé à titre :</div>
      <div class="cerfa-checkbox-line">
        ${checkbox(isPrincipale)} <span>de résidence principale</span>
      </div>
      <div class="cerfa-checkbox-line">
        ${checkbox(isSecondaire)} <span>de résidence secondaire</span>
      </div>
      <div class="cerfa-checkbox-line">
        ${checkbox(isLouee)} <span>est mis en location à usage d'habitation</span>
      </div>
    </div>
  </div>
</div>

<div class="cerfa-section">
  <div class="section-title">3. Nature des travaux réalisés</div>
  <div class="section-content">
    <div class="cerfa-field-vertical">
      <div class="field-label">Description des travaux</div>
      <div class="field-value" style="min-height:18mm">${escapeHtml(attestation.worksDescription).replace(/\n/g, "<br>") || "&nbsp;"}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:2mm">
      <div class="cerfa-field" style="grid-template-columns:35mm 1fr">
        <div class="field-label">Date de début</div>
        <div class="field-value">${formatDate(attestation.worksStartDate)}</div>
      </div>
      <div class="cerfa-field" style="grid-template-columns:35mm 1fr">
        <div class="field-label">Date de fin</div>
        <div class="field-value">${formatDate(attestation.worksEndDate)}</div>
      </div>
    </div>
    ${Number(attestation.totalAmountHt) > 0 ? `
      <div class="cerfa-field" style="margin-top:2mm">
        <div class="field-label">Montant total HT</div>
        <div class="field-value" style="font-weight:700">${formatEuro(attestation.totalAmountHt)}</div>
      </div>
    ` : ""}
    ${attestation.invoiceReference ? `
      <div class="cerfa-field">
        <div class="field-label">Référence facture</div>
        <div class="field-value">${escapeHtml(attestation.invoiceReference)}</div>
      </div>
    ` : ""}
  </div>
</div>

<div class="cerfa-section">
  <div class="section-title">4. Identité de l'entreprise</div>
  <div class="section-content">
    <div class="cerfa-field">
      <div class="field-label">Raison sociale</div>
      <div class="field-value">${escapeHtml((company && company.companyName) || "")}</div>
    </div>
    <div class="cerfa-field">
      <div class="field-label">Adresse</div>
      <div class="field-value">${escapeHtml([company && company.addressLine1, [company && company.postalCode, company && company.city].filter(Boolean).join(" ")].filter(Boolean).join(" — "))}</div>
    </div>
    <div class="cerfa-field">
      <div class="field-label">SIRET</div>
      <div class="field-value">${escapeHtml((company && company.siret) || "")}</div>
    </div>
    <div class="cerfa-field">
      <div class="field-label">N° TVA intracommunautaire</div>
      <div class="field-value">${escapeHtml((company && company.tvaNumber) || "")}</div>
    </div>
  </div>
</div>

<div class="cerfa-section">
  <div class="section-title">5. Certifications du client</div>
  <div class="section-content">
    <p style="font-size:9pt;margin-bottom:2mm">
      Je soussigné(e) <strong>${escapeHtml(ownerFullName) || "_______________"}</strong>, certifie sur l'honneur :
    </p>
    ${commitments.map((c) => `
      <div class="cerfa-checkbox-line">
        ${checkbox(true)}
        <span>${escapeHtml(c)}</span>
      </div>
    `).join("")}
  </div>
</div>

<div class="cerfa-warning">
  <strong>⚠ Sanctions en cas de fausse déclaration</strong> — Toute fausse déclaration ou irrégularité
  expose le donneur d'ordre à un rappel de TVA au taux normal (20 %) ainsi qu'aux pénalités fiscales prévues
  par le Code général des impôts. L'entreprise demeure responsable du contrôle de l'application correcte du taux réduit.
</div>

<div class="cerfa-signature-zone">
  <div class="cerfa-signature-block">
    <div class="sig-title">Le donneur d'ordre</div>
    <div class="sig-info">Fait à ${escapeHtml(attestation.signedLocation || "____________")}</div>
    <div class="sig-info">Le ${formatDate(attestation.signedDate || new Date().toISOString())}</div>
    ${attestation.clientSignatureDataUrl
      ? '<img src="' + attestation.clientSignatureDataUrl + '" alt="Signature" style="max-width:55mm;max-height:22mm;object-fit:contain;margin:1mm 0" />'
      : ""}
    <div class="sig-mention">"Lu et approuvé" — signature</div>
  </div>
  <div class="cerfa-signature-block">
    <div class="sig-title">L'entreprise</div>
    <div class="sig-info">${escapeHtml((company && company.companyName) || "")}</div>
    ${company && company.siret ? '<div class="sig-info">SIRET : ' + escapeHtml(company.siret) + '</div>' : ""}
    ${company && company.companyStampDataUrl
      ? '<img src="' + company.companyStampDataUrl + '" alt="Cachet" style="max-width:40mm;max-height:25mm;object-fit:contain;margin:1mm 0" />'
      : ""}
    ${company && company.companySignatureDataUrl
      ? '<img src="' + company.companySignatureDataUrl + '" alt="Signature" style="max-width:55mm;max-height:22mm;object-fit:contain;margin:1mm 0" />'
      : ""}
    <div class="sig-mention">Cachet et signature</div>
  </div>
</div>

<div style="margin-top:4mm;padding:2mm;background:#fef9c3;border-left:3px solid #ca8a04;font-size:8.5pt;color:#713f12">
  <strong>Conservation obligatoire :</strong> ce document, ses justificatifs et la facture
  correspondante doivent être conservés <strong>5 ans</strong> par le donneur d'ordre comme
  par l'entreprise (art. L. 102 B du Livre des procédures fiscales). En cas de contrôle
  fiscal, l'absence ou l'inexactitude de cette attestation entraîne le rappel du complément
  de TVA dû au taux normal sur l'ensemble des prestations concernées.
</div>

<div class="cerfa-footer">
  <span class="form-info">Formulaire n° 1300-SD</span> ·
  ${isReducedRate ? "Article 278-0 bis A" : "Article 279-0 bis"} du CGI ·
  BOI-TVA-LIQ-30-20-90 · Document interne BatiDesk basé sur le format officiel DGFIP
</div>

</body>
</html>`;
}

module.exports = { renderTvaAttestationCerfaHtml };
