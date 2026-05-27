import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Quote, Client } from "@btp/types";
import { computeQuoteTotals, formatEuros } from "@/features/quotes/quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// QuotePdfMinimal — Template DEVIS sobre, noir & blanc, style classique BTP
// (inspiré des devis pro français — TerréA / agriculture / artisanat)
// ═══════════════════════════════════════════════════════════════════════════

const BLACK = "#000000";
const GREY_LIGHT = "#f5f5f5";

// Conversion mm → pt (1 mm ≈ 2.835 pt)
const MM_TO_PT = 2.83465;

// Valeurs par défaut SI rien n'est défini dans les paramètres PDF
const DEFAULT_LOGO_SIZE_MM = 50;          // logo plus grand par défaut (avant 70pt ≈ 25mm)
const DEFAULT_COMPANY_NAME_SIZE = 18;     // nom plus discret (avant 26)

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    color: BLACK,
    fontFamily: "Helvetica",
  },

  // ── Header ────────────────────────────────────────────────────────────
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  companyAddress: {
    fontSize: 9,
    marginBottom: 18,
  },
  companyDot: { fontSize: 14, marginBottom: 12 },

  // ── Bandeau infos + destinataire ─────────────────────────────────────
  topRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 18,
  },
  topCol: { flex: 1 },

  infoTable: {
    borderWidth: 0.6,
    borderColor: BLACK,
  },
  infoHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: BLACK,
  },
  infoHeaderCell: {
    padding: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    borderRightWidth: 0.6,
    borderRightColor: BLACK,
  },
  infoCellLast: { borderRightWidth: 0 },
  infoBodyRow: { flexDirection: "row" },
  infoBodyCell: {
    padding: 4,
    fontSize: 9,
    textAlign: "center",
    borderRightWidth: 0.6,
    borderRightColor: BLACK,
  },
  serviceLine: {
    fontSize: 9,
    marginTop: 4,
    fontStyle: "italic",
  },

  recipientBox: {
    borderWidth: 0.6,
    borderColor: BLACK,
    padding: 8,
    minHeight: 90,
  },
  recipientLine: {
    fontSize: 10,
    lineHeight: 1.4,
  },

  // ── Titre ──────────────────────────────────────────────────────────────
  bigTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 4,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
  },

  // ── Table prestations ─────────────────────────────────────────────────
  table: {
    borderWidth: 0.6,
    borderColor: BLACK,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: BLACK,
  },
  th: {
    padding: 5,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 0.6,
    borderRightColor: BLACK,
  },
  thLast: { borderRightWidth: 0 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderBottomColor: BLACK,
    minHeight: 18,
  },
  td: {
    padding: 4,
    fontSize: 9,
    borderRightWidth: 0.6,
    borderRightColor: BLACK,
  },
  tdLast: { borderRightWidth: 0 },
  tdQty: { width: "8%", textAlign: "right" },
  tdDesc: { width: "62%" },
  tdPu: { width: "12%", textAlign: "right" },
  tdMt: { width: "13%", textAlign: "right" },
  tdT: { width: "5%", textAlign: "center" },

  metaRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottomWidth: 0.4,
    borderBottomColor: BLACK,
  },
  metaText: {
    fontSize: 9,
    flex: 1,
  },
  metaTextBold: {
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
  },

  noteRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  noteText: { fontSize: 9 },

  sectionRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 5,
    backgroundColor: GREY_LIGHT,
    borderBottomWidth: 0.4,
    borderBottomColor: BLACK,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },

  // ── Totaux ────────────────────────────────────────────────────────────
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  totalsBox: {
    width: 240,
    borderWidth: 0.6,
    borderColor: BLACK,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    borderBottomWidth: 0.4,
    borderBottomColor: BLACK,
  },
  totalLineLast: { borderBottomWidth: 0 },
  totalLabel: { fontFamily: "Helvetica-Bold" },

  // ── Règlement / mentions ─────────────────────────────────────────────
  paymentLine: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 8,
  },

  noticeBox: {
    backgroundColor: GREY_LIGHT,
    padding: 8,
    marginBottom: 10,
  },
  noticeText: {
    fontSize: 8,
    lineHeight: 1.5,
  },

  legalText: {
    fontSize: 7,
    color: "#333333",
    lineHeight: 1.4,
    marginTop: 8,
  },

  signatureRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 20,
  },
  signatureBox: {
    flex: 1,
    minHeight: 60,
    borderWidth: 0.6,
    borderColor: BLACK,
    padding: 6,
  },
  signatureLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginBottom: 4,
  },

  pageNumber: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7,
  },
});

