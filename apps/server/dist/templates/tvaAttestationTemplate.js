"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// tvaAttestationTemplate.js — Attestation TVA réduite (modèle simplifié)
// ═══════════════════════════════════════════════════════════════════════════
const { escapeHtml, formatDate, formatEuro, nl2br, BASE_CSS, renderCompanyHeader, } = require("./adminTemplateCommon");
const LOGEMENT_LABELS = {
    residence_principale: "Résidence principale",
    residence_secondaire: "Résidence secondaire",
    logement_loue: "Logement mis en location",
    ehpad: "Établissement médico-social (EHPAD)",
    autre: "Autre",
};
function renderTvaAttestationHtml({ attestation, company }) {
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
    const commitmentsHtml = commitments.map((c) => `<li>${escapeHtml(c)}</li>`).join("");
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Attestation TVA ${escapeHtml(attestation.reference)}</title>
<style>${BASE_CSS}</style>
</head>
<body>

<div class="doc-header">
  <div class="company">
    ${renderCompanyHeader(company)}
  </div>
  <div class="reference">
    <div class="ref-label">ATTESTATION TVA RÉDUITE</div>
    <div class="ref-value">${escapeHtml(attestation.reference)}</div>
    <div style="margin-top:2mm">${formatDate(attestation.signedDate || new Date().toISOString())}</div>
    <div style="margin-top:1mm" class="badge ${isReducedRate ? 'badge-success' : 'badge-info'}">TVA ${tauxLabel}</div>
  </div>
</div>

<h1>Attestation simplifiée<br>
<span style="font-size:12pt;font-weight:600;text-transform:none;letter-spacing:normal">
${isReducedRate
        ? "Travaux d'amélioration de la qualité énergétique du logement (TVA 5,5 %)"
        : "Travaux d'amélioration, de transformation, d'aménagement ou d'entretien (TVA 10 %)"}
</span>
</h1>

<div class="important-notice">
  <strong>Document à conserver 5 ans</strong><br>
  La présente attestation doit être conservée par le maître d'ouvrage et par l'entreprise
  pendant 5 ans à compter de la fin des travaux. Elle pourra être réclamée par
  l'administration fiscale en cas de contrôle.
</div>

<h2>1. Maître d'ouvrage (le client)</h2>
<div class="text-block">
  <p><strong>Nom et prénom :</strong> ${escapeHtml(ownerFullName) || "—"}</p>
  ${attestation.ownerEmail ? '<p><strong>Email :</strong> ' + escapeHtml(attestation.ownerEmail) + '</p>' : ""}
  ${attestation.ownerPhone ? '<p><strong>Téléphone :</strong> ' + escapeHtml(attestation.ownerPhone) + '</p>' : ""}
</div>

<h2>2. Logement concerné par les travaux</h2>
<div class="text-block">
  <p><strong>Adresse :</strong></p>
  <p style="margin-left:4mm">${nl2br(attestation.logementAddress) || "—"}</p>
  <p style="margin-top:2mm"><strong>Type de logement :</strong> ${escapeHtml(LOGEMENT_LABELS[attestation.logementType] || "—")}</p>
  ${attestation.logementYearOfConstruction
        ? '<p><strong>Année de construction :</strong> ' + escapeHtml(attestation.logementYearOfConstruction) + '</p>'
        : ""}
  <p style="margin-top:2mm">
    <strong>${attestation.logementBuiltOver2Years ? "✓" : "✗"} Logement achevé depuis plus de 2 ans</strong>
    à la date de début des travaux
  </p>
</div>

<h2>3. Entreprise réalisant les travaux</h2>
<div class="text-block">
  <p><strong>${escapeHtml((company && company.companyName) || "—")}</strong></p>
  ${company && company.legalForm ? '<p>' + escapeHtml(company.legalForm) + '</p>' : ""}
  ${company ? `
    <p>${[company.addressLine1, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).map(escapeHtml).join("<br>")}</p>
    ${company.siret ? '<p>SIRET : ' + escapeHtml(company.siret) + '</p>' : ""}
    ${company.tvaNumber ? '<p>N° TVA : ' + escapeHtml(company.tvaNumber) + '</p>' : ""}
  ` : ""}
</div>

<h2>4. Description des travaux</h2>
<div class="text-block">
  ${attestation.worksDescription ? '<p>' + nl2br(attestation.worksDescription) + '</p>' : '<p style="color:#9ca3af">—</p>'}
  <div class="info-grid" style="margin-top:3mm">
    <div class="info-block">
      <div class="label">Date de début</div>
      <div class="content">${formatDate(attestation.worksStartDate)}</div>
    </div>
    <div class="info-block">
      <div class="label">Date de fin</div>
      <div class="content">${formatDate(attestation.worksEndDate)}</div>
    </div>
  </div>
  ${Number(attestation.totalAmountHt) > 0 ? `
    <p style="margin-top:3mm"><strong>Montant total HT des travaux :</strong> ${formatEuro(attestation.totalAmountHt)}</p>
    <p><strong>Taux de TVA appliqué :</strong> <span class="badge ${isReducedRate ? 'badge-success' : 'badge-info'}">${tauxLabel}</span></p>
  ` : ""}
  ${attestation.invoiceReference ? '<p style="margin-top:2mm"><strong>Référence facture :</strong> ' + escapeHtml(attestation.invoiceReference) + '</p>' : ""}
</div>

<h2>5. Engagements du maître d'ouvrage</h2>
<p style="font-size:9.5pt;margin-bottom:2mm">
  Je soussigné(e) <strong>${escapeHtml(ownerFullName) || "—"}</strong>, maître d'ouvrage,
  certifie sur l'honneur que :
</p>
${commitmentsHtml ? `<ul class="commitment-list">${commitmentsHtml}</ul>` : "<p style='color:#9ca3af'>Aucun engagement renseigné</p>"}

<div class="important-notice" style="margin-top:4mm">
  <strong>Conséquences en cas de fausse déclaration</strong><br>
  Toute fausse déclaration ou irrégularité expose le maître d'ouvrage à un rappel de TVA
  au taux normal (20 %) ainsi qu'à des pénalités fiscales. L'entreprise demeure responsable
  de l'application correcte du taux de TVA réduit.
</div>

<h2>Signature</h2>
<div class="signature-zone">
  <div class="signature-block">
    <div class="sig-label">Le maître d'ouvrage</div>
    <div class="sig-meta">${escapeHtml(ownerFullName) || "—"}</div>
    ${attestation.signedDate ? '<div class="sig-meta">Fait à ' + escapeHtml(attestation.signedLocation || "—") + ', le ' + formatDate(attestation.signedDate) + '</div>' : ""}
    <div class="sig-mention">"Lu et approuvé" — signature</div>
  </div>
  <div class="signature-block">
    <div class="sig-label">L'entreprise</div>
    <div class="sig-meta">${escapeHtml((company && company.companyName) || "—")}</div>
    <div class="sig-mention">Cachet et signature</div>
  </div>
</div>

<div class="legal-footer">
  <span class="law-ref">${isReducedRate ? "Article 278-0 bis A" : "Article 279-0 bis"} du CGI</span> ·
  <span class="law-ref">BOI-TVA-LIQ-30-20-90</span> ·
  Attestation à conserver par les deux parties pendant <span class="law-ref">5 ans</span>
  à compter de la fin des travaux ·
  En cas de contrôle, l'attestation et la facture devront être présentées à l'administration fiscale
</div>

</body>
</html>`;
}
module.exports = { renderTvaAttestationHtml };
