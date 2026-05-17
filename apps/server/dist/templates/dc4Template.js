"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// dc4Template.js — Déclaration de sous-traitance (DC4 / Loi MOP 1985)
// Approximation visuelle du formulaire DC4 utilisé dans les marchés publics
// ═══════════════════════════════════════════════════════════════════════════
const { escapeHtml, formatDate, formatEuro, nl2br, BASE_CSS, renderCompanyHeader, } = require("./adminTemplateCommon");
const STATUS_LABELS = {
    brouillon: { label: "Brouillon", badge: "badge-neutral" },
    envoyee: { label: "Envoyée", badge: "badge-info" },
    acceptee: { label: "Acceptée", badge: "badge-success" },
    refusee: { label: "Refusée", badge: "badge-danger" },
};
function renderDc4Html({ declaration, subcontractor, chantier, company }) {
    const statusMeta = STATUS_LABELS[declaration.status] || STATUS_LABELS.brouillon;
    const subcontractorAddress = subcontractor
        ? [
            subcontractor.addressLine1,
            subcontractor.addressLine2,
            [subcontractor.postalCode, subcontractor.city].filter(Boolean).join(" "),
        ].filter(Boolean).join("<br>")
        : "—";
    const chantierAddress = chantier
        ? [
            chantier.addressLine1,
            [chantier.postalCode, chantier.city].filter(Boolean).join(" "),
        ].filter(Boolean).join(" — ")
        : "";
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>DC4 ${escapeHtml(declaration.reference)}</title>
<style>${BASE_CSS}</style>
</head>
<body>

<div class="doc-header">
  <div class="company">
    ${renderCompanyHeader(company)}
  </div>
  <div class="reference">
    <div class="ref-label">DC4 — DÉCLARATION DE SOUS-TRAITANCE</div>
    <div class="ref-value">${escapeHtml(declaration.reference)}</div>
    <div style="margin-top:2mm">${formatDate(declaration.signedDate || new Date().toISOString())}</div>
    <div style="margin-top:1mm" class="badge ${statusMeta.badge}">${statusMeta.label}</div>
  </div>
</div>

<h1>Déclaration de sous-traitance<br>
<span style="font-size:11pt;font-weight:600;text-transform:none;letter-spacing:normal">
Acte spécial — Marché public
</span>
</h1>

<div class="important-notice">
  <strong>Loi n° 75-1334 du 31 décembre 1975 relative à la sous-traitance</strong><br>
  Le présent acte a pour objet la déclaration au pouvoir adjudicateur de la sous-traitance
  d'une partie du marché public référencé ci-dessous, en vue de son acceptation et de
  l'agrément des conditions de paiement, conformément à l'article 5 de la loi susvisée
  et au Code de la commande publique.
</div>

<h2>A. Identification du marché public</h2>
<div class="info-grid">
  <div class="info-block">
    <div class="label">Référence du marché</div>
    <div class="content">
      <p style="font-family:'Courier New',monospace;font-weight:700">
        ${escapeHtml(declaration.publicMarketReference) || "—"}
      </p>
    </div>
  </div>
  <div class="info-block">
    <div class="label">Pouvoir adjudicateur</div>
    <div class="content">
      <p><strong>${escapeHtml(declaration.publicAuthorityName) || "—"}</strong></p>
      ${declaration.publicAuthorityAddress ? '<p style="font-size:9pt;margin-top:1mm">' + nl2br(declaration.publicAuthorityAddress) + '</p>' : ""}
    </div>
  </div>
</div>
${declaration.publicMarketObject ? `
<div class="text-block">
  <p><strong>Objet du marché :</strong></p>
  <p style="margin-top:1mm">${nl2br(declaration.publicMarketObject)}</p>
</div>
` : ""}

<h2>B. Entrepreneur principal (titulaire du marché)</h2>
<div class="text-block">
  <p><strong>${escapeHtml((company && company.companyName) || "—")}</strong></p>
  ${company && company.legalForm ? '<p>' + escapeHtml(company.legalForm) + (company.capital ? ' au capital de ' + escapeHtml(company.capital) : '') + '</p>' : ""}
  ${company ? `
    <p>${[company.addressLine1, company.addressLine2, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).map(escapeHtml).join("<br>")}</p>
    ${company.siret ? '<p style="margin-top:1mm">SIRET : <strong>' + escapeHtml(company.siret) + '</strong></p>' : ""}
    ${company.tvaNumber ? '<p>N° TVA intracommunautaire : ' + escapeHtml(company.tvaNumber) + '</p>' : ""}
  ` : ""}
</div>

<h2>C. Sous-traitant déclaré</h2>
<div class="text-block">
  <p><strong>${escapeHtml((subcontractor && subcontractor.companyName) || declaration.subcontractorName || "—")}</strong></p>
  ${subcontractor && subcontractor.legalForm ? '<p>' + escapeHtml(subcontractor.legalForm) + (subcontractor.capital ? ' au capital de ' + escapeHtml(subcontractor.capital) : '') + '</p>' : ""}
  <p>${subcontractorAddress}</p>
  ${subcontractor && subcontractor.siret ? '<p style="margin-top:1mm">SIRET : <strong>' + escapeHtml(subcontractor.siret) + '</strong></p>' : ""}
  ${subcontractor && subcontractor.tvaNumber ? '<p>N° TVA intracommunautaire : ' + escapeHtml(subcontractor.tvaNumber) + '</p>' : ""}
  ${subcontractor && (subcontractor.contactFirstName || subcontractor.contactLastName) ? `
    <p style="margin-top:2mm"><strong>Représenté par :</strong>
    ${escapeHtml(`${subcontractor.contactFirstName || ""} ${subcontractor.contactLastName || ""}`.trim())}
    ${subcontractor.contactRole ? " (" + escapeHtml(subcontractor.contactRole) + ")" : ""}
    </p>
  ` : ""}
</div>

<h2>D. Nature et étendue des prestations sous-traitées</h2>
<div class="text-block">
  ${declaration.subcontractedWorksDescription ? '<p>' + nl2br(declaration.subcontractedWorksDescription) + '</p>' : '<p style="color:#9ca3af">—</p>'}
  ${chantier ? `
    <p style="margin-top:2mm"><strong>Lieu d'exécution :</strong>
    ${escapeHtml(chantier.title)}${chantierAddress ? " — " + chantierAddress : ""}
    </p>
  ` : ""}
  ${declaration.subcontractedDuration ? `
    <p><strong>Durée prévue d'exécution :</strong> ${escapeHtml(declaration.subcontractedDuration)}</p>
  ` : ""}
</div>

<h2>E. Montant des prestations sous-traitées</h2>
<table class="data-table">
  <thead>
    <tr>
      <th style="width:60%">Désignation</th>
      <th class="num">Montant HT</th>
      <th class="num">Montant TTC</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Total des prestations sous-traitées</td>
      <td class="num"><strong>${formatEuro(declaration.subcontractedAmountHt)}</strong></td>
      <td class="num"><strong>${formatEuro(declaration.subcontractedAmountTtc)}</strong></td>
    </tr>
  </tbody>
</table>

<h2>F. Conditions de paiement</h2>
<div class="text-block">
  <p><strong>Modalité de paiement :</strong> ${escapeHtml(declaration.paymentMethod) || "—"}</p>
  <p><strong>Délai de paiement :</strong> ${declaration.paymentDelay ? declaration.paymentDelay + " jours" : "—"}</p>
  <p style="font-size:9pt;color:#6b7280;margin-top:2mm">
    En application des articles L. 2193-10 et suivants du Code de la commande publique,
    le sous-traitant peut bénéficier du paiement direct par le pouvoir adjudicateur dès lors
    que le montant des prestations sous-traitées est égal ou supérieur à 600 € TTC et qu'il
    a été dûment accepté avec ses conditions de paiement agréées.
  </p>
</div>

<h2>G. Garanties</h2>
<div class="text-block">
  <p><strong>Type de garantie :</strong> ${escapeHtml(declaration.cautionType) || "Aucune"}</p>
  ${declaration.cautionRequired ? `
    <p><strong>Caution requise :</strong> Oui</p>
    <p><strong>Caution reçue :</strong> ${declaration.cautionReceived ? "Oui" : "Non — à fournir"}</p>
  ` : "<p>Aucune caution n'est requise pour cette sous-traitance.</p>"}
</div>

<h2>H. Acceptation et agrément</h2>
<div class="text-block" style="margin-bottom:4mm">
  <p>
    L'entrepreneur principal soussigné déclare faire exécuter par le sous-traitant ci-dessus
    désigné la part du marché précisée à l'article D, dans les conditions de paiement énoncées
    à l'article F. Il sollicite à cet effet l'<strong>acceptation du sous-traitant</strong> ainsi
    que l'<strong>agrément des conditions de paiement</strong> auprès du pouvoir adjudicateur.
  </p>
  ${declaration.acteSpecialNumber ? `
    <p style="margin-top:2mm"><strong>N° de l'acte spécial :</strong> ${escapeHtml(declaration.acteSpecialNumber)}</p>
  ` : ""}
  ${declaration.acceptanceDeadline ? `
    <p><strong>Date limite d'acceptation par le pouvoir adjudicateur :</strong> ${formatDate(declaration.acceptanceDeadline)}</p>
  ` : ""}
  <p style="font-size:9pt;color:#6b7280;margin-top:2mm">
    Le sous-traitant ne peut entreprendre l'exécution de ses prestations qu'après acceptation
    par le pouvoir adjudicateur. Conformément à l'article L. 2193-3 du Code de la commande
    publique, le sous-traitant <strong>ne peut réclamer aucune somme</strong> directement au
    maître d'ouvrage pour les prestations exécutées en sous-traitance dès lors que celles-ci
    n'ont pas été préalablement acceptées et que ses conditions de paiement n'ont pas été
    agréées par le pouvoir adjudicateur.
  </p>
</div>

<div class="signature-zone">
  <div class="signature-block">
    <div class="sig-label">L'entrepreneur principal (titulaire)</div>
    <div class="sig-meta">${escapeHtml((company && company.companyName) || "—")}</div>
    <div class="sig-meta">Fait à ${escapeHtml(declaration.signedLocation) || "____________"}, le ${formatDate(declaration.signedDate || new Date().toISOString())}</div>
    ${declaration.contractorSignatureDataUrl
        ? '<img src="' + declaration.contractorSignatureDataUrl + '" alt="Signature" style="max-width:60mm;max-height:25mm;object-fit:contain;margin:2mm 0" />'
        : ""}
    <div class="sig-mention">Cachet et signature</div>
  </div>
  <div class="signature-block">
    <div class="sig-label">Le sous-traitant</div>
    <div class="sig-meta">${escapeHtml((subcontractor && subcontractor.companyName) || declaration.subcontractorName || "—")}</div>
    ${declaration.ownerSignatureDataUrl
        ? '<img src="' + declaration.ownerSignatureDataUrl + '" alt="Signature" style="max-width:60mm;max-height:25mm;object-fit:contain;margin:2mm 0" />'
        : ""}
    <div class="sig-mention">"Lu et approuvé" — Cachet et signature</div>
  </div>
</div>

<div class="signature-block" style="margin-top:4mm">
  <div class="sig-label">Acceptation du pouvoir adjudicateur (maître d'ouvrage public)</div>
  <div class="sig-meta">${escapeHtml(declaration.publicAuthorityName) || "—"}</div>
  ${declaration.authoritySignatureDataUrl
        ? '<img src="' + declaration.authoritySignatureDataUrl + '" alt="Signature" style="max-width:60mm;max-height:25mm;object-fit:contain;margin:2mm 0" />'
        : ""}
  <div class="sig-mention">Date, cachet et signature du pouvoir adjudicateur — réservé à l'administration</div>
</div>

<div class="legal-footer">
  <span class="law-ref">Loi 75-1334 du 31 décembre 1975</span> sur la sous-traitance ·
  <span class="law-ref">Code de la commande publique, articles L. 2193-1 à L. 2193-14</span> ·
  Document à transmettre au pouvoir adjudicateur pour acceptation préalable au démarrage des travaux ·
  Format inspiré du formulaire officiel DC4
</div>

</body>
</html>`;
}
module.exports = { renderDc4Html };
