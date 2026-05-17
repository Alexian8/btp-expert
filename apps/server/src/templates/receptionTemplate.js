// ═══════════════════════════════════════════════════════════════════════════
// receptionTemplate.js — PV de réception de chantier (norme NF P 03-001)
// ═══════════════════════════════════════════════════════════════════════════

const {
  escapeHtml, formatDate, formatEuro, nl2br,
  BASE_CSS, COMPACT_A4_PAGE_CSS, renderCompanyHeader, renderClientName, renderClientAddress,
} = require("./adminTemplateCommon");

const RECEPTION_TYPE_LABELS = {
  sans_reserves: { label: "Sans réserves", badge: "badge-success" },
  avec_reserves: { label: "Avec réserves", badge: "badge-warning" },
  refusee: { label: "Refusée", badge: "badge-danger" },
};

function renderReceptionHtml({ report, reserves, client, chantier, company }) {
  const typeMeta = RECEPTION_TYPE_LABELS[report.receptionType] || RECEPTION_TYPE_LABELS.sans_reserves;
  const isAvecReserves = report.receptionType === "avec_reserves";
  const isRefusee = report.receptionType === "refusee";

  const chantierAddress = chantier
    ? [
        chantier.addressLine1,
        chantier.addressLine2,
        [chantier.postalCode, chantier.city].filter(Boolean).join(" "),
      ].filter(Boolean).join("<br>")
    : "—";

  const reservesHtml = (reserves || []).map((r, i) => `
    <div class="reserve-item">
      <div class="reserve-num">Réserve n°${i + 1} — ${escapeHtml(r.category || "—")}</div>
      <div class="reserve-desc">${escapeHtml(r.description || "")}</div>
      <div class="reserve-meta">
        ${r.location ? "Localisation : " + escapeHtml(r.location) + " · " : ""}
        ${r.toBeFixedBefore ? "À lever avant le " + formatDate(r.toBeFixedBefore) : "Sans délai précis"}
        ${r.fixed ? ' · <strong style="color:#047857">Levée le ' + formatDate(r.fixedDate) + "</strong>" : ""}
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>PV de réception ${escapeHtml(report.reference)}</title>
<style>${COMPACT_A4_PAGE_CSS}${BASE_CSS}</style>
</head>
<body class="compact-a4">

<div class="doc-header">
  <div class="company">
    ${renderCompanyHeader(company)}
  </div>
  <div class="reference">
    <div class="ref-label">PROCÈS-VERBAL DE RÉCEPTION</div>
    <div class="ref-value">${escapeHtml(report.reference)}</div>
    <div style="margin-top:2mm">${formatDate(report.receptionDate)}</div>
    <div style="margin-top:1mm" class="badge ${typeMeta.badge}">${typeMeta.label}</div>
  </div>
</div>

<h1>Procès-verbal de réception de travaux</h1>

<div class="important-notice">
  <strong>Norme NF P 03-001 — Référentiel des marchés privés de travaux</strong><br>
  Le présent document constitue le procès-verbal de réception des travaux exécutés
  par l'entreprise désignée ci-dessus pour le compte du maître d'ouvrage. Sa signature
  ${isRefusee ? "concrétise le <strong>refus de réception</strong> des travaux." : "déclenche le point de départ de la garantie de parfait achèvement (1 an), de la garantie biennale de bon fonctionnement (2 ans) et de la garantie décennale (10 ans)."}
</div>

<h2>1. Identification</h2>
<div class="info-grid">
  <div class="info-block">
    <div class="label">Maître d'ouvrage</div>
    <div class="content">
      <p><strong>${renderClientName(client)}</strong></p>
      <p>${renderClientAddress(client)}</p>
      ${client && client.email ? '<p>' + escapeHtml(client.email) + '</p>' : ''}
      ${client && (client.phoneMobile || client.phoneFixed) ? '<p>' + escapeHtml(client.phoneMobile || client.phoneFixed) + '</p>' : ''}
    </div>
  </div>
  <div class="info-block">
    <div class="label">Chantier</div>
    <div class="content">
      ${chantier ? '<p><strong>' + escapeHtml(chantier.title) + '</strong></p>' : ""}
      ${chantier ? '<p>Réf : ' + escapeHtml(chantier.reference) + '</p>' : ""}
      <p>${chantierAddress}</p>
    </div>
  </div>
</div>

<h2>2. Personnes présentes lors de la réception</h2>
<div class="info-grid">
  <div class="info-block">
    <div class="label">Pour le maître d'ouvrage</div>
    <div class="content">
      <p>${escapeHtml(report.ownerPresent || "—")}</p>
    </div>
  </div>
  <div class="info-block">
    <div class="label">Pour l'entreprise</div>
    <div class="content">
      <p>${escapeHtml(report.contractorPresent || "—")}</p>
    </div>
  </div>
</div>

<h2>3. Date et lieu</h2>
<div class="text-block">
  <p><strong>Date de réception :</strong> ${formatDate(report.receptionDate)}</p>
  ${report.location ? '<p><strong>Lieu :</strong> ' + escapeHtml(report.location) + '</p>' : ''}
  ${!isRefusee ? "<p><strong>Date de prise d'effet des garanties légales :</strong> " + formatDate(report.guaranteeStartDate || report.receptionDate) + "</p>" : ""}
</div>

<h2>4. Travaux réceptionnés</h2>
<div class="text-block">
  ${report.worksDescription ? '<p>' + nl2br(report.worksDescription) + '</p>' : '<p style="color:#9ca3af">Description non renseignée</p>'}
</div>

${isAvecReserves && reserves && reserves.length > 0 ? `
<h2>5. Réserves émises</h2>
<p style="font-size:9.5pt;color:#92400e;margin-bottom:2mm">
  Les réserves ci-dessous doivent être levées par l'entreprise dans le délai imparti.
  La garantie de parfait achèvement court à compter de la date de réception jusqu'à la levée
  effective des réserves.
</p>
${reservesHtml}
` : ""}

${isRefusee ? `
<h2>5. Motifs du refus</h2>
<div class="important-notice" style="border-color:#ef4444;background:#fee2e2">
  <strong>Réception refusée</strong><br>
  Les travaux présentés ne sont pas conformes et la réception est refusée par le maître
  d'ouvrage. L'entreprise doit reprendre les travaux et présenter une nouvelle réception.
</div>
` : ""}

${report.observations ? `
<h2>${isAvecReserves ? "6" : (isRefusee ? "6" : "5")}. Observations</h2>
<div class="text-block">
  <p>${nl2br(report.observations)}</p>
</div>
` : ""}

${!isRefusee && Number(report.retentionAmount) > 0 ? `
<h2>${(isAvecReserves || report.observations) ? (isAvecReserves && report.observations ? "7" : "6") : "5"}. Retenue de garantie</h2>
<div class="text-block">
  <p><strong>Montant retenu :</strong> ${formatEuro(report.retentionAmount)}</p>
  ${report.retentionReleaseDate ? '<p><strong>Date prévue de libération :</strong> ' + formatDate(report.retentionReleaseDate) + '</p>' : ''}
  <p style="font-size:9pt;color:#6b7280;margin-top:2mm">
    Conformément à la loi du 16 juillet 1971 (article 1799-1 du Code civil), une retenue
    de garantie de 5% maximum peut être prélevée sur les paiements pour garantir l'exécution
    des travaux. Elle est libérée à l'expiration du délai de levée des réserves.
  </p>
</div>
` : ""}

<h2>${isRefusee ? "Conclusion et signatures" : "Acceptation et signatures"}</h2>

<div class="text-block" style="margin-bottom:4mm">
  ${isRefusee
    ? "<p>Le maître d'ouvrage <strong>refuse la réception</strong> des travaux pour les motifs ci-dessus exposés.</p>"
    : isAvecReserves
      ? "<p>Le maître d'ouvrage <strong>réceptionne les travaux avec les réserves</strong> énumérées ci-dessus. La présente réception déclenche le point de départ des garanties légales sous condition de levée des réserves.</p>"
      : "<p>Le maître d'ouvrage <strong>réceptionne les travaux sans aucune réserve</strong>. La présente réception déclenche le point de départ des garanties légales (parfait achèvement, biennale, décennale).</p>"
  }
</div>

<div class="signature-zone">
  <div class="signature-block">
    <div class="sig-label">Le maître d'ouvrage</div>
    <div class="sig-meta">${escapeHtml(report.ownerPresent || "—")}</div>
    ${report.ownerSignatureDataUrl
      ? '<img src="' + report.ownerSignatureDataUrl + '" alt="Signature" style="max-width:60mm;max-height:25mm;object-fit:contain;margin:2mm 0" />'
      : ""}
    ${report.ownerSigned ? '<div class="sig-meta">Signé le ' + formatDate(report.ownerSignedDate) + '</div>' : ""}
    <div class="sig-mention">"Lu et approuvé"</div>
  </div>
  <div class="signature-block">
    <div class="sig-label">L'entreprise</div>
    <div class="sig-meta">${escapeHtml(report.contractorPresent || (company && company.companyName) || "—")}</div>
    ${report.contractorSignatureDataUrl
      ? '<img src="' + report.contractorSignatureDataUrl + '" alt="Signature" style="max-width:60mm;max-height:25mm;object-fit:contain;margin:2mm 0" />'
      : ""}
    ${report.contractorSigned ? '<div class="sig-meta">Signé le ' + formatDate(report.contractorSignedDate) + '</div>' : ""}
    <div class="sig-mention">Cachet et signature</div>
  </div>
</div>

${!isRefusee ? `
<div class="text-block" style="margin-top:4mm;font-size:9pt;color:#475569">
  <strong>Mentions légales :</strong>
  <ul style="margin:1mm 0 0 4mm;padding:0">
    <li>Garantie de parfait achèvement — <span class="law-ref">art. 1792-6 Code civil</span> — 1 an à compter de la réception, couvre tous les désordres signalés.</li>
    <li>Garantie biennale de bon fonctionnement — <span class="law-ref">art. 1792-3 Code civil</span> — 2 ans, éléments d'équipement dissociables.</li>
    <li>Garantie décennale — <span class="law-ref">art. 1792 et 2270 Code civil</span> — 10 ans, désordres compromettant la solidité ou rendant l'ouvrage impropre à sa destination.</li>
    <li>Délai de dénonciation des vices apparents non réservés : <strong>10 jours</strong> à compter de la réception (sauf clause contractuelle différente).</li>
    <li>Toute réserve consignée au présent procès-verbal est <strong>opposable à l'entrepreneur</strong> au sens de l'<span class="law-ref">art. L. 111-12 du Code de la construction et de l'habitation</span>.</li>
  </ul>
</div>
` : ""}

<div class="legal-footer">
  <span class="law-ref">Norme NF P 03-001</span> · Marché privé de travaux ·
  <span class="law-ref">Articles 1792 et suivants du Code civil</span> (garanties légales) ·
  <span class="law-ref">Loi 71-584 du 16 juillet 1971</span> (retenue de garantie 5%) ·
  Document conservé par les deux parties pendant la durée des garanties légales (10 ans)
</div>

</body>
</html>`;
}

module.exports = { renderReceptionHtml };
