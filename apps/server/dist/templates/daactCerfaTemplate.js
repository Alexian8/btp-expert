"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// daactCerfaTemplate.js
// Reproduction du CERFA officiel n°13408*13
// "Déclaration attestant l'achèvement et la conformité des travaux" (DAACT)
// Ministère en charge de l'urbanisme.
//
// À transmettre à la mairie du lieu du projet après achèvement des travaux
// soumis à permis de construire, d'aménager ou à déclaration préalable.
// Pré-remplissage automatique depuis le chantier (permis, surfaces, dates)
// et le profil entreprise (déclarant si personne morale).
// ═══════════════════════════════════════════════════════════════════════════
const { escapeHtml, formatDate } = require("./adminTemplateCommon");
function cb(checked) {
    return checked ? "☒" : "☐";
}
function dot(value, minDots = 20) {
    const s = String(value ?? "").trim();
    return s ? escapeHtml(s) : ".".repeat(minDots);
}
// Cellules vides pour les n° de permis : "PC 075 056 23 X0001" → segments
function permitCells(numero) {
    const clean = String(numero ?? "").replace(/\s+/g, "");
    // Format usuel : 2 lettres + 3 chiffres + 3 chiffres + 2 chiffres + 1 lettre + 4 chiffres
    // On rend simplement N° puis chaque char dans une case ; vide si pas fourni
    const slots = 17;
    let html = "";
    for (let i = 0; i < slots; i++) {
        html += `<span class="permit-cell">${escapeHtml(clean[i] ?? "")}</span>`;
    }
    return html;
}
// Date FR éclatée jj/mm/aaaa en 3 segments
function splitDate(iso) {
    if (!iso)
        return { d: "", m: "", y: "" };
    const d = new Date(iso);
    if (isNaN(d.getTime()))
        return { d: "", m: "", y: "" };
    return {
        d: String(d.getDate()).padStart(2, "0"),
        m: String(d.getMonth() + 1).padStart(2, "0"),
        y: String(d.getFullYear()),
    };
}
function renderDaactCerfaHtml({ declaration, chantier, company }) {
    const d = declaration || {};
    const ch = chantier || {};
    const co = company || {};
    // Coordonnées entreprise (déclarant si personne morale)
    const isMoralePerson = !!co.companyName;
    const titulaireNom = d.titulaireNom || co.contactLastName || "";
    const titulairePrenom = d.titulairePrenom || co.contactFirstName || "";
    const denomination = d.denomination || co.companyName || "";
    const siret = d.siret || co.siret || "";
    const typeSociete = co.legalForm || "";
    const representantNom = d.representantNom || co.contactLastName || "";
    const representantPrenom = d.representantPrenom || co.contactFirstName || "";
    // Coordonnées chantier
    const addressNum = ch.addressNumber || "";
    const addressStreet = ch.addressLine1 || "";
    const postalCode = ch.postalCode || "";
    const city = ch.city || "";
    const email = d.email || co.email || "";
    // Permis
    const permitType = d.permitType || "permis_construire"; // permis_construire | permis_amenager | declaration_prealable
    const permitNumber = d.permitNumber || ch.permitNumber || "";
    const isPC = permitType === "permis_construire";
    const isPA = permitType === "permis_amenager";
    const isDP = permitType === "declaration_prealable";
    // Voiries différées
    const voiriesDifferees = d.voiriesDifferees ?? false;
    const voiriesDate = splitDate(d.voiriesDate);
    // Achèvement
    const ach = splitDate(d.achievementDate || ch.endDate);
    const dest = splitDate(d.destinationChangeDate);
    const isPartial = !!d.partialWorks;
    const partialDesc = d.partialWorksDescription || "";
    const surfacePlancher = d.surfaceCreated ?? ch.surface ?? "";
    const nbLogementsTotal = d.nbLogementsTotal ?? "";
    const nbIndividuels = d.nbIndividuels ?? "";
    const nbCollectifs = d.nbCollectifs ?? "";
    // Signature
    const sign = splitDate(d.signedDate);
    const signLieu = d.signedLocation || co.city || "";
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CERFA 13408*13 — DAACT</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, "Helvetica Neue", sans-serif;
    font-size: 8.5pt;
    line-height: 1.3;
    color: #000;
    margin: 0;
    padding: 0;
  }
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #003366;
    padding-bottom: 2mm;
    margin-bottom: 3mm;
  }
  .header-bar .logo {
    font-weight: 700;
    color: #003366;
    font-size: 9pt;
    line-height: 1.2;
  }
  .header-bar .logo .official {
    font-size: 7pt;
    color: #666;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .header-bar .num {
    text-align: right;
    font-weight: 700;
    color: #003366;
  }
  .header-bar .num .num-cerfa { font-size: 9pt; }
  .header-bar .num .num-form { font-size: 10pt; margin-top: 1mm; }
  .doc-title {
    text-align: center;
    font-size: 13pt;
    font-weight: 700;
    color: #003366;
    margin: 3mm 0;
    text-transform: uppercase;
  }
  .intro {
    font-size: 8pt;
    color: #333;
    padding: 2mm;
    background: #f0f4ff;
    border-left: 3px solid #003366;
    margin-bottom: 3mm;
  }
  .layout {
    display: grid;
    grid-template-columns: 1fr 60mm;
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .reserve-mairie {
    border: 1.5px solid #000;
    padding: 2mm;
    font-size: 7.5pt;
    min-height: 35mm;
  }
  .reserve-mairie .title {
    font-weight: 700;
    text-align: center;
    border-bottom: 1px solid #000;
    padding-bottom: 1mm;
    margin-bottom: 2mm;
  }
  .reserve-mairie .cachet-zone {
    margin-top: 2mm;
    border: 1px dashed #666;
    height: 18mm;
    text-align: center;
    color: #999;
    font-style: italic;
    padding-top: 6mm;
  }
  .reserve-mairie .date-line {
    margin-top: 1.5mm;
    font-size: 8pt;
  }
  .section {
    border: 1.5px solid #003366;
    margin: 2mm 0;
    page-break-inside: avoid;
  }
  .section-title {
    background: #003366;
    color: white;
    padding: 1.5mm 3mm;
    font-weight: 700;
    font-size: 9pt;
  }
  .section-body {
    padding: 2mm 3mm;
  }
  .section-subtitle {
    font-weight: 700;
    color: #003366;
    margin: 2mm 0 1mm 0;
    font-size: 8.5pt;
    border-bottom: 1px dotted #666;
  }
  .field-row {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    margin: 1mm 0;
    flex-wrap: wrap;
  }
  .field-row .label { font-weight: 600; min-width: 28mm; }
  .field-row .value {
    border-bottom: 1px solid #444;
    flex: 1;
    min-width: 30mm;
    padding: 0 1mm;
    min-height: 4mm;
  }
  .field-row .value.small { max-width: 35mm; flex: 0 0 35mm; }
  .field-row .value.tiny { max-width: 20mm; flex: 0 0 20mm; }
  .check-line {
    margin: 1mm 0;
    display: flex;
    align-items: flex-start;
    gap: 1.5mm;
  }
  .check-line .cb {
    font-size: 11pt;
    font-family: "DejaVu Sans", "Arial Unicode MS", sans-serif;
    line-height: 1;
    margin-top: 0.5mm;
    min-width: 4mm;
  }
  .permit-cell {
    display: inline-block;
    width: 5mm;
    height: 5mm;
    border: 1px solid #000;
    text-align: center;
    line-height: 5mm;
    font-family: "Courier New", monospace;
    font-size: 8.5pt;
    margin: 0 0.3mm;
    font-weight: 700;
  }
  .date-segments {
    display: inline-flex;
    align-items: center;
    gap: 1mm;
  }
  .date-segments .ds {
    border: 1px solid #000;
    display: inline-block;
    width: 6mm;
    height: 5mm;
    text-align: center;
    line-height: 5mm;
    font-family: "Courier New", monospace;
    font-size: 8.5pt;
    font-weight: 700;
  }
  .date-segments .sep { font-weight: 700; }
  .signature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4mm;
    margin-top: 3mm;
  }
  .signature-box {
    border: 1px solid #000;
    padding: 2mm;
    min-height: 30mm;
    font-size: 8.5pt;
  }
  .signature-box .lbl { font-weight: 700; font-size: 8pt; }
  .signature-box img {
    max-width: 60mm;
    max-height: 20mm;
    object-fit: contain;
    display: block;
    margin: 1mm auto;
  }
  .footnote {
    font-size: 7pt;
    color: #444;
    margin-top: 3mm;
    text-align: center;
    border-top: 1px solid #ccc;
    padding-top: 1.5mm;
  }
  .checkbox-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1mm 4mm;
  }
