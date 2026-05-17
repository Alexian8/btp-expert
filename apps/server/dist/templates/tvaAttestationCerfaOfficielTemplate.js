"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// tvaAttestationCerfaOfficielTemplate.js
// Reproduction fidèle du CERFA officiel n°1301-SD / N°13948*06
// "Attestation simplifiée" — TVA réduite à 5,5% / 10% sur travaux dans
// les locaux à usage d'habitation achevés depuis plus de 2 ans.
//
// Pré-remplissage automatique depuis l'objet `attestation` (table tva_attestations).
// L'utilisateur n'a plus qu'à imprimer et faire signer.
// ═══════════════════════════════════════════════════════════════════════════
const { escapeHtml, formatDate } = require("./adminTemplateCommon");
// Helper : case à cocher rendue avec ☒ si cochée, ☐ sinon
function cb(checked) {
    return checked ? "☒" : "☐";
}
// Helper : valeur en pointillés (style CERFA officiel) — vide → "............"
function dot(value, minDots = 30) {
    const s = String(value ?? "").trim();
    if (s)
        return escapeHtml(s);
    return ".".repeat(minDots);
}
function renderTvaAttestationCerfaOfficielHtml({ attestation, company }) {
    const a = attestation || {};
    const c = company || {};
    // Identité signataire (le client)
    const lastName = a.ownerLastName || "";
    const firstName = a.ownerFirstName || "";
    const address = a.logementAddress || "";
    const fullAddress = address.split(/\s*\n\s*|\s*,\s*/).filter(Boolean);
    const street = fullAddress[0] || "";
    const cityZip = fullAddress.slice(1).join(", ");
    const postal = (cityZip.match(/\b(\d{5})\b/) || [])[1] || "";
    const city = cityZip.replace(postal, "").replace(/,/g, "").trim();
    // Type de local
    const lt = a.logementType || "";
    const typeMaison = ["maison", "individuel"].some((k) => lt.includes(k));
    const typeImmeubleCollectif = lt === "immeuble_collectif";
    const typeAppart = lt === "appartement";
    const typeAutre = !typeMaison && !typeImmeubleCollectif && !typeAppart;
    // Qualité (propriétaire / locataire) — déduite si dispo, sinon laissée vide
    const isOwner = a.ownerQualite === "proprietaire" || !a.ownerQualite;
    const isTenant = a.ownerQualite === "locataire";
    // Taux : 5,5% = amélioration énergétique, 10% = travaux d'entretien / rénovation
    const rate = Number(a.tvaRate);
    const isEnergetique = rate === 5.5 || a.category === "amelioration_energetique";
    const isEntretien = rate === 10 || a.category === "amelioration_qualite";
    // Date/lieu signature
    const signedLocation = a.signedLocation || "";
    const signedDate = a.signedDate ? formatDate(a.signedDate) : "";
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CERFA 1301-SD — Attestation simplifiée TVA</title>
<style>
  @page { size: A4; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 9pt;
    line-height: 1.35;
    color: #000;
    margin: 0;
    padding: 0;
  }
  .cerfa-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4mm;
    font-size: 8.5pt;
  }
  .cerfa-head .ministere {
    flex: 1;
    text-align: center;
    font-weight: 700;
    text-transform: uppercase;
  }
  .cerfa-head .num {
    text-align: right;
    font-weight: 700;
  }
  .cerfa-head .num-stack { line-height: 1.2; }
  .cerfa-title {
    text-align: center;
    font-size: 14pt;
    font-weight: 700;
    text-transform: uppercase;
    margin: 4mm 0;
    letter-spacing: 0.5px;
  }
  .cerfa-section {
    border: 1.5px solid #000;
    margin: 3mm 0;
    padding: 0;
    page-break-inside: avoid;
  }
  .cerfa-section .section-title {
    background: #1f2937;
    color: white;
    padding: 1.5mm 3mm;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 9pt;
    letter-spacing: 0.5px;
  }
  .cerfa-section .section-body {
    padding: 2.5mm 3mm;
  }
  .field-row {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    margin: 1.5mm 0;
    flex-wrap: wrap;
  }
  .field-row .label { font-weight: 600; }
  .field-row .value {
    border-bottom: 1px dotted #444;
    flex: 1;
    min-width: 30mm;
    padding: 0 1mm;
  }
  .checkbox-line {
    margin: 1mm 0;
    display: flex;
    align-items: flex-start;
    gap: 1.5mm;
  }
  .checkbox-line .cb {
    font-size: 11pt;
    font-family: "DejaVu Sans", "Arial Unicode MS", sans-serif;
    line-height: 1;
    margin-top: 0.5mm;
    min-width: 4mm;
  }
  .checkbox-line .lbl { flex: 1; }
  .indent { margin-left: 6mm; }
  .signature-zone {
    margin-top: 5mm;
    border-top: 1px solid #000;
    padding-top: 3mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .signature-zone .sig-text {
    flex: 1;
    font-size: 9pt;
  }
  .signature-zone .sig-box {
    width: 60mm;
    min-height: 25mm;
    border: 1px solid #000;
    padding: 2mm;
    text-align: center;
    font-size: 8pt;
  }
  .signature-zone .sig-box img {
    max-width: 56mm;
    max-height: 20mm;
    object-fit: contain;
  }
  .footnote {
    font-size: 7.5pt;
    color: #444;
    margin-top: 2mm;
    border-top: 1px solid #aaa;
    padding-top: 1mm;
  }
  .legal-warning {
    font-size: 7.5pt;
    padding: 2mm;
    border: 1px solid #000;
    background: #f5f5f5;
    margin: 3mm 0;
  }
  .strong-rate {
    display: inline-block;
    background: #fff3cd;
    border: 1px solid #856404;
    padding: 0.5mm 2mm;
    font-weight: 700;
    margin: 0 1mm;
  }
</style>
</head>
<body>

<div class="cerfa-head">
  <div style="width:30mm;text-align:left">
    <strong>CERFA</strong><br>
    <span style="font-size:10pt;font-weight:700">N°1301-SD</span>
  </div>
  <div class="ministere">
    DIRECTION GÉNÉRALE<br>
    DES FINANCES PUBLIQUES
  </div>
  <div class="num">
    <div class="num-stack">
      <div style="font-size:10pt">N°13948*06</div>
      <div style="font-size:7pt;color:#444;margin-top:1mm">(2022)</div>
    </div>
  </div>
</div>

<div class="cerfa-title">Attestation simplifiée</div>

<div class="legal-warning">
  Pour l'application des taux réduits de la TVA (5,5 % ou 10 % en métropole, 2,10 % en outre-mer)
  aux travaux d'amélioration, de transformation, d'aménagement et d'entretien portant sur des locaux
  à usage d'habitation achevés depuis plus de deux ans.
  &nbsp;—&nbsp; Articles 278-0 bis A et 279-0 bis du Code Général des Impôts.
</div>

<!-- ─── Cadre 1 : Identité du client ──────────────────────────────────────── -->
<div class="cerfa-section">
  <div class="section-title">1. Identité du client ou de son représentant</div>
  <div class="section-body">
    <p style="margin:0 0 1.5mm 0">Je soussigné(e) :</p>
    <div class="field-row">
      <span class="label">Nom :</span>
      <span class="value">${dot(lastName, 40)}</span>
      <span class="label">Prénom :</span>
      <span class="value">${dot(firstName, 30)}</span>
    </div>
    <div class="field-row">
      <span class="label">Adresse :</span>
      <span class="value">${dot(street, 60)}</span>
    </div>
    <div class="field-row">
      <span class="label">Code postal :</span>
      <span class="value" style="max-width:25mm">${dot(postal, 6)}</span>
      <span class="label">Commune :</span>
      <span class="value">${dot(city, 30)}</span>
    </div>
  </div>
</div>

<!-- ─── Cadre 2 : Nature des locaux ───────────────────────────────────────── -->
<div class="cerfa-section">
  <div class="section-title">2. Nature des locaux</div>
  <div class="section-body">
    <p style="margin:0 0 1.5mm 0">
      J'atteste que les travaux à réaliser portent sur un immeuble achevé depuis plus de deux ans
      à la date de commencement des travaux et affecté à l'habitation à l'issue de ces travaux :
    </p>
    <div class="checkbox-line">
      <span class="cb">${cb(typeMaison)}</span>
      <span class="lbl">maison ou immeuble individuel</span>
      <span class="cb" style="margin-left:6mm">${cb(typeImmeubleCollectif)}</span>
      <span class="lbl">immeuble collectif</span>
      <span class="cb" style="margin-left:6mm">${cb(typeAppart)}</span>
      <span class="lbl">appartement individuel</span>
    </div>
    <div class="checkbox-line">
      <span class="cb">${cb(typeAutre)}</span>
      <span class="lbl">autre (précisez la nature du local à usage d'habitation) :
        <span style="border-bottom:1px dotted #444;display:inline-block;min-width:60mm;padding:0 1mm">
          ${typeAutre && a.logementType ? escapeHtml(a.logementType) : "&nbsp;"}
        </span>
      </span>
    </div>

    <p style="margin:2mm 0 1mm 0">Les travaux sont réalisés dans :</p>
    <div class="checkbox-line">
      <span class="cb">☒</span>
      <span class="lbl">un local affecté exclusivement ou principalement à l'habitation</span>
    </div>
    <div class="checkbox-line">
      <span class="cb">☐</span>
      <span class="lbl">des pièces affectées exclusivement à l'habitation situées dans un local affecté pour moins de 50 % à cet usage</span>
    </div>
    <div class="checkbox-line">
      <span class="cb">☐</span>
      <span class="lbl">des parties communes de locaux affectés exclusivement ou principalement à l'habitation dans une proportion de (...........) millièmes de l'immeuble</span>
    </div>
    <div class="checkbox-line">
      <span class="cb">☐</span>
      <span class="lbl">un local antérieurement affecté à un usage autre que d'habitation et transformé à cet usage</span>
    </div>

    <div class="field-row" style="margin-top:2mm">
      <span class="label">Adresse² :</span>
      <span class="value">${dot(street, 50)}</span>
    </div>
    <div class="field-row">
      <span class="label">Commune :</span>
      <span class="value">${dot(city, 25)}</span>
      <span class="label">Code postal :</span>
      <span class="value" style="max-width:25mm">${dot(postal, 6)}</span>
    </div>
    <div class="field-row">
      <span class="label">dont je suis :</span>
      <span class="cb">${cb(isOwner)}</span><span>propriétaire</span>
      <span class="cb" style="margin-left:6mm">${cb(isTenant)}</span><span>locataire</span>
      <span class="cb" style="margin-left:6mm">☐</span><span>autre (précisez) :
        <span style="border-bottom:1px dotted #444;display:inline-block;min-width:40mm">&nbsp;</span>
      </span>
    </div>
  </div>
</div>

<!-- ─── Cadre 3 : Nature des travaux ──────────────────────────────────────── -->
<div class="cerfa-section">
  <div class="section-title">3. Nature des travaux</div>
  <div class="section-body">
    <p style="margin:0 0 1.5mm 0">
      J'atteste que sur la période de deux ans précédant ou suivant la réalisation des travaux décrits
      dans la présente attestation, les travaux :
    </p>
    <div class="checkbox-line">
      <span class="cb">☒</span>
      <span class="lbl">
        n'affectent ni les fondations, ni les éléments, hors fondations, déterminant la résistance et
        la rigidité de l'ouvrage, ni la consistance des façades (hors ravalement).
      </span>
    </div>
    <div class="checkbox-line">
      <span class="cb">☒</span>
      <span class="lbl">n'affectent pas plus de cinq des six éléments de second œuvre suivants :</span>
    </div>
    <div class="indent" style="font-size:8.5pt">
      Cochez les cases correspondant aux éléments affectés :
      <span class="cb">☐</span> planchers qui ne déterminent pas la résistance de l'ouvrage
      &nbsp; <span class="cb">☐</span> huisseries extérieures
      &nbsp; <span class="cb">☐</span> cloisons intérieures
      &nbsp; <span class="cb">☐</span> installations sanitaires et de plomberie
      &nbsp; <span class="cb">☐</span> installations électriques
      &nbsp; <span class="cb">☐</span> système de chauffage (pour les immeubles situés en métropole)
    </div>
    <div class="checkbox-line">
      <span class="cb">☒</span>
      <span class="lbl">
        n'entraînent pas une augmentation de la surface de plancher de la construction existante
        supérieure à 10 %.
      </span>
    </div>
    <div class="checkbox-line">
      <span class="cb">☒</span>
      <span class="lbl">ne consistent pas en une surélévation ou une addition de construction.</span>
    </div>

    ${isEnergetique ? `
    <div class="checkbox-line" style="margin-top:2mm">
      <span class="cb">${cb(isEnergetique)}</span>
      <span class="lbl">
        <strong>J'atteste que les travaux visent à améliorer la qualité énergétique du logement</strong>
        et portent sur la fourniture, la pose, l'installation ou l'entretien des matériaux, appareils
        et équipements dont la liste figure dans la notice (1 de l'article 200 quater du CGI) et
        respectent les caractéristiques techniques et les critères de performances minimales fixés
        par un arrêté du ministre du budget (article 18 bis de l'annexe IV au CGI).
        <span class="strong-rate">Taux réduit applicable : 5,50 %</span>
      </span>
    </div>
    ` : ""}

    ${isEntretien ? `
    <div class="checkbox-line" style="margin-top:2mm">
      <span class="cb">${cb(isEntretien)}</span>
      <span class="lbl">
        <strong>J'atteste que les travaux ont la nature de travaux induits indissociablement liés</strong>
        à des travaux d'amélioration de la qualité énergétique soumis aux taux réduits de TVA de 5,50 %
        (métropole) ou 2,10 % (outre-mer), ou portent sur l'amélioration, transformation, aménagement
        ou entretien de locaux à usage d'habitation achevés depuis plus de deux ans.
        <span class="strong-rate">Taux réduit applicable : 10,00 %</span>
      </span>
    </div>
    ` : ""}
  </div>
</div>

<!-- ─── Cadre 4 : Conservation ────────────────────────────────────────────── -->
<div class="cerfa-section">
  <div class="section-title">4. Conservation de l'attestation et des pièces justificatives</div>
  <div class="section-body" style="font-size:8.5pt">
    Je conserve une copie de cette attestation ainsi que toutes les factures ou notes émises par
    les entreprises prestataires <strong>jusqu'au 31 décembre de la cinquième année suivant la
    réalisation des travaux</strong> et m'engage à en produire une copie à l'administration fiscale
    sur sa demande.
    <p style="margin:1.5mm 0">
      Si les mentions portées sur l'attestation s'avèrent inexactes de votre fait et ont eu pour
      conséquence l'application erronée des taux réduits de la TVA, vous êtes solidairement tenu
      au paiement du complément de taxe résultant de la différence entre le montant de la TVA due
      au taux normal (20 % en métropole, 8,50 % en outre-mer) et le montant de la TVA effectivement
      payé au taux réduit.
    </p>
  </div>
</div>

<!-- ─── Signature ─────────────────────────────────────────────────────────── -->
<div class="signature-zone">
  <div class="sig-text">
    <div class="field-row">
      <span class="label">Fait à</span>
      <span class="value" style="max-width:50mm">${dot(signedLocation, 25)}</span>
      <span class="label">, le</span>
      <span class="value" style="max-width:35mm">${dot(signedDate, 20)}</span>
    </div>
    <p style="margin-top:3mm;font-size:8.5pt">
      Signature du client ou de son représentant<br>
      (précédée de la mention "Lu et approuvé") :
    </p>
  </div>
  <div class="sig-box">
    ${a.clientSignatureDataUrl
        ? `<img src="${a.clientSignatureDataUrl}" alt="Signature" />`
        : '<div style="color:#888;padding-top:8mm">Signature</div>'}
  </div>
</div>

<div class="footnote">
  ¹ Pour remplir cette attestation, cochez les cases correspondant à votre situation et complétez
  les rubriques en pointillés.<br>
  ² Si différente de l'adresse indiquée dans le cadre 1.<br>
  <br>
  <strong>Entreprise prestataire :</strong>
  ${escapeHtml(c.companyName || "")}${c.siret ? " — SIRET " + escapeHtml(c.siret) : ""}
  ${a.invoiceReference ? " — Facture/devis n° " + escapeHtml(a.invoiceReference) : ""}
  ${a.totalAmountHt ? " — Montant HT : " + Number(a.totalAmountHt).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : ""}
</div>

</body>
</html>`;
}
module.exports = { renderTvaAttestationCerfaOfficielHtml };
