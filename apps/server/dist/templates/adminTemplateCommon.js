"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// adminTemplateCommon.js — Helpers partagés pour les templates de docs admin
// Style "très administratif" avec mentions légales en pied de page
// ═══════════════════════════════════════════════════════════════════════════
function escapeHtml(value) {
    if (value === undefined || value === null)
        return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function formatDate(iso) {
    if (!iso)
        return "—";
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime()))
            return iso;
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    }
    catch {
        return iso;
    }
}
function formatDateShort(iso) {
    if (!iso)
        return "—";
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime()))
            return iso;
        return d.toLocaleDateString("fr-FR");
    }
    catch {
        return iso;
    }
}
function formatEuro(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }) + " €";
}
function nl2br(text) {
    if (!text)
        return "";
    return escapeHtml(text).replace(/\n/g, "<br>");
}
// CSS de base partagé entre tous les templates admin
const BASE_CSS = `
  @page {
    size: A4;
    margin: 18mm 16mm 22mm 16mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1f2937;
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 16pt;
    font-weight: 700;
    margin: 0 0 4mm 0;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #111827;
  }
  h2 {
    font-size: 11.5pt;
    font-weight: 700;
    margin: 6mm 0 2mm 0;
    color: #111827;
    border-bottom: 1px solid #d1d5db;
    padding-bottom: 1mm;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  h3 {
    font-size: 10.5pt;
    font-weight: 700;
    margin: 4mm 0 1mm 0;
    color: #374151;
  }
  p { margin: 1mm 0; }
  strong { font-weight: 600; }

  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1f2937;
    padding-bottom: 4mm;
    margin-bottom: 6mm;
  }
  .doc-header .company {
    flex: 1;
    font-size: 9pt;
    line-height: 1.3;
  }
  .doc-header .company .company-name {
    font-weight: 700;
    font-size: 11pt;
    text-transform: uppercase;
    margin-bottom: 1mm;
  }
  .doc-header .reference {
    text-align: right;
    font-size: 9pt;
    color: #4b5563;
  }
  .doc-header .reference .ref-label {
    font-weight: 600;
    color: #1f2937;
  }
  .doc-header .reference .ref-value {
    font-family: "Courier New", monospace;
    font-size: 11pt;
    font-weight: 700;
    color: #111827;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4mm;
    margin: 3mm 0;
  }
  .info-block {
    border: 1px solid #d1d5db;
    border-radius: 2mm;
    padding: 3mm;
    background: #f9fafb;
  }
  .info-block .label {
    font-size: 8.5pt;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1mm;
  }
  .info-block .content {
    font-size: 10pt;
  }
  .info-block .content p {
    margin: 0.5mm 0;
  }

  .text-block {
    border: 1px solid #d1d5db;
    border-radius: 2mm;
    padding: 3mm;
    background: #ffffff;
    margin: 2mm 0;
  }

  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 3mm 0;
    font-size: 9.5pt;
  }
  table.data-table th {
    background: #1f2937;
    color: white;
    padding: 2mm 3mm;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  table.data-table td {
    padding: 2mm 3mm;
    border-bottom: 1px solid #e5e7eb;
  }
  table.data-table tr:nth-child(even) td {
    background: #f9fafb;
  }
  table.data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  table.data-table .center { text-align: center; }

  .commitment-list {
    list-style: none;
    padding: 0;
    margin: 2mm 0;
  }
  .commitment-list li {
    padding: 1.5mm 0 1.5mm 8mm;
    position: relative;
    font-size: 10pt;
  }
  .commitment-list li::before {
    content: "☑";
    position: absolute;
    left: 1mm;
    top: 1mm;
    font-size: 11pt;
    color: #1f2937;
  }

  .signature-zone {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm;
    margin: 8mm 0 4mm 0;
  }
  .signature-block {
    border: 1px solid #1f2937;
    border-radius: 2mm;
    padding: 3mm;
    min-height: 30mm;
  }
  .signature-block .sig-label {
    font-size: 9pt;
    font-weight: 700;
    margin-bottom: 1mm;
    text-transform: uppercase;
  }
  .signature-block .sig-meta {
    font-size: 8.5pt;
    color: #4b5563;
  }
  .signature-block .sig-mention {
    font-size: 8pt;
    color: #6b7280;
    font-style: italic;
    margin-top: 1mm;
  }

  .legal-footer {
    position: fixed;
    bottom: 8mm;
    left: 16mm;
    right: 16mm;
    border-top: 1px solid #d1d5db;
    padding-top: 2mm;
    font-size: 7.5pt;
    color: #6b7280;
    line-height: 1.3;
    text-align: center;
  }
  .legal-footer .law-ref {
    font-weight: 600;
    color: #4b5563;
  }

  .badge {
    display: inline-block;
    padding: 0.5mm 2mm;
    border: 1px solid currentColor;
    border-radius: 1mm;
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .badge-success { color: #047857; background: #d1fae5; border-color: #10b981; }
  .badge-warning { color: #92400e; background: #fef3c7; border-color: #f59e0b; }
  .badge-danger  { color: #b91c1c; background: #fee2e2; border-color: #ef4444; }
  .badge-info    { color: #1e40af; background: #dbeafe; border-color: #3b82f6; }
  .badge-neutral { color: #374151; background: #f3f4f6; border-color: #6b7280; }

  .reserve-item {
    border-left: 3px solid #f59e0b;
    background: #fffbeb;
    padding: 2.5mm;
    margin: 2mm 0;
    border-radius: 0 2mm 2mm 0;
  }
  .reserve-item .reserve-num {
    font-weight: 700;
    color: #92400e;
    font-size: 9pt;
    margin-bottom: 1mm;
  }
  .reserve-item .reserve-desc {
    font-size: 10pt;
    margin-bottom: 1mm;
  }
  .reserve-item .reserve-meta {
    font-size: 8.5pt;
    color: #78350f;
  }

  .important-notice {
    border: 2px solid #1f2937;
    border-radius: 2mm;
    padding: 3mm;
    margin: 3mm 0;
    background: #f3f4f6;
    font-size: 9.5pt;
  }
  .important-notice strong {
    text-transform: uppercase;
    font-size: 9pt;
    letter-spacing: 0.3px;
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Variante COMPACT-A4 — force tout le document à tenir sur une seule
   * feuille A4. Active via <body class="compact-a4"> (utilisé par le PV
   * de réception). TVA / DC4 gardent leur layout aéré multi-pages.
   * Les overrides réduisent uniformément tailles de police, marges et
   * paddings pour gagner ~40% de hauteur.
   * ─────────────────────────────────────────────────────────────────── */
  body.compact-a4 {
    font-size: 8.5pt;
    line-height: 1.3;
  }
  body.compact-a4 h1 { font-size: 13pt; margin: 0 0 2mm 0; }
  body.compact-a4 h2 {
    font-size: 9.5pt;
    margin: 3mm 0 1mm 0;
    padding-bottom: 0.5mm;
  }
  body.compact-a4 h3 { font-size: 9pt; margin: 2mm 0 0.5mm 0; }
  body.compact-a4 p { margin: 0.5mm 0; }

  body.compact-a4 .doc-header {
    padding-bottom: 2mm;
    margin-bottom: 3mm;
  }
  body.compact-a4 .doc-header .company { font-size: 8pt; line-height: 1.25; }
  body.compact-a4 .doc-header .company .company-name {
    font-size: 9.5pt;
    margin-bottom: 0.5mm;
  }
  body.compact-a4 .doc-header .reference { font-size: 8pt; }
  body.compact-a4 .doc-header .reference .ref-value { font-size: 9.5pt; }

  body.compact-a4 .info-grid { gap: 2mm; margin: 1.5mm 0; }
  body.compact-a4 .info-block { padding: 2mm; }
  body.compact-a4 .info-block .label { font-size: 7.5pt; margin-bottom: 0.5mm; }
  body.compact-a4 .info-block .content { font-size: 8.5pt; }

  body.compact-a4 .text-block { padding: 2mm; margin: 1mm 0; }

  body.compact-a4 .important-notice {
    padding: 2mm;
    margin: 2mm 0;
    font-size: 8pt;
  }
  body.compact-a4 .important-notice strong { font-size: 8.5pt; }

  body.compact-a4 .reserve-item { padding: 1.5mm; margin: 1mm 0; }
  body.compact-a4 .reserve-item .reserve-num { font-size: 8pt; }
  body.compact-a4 .reserve-item .reserve-desc { font-size: 8.5pt; margin-bottom: 0.5mm; }
  body.compact-a4 .reserve-item .reserve-meta { font-size: 7.5pt; }

  body.compact-a4 .signature-zone {
    margin: 4mm 0 2mm 0;
    gap: 4mm;
  }
  body.compact-a4 .signature-block {
    padding: 2mm;
    min-height: 22mm;
  }
  body.compact-a4 .signature-block .sig-label { font-size: 8pt; margin-bottom: 0.5mm; }
  body.compact-a4 .signature-block .sig-meta { font-size: 7.5pt; }
  body.compact-a4 .signature-block .sig-mention { font-size: 7pt; margin-top: 0.5mm; }
  body.compact-a4 .signature-block img {
    max-width: 50mm !important;
    max-height: 18mm !important;
    margin: 1mm 0 !important;
  }

  body.compact-a4 .legal-footer {
    position: static;
    margin-top: 3mm;
    padding-top: 1mm;
    font-size: 6.5pt;
    left: auto;
    right: auto;
    bottom: auto;
  }

  /* Bloc "Mentions légales" en fin de page — liste à puces compactée */
  body.compact-a4 .text-block ul {
    margin: 0.5mm 0 0 4mm;
    padding: 0;
    font-size: 7.5pt;
    line-height: 1.25;
  }
  body.compact-a4 .text-block ul li { margin: 0.2mm 0; }

  /* Évite qu'un bloc principal soit cassé en deux pages si jamais le
   * contenu déborde malgré la compaction. */
  body.compact-a4 .info-block,
  body.compact-a4 .signature-block,
  body.compact-a4 .reserve-item,
  body.compact-a4 .important-notice {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Marges @page plus serrées pour la variante compacte */
  @media print {
    body.compact-a4 { font-size: 8.5pt; }
  }
`;
// Marges @page spécifiques pour la variante compact-a4 (override @page racine).
// On exporte un bloc CSS séparé que le template peut insérer dans son <style>
// pour que les règles @page prennent effet (les @page imbriquées ne marchent
// pas — il faut les déclarer au niveau racine du document).
const COMPACT_A4_PAGE_CSS = `
  @page {
    size: A4;
    margin: 10mm 12mm 12mm 12mm;
  }
`;
function renderCompanyHeader(company) {
    const c = company || {};
    const lines = [];
    if (c.companyName)
        lines.push(`<div class="company-name">${escapeHtml(c.companyName)}</div>`);
    if (c.legalForm)
        lines.push(`<div>${escapeHtml(c.legalForm)}${c.capital ? " au capital de " + escapeHtml(c.capital) : ""}</div>`);
    const addr = [
        c.addressLine1,
        c.addressLine2,
        [c.postalCode, c.city].filter(Boolean).join(" "),
    ].filter(Boolean).join("<br>");
    if (addr)
        lines.push(`<div>${addr}</div>`);
    if (c.siret)
        lines.push(`<div>SIRET : ${escapeHtml(c.siret)}</div>`);
    if (c.tvaNumber)
        lines.push(`<div>TVA : ${escapeHtml(c.tvaNumber)}</div>`);
    if (c.email)
        lines.push(`<div>${escapeHtml(c.email)}</div>`);
    if (c.phone)
        lines.push(`<div>${escapeHtml(c.phone)}</div>`);
    return lines.join("");
}
function renderClientName(client) {
    if (!client)
        return "—";
    if (client.type === "particulier") {
        const civility = client.civility ? client.civility + " " : "";
        return escapeHtml(`${civility}${client.firstName || ""} ${client.lastName || ""}`.trim());
    }
    return escapeHtml(client.companyName || `${client.firstName || ""} ${client.lastName || ""}`.trim());
}
function renderClientAddress(client) {
    if (!client)
        return "—";
    const lines = [
        client.addressLine1,
        client.addressLine2,
        [client.postalCode, client.city].filter(Boolean).join(" "),
    ].filter(Boolean);
    return lines.length > 0 ? lines.map(escapeHtml).join("<br>") : "—";
}
module.exports = {
    escapeHtml,
    formatDate,
    formatDateShort,
    formatEuro,
    nl2br,
    BASE_CSS,
    COMPACT_A4_PAGE_CSS,
    renderCompanyHeader,
    renderClientName,
    renderClientAddress,
};