</style>
</head>
<body>

<div class="header-bar">
  <div class="logo">
    <div class="official">République française · Ministère de la Transition écologique</div>
    Liberté · Égalité · Fraternité
  </div>
  <div class="num">
    <div class="num-cerfa">CERFA</div>
    <div class="num-form">N° 13408*13</div>
  </div>
</div>

<div class="doc-title">Déclaration attestant l'achèvement<br>et la conformité des travaux</div>

<div class="intro">
  À transmettre à la mairie du lieu du projet pour déclarer l'achèvement total ou partiel des
  travaux de construction ou d'aménagement, leur conformité à l'autorisation d'urbanisme, et le
  cas échéant le changement de destination effectué.
</div>

<div class="layout">
  <div>
    <!-- ─── Cadre 1 : Désignation du permis ──────────────────────────────── -->
    <div class="section">
      <div class="section-title">1 — Désignation du permis ou de la déclaration préalable</div>
      <div class="section-body">
        <div class="check-line">
          <span class="cb">${cb(isPC)}</span>
          <span><strong>Permis de construire</strong>&nbsp;&nbsp; N°&nbsp;${permitCells(isPC ? permitNumber : "")}</span>
        </div>
        <div class="check-line">
          <span class="cb">${cb(isPA)}</span>
          <span><strong>Permis d'aménager</strong>&nbsp;&nbsp; N°&nbsp;${permitCells(isPA ? permitNumber : "")}</span>
        </div>
        <div style="margin-left:6mm;font-size:8pt;color:#444;margin-top:1mm">
          S'agit-il d'un aménagement pour lequel l'aménageur a été autorisé à différer les travaux
          de finition des voiries ?
          <span class="cb">${cb(voiriesDifferees === true)}</span> Oui
          <span class="cb">${cb(voiriesDifferees === false)}</span> Non
          ${voiriesDifferees ? `
            <br>Si oui, date de finition des voiries fixée au :
            <span class="date-segments"><span class="ds">${voiriesDate.d}</span><span class="sep">/</span><span class="ds">${voiriesDate.m}</span><span class="sep">/</span><span class="ds">${voiriesDate.y.slice(2)}</span></span>
          ` : ""}
        </div>
        <div class="check-line" style="margin-top:1.5mm">
          <span class="cb">${cb(isDP)}</span>
          <span><strong>Déclaration préalable</strong>&nbsp;&nbsp; N°&nbsp;${permitCells(isDP ? permitNumber : "")}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="reserve-mairie">
    <div class="title">Cadre réservé à la mairie<br>du lieu du projet</div>
    La présente déclaration a été reçue à la mairie
    <div class="cachet-zone">Cachet de la mairie</div>
    <div class="date-line">
      le&nbsp; ___ / ___ / _____
    </div>
  </div>
