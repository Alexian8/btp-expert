// ═══════════════════════════════════════════════════════════════════════════
// quoteTemplate.js — Génère le HTML d'un devis pour impression PDF
// Style moderne épuré (Pennylane/Tolteck inspired)
//
// Utilisé par le main process Electron (CommonJS)
// ═══════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

// ─── Utilitaires de format ───────────────────────────────────────────────
function formatEuros(v, decimals = 2) {
  return Number(v || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + " €";
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Logo en base64 pour embed dans le PDF ─────────────────────────────
function logoToDataUrl(logoPath) {
  if (!logoPath || !fs.existsSync(logoPath)) return null;
  try {
    const buffer = fs.readFileSync(logoPath);
    const ext = path.extname(logoPath).slice(1).toLowerCase();
    const mime = ext === "jpg" ? "jpeg" : ext;
    return `data:image/${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// ─── Session S28 — CSS overrides selon le style choisi ────────────────
// "moderne" = aucune surcharge (style original conservé pixel-perfect)
// "sobre" = retire les couleurs des en-têtes de catégorie, plus minimaliste
// "classique" = bordures noires, look traditionnel BTP
function getQuoteStyleOverrides(style, accentColor) {
  if (style === "sobre") {
    return `
  /* ─── STYLE SOBRE ─── */
  /* Retire les fonds colorés sur les en-têtes de catégorie */
  table.items thead th {
    background: #f8fafc !important;
    color: #1f2937 !important;
    border-bottom: 2px solid #1f2937 !important;
  }
  .category-row td {
    background: #f8fafc !important;
    color: #1f2937 !important;
    border-top: 1px solid #d1d5db;
    border-bottom: 1px solid #d1d5db;
  }
  /* Total TTC en noir, juste avec accent en bordure */
  .total-ttc {
    background: white !important;
    color: ${accentColor} !important;
    border: 2px solid ${accentColor} !important;
  }
  /* Numéro devis et titre en noir */
  .doc-type, .doc-number {
    color: #1f2937 !important;
  }
  .signature-col h3 {
    color: #1f2937 !important;
  }
    `;
  }
  if (style === "classique") {
    return `
  /* ─── STYLE CLASSIQUE BTP ─── */
  /* Bordures partout, fond gris très clair */
  .page {
    background: #fafbfc;
  }
  table.items {
    border: 1.5px solid #1f2937;
  }
  table.items thead th {
    background: #f0f2f5 !important;
    color: #1f2937 !important;
    border-bottom: 2px solid #1f2937 !important;
    border-right: 1px solid #c8cdd4;
  }
  table.items td {
    border-right: 1px solid #e8ebf0;
  }
  .category-row td {
    background: ${accentColor}15 !important;
    color: ${accentColor} !important;
    border-top: 1px solid #c8cdd4;
    border-bottom: 1px solid #c8cdd4;
  }
  .total-ttc {
    border: 2px solid ${accentColor} !important;
    background: white !important;
    color: ${accentColor} !important;
  }
  .party-block {
    border: 1.5px solid #c8cdd4 !important;
    background: white !important;
  }
  .signature-col {
    border: 1.5px solid #c8cdd4 !important;
  }
  /* Header avec bordure */
  .header {
    border-bottom: 2px solid #1f2937 !important;
    padding-bottom: 4mm;
  }
    `;
  }
  // "moderne" — pas de surcharge, conserve le rendu original
  return "";
}

// ─── Calcul des totaux (reproduction du quoteEngine côté backend) ────
function computeTotals(items, globalDiscountMode, globalDiscountPercent, globalDiscountAmount) {
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const vatDetail = { 0:{base:0,tax:0}, 5.5:{base:0,tax:0}, 10:{base:0,tax:0}, 20:{base:0,tax:0} };

  let subtotalBefore = 0;
  let totalLineDiscounts = 0;
  let subtotalAfter = 0;

  for (const item of items) {
    if (item.kind !== "line") continue;
    const brut = (item.quantity || 0) * (item.unitPriceHT || 0);
    let disc = 0;
    if (item.discountMode === "percent" && item.discountPercent > 0) disc = brut * (item.discountPercent / 100);
    else if (item.discountMode === "amount" && item.discountAmount > 0) disc = Math.min(item.discountAmount, brut);
    const net = Math.max(0, brut - disc);
    subtotalBefore += brut;
    totalLineDiscounts += disc;
    subtotalAfter += net;
  }

  let globalDiscount = 0;
  if (globalDiscountMode === "percent" && globalDiscountPercent > 0) {
    globalDiscount = subtotalAfter * (globalDiscountPercent / 100);
  } else if (globalDiscountMode === "amount" && globalDiscountAmount > 0) {
    globalDiscount = Math.min(globalDiscountAmount, subtotalAfter);
  }
  const totalHT = Math.max(0, subtotalAfter - globalDiscount);
  const ratio = subtotalAfter > 0 ? totalHT / subtotalAfter : 0;

  for (const item of items) {
    if (item.kind !== "line") continue;
    const brut = (item.quantity || 0) * (item.unitPriceHT || 0);
    let disc = 0;
    if (item.discountMode === "percent" && item.discountPercent > 0) disc = brut * (item.discountPercent / 100);
    else if (item.discountMode === "amount" && item.discountAmount > 0) disc = Math.min(item.discountAmount, brut);
    const net = Math.max(0, brut - disc) * ratio;
    const rate = item.vatRate || 0;
    if (vatDetail[rate]) {
      vatDetail[rate].base += net;
      vatDetail[rate].tax += net * (rate / 100);
    }
  }

  for (const r of [0, 5.5, 10, 20]) {
    vatDetail[r].base = round2(vatDetail[r].base);
    vatDetail[r].tax = round2(vatDetail[r].tax);
  }

  const totalVAT = round2(vatDetail[0].tax + vatDetail[5.5].tax + vatDetail[10].tax + vatDetail[20].tax);
  const totalTTC = round2(totalHT + totalVAT);

  return {
    subtotalBeforeDiscountHT: round2(subtotalBefore),
    totalLineDiscounts: round2(totalLineDiscounts),
    subtotalAfterLineDiscountsHT: round2(subtotalAfter),
    globalDiscount: round2(globalDiscount),
    totalHT: round2(totalHT),
    vatDetail,
    totalVAT,
    totalTTC,
  };
}

// ─── Rendu HTML de l'ensemble ────────────────────────────────────────────
function renderQuoteHtml({ quote, client, chantier, company, categories = [], pdfSettings = {} }) {
  const snapshot = (quote.companySnapshot && Object.keys(quote.companySnapshot).length)
    ? quote.companySnapshot
    : (company || {});
  const logoUrl = logoToDataUrl(snapshot.logoPath);
  const vatEnabled = snapshot.tvaApplicable !== false;
  // Session S26 — Champs de personnalisation S25
  const stampDataUrl = pdfSettings.companyStampDataUrl || "";
  const signatureDataUrl = pdfSettings.companySignatureDataUrl || "";
  const rgeQualifications = Array.isArray(pdfSettings.rgeQualifications) ? pdfSettings.rgeQualifications : [];
  const hasSignatureBlock = stampDataUrl || signatureDataUrl;

  // Session S26.3 — Personnalisation visuelle
  const logoSize = Number(pdfSettings.pdfLogoSizeMm) || 35;
  const stampSize = Number(pdfSettings.pdfStampSizeMm) || 26;
  const signatureSize = Number(pdfSettings.pdfSignatureSizeMm) || 22;
  const stampPosition = pdfSettings.pdfStampPosition || "right"; // left|center|right
  const density = pdfSettings.pdfDensity || "normal"; // compact|normal|comfortable
  const showAccordBlock = pdfSettings.pdfShowAccordBlock !== false;
  const showSignatureBlock = pdfSettings.pdfShowSignatureBlock !== false;
  const showQualifications = pdfSettings.pdfShowQualifications !== false;

  // Session S27 — CGV en dernière page
  const cgvText = (pdfSettings.cgvText || "").trim();
  const showCgv = cgvText.length > 0;

  // Session S28 — Police personnalisable
  const pdfFont = pdfSettings.pdfFont || "Inter";

  // Session S28 — Multi-style devis
  const quoteStyle = pdfSettings.pdfQuoteStyle || "moderne";
  const accentColor = pdfSettings.pdfAccentColor || "#2563eb";

  // Mappings pour le CSS dynamique
  const densityGap = density === "compact" ? "4mm" : density === "comfortable" ? "12mm" : "8mm";
  const blockJustify = stampPosition === "left" ? "flex-start"
                     : stampPosition === "center" ? "center"
                     : "flex-end";
  const totals = computeTotals(
    quote.items || [],
    quote.globalDiscountMode || "none",
    Number(quote.globalDiscountPercent || 0),
    Number(quote.globalDiscountAmount || 0)
  );

  // Session 22 — Map des catégories pour rendu PDF
  const categoryColorHex = {
    slate:   { hex: "#64748b", hexBg: "#f1f5f9" },
    stone:   { hex: "#78716c", hexBg: "#f5f5f4" },
    blue:    { hex: "#3b82f6", hexBg: "#dbeafe" },
    indigo:  { hex: "#6366f1", hexBg: "#e0e7ff" },
    violet:  { hex: "#8b5cf6", hexBg: "#ede9fe" },
    emerald: { hex: "#10b981", hexBg: "#d1fae5" },
    teal:    { hex: "#14b8a6", hexBg: "#ccfbf1" },
    yellow:  { hex: "#ca8a04", hexBg: "#fef9c3" },
    amber:   { hex: "#f59e0b", hexBg: "#fef3c7" },
    orange:  { hex: "#f97316", hexBg: "#ffedd5" },
    rose:    { hex: "#f43f5e", hexBg: "#ffe4e6" },
    pink:    { hex: "#ec4899", hexBg: "#fce7f3" },
  };
  const categoryById = {};
  for (const c of (categories || [])) {
    categoryById[c.id] = c;
  }

  // ─── Bloc destinataire ───────────────────────────────────────────
  let clientBlock = "";
  if (client) {
    const isPro = client.type === "pro";
    const lines = [];
    if (isPro && client.companyName) {
      lines.push(`<strong>${escapeHtml(client.companyName)}</strong>`);
      const contact = [client.civility, client.firstName, client.lastName].filter(Boolean).join(" ");
      if (contact.trim()) lines.push(escapeHtml(contact));
    } else {
      const name = [client.civility, client.firstName, client.lastName].filter(Boolean).join(" ");
      lines.push(`<strong>${escapeHtml(name)}</strong>`);
    }
    if (client.addressLine1) lines.push(escapeHtml(client.addressLine1));
    if (client.addressLine2) lines.push(escapeHtml(client.addressLine2));
    const cp = [client.postalCode, client.city].filter(Boolean).join(" ");
    if (cp) lines.push(escapeHtml(cp));
    if (isPro && client.siret) lines.push(`<span class="muted">SIRET ${escapeHtml(client.siret)}</span>`);
    if (isPro && client.tvaIntracom) lines.push(`<span class="muted">TVA ${escapeHtml(client.tvaIntracom)}</span>`);
    clientBlock = lines.join("<br/>");
  }

  // ─── Bloc chantier ───────────────────────────────────────────────
  let chantierBlock = "";
  if (chantier && (chantier.addressLine1 || chantier.city)) {
    const lines = [];
    lines.push(`<strong>Chantier : ${escapeHtml(chantier.title || chantier.reference || "")}</strong>`);
    if (chantier.addressLine1) lines.push(escapeHtml(chantier.addressLine1));
    if (chantier.addressLine2) lines.push(escapeHtml(chantier.addressLine2));
    const cp = [chantier.postalCode, chantier.city].filter(Boolean).join(" ");
    if (cp) lines.push(escapeHtml(cp));
    chantierBlock = `<div class="chantier-block">${lines.join("<br/>")}</div>`;
  }

  // ─── Rendu des lignes (tableau HTML) ──────────────────────────────
  const itemsHtml = (quote.items || []).map((item) => {
    if (item.kind === "section") {
      return `
        <tr class="section-row">
          <td colspan="${vatEnabled ? 6 : 5}">${escapeHtml(item.title)}</td>
        </tr>`;
    }
    const brut = (item.quantity || 0) * (item.unitPriceHT || 0);
    let disc = 0;
    if (item.discountMode === "percent" && item.discountPercent > 0) disc = brut * (item.discountPercent / 100);
    else if (item.discountMode === "amount" && item.discountAmount > 0) disc = Math.min(item.discountAmount, brut);
    const netHT = Math.max(0, brut - disc);

    const discountLine = disc > 0
      ? `<div class="line-discount">Remise ${item.discountMode === "percent" ? item.discountPercent + " %" : formatEuros(item.discountAmount)} (− ${formatEuros(disc)})</div>`
      : "";
    const descLine = item.description
      ? `<div class="line-desc">${escapeHtml(item.description).replace(/\n/g, "<br/>")}</div>`
      : "";

    // Session 20 — Badge type (P / F / PF) si défini
    const typeBadgeMeta = {
      "P":  { label: "P",  longLabel: "Pose",                 color: "#7c3aed", bg: "#f3e8ff" },
      "F":  { label: "F",  longLabel: "Fourniture",           color: "#2563eb", bg: "#dbeafe" },
      "PF": { label: "PF", longLabel: "Pose et fourniture",   color: "#059669", bg: "#d1fae5" },
    };
    const typeBadge = item.lineType && typeBadgeMeta[item.lineType]
      ? `<span class="line-type-badge" title="${typeBadgeMeta[item.lineType].longLabel}">${typeBadgeMeta[item.lineType].label}</span>`
      : "";

    // Session 22 — Badge catégorie / poste
    let categoryBadge = "";
    if (item.categoryId && categoryById[item.categoryId]) {
      const cat = categoryById[item.categoryId];
      const c = categoryColorHex[cat.colorKey] || categoryColorHex.slate;
      categoryBadge = `<span class="line-category-badge" style="color:${c.hex};background:${c.hexBg};border-color:${c.hex};">${escapeHtml(cat.name)}</span>`;
    }

    return `
      <tr class="line-row">
        <td class="col-desc">
          <div class="line-title">${typeBadge}${categoryBadge}${escapeHtml(item.title || "—")}</div>
          ${descLine}
          ${discountLine}
        </td>
        <td class="col-qty">${Number(item.quantity || 0).toLocaleString("fr-FR")}</td>
        <td class="col-unit">${escapeHtml(item.unit || "")}</td>
        <td class="col-price">${formatEuros(item.unitPriceHT || 0)}</td>
        ${vatEnabled ? `<td class="col-vat">${item.vatRate || 0}%</td>` : ""}
        <td class="col-total">${formatEuros(netHT)}</td>
      </tr>`;
  }).join("");

  // ─── Ventilation TVA ─────────────────────────────────────────────
  let vatBreakdownHtml = "";
  if (vatEnabled) {
    const rows = [];
    for (const rate of [20, 10, 5.5, 0]) {
      const d = totals.vatDetail[rate];
      if (d.tax === 0 && d.base === 0) continue;
      rows.push(`
        <div class="vat-row">
          <span>TVA ${rate}% sur ${formatEuros(d.base)}</span>
          <span>${formatEuros(d.tax)}</span>
        </div>`);
    }
    vatBreakdownHtml = rows.join("");
  }

  // ─── Bloc entreprise en-tête ────────────────────────────────────
  const companyInfoLines = [];
  if (snapshot.addressLine1) companyInfoLines.push(escapeHtml(snapshot.addressLine1));
  if (snapshot.addressLine2) companyInfoLines.push(escapeHtml(snapshot.addressLine2));
  const companyCP = [snapshot.postalCode, snapshot.city].filter(Boolean).join(" ");
  if (companyCP) companyInfoLines.push(escapeHtml(companyCP));
  if (snapshot.phoneMobile || snapshot.phoneFixed)
    companyInfoLines.push(`Tél. ${escapeHtml(snapshot.phoneMobile || snapshot.phoneFixed)}`);
  if (snapshot.email) companyInfoLines.push(escapeHtml(snapshot.email));
  if (snapshot.website) companyInfoLines.push(escapeHtml(snapshot.website));

  // ─── Pied de page légal ──────────────────────────────────────────
  const legalLines = [];
  const companyName = snapshot.companyName || "";
  const legalFirstLine = [
    companyName,
    snapshot.legalForm,
  ].filter(Boolean).join(" — ");
  if (legalFirstLine) legalLines.push(escapeHtml(legalFirstLine));
  const legalSecondLine = [
    snapshot.siret ? `SIRET ${snapshot.siret}` : "",
    snapshot.tvaIntracom ? `TVA ${snapshot.tvaIntracom}` : "",
    snapshot.apeCode ? `APE ${snapshot.apeCode}` : "",
  ].filter(Boolean).join(" · ");
  if (legalSecondLine) legalLines.push(escapeHtml(legalSecondLine));
  if (!vatEnabled) legalLines.push("TVA non applicable — art. 293 B du CGI");

  // ─── HTML complet ────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(quote.reference || "Devis")}</title>
<style>
  @page {
    size: A4;
    margin: 0;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: "${pdfFont}", -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif;
    font-size: 10pt;
    color: #1a1d24;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    padding: 18mm 16mm 28mm 16mm;
    position: relative;
    min-height: 297mm;
  }
  .accent-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6mm;
    background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
  }

  /* ═══ HEADER ═══ */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12mm;
    padding-top: 4mm;
  }
  .header-left { max-width: 55%; }
  .header-logo {
    max-height: ${logoSize}mm;
    max-width: ${Math.round(logoSize * 2.5)}mm;
    display: block;
    margin-bottom: 3mm;
  }
  .company-name {
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #1a1d24;
    margin: 0 0 2mm 0;
  }
  .company-info {
    font-size: 9pt;
    color: #5a6472;
    line-height: 1.45;
  }
  .header-right {
    text-align: right;
  }
  .doc-label {
    font-size: 8pt;
    color: #8891a0;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 600;
    margin-bottom: 1mm;
  }
  .doc-reference {
    font-size: 16pt;
    font-weight: 700;
    color: #3b82f6;
    font-family: "SF Mono", Menlo, Consolas, monospace;
    margin: 0 0 4mm 0;
  }
  .doc-dates {
    font-size: 9pt;
    color: #5a6472;
    line-height: 1.7;
  }
  .doc-dates strong { color: #1a1d24; }

  /* ═══ DESTINATAIRE + CHANTIER ═══ */
  .recipient-section {
    display: flex;
    justify-content: space-between;
    gap: 12mm;
    margin-bottom: 10mm;
  }
  .recipient-block, .chantier-block {
    flex: 1;
    padding: 4mm 5mm;
    background: #f5f7fb;
    border-radius: 2mm;
    border-left: 3px solid #3b82f6;
  }
  .chantier-block {
    border-left-color: #6366f1;
    background: #f3f4fc;
  }
  .block-label {
    font-size: 8pt;
    color: #8891a0;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
    margin-bottom: 2mm;
  }
  .block-content { font-size: 9.5pt; line-height: 1.6; }
  .muted { color: #8891a0; font-size: 8.5pt; }

  /* ═══ TITRE + INTRO ═══ */
  .quote-title {
    font-size: 14pt;
    font-weight: 600;
    color: #1a1d24;
    margin: 0 0 4mm 0;
    padding-bottom: 2mm;
    border-bottom: 1px solid #e4e8ef;
  }
  .intro-text {
    font-size: 9.5pt;
    color: #4a5260;
    margin-bottom: 6mm;
    white-space: pre-wrap;
  }

  /* ═══ TABLEAU DES LIGNES ═══ */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6mm;
  }
  table.items thead th {
    text-align: left;
    font-size: 8pt;
    color: #8891a0;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
    padding: 3mm 2mm;
    border-bottom: 2px solid #e4e8ef;
  }
  table.items th.col-qty,
  table.items th.col-unit,
  table.items th.col-price,
  table.items th.col-vat,
  table.items th.col-total,
  table.items td.col-qty,
  table.items td.col-unit,
  table.items td.col-price,
  table.items td.col-vat,
  table.items td.col-total {
    text-align: right;
    white-space: nowrap;
  }
  table.items td.col-unit { text-align: center; }

  tr.section-row td {
    background: #3b82f6;
    color: #ffffff;
    font-size: 10pt;
    font-weight: 600;
    padding: 2.5mm 3mm;
    border-radius: 1mm;
  }

  tr.line-row td {
    padding: 3mm 2mm;
    border-bottom: 1px solid #eef0f5;
    vertical-align: top;
  }
  tr.line-row:nth-child(even) td {
    background: #fafbfd;
  }
  .line-title { font-weight: 500; color: #1a1d24; }
  .line-type-badge {
    display: inline-block;
    font-size: 7pt;
    font-weight: 700;
    padding: 0.5mm 1.5mm;
    margin-right: 1.5mm;
    border-radius: 1mm;
    background: #f3e8ff;
    color: #7c3aed;
    border: 0.3pt solid currentColor;
    letter-spacing: 0.3pt;
    vertical-align: 1px;
  }
  /* Session 22 : badge catégorie / poste */
  .line-category-badge {
    display: inline-block;
    font-size: 7pt;
    font-weight: 600;
    padding: 0.5mm 1.5mm;
    margin-right: 1.5mm;
    border-radius: 1mm;
    border: 0.3pt solid;
    vertical-align: 1px;
  }
  .line-desc {
    font-size: 8.5pt;
    color: #6b7280;
    margin-top: 1mm;
    white-space: pre-wrap;
  }
  .line-discount {
    font-size: 8pt;
    color: #ef4444;
    margin-top: 1mm;
    font-style: italic;
  }

  table.items td.col-total { font-weight: 600; }

  /* ═══ TOTAUX ═══ */
  .totals-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 4mm;
    page-break-inside: avoid;
  }
  .totals-block {
    width: 80mm;
    font-size: 9.5pt;
  }
  .total-line {
    display: flex;
    justify-content: space-between;
    padding: 1.5mm 0;
    color: #4a5260;
  }
  .total-line.subtotal {
    border-top: 1px solid #e4e8ef;
    padding-top: 2.5mm;
    color: #1a1d24;
  }
  .total-line.discount { color: #ef4444; }
  .vat-row {
    display: flex;
    justify-content: space-between;
    padding: 1mm 0;
    font-size: 9pt;
    color: #6b7280;
  }
  .total-vat-subtotal {
    display: flex;
    justify-content: space-between;
    padding: 2mm 0;
    font-weight: 500;
    border-top: 1px solid #e4e8ef;
    margin-top: 1mm;
  }
  .total-ttc {
    display: flex;
    justify-content: space-between;
    padding: 4mm 3mm;
    margin-top: 3mm;
    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
    color: white;
    font-size: 13pt;
    font-weight: 700;
    border-radius: 2mm;
  }

  /* ═══ CONDITIONS ═══ */
  .conditions {
    margin-top: 10mm;
    padding: 4mm 5mm;
    background: #f9fafc;
    border-radius: 2mm;
    font-size: 9pt;
    color: #4a5260;
    line-height: 1.6;
    white-space: pre-wrap;
    page-break-inside: avoid;
  }
  .conditions-label {
    font-size: 8pt;
    color: #8891a0;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
    margin-bottom: 2mm;
  }

  /* ═══ SESSION S26 — Bloc signature + cachet + qualifications ═══ */
  .signature-block {
    display: flex;
    justify-content: space-between;
    gap: 8mm;
    margin: ${densityGap} 0 4mm 0;
    page-break-inside: avoid;
  }
  /* S26.3 — Si seul le bloc entreprise est affiché, applique la position choisie */
  .signature-block.signature-only {
    justify-content: ${blockJustify};
  }
  .signature-block.signature-only .signature-col {
    flex: 0 0 80mm;
  }
  .signature-col {
    flex: 1;
    border: 1px solid #e4e8ef;
    border-radius: 2mm;
    padding: 4mm 5mm 5mm 5mm;
    min-height: 32mm;
    position: relative;
  }
  .signature-col h3 {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    margin: 0 0 2mm 0;
    font-weight: 600;
  }
  .signature-col .accord-mention {
    font-size: 7.5pt;
    color: #8891a0;
    font-style: italic;
    margin-bottom: 2mm;
  }
  .signature-col .signed-by {
    font-size: 8pt;
    color: #4b5563;
    margin-top: 2mm;
  }
  .signature-images {
    display: flex;
    align-items: flex-end;
    gap: 4mm;
    margin-top: 2mm;
  }
  .signature-images .signature-img {
    max-height: ${signatureSize}mm;
    max-width: 60mm;
    object-fit: contain;
  }
  .signature-images .stamp-img {
    max-height: ${stampSize}mm;
    max-width: ${Math.round(stampSize * 1.4)}mm;
    object-fit: contain;
    opacity: 0.95;
  }

  .qualifications-line {
    margin-top: 2mm;
    padding-top: 2mm;
    border-top: 1px dashed #e4e8ef;
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
    justify-content: center;
  }
  .qualif-badge {
    display: inline-block;
    padding: 0.5mm 2mm;
    border: 1px solid #d1d5db;
    border-radius: 1.5mm;
    font-size: 7pt;
    color: #4b5563;
    background: #f9fafb;
  }

  /* ═══ SESSION S27 — Page CGV ═══ */
  .cgv-page {
    page-break-before: always;
    padding-top: 6mm;
  }
  .cgv-title {
    font-size: 14pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #1f2937;
    margin: 0 0 2mm 0;
    padding-bottom: 3mm;
    border-bottom: 2px solid #e4e8ef;
  }
  .cgv-subtitle {
    font-size: 8.5pt;
    color: #8891a0;
    margin: 0 0 6mm 0;
    font-style: italic;
  }
  .cgv-content {
    font-size: 8.5pt;
    line-height: 1.6;
    color: #374151;
    white-space: pre-wrap;
    word-wrap: break-word;
    text-align: justify;
    margin-bottom: 20mm; /* Marge pour le footer fixe */
  }
  /* Mise en valeur des titres d'articles dans le texte CGV */
  .cgv-content {
    font-family: "${pdfFont}", sans-serif;
  }

  /* ═══ PIED DE PAGE ═══ */
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4mm 16mm 6mm 16mm;
    font-size: 7.5pt;
    color: #8891a0;
    text-align: center;
    border-top: 1px solid #e4e8ef;
    background: white;
    line-height: 1.6;
  }
  .footer .legal-line { margin: 0.5mm 0; }
  .mention-legale {
    font-weight: 600;
    color: #6b7280;
    margin-top: 1mm;
  }

  /* ═══ Session S28 — Surcharges selon le style choisi (moderne/sobre/classique) ═══ */
  ${getQuoteStyleOverrides(quoteStyle, accentColor)}
</style>
</head>
<body>
<div class="page">
  <div class="accent-bar"></div>

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img class="header-logo" src="${logoUrl}" alt="Logo"/>` : ""}
      <h1 class="company-name">${escapeHtml(snapshot.companyName || "Votre entreprise")}</h1>
      <div class="company-info">
        ${companyInfoLines.join("<br/>")}
      </div>
    </div>
    <div class="header-right">
      <div class="doc-label">Devis</div>
      <div class="doc-reference">${escapeHtml(quote.reference || "")}</div>
      <div class="doc-dates">
        <strong>Émis le</strong> ${formatDate(quote.issueDate)}<br/>
        ${quote.validUntil ? `<strong>Valable jusqu'au</strong> ${formatDate(quote.validUntil)}` : ""}
      </div>
    </div>
  </div>

  <!-- DESTINATAIRE + CHANTIER -->
  <div class="recipient-section">
    <div class="recipient-block">
      <div class="block-label">Destinataire</div>
      <div class="block-content">${clientBlock || "—"}</div>
    </div>
    ${chantierBlock ? `
    <div class="chantier-block">
      <div class="block-label">Lieu des travaux</div>
      <div class="block-content">${chantierBlock.replace('<div class="chantier-block">', '').replace('</div>', '')}</div>
    </div>` : ""}
  </div>

  <!-- TITRE -->
  ${quote.title ? `<h2 class="quote-title">${escapeHtml(quote.title)}</h2>` : ""}

  <!-- INTRO -->
  ${quote.introText ? `<div class="intro-text">${escapeHtml(quote.introText)}</div>` : ""}

  <!-- TABLEAU -->
  <table class="items">
    <thead>
      <tr>
        <th class="col-desc">Désignation</th>
        <th class="col-qty">Qté</th>
        <th class="col-unit">Unité</th>
        <th class="col-price">PU HT</th>
        ${vatEnabled ? `<th class="col-vat">TVA</th>` : ""}
        <th class="col-total">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <!-- TOTAUX -->
  <div class="totals-wrapper">
    <div class="totals-block">
      <div class="total-line subtotal">
        <span>Sous-total HT</span>
        <span>${formatEuros(totals.subtotalBeforeDiscountHT)}</span>
      </div>
      ${totals.totalLineDiscounts > 0 ? `
        <div class="total-line discount">
          <span>Remises lignes</span>
          <span>− ${formatEuros(totals.totalLineDiscounts)}</span>
        </div>
      ` : ""}
      ${totals.globalDiscount > 0 ? `
        <div class="total-line discount">
          <span>Remise globale</span>
          <span>− ${formatEuros(totals.globalDiscount)}</span>
        </div>
      ` : ""}
      <div class="total-line subtotal">
        <span><strong>Total HT</strong></span>
        <span><strong>${formatEuros(totals.totalHT)}</strong></span>
      </div>
      ${vatEnabled ? `
        <div style="margin-top:2mm;">${vatBreakdownHtml}</div>
        <div class="total-vat-subtotal">
          <span>Total TVA</span>
          <span>${formatEuros(totals.totalVAT)}</span>
        </div>
      ` : `
        <div style="margin-top:3mm; font-size:8pt; color:#8891a0; font-style:italic;">
          TVA non applicable — art. 293 B du CGI
        </div>
      `}
      <div class="total-ttc">
        <span>Total ${vatEnabled ? "TTC" : "à payer"}</span>
        <span>${formatEuros(totals.totalTTC)}</span>
      </div>
    </div>
  </div>

  <!-- CONDITIONS -->
  ${quote.conditionsText ? `
    <div class="conditions">
      <div class="conditions-label">Conditions de règlement</div>
      ${escapeHtml(quote.conditionsText)}
    </div>
  ` : ""}

  <!-- SESSION S26 — Bloc signature : Bon pour accord + cachet/signature entreprise -->
  ${(() => {
    // Session S26.3 — Logique d'affichage conditionnelle des blocs
    if (!showAccordBlock && !showSignatureBlock) return "";
    const onlyOneBlock = (showAccordBlock && !showSignatureBlock) || (!showAccordBlock && showSignatureBlock);
    return `
  <div class="signature-block${onlyOneBlock ? " signature-only" : ""}">
    ${showAccordBlock ? `
      <div class="signature-col">
        <h3>Bon pour accord du client</h3>
        <p class="accord-mention">
          Faire précéder la signature de la mention manuscrite « Bon pour accord ».
        </p>
        <p class="signed-by" style="margin-top: 12mm; border-top: 1px solid #e4e8ef; padding-top: 2mm;">
          Date : ___ / ___ / ______
        </p>
      </div>
    ` : ""}
    ${showSignatureBlock ? `
      <div class="signature-col">
        <h3>Pour ${escapeHtml(snapshot.companyName || "l'entreprise")}</h3>
        ${hasSignatureBlock ? `
          <div class="signature-images">
            ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Signature" class="signature-img" />` : ""}
            ${stampDataUrl ? `<img src="${stampDataUrl}" alt="Cachet" class="stamp-img" />` : ""}
          </div>
        ` : `
          <p class="accord-mention">Signature et cachet</p>
          <div style="height: 18mm;"></div>
        `}
        <p class="signed-by">
          ${escapeHtml(`${snapshot.leaderFirstName || ""} ${snapshot.leaderLastName || ""}`.trim() || snapshot.companyName || "")}
          ${snapshot.leaderRole ? ` — ${escapeHtml(snapshot.leaderRole)}` : ""}
        </p>
      </div>
    ` : ""}
  </div>
    `;
  })()}

  <!-- PIED DE PAGE -->
  <div class="footer">
    ${legalLines.map(l => `<div class="legal-line ${l.includes("non applicable") ? "mention-legale" : ""}">${l}</div>`).join("")}
    ${(showQualifications && rgeQualifications.length > 0) ? `
      <div class="qualifications-line">
        ${rgeQualifications.filter(q => q && q.type).map(q => `
          <span class="qualif-badge">${escapeHtml(q.type)}${q.number ? ` n°${escapeHtml(q.number)}` : ""}</span>
        `).join("")}
      </div>
    ` : ""}
  </div>
</div>

${showCgv ? `
  <!-- SESSION S27 — Page CGV (Conditions Générales de Vente) -->
  <div class="cgv-page">
    <h1 class="cgv-title">Conditions Générales de Vente</h1>
    <p class="cgv-subtitle">
      Devis n° ${escapeHtml(quote.reference || "")} · ${escapeHtml(snapshot.companyName || "")}
    </p>
    <div class="cgv-content">${escapeHtml(cgvText)}</div>
  </div>
` : ""}
</body>
</html>`;
}

module.exports = { renderQuoteHtml };