interface Props {
  quote: Quote;
  client: Client | undefined;
  company?: Record<string, unknown>;
}

function fmtDate(s: string): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

/** Code TVA pour la colonne T (compact, à la TerréA) */
function vatCode(rate: number): string {
  if (rate === 20) return "1";
  if (rate === 10) return "2";
  if (rate === 5.5) return "3";
  if (rate === 0) return "4";
  return "—";
}

function clientName(c: Client | undefined): string {
  if (!c) return "—";
  if (c.type === "pro" && c.companyName) return c.companyName;
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
}

function clientLines(c: Client | undefined): string[] {
  if (!c) return [];
  const lines: string[] = [];
  if (c.addressLine1) lines.push(c.addressLine1);
  if (c.addressLine2) lines.push(c.addressLine2);
  const cityLine = [c.postalCode, c.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (c.country && c.country !== "France") lines.push(c.country);
  return lines;
}

function get(company: Record<string, unknown>, k: string): string {
  return typeof company[k] === "string" ? (company[k] as string) : "";
}

function computeLineTotal(item: { quantity: number; unitPriceHT: number; discountMode: string; discountPercent: number; discountAmount: number }): number {
  const subtotal = item.quantity * item.unitPriceHT;
  if (item.discountMode === "percent") return subtotal * (1 - (item.discountPercent ?? 0) / 100);
  if (item.discountMode === "amount") return Math.max(0, subtotal - (item.discountAmount ?? 0));
  return subtotal;
}

export function QuotePdfMinimal({ quote, client, company = {} }: Props) {
  const totals = computeQuoteTotals(quote);
  const companyName = get(company, "companyName") || get(company, "name") || "Mon entreprise";
  const companyAddress = [
    get(company, "addressLine1"),
    [get(company, "postalCode"), get(company, "city")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" - ");

  // Tailles configurables depuis Paramètres > Documents
  const logoSizeMm = Number(company.pdfLogoSizeMm) || DEFAULT_LOGO_SIZE_MM;
  const logoHeightPt = logoSizeMm * MM_TO_PT;
  const logoWidthPt = logoHeightPt * 1.6;      // logo horizontal jusqu'à 1.6× large
  const companyNameSize = Number(company.pdfCompanyNameSize) || DEFAULT_COMPANY_NAME_SIZE;

  const dynStyles = {
    companyLogo: {
      height: logoHeightPt,
      width: logoWidthPt,
      objectFit: "contain" as const,
    },
    companyName: {
      fontSize: companyNameSize,
      fontFamily: "Helvetica-Bold",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
  };

  const cName = clientName(client);
  const cLines = clientLines(client);

  // N° client : compte auxiliaire (411xxx) attribué par la compta partie
  // double si présent, sinon fallback sur les 6 derniers chars de l'id.
  const clientNum =
    client?.accountNumber ||
    (client?.id ?? "").slice(-6).toUpperCase() ||
    "—";
  const folio = "1 / 1";

  return (
    <Document title={quote.reference || "Devis"} author={companyName}>
      <Page size="A4" style={styles.page}>
        {/* Header company */}
        <View style={styles.headerRow}>
          {typeof company.logoDataUrl === "string" && company.logoDataUrl && (
            <Image style={dynStyles.companyLogo} src={company.logoDataUrl as string} />
          )}
          <Text style={dynStyles.companyName}>{companyName}</Text>
        </View>
        {companyAddress && <Text style={styles.companyAddress}>{companyAddress}</Text>}
        <Text style={styles.companyDot}>•</Text>

        {/* Top row: infos + recipient */}
        <View style={styles.topRow}>
          <View style={styles.topCol}>
            <View style={styles.infoTable}>
              <View style={styles.infoHeaderRow}>
                <Text style={[styles.infoHeaderCell, { width: "25%" }]}>Date</Text>
                <Text style={[styles.infoHeaderCell, { width: "25%" }]}>N° Client</Text>
                <Text style={[styles.infoHeaderCell, { width: "30%" }]}>N° Devis</Text>
                <Text
                  style={[
                    styles.infoHeaderCell,
                    styles.infoCellLast,
                    { width: "20%" },
                  ]}
                >
                  Folio
                </Text>
              </View>
              <View style={styles.infoBodyRow}>
                <Text style={[styles.infoBodyCell, { width: "25%" }]}>
                  {fmtDate(quote.issueDate)}
                </Text>
                <Text style={[styles.infoBodyCell, { width: "25%" }]}>{clientNum}</Text>
                <Text style={[styles.infoBodyCell, { width: "30%" }]}>
                  {quote.reference || "—"}
                </Text>
                <Text
                  style={[
                    styles.infoBodyCell,
                    styles.infoCellLast,
                    { width: "20%" },
                  ]}
                >
                  {folio}
                </Text>
              </View>
            </View>
            {get(company, "siret") && (
              <Text style={styles.serviceLine}>SIRET : {get(company, "siret")}</Text>
            )}
          </View>

          <View style={styles.topCol}>
            <View style={styles.recipientBox}>
              <Text style={[styles.recipientLine, { fontFamily: "Helvetica-Bold" }]}>
                {cName}
              </Text>
              {cLines.map((l, i) => (
                <Text key={i} style={styles.recipientLine}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Big centered title */}
        <Text style={styles.bigTitle}>D E V I S</Text>

        {/* Main table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.tdQty]}>Qté</Text>
            <Text style={[styles.th, styles.tdDesc]}>Description</Text>
            <Text style={[styles.th, styles.tdPu]}>PU NET €</Text>
            <Text style={[styles.th, styles.tdMt]}>MT H.T. €</Text>
            <Text style={[styles.th, styles.thLast, styles.tdT]}>T</Text>
          </View>

          {/* Meta sub-header : numéro devis & validité */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              <Text style={styles.metaTextBold}>
                Devis N° {quote.reference} du {fmtDate(quote.issueDate)}
              </Text>
              {get(company, "phone") && `\nV/Tél: ${get(company, "phone")}`}
              {quote.validUntil && `\nValidité Offre : ${fmtDate(quote.validUntil)}`}
            </Text>
          </View>

          {/* Intro libre (si renseigné) */}
          {quote.introText && (
            <View style={styles.noteRow}>
              <Text style={styles.noteText}>{quote.introText}</Text>
            </View>
          )}

          {/* Items */}
          {quote.items.map((item, idx) => {
            if (item.kind === "section") {
              return (
                <View key={item.id || idx} style={styles.sectionRow} wrap={false}>
                  <Text style={styles.sectionTitle}>{item.title || "Section"}</Text>
                </View>
              );
            }
            return (
              <View key={item.id || idx} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, styles.tdQty]}>{item.quantity}</Text>
                <View style={[styles.td, styles.tdDesc]}>
                  {item.title && (
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.title}</Text>
                  )}
                  {item.description && <Text>{item.description}</Text>}
                </View>
                <Text style={[styles.td, styles.tdPu]}>
                  {formatEuros(item.unitPriceHT)}
                </Text>
                <Text style={[styles.td, styles.tdMt]}>
                  {formatEuros(computeLineTotal(item))}
                </Text>
                <Text style={[styles.td, styles.tdLast, styles.tdT]}>
                  {vatCode(item.vatRate)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Totaux à droite */}
        <View style={styles.totalsRow}>
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text>{formatEuros(totals.totalHT)}</Text>
            </View>
            {(Object.entries(totals.vatDetail) as [string, { base: number; tax: number }][])
              .filter(([, v]) => v.tax > 0)
              .map(([rate, v]) => (
                <View key={rate} style={styles.totalLine}>
                  <Text>T.V.A. {rate}%</Text>
                  <Text>{formatEuros(v.tax)}</Text>
                </View>
              ))}
            <View style={[styles.totalLine, styles.totalLineLast]}>
              <Text style={styles.totalLabel}>Total TTC</Text>
              <Text style={styles.totalLabel}>{formatEuros(totals.totalTTC)}</Text>
            </View>
          </View>
        </View>

        {/* Règlement */}
        <Text style={styles.paymentLine}>
          Règlement : {get(company, "paymentTerms") || "Acompte de 30 % à la commande, solde à la fin des travaux"}
        </Text>

        {/* Notice / conditions optionnelle */}
        {quote.conditionsText && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{quote.conditionsText}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Bon pour accord — Le client</Text>
            <Text style={{ fontSize: 8 }}>
              Date et signature précédées de la mention « Bon pour accord »
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>L'entreprise</Text>
            <Text style={{ fontSize: 8 }}>{companyName}</Text>
          </View>
        </View>

        {/* Mentions légales */}
        {quote.footerText ? (
          <Text style={styles.legalText}>{quote.footerText}</Text>
        ) : (
          <Text style={styles.legalText}>
            Réserve de Propriété : Le vendeur se réserve la propriété des marchandises
            jusqu'au complet paiement du prix par l'acheteur. Aucune réclamation ne pourra
            être admise si elle n'est pas formulée par écrit dans les 8 jours de la
            réception. Aucune pièce ne sera reprise ou échangée après 8 jours suivant la
            livraison. Tout avoir est déductible d'un autre achat dans l'année et ne donne
            pas lieu à remboursement.
          </Text>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