</div>

<!-- ─── Cadre 2 : Identité du déclarant ──────────────────────────────────── -->
<div class="section">
  <div class="section-title">2 — Identité du déclarant</div>
  <div class="section-body">
    <p style="font-size:8pt;color:#444;margin:0 0 1mm 0">
      <span class="cb">☒</span> Le déclarant est le titulaire de l'autorisation
    </p>

    <div class="section-subtitle">2.1 — Vous êtes un particulier</div>
    <div class="field-row">
      <span class="label">Nom :</span>
      <span class="value">${isMoralePerson ? "" : dot(titulaireNom, 30)}</span>
      <span class="label">Prénom :</span>
      <span class="value">${isMoralePerson ? "" : dot(titulairePrenom, 25)}</span>
    </div>

    <div class="section-subtitle">2.2 — Vous êtes une personne morale</div>
    <div class="field-row">
      <span class="label">Dénomination :</span>
      <span class="value">${dot(denomination, 40)}</span>
    </div>
    <div class="field-row">
      <span class="label">Raison sociale :</span>
      <span class="value">${dot(denomination, 40)}</span>
    </div>
    <div class="field-row">
      <span class="label">N° SIRET :</span>
      <span class="value small">${dot(siret, 14)}</span>
      <span class="label">Type de société :</span>
      <span class="value small">${dot(typeSociete, 10)}</span>
    </div>
    <div style="margin-top:1mm">
      <strong>Représentant de la personne morale :</strong>
      <div class="field-row">
        <span class="label">Nom :</span>
        <span class="value">${dot(representantNom, 30)}</span>
        <span class="label">Prénom :</span>
        <span class="value">${dot(representantPrenom, 25)}</span>
      </div>
    </div>
  </div>
</div>

<!-- ─── Cadre 3 : Coordonnées du demandeur ───────────────────────────────── -->
<div class="section">
  <div class="section-title">3 — Coordonnées du demandeur</div>
  <div class="section-body">
    <p style="font-size:8pt;color:#444;margin:0 0 1mm 0">
      Ne remplir qu'en cas de changement des coordonnées du titulaire de l'autorisation.
    </p>
    <div class="field-row">
      <span class="label">Adresse — Numéro :</span>
      <span class="value tiny">${dot(addressNum, 5)}</span>
      <span class="label">Voie :</span>
      <span class="value">${dot(addressStreet, 50)}</span>
    </div>
    <div class="field-row">
      <span class="label">Lieu-dit :</span>
      <span class="value">${dot("", 30)}</span>
      <span class="label">Localité :</span>
      <span class="value">${dot(city, 25)}</span>
    </div>
    <div class="field-row">
      <span class="label">Code postal :</span>
      <span class="value small">${dot(postalCode, 6)}</span>
      <span class="label">BP :</span>
      <span class="value tiny">${dot("", 5)}</span>
      <span class="label">Cedex :</span>
      <span class="value tiny">${dot("", 5)}</span>
    </div>
    <div class="field-row">
      <span class="label">Adresse électronique :</span>
      <span class="value">${dot(email, 40)}</span>
    </div>
  </div>
