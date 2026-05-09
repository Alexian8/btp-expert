// ═══════════════════════════════════════════════════════════════════════════
// invoiceTemplate.js — Génère le HTML d'une facture pour impression PDF
//
// Supporte 3 styles (moderne/sobre/classique) + couleur d'accent personnalisée
// + pied de page personnalisé + option afficher/masquer IBAN
//
// Différences avec quoteTemplate :
//   - En-tête "FACTURE" (+ badge Acompte/Avoir si applicable)
//   - Référence commence par FACT-
//   - Affiche la date d'échéance (dueDate)
//   - Affiche le montant payé + le reste à devoir
//   - Pas de "Bon pour accord" / zone signature
//   - Mentions légales factures (pénalités retard, indemnité recouvrement)
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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

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

function round2(n) { return Math.round(n * 100) / 100; }

// ─── Calcul des totaux ───────────────────────────────────────────────────
function computeTotals(items, globalDiscountMode, globalPct, globalAmount) {
  let subtotalBefore = 0;
  let totalLineDiscounts = 0;

  for (const item of items || []) {
    if (item.kind !== "line") continue;
    const brut = (item.quantity || 0) * (item.unitPriceHT || 0);
    let disc = 0;
    if (item.discountMode === "percent" && item.discountPercent > 0) disc = brut * (item.discountPercent / 100);
    else if (item.discountMode === "amount" && item.discountAmount > 0) disc = Math.min(item.discountAmount, brut);
    subtotalBefore += brut;
    totalLineDiscounts += disc;
  }

  const subtotalAfter = subtotalBefore - totalLineDiscounts;
  let globalDiscount = 0;
  if (globalDiscountMode === "percent" && globalPct > 0) globalDiscount = subtotalAfter * (globalPct / 100);
  else if (globalDiscountMode === "amount" && globalAmount > 0) globalDiscount = Math.min(globalAmount, subtotalAfter);

  const totalHT = Math.max(0, subtotalAfter - globalDiscount);
  const ratio = subtotalAfter > 0 ? totalHT / subtotalAfter : 1;

  const vatDetail = { 0: { base: 0, tax: 0 }, 5.5: { base: 0, tax: 0 }, 10: { base: 0, tax: 0 }, 20: { base: 0, tax: 0 } };
  for (const item of items || []) {
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

  return { subtotalBeforeDiscountHT: round2(subtotalBefore), totalLineDiscounts: round2(totalLineDiscounts),
    subtotalAfterLineDiscountsHT: round2(subtotalAfter), globalDiscount: round2(globalDiscount),
    totalHT: round2(totalHT), vatDetail, totalVAT, totalTTC };
}

// ─── Traduction accent color → styles CSS ─────────────────────────────────
function getAccentColor(pdfSettings) {
  const raw = pdfSettings.pdfAccentColor || "#2563eb";
  // Validation basique : doit être #RRGGBB
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return "#2563eb";
  return raw;
}

// Génère une couleur légèrement plus foncée pour les dégradés
function darkenColor(hex, amount = 0.15) {
  const h = hex.replace("#", "");
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── Styles CSS selon pdfStyle (moderne/sobre/classique) ──────────────────
function getStyleCss(style, accentColor, sizes = {}) {
  const accentDark = darkenColor(accentColor, 0.15);
  // Session S26.3 — Tailles personnalisables (avec fallback)
  const logoSize = Number(sizes.logoSize) || 18;
  const stampSize = Number(sizes.stampSize) || 26;
  const signatureSize = Number(sizes.signatureSize) || 22;
  // Session S26.3 — Position du bloc cachet/signature
  const blockJustify = sizes.stampPosition === "left" ? "flex-start"
                     : sizes.stampPosition === "center" ? "center"
                     : "flex-end";
  // Session S28 — Police personnalisable
  const fontFamily = sizes.pdfFont || "Inter";

  // ─── Base commune à tous les styles ───
  const baseCss = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: "${fontFamily}", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a1d24; font-size: 10pt; line-height: 1.5;
    }
    .page {
      width: 210mm; min-height: 297mm; padding: 18mm 15mm;
      background: white;
    }
    .muted { color: #8891a0; }
    .accent { color: ${accentColor}; }

    /* Header commun */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; }
    .company-block { flex: 1; max-width: 95mm; }
    .company-logo { max-height: ${logoSize}mm; max-width: ${Math.round(logoSize * 3.3)}mm; margin-bottom: 3mm; }
    .company-name { font-size: 13pt; font-weight: 600; color: #111; margin-bottom: 1mm; }
    .company-info { font-size: 8.5pt; color: #5a6273; line-height: 1.45; }

    .invoice-block { text-align: right; min-width: 60mm; }
    .invoice-label { font-size: 9pt; color: #8891a0; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; }
    .invoice-ref { font-size: 20pt; font-weight: 700; color: #111; margin-top: 1mm; }
    .invoice-type-badge { display: inline-block; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
      padding: 1mm 2mm; border-radius: 2px; margin-top: 2mm; }
    .invoice-dates { font-size: 9pt; color: #5a6273; margin-top: 3mm; line-height: 1.6; }
    .invoice-dates strong { color: #111; font-weight: 500; }

    /* Client / chantier */
    .parties { display: flex; gap: 8mm; margin: 8mm 0; }
    .party-block { flex: 1; padding: 5mm 6mm; background: #f7f8fa; border-radius: 3px; }
    .party-label { font-size: 8pt; color: #8891a0; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600; margin-bottom: 2mm; }
    .party-content { font-size: 10pt; line-height: 1.55; }
    .chantier-block { margin-top: 3mm; padding-top: 3mm; border-top: 1px dashed #d8dde4; font-size: 9pt; color: #5a6273; }

    /* Intro */
    .intro { margin: 6mm 0; padding: 4mm 5mm; border-left: 3px solid ${accentColor}; background: ${accentColor}0a; font-size: 9.5pt; font-style: italic; color: #4a5368; }

    /* Tableau des lignes */
    table.items { width: 100%; border-collapse: collapse; margin-top: 4mm; }
    table.items thead th { background: ${accentColor}; color: white; font-size: 8.5pt; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.04em; padding: 3mm 2.5mm; text-align: left; }
    table.items thead th.right { text-align: right; }
    table.items thead th.center { text-align: center; }
    table.items tbody tr { border-bottom: 1px solid #e8ebf0; }
    table.items td { padding: 3mm 2.5mm; vertical-align: top; font-size: 9.5pt; }
    table.items td.right { text-align: right; }
    table.items td.center { text-align: center; }
    .section-row td { background: #f7f8fa; font-weight: 600; color: #111; font-size: 9.5pt; padding: 2.5mm 2.5mm; border-bottom: 1.5px solid ${accentColor}40; }
    .line-title { font-weight: 500; color: #1a1d24; }
    .line-desc { font-size: 8.5pt; color: #6a7487; margin-top: 1mm; line-height: 1.45; }
    .line-discount { font-size: 8pt; color: ${accentColor}; margin-top: 1mm; font-style: italic; }
    .col-desc { width: 50%; }
    .col-qty { width: 8%; text-align: right; font-variant-numeric: tabular-nums; }
    .col-unit { width: 10%; text-align: center; color: #6a7487; font-size: 9pt; }
    .col-price { width: 14%; text-align: right; font-variant-numeric: tabular-nums; }
    .col-vat { width: 8%; text-align: center; font-size: 9pt; color: #6a7487; }
    .col-total { width: 14%; text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }

    /* Zone totaux */
    .totals-zone { margin-top: 8mm; display: flex; justify-content: flex-end; }
    .totals-box { min-width: 85mm; }
    .totals-row { display: flex; justify-content: space-between; padding: 2mm 0; font-size: 10pt; }
    .totals-row.muted { color: #6a7487; font-size: 9pt; }
    .totals-row .label { text-align: left; }
    .totals-row .value { font-variant-numeric: tabular-nums; }
    .totals-divider { border-top: 1px solid #d8dde4; margin: 2mm 0; }

    .total-ttc {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 3mm; padding: 4mm 5mm;
      background: ${accentColor}; color: white; border-radius: 3px;
      font-size: 13pt; font-weight: 700;
    }
    .total-ttc .value { font-variant-numeric: tabular-nums; }

    .payment-status { margin-top: 3mm; padding: 3mm 5mm; border-radius: 3px; }
    .payment-status.paid { background: #10b98115; color: #047857; border-left: 3px solid #10b981; }
    .payment-status.partial { background: #f5940915; color: #b45309; border-left: 3px solid #f59409; }
    .payment-status-row { display: flex; justify-content: space-between; font-size: 9.5pt; padding: 1mm 0; }
    .payment-status-row strong { font-weight: 600; }
    .payment-status-row.remaining { border-top: 1px solid currentColor; margin-top: 2mm; padding-top: 2mm; font-weight: 700; font-size: 10.5pt; }

    /* Conditions */
    .conditions { margin-top: 8mm; padding: 4mm 5mm; background: #f7f8fa; border-radius: 3px; font-size: 9pt; color: #4a5368; }
    .conditions-label { font-size: 8pt; color: #8891a0; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600; margin-bottom: 2mm; }

    /* IBAN */
    .iban-block { margin-top: 5mm; padding: 4mm 5mm; border: 1px dashed ${accentColor}80; border-radius: 3px; }
    .iban-label { font-size: 8pt; color: #8891a0; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600; margin-bottom: 2mm; }
    .iban-value { font-family: "Menlo", "Monaco", monospace; font-size: 10pt; letter-spacing: 0.5px; color: #111; }

    /* Footer */
    .footer { margin-top: 8mm; padding-top: 4mm; border-top: 1px solid #d8dde4; text-align: center; font-size: 8pt; color: #8891a0; line-height: 1.6; }
    .legal-line { margin: 0.5mm 0; }
    .mention-legale { font-style: italic; }
    .footer-custom { margin-top: 3mm; font-size: 8.5pt; color: #5a6273; line-height: 1.5; white-space: pre-wrap; }

    /* Session S26 — Bloc cachet/signature + qualifications */
    .signature-block {
      display: flex;
      justify-content: ${blockJustify};
      margin: 6mm 0 4mm 0;
      page-break-inside: avoid;
    }
    .signature-col {
      flex: 0 0 70mm;
      border: 1px solid #e4e8ef;
      border-radius: 2mm;
      padding: 4mm 5mm 5mm 5mm;
      min-height: 30mm;
    }
    .signature-col h3 {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin: 0 0 2mm 0;
      font-weight: 600;
    }
    .signature-col .accord-mention { font-size: 7.5pt; color: #8891a0; font-style: italic; margin: 0 0 2mm 0; }
    .signature-col .signed-by { font-size: 8pt; color: #4b5563; margin-top: 2mm; }
    .signature-images { display: flex; align-items: flex-end; gap: 4mm; margin-top: 2mm; }
    .signature-images .signature-img { max-height: ${signatureSize}mm; max-width: 50mm; object-fit: contain; }
    .signature-images .stamp-img { max-height: ${stampSize}mm; max-width: ${Math.round(stampSize * 1.2)}mm; object-fit: contain; opacity: 0.95; }

    .qualifications-line { margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #e4e8ef; display: flex; flex-wrap: wrap; gap: 2mm; justify-content: center; }
    .qualif-badge { display: inline-block; padding: 0.5mm 2mm; border: 1px solid #d1d5db; border-radius: 1.5mm; font-size: 7pt; color: #4b5563; background: #f9fafb; }
  `;

  // ─── Overrides selon le style ───
  if (style === "sobre") {
    return baseCss + `
      /* SOBRE : pas de fond coloré en en-tête tableau, juste une ligne */
      table.items thead th { background: white; color: #111; border-bottom: 2px solid ${accentColor}; }
      .total-ttc { background: #111; color: white; }
      .invoice-ref { color: ${accentColor}; }
      .party-block { background: white; border: 1px solid #e8ebf0; }
      .intro { background: none; border-left-color: #111; }
    `;
  }
  if (style === "classique") {
    return baseCss + `
      /* CLASSIQUE BTP : bordures partout, fond gris clair */
      .page { background: #fafbfc; }
      table.items { border: 1.5px solid #111; }
      table.items thead th { background: #f0f2f5; color: #111; border-bottom: 2px solid #111; border-right: 1px solid #c8cdd4; }
      table.items td { border-right: 1px solid #e8ebf0; }
      .total-ttc { border: 2px solid ${accentColor}; background: white; color: ${accentColor}; }
      .party-block { border: 1.5px solid #c8cdd4; background: white; }
      .conditions { border: 1px solid #c8cdd4; background: white; }
    `;
  }
  // moderne (default) → pas d'override
  return baseCss;
}

// ─── Rendu HTML principal ─────────────────────────────────────────────────
function renderInvoiceHtml({ invoice, client, chantier, company, payments = [], pdfSettings = {} }) {
  const snapshot = (invoice.companySnapshot && Object.keys(invoice.companySnapshot).length)
    ? invoice.companySnapshot
    : (company || {});
  const logoUrl = (pdfSettings.pdfShowLogoInHeader !== false) ? logoToDataUrl(snapshot.logoPath) : null;
  const vatEnabled = snapshot.tvaApplicable !== false;
  const style = pdfSettings.pdfStyle || "moderne";
  const accentColor = getAccentColor(pdfSettings);

  // Session S26 — Champs S25 pour le rendu sur facture
  const stampDataUrl = pdfSettings.companyStampDataUrl || "";
  const signatureDataUrl = pdfSettings.companySignatureDataUrl || "";
  const rgeQualifications = Array.isArray(pdfSettings.rgeQualifications) ? pdfSettings.rgeQualifications : [];
  const hasSignatureBlock = stampDataUrl || signatureDataUrl;

  // Session S26.3 — Personnalisation visuelle
  const logoSize = Number(pdfSettings.pdfLogoSizeMm) || 35;
  const stampSize = Number(pdfSettings.pdfStampSizeMm) || 26;
  const signatureSize = Number(pdfSettings.pdfSignatureSizeMm) || 22;
  const stampPosition = pdfSettings.pdfStampPosition || "right";
  const showSignatureBlock = pdfSettings.pdfShowSignatureBlock !== false;
  const showQualifications = pdfSettings.pdfShowQualifications !== false;
  const blockJustify = stampPosition === "left" ? "flex-start"
                     : stampPosition === "center" ? "center"
                     : "flex-end";
  // Session S28 — Police personnalisable
  const pdfFont = pdfSettings.pdfFont || "Inter";

  const totals = computeTotals(
    invoice.items || [],
    invoice.globalDiscountMode || "none",
    Number(invoice.globalDiscountPercent || 0),
    Number(invoice.globalDiscountAmount || 0)
  );

  const totalPaid = Number(invoice.totalPaid || 0);
  const remaining = Math.max(0, totals.totalTTC - totalPaid);
  const isFullyPaid = totalPaid >= totals.totalTTC - 0.01 && totalPaid > 0;
  const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;

  // ─── Badge type facture ─────────────────────────────────────────────
  let typeBadge = "";
  if (invoice.type === "acompte") {
    typeBadge = `<div class="invoice-type-badge" style="background:#f5940920; color:#b45309;">Acompte ${invoice.acomptePercent || 30}%</div>`;
  } else if (invoice.type === "avoir") {
    typeBadge = `<div class="invoice-type-badge" style="background:#ef444420; color:#b91c1c;">AVOIR</div>`;
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

  // ─── Bloc chantier (facultatif) ───────────────────────────
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

  // ─── Rendu des lignes ───────────────────────────────────────────
  const itemsHtml = (invoice.items || []).map((item) => {
    if (item.kind === "section") {
      return `<tr class="section-row"><td colspan="${vatEnabled ? 6 : 5}">${escapeHtml(item.title)}</td></tr>`;
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
    return `<tr class="line-row">
      <td class="col-desc"><div class="line-title">${escapeHtml(item.title || "—")}</div>${descLine}${discountLine}</td>
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
    const lines = [];
    for (const r of [20, 10, 5.5, 0]) {
      const v = totals.vatDetail[r];
      if (v && v.base > 0) {
        lines.push(`<div class="totals-row muted"><span class="label">TVA ${r}% sur ${formatEuros(v.base)}</span><span class="value">${formatEuros(v.tax)}</span></div>`);
      }
    }
    if (lines.length) vatBreakdownHtml = lines.join("");
  }

  // ─── Mentions légales pied de page ───────────────────────────────
  const legalLines = [];
  const legalCompanyLine = [];
  if (snapshot.entreprise) legalCompanyLine.push(escapeHtml(snapshot.entreprise));
  if (snapshot.formeJuridique) legalCompanyLine.push(escapeHtml(snapshot.formeJuridique));
  if (snapshot.siret) legalCompanyLine.push(`SIRET ${escapeHtml(snapshot.siret)}`);
  if (snapshot.tva) legalCompanyLine.push(`TVA ${escapeHtml(snapshot.tva)}`);
  if (snapshot.ape) legalCompanyLine.push(`APE ${escapeHtml(snapshot.ape)}`);
  if (legalCompanyLine.length) legalLines.push(legalCompanyLine.join(" · "));

  if (pdfSettings.pdfShowCompanyAddress !== false) {
    const addr = [snapshot.adresse, [snapshot.codePostal, snapshot.commune].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
    if (addr) legalLines.push(escapeHtml(addr));
  }

  const contactLine = [];
  if (snapshot.tel) contactLine.push(`Tél. ${escapeHtml(snapshot.tel)}`);
  if (snapshot.email) contactLine.push(escapeHtml(snapshot.email));
  if (snapshot.site) contactLine.push(escapeHtml(snapshot.site));
  if (contactLine.length) legalLines.push(contactLine.join(" · "));

  if (!vatEnabled) legalLines.push(`TVA non applicable — art. 293 B du CGI`);

  // Pied de page perso utilisateur
  const customFooter = pdfSettings.pdfFooterText
    ? `<div class="footer-custom">${escapeHtml(pdfSettings.pdfFooterText).replace(/\n/g, "<br/>")}</div>`
    : "";

  // ─── IBAN (si activé) ──────────────────────────────────────────
  const ibanBlock = (pdfSettings.pdfIbanShown !== false && snapshot.rib)
    ? `<div class="iban-block">
        <div class="iban-label">Coordonnées bancaires</div>
        <div class="iban-value">IBAN ${escapeHtml(snapshot.rib)}${snapshot.bic ? ` · BIC ${escapeHtml(snapshot.bic)}` : ""}</div>
      </div>`
    : "";

  // ─── Bloc statut paiement ─────────────────────────────────────
  let paymentStatusBlock = "";
  if (isFullyPaid) {
    paymentStatusBlock = `<div class="payment-status paid">
      <div class="payment-status-row"><strong>FACTURE ACQUITTÉE</strong><span>${formatDate(invoice.paidAt)}</span></div>
    </div>`;
  } else if (isPartiallyPaid) {
    paymentStatusBlock = `<div class="payment-status partial">
      <div class="payment-status-row"><span>Montant total</span><span>${formatEuros(totals.totalTTC)}</span></div>
      <div class="payment-status-row"><span>Payé</span><span>${formatEuros(totalPaid)}</span></div>
      <div class="payment-status-row remaining"><span>Reste à payer</span><span>${formatEuros(remaining)}</span></div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>${getStyleCss(style, accentColor, { logoSize, stampSize, signatureSize, stampPosition, pdfFont })}</style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="company-block">
      ${logoUrl ? `<img src="${logoUrl}" class="company-logo" alt="Logo"/>` : ""}
      <div class="company-name">${escapeHtml(snapshot.entreprise || "—")}</div>
      <div class="company-info">
        ${snapshot.adresse ? `${escapeHtml(snapshot.adresse)}<br/>` : ""}
        ${[snapshot.codePostal, snapshot.commune].filter(Boolean).join(" ")}${snapshot.codePostal || snapshot.commune ? "<br/>" : ""}
        ${snapshot.tel ? `Tél. ${escapeHtml(snapshot.tel)}<br/>` : ""}
        ${snapshot.email ? `${escapeHtml(snapshot.email)}<br/>` : ""}
        ${snapshot.siret ? `<span class="muted">SIRET ${escapeHtml(snapshot.siret)}</span>` : ""}
      </div>
    </div>
    <div class="invoice-block">
      <div class="invoice-label">${invoice.type === "avoir" ? "Avoir" : "Facture"}</div>
      <div class="invoice-ref">${escapeHtml(invoice.reference || "")}</div>
      ${typeBadge}
      <div class="invoice-dates">
        <div>Émise le <strong>${formatDate(invoice.issueDate)}</strong></div>
        ${invoice.dueDate ? `<div>Échéance : <strong>${formatDate(invoice.dueDate)}</strong></div>` : ""}
      </div>
    </div>
  </div>

  <!-- CLIENT / CHANTIER -->
  <div class="parties">
    ${clientBlock ? `<div class="party-block">
      <div class="party-label">Destinataire</div>
      <div class="party-content">${clientBlock}</div>
    </div>` : ""}
    ${chantierBlock ? `<div class="party-block">
      <div class="party-label">Chantier</div>
      <div class="party-content">${chantierBlock}</div>
    </div>` : ""}
  </div>

  <!-- INTRO -->
  ${invoice.introText ? `<div class="intro">${escapeHtml(invoice.introText).replace(/\n/g, "<br/>")}</div>` : ""}

  <!-- TITRE FACTURE -->
  ${invoice.title ? `<h2 style="font-size:13pt; margin:6mm 0 3mm; color:#111;">${escapeHtml(invoice.title)}</h2>` : ""}

  <!-- LIGNES -->
  <table class="items">
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="right">Qté</th>
        <th class="center">Unité</th>
        <th class="right">P.U. HT</th>
        ${vatEnabled ? `<th class="center">TVA</th>` : ""}
        <th class="right">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <!-- TOTAUX -->
  <div class="totals-zone">
    <div class="totals-box">
      <div class="totals-row muted"><span class="label">Sous-total HT</span><span class="value">${formatEuros(totals.subtotalBeforeDiscountHT)}</span></div>
      ${totals.totalLineDiscounts > 0 ? `<div class="totals-row muted"><span class="label">Remises par ligne</span><span class="value">− ${formatEuros(totals.totalLineDiscounts)}</span></div>` : ""}
      ${totals.globalDiscount > 0 ? `<div class="totals-row muted"><span class="label">Remise globale</span><span class="value">− ${formatEuros(totals.globalDiscount)}</span></div>` : ""}
      <div class="totals-divider"></div>
      <div class="totals-row"><span class="label">Total HT</span><span class="value"><strong>${formatEuros(totals.totalHT)}</strong></span></div>
      ${vatBreakdownHtml}
      ${vatEnabled ? `<div class="totals-row"><span class="label">Total TVA</span><span class="value">${formatEuros(totals.totalVAT)}</span></div>` : `<div style="margin-top:3mm; font-size:8pt; color:#8891a0; font-style:italic;">TVA non applicable — art. 293 B du CGI</div>`}
      <div class="total-ttc"><span>Total ${vatEnabled ? "TTC" : "à payer"}</span><span class="value">${formatEuros(totals.totalTTC)}</span></div>
      ${paymentStatusBlock}
    </div>
  </div>

  <!-- IBAN -->
  ${ibanBlock}

  <!-- CONDITIONS -->
  ${invoice.conditionsText ? `<div class="conditions">
    <div class="conditions-label">Conditions de règlement</div>
    ${escapeHtml(invoice.conditionsText).replace(/\n/g, "<br/>")}
  </div>` : ""}

  <!-- SESSION S26 — Bloc cachet/signature pour l'entreprise (factures) -->
  ${(showSignatureBlock && hasSignatureBlock) ? `
    <div class="signature-block">
      <div class="signature-col">
        <h3>Pour ${escapeHtml(snapshot.companyName || "l'entreprise")}</h3>
        <div class="signature-images">
          ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Signature" class="signature-img" />` : ""}
          ${stampDataUrl ? `<img src="${stampDataUrl}" alt="Cachet" class="stamp-img" />` : ""}
        </div>
        <p class="signed-by">
          ${escapeHtml(`${snapshot.leaderFirstName || ""} ${snapshot.leaderLastName || ""}`.trim() || snapshot.companyName || "")}
          ${snapshot.leaderRole ? ` — ${escapeHtml(snapshot.leaderRole)}` : ""}
        </p>
      </div>
    </div>
  ` : ""}

  <!-- FOOTER -->
  <div class="footer">
    ${legalLines.map(l => `<div class="legal-line ${l.includes("non applicable") ? "mention-legale" : ""}">${l}</div>`).join("")}
    ${customFooter}
    ${(showQualifications && rgeQualifications.length > 0) ? `
      <div class="qualifications-line">
        ${rgeQualifications.filter(q => q && q.type).map(q => `
          <span class="qualif-badge">${escapeHtml(q.type)}${q.number ? ` n°${escapeHtml(q.number)}` : ""}</span>
        `).join("")}
      </div>
    ` : ""}
  </div>
</div>
</body>
</html>`;
}

module.exports = { renderInvoiceHtml };