</div>

<!-- ─── Cadre 4 : Achèvement des travaux ─────────────────────────────────── -->
<div class="section">
  <div class="section-title">4 — Achèvement des travaux</div>
  <div class="section-body">
    <div class="field-row">
      <span class="label">Chantier achevé le :</span>
      <span class="date-segments"><span class="ds">${ach.d}</span><span class="sep">/</span><span class="ds">${ach.m}</span><span class="sep">/</span><span class="ds">${ach.y.slice(2)}</span></span>
    </div>
    <div class="field-row">
      <span class="label">Changement de destination effectué le :</span>
      <span class="date-segments"><span class="ds">${dest.d}</span><span class="sep">/</span><span class="ds">${dest.m}</span><span class="sep">/</span><span class="ds">${dest.y.slice(2)}</span></span>
    </div>
    <div class="check-line">
      <span class="cb">${cb(!isPartial)}</span>
      <span class="lbl">Pour la totalité des travaux</span>
      <span class="cb" style="margin-left:8mm">${cb(isPartial)}</span>
      <span class="lbl">Pour une tranche des travaux</span>
    </div>
    ${isPartial ? `
      <div style="border:1px solid #666;padding:1.5mm;margin-top:1mm;font-size:8pt">
        <strong>Aménagements ou constructions achevés :</strong><br>
        ${escapeHtml(partialDesc)}
      </div>
    ` : ""}
    <div class="field-row" style="margin-top:1.5mm">
      <span class="label">Surface de plancher créée (m²) :</span>
      <span class="value small">${dot(surfacePlancher, 8)}</span>
    </div>
    <div class="field-row">
      <span class="label">Nombre de logements terminés :</span>
      <span class="value tiny">${dot(nbLogementsTotal, 4)}</span>
      <span class="label">dont individuels :</span>
      <span class="value tiny">${dot(nbIndividuels, 4)}</span>
      <span class="label">dont collectifs :</span>
      <span class="value tiny">${dot(nbCollectifs, 4)}</span>
    </div>

    <p style="margin:2.5mm 0 1mm 0;font-weight:600;font-size:8.5pt">
      J'atteste que les travaux sont achevés et qu'ils sont conformes à l'autorisation
      (permis ou non-opposition à la déclaration préalable).
    </p>

    <div class="signature-grid">
      <div class="signature-box">
        <div class="lbl">Signature du (ou des) déclarant(s)</div>
        <div style="margin:1mm 0">
          À <span style="border-bottom:1px solid #444;display:inline-block;min-width:30mm;padding:0 1mm">${escapeHtml(signLieu)}</span>
        </div>
        <div>
          Fait le <span class="date-segments"><span class="ds">${sign.d}</span><span class="sep">/</span><span class="ds">${sign.m}</span><span class="sep">/</span><span class="ds">${sign.y.slice(2)}</span></span>
        </div>
        ${d.declarantSignatureDataUrl
        ? `<img src="${d.declarantSignatureDataUrl}" alt="Signature" />`
        : '<div style="height:18mm"></div>'}
      </div>
      <div class="signature-box">
        <div class="lbl">Signature de l'architecte (s'il a dirigé les travaux)</div>
        <div style="margin:1mm 0">
          À <span style="border-bottom:1px solid #444;display:inline-block;min-width:30mm;padding:0 1mm">${escapeHtml(d.architectLocation || "")}</span>
        </div>
        <div>
          Fait le <span class="date-segments"><span class="ds">${(d.architectSignedDate ? splitDate(d.architectSignedDate).d : "")}</span><span class="sep">/</span><span class="ds">${(d.architectSignedDate ? splitDate(d.architectSignedDate).m : "")}</span><span class="sep">/</span><span class="ds">${(d.architectSignedDate ? splitDate(d.architectSignedDate).y.slice(2) : "")}</span></span>
        </div>
        ${d.architectSignatureDataUrl
        ? `<img src="${d.architectSignatureDataUrl}" alt="Signature architecte" />`
        : '<div style="height:18mm"></div>'}
      </div>
    </div>
  </div>
</div>

<div class="footnote">
  Document à adresser par pli recommandé avec demande d'avis de réception postal au maire de la commune,
  ou déposé contre décharge à la mairie. L'administration dispose de 3 mois à compter de la réception pour
  contester la conformité (5 mois pour les sites protégés, monuments historiques, IGH/ERP).
  &nbsp;·&nbsp; <strong>Articles R. 462-1 à R. 462-9 du Code de l'urbanisme.</strong>
</div>

</body>
</html>`;
}
module.exports = { renderDaactCerfaHtml };
