import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Invoice, Client } from "@btp/types";
import { computeQuoteTotals, formatEuros } from "@/features/quotes/quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// InvoicePdfMinimal — Template FACTURE sobre noir & blanc
// Version factures du QuotePdfMinimal, avec specs paiement.
// ═══════════════════════════════════════════════════════════════════════════

const BLACK = "#000000";
const GREY_LIGHT = "#f5f5f5";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, color: BLACK, fontFamily: "Helvetica" },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  companyAddress: { fontSize: 9, marginBottom: 18 },
  companyDot: { fontSize: 14, marginBottom: 12 },

  topRow: { flexDirection: "row", gap: 16, marginBottom: 18 },
  topCol: { flex: 1 },

  infoTable: { borderWidth: 0.6, borderColor: BLACK },
  infoHeaderRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: BLACK },
  infoHeaderCell: {
    padding: 4, fontSize: 8, fontFamily: "Helvetica-Bold",
    textAlign: "center", borderRightWidth: 0.6, borderRightColor: BLACK,
  },
  infoCellLast: { borderRightWidth: 0 },
  infoBodyRow: { flexDirection: "row" },
  infoBodyCell: {
    padding: 4, fontSize: 9, textAlign: "center",
    borderRightWidth: 0.6, borderRightColor: BLACK,
  },
  serviceLine: { fontSize: 9, marginTop: 4, fontStyle: "italic" },

  recipientBox: {
    borderWidth: 0.6, borderColor: BLACK, padding: 8, minHeight: 90,
  },
  recipientLine: { fontSize: 10, lineHeight: 1.4 },

  bigTitle: {
    fontSize: 18, fontFamily: "Helvetica-Bold",
    letterSpacing: 4, textAlign: "center",
    marginTop: 6, marginBottom: 14,
  },

  table: { borderWidth: 0.6, borderColor: BLACK },
  tableHeader: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: BLACK },
  th: {
    padding: 5, fontSize: 9, fontFamily: "Helvetica-Bold",
    borderRightWidth: 0.6, borderRightColor: BLACK,
  },
  thLast: { borderRightWidth: 0 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: BLACK, minHeight: 18 },
  td: { padding: 4, fontSize: 9, borderRightWidth: 0.6, borderRightColor: BLACK },
  tdLast: { borderRightWidth: 0 },
  tdQty: { width: "8%", textAlign: "right" },
  tdDesc: { width: "62%" },
  tdPu: { width: "12%", textAlign: "right" },
  tdMt: { width: "13%", textAlign: "right" },
  tdT: { width: "5%", textAlign: "center" },

  metaRow: {
    flexDirection: "row", paddingHorizontal: 4, paddingVertical: 4,
    borderBottomWidth: 0.4, borderBottomColor: BLACK,
  },
  metaText: { fontSize: 9, flex: 1 },
  metaTextBold: { fontFamily: "Helvetica-Bold", textDecoration: "underline" },

  sectionRow: {
    flexDirection: "row", paddingHorizontal: 4, paddingVertical: 5,
    backgroundColor: GREY_LIGHT, borderBottomWidth: 0.4, borderBottomColor: BLACK,
  },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 1 },

  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  totalsBox: { width: 250, borderWidth: 0.6, borderColor: BLACK },
  totalLine: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 8, paddingVertical: 4, fontSize: 9,
    borderBottomWidth: 0.4, borderBottomColor: BLACK,
  },
  totalLineLast: { borderBottomWidth: 0 },
  totalLabel: { fontFamily: "Helvetica-Bold" },
  totalLineFinal: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 8, paddingVertical: 6, fontSize: 11,
    fontFamily: "Helvetica-Bold",
    backgroundColor: BLACK, color: "#ffffff",
  },
  paidLine: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 8, paddingVertical: 5, fontSize: 9,
    borderBottomWidth: 0.4, borderBottomColor: BLACK,
    backgroundColor: GREY_LIGHT,
  },

  paymentLine: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 8 },

  statusStamp: {
    position: "absolute",
    top: 100,
    right: 30,
    borderWidth: 2,
    borderColor: BLACK,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    transform: "rotate(-8deg)",
  },

  noticeBox: { backgroundColor: GREY_LIGHT, padding: 8, marginBottom: 10 },
  noticeText: { fontSize: 8, lineHeight: 1.5 },
  legalText: { fontSize: 7, color: "#333333", lineHeight: 1.4, marginTop: 8 },

  pageNumber: {
    position: "absolute", bottom: 14, left: 0, right: 0,
    textAlign: "center", fontSize: 7,
  },
});

interface Props {
  invoice: Invoice;
  client: Client | undefined;
  company?: Record<string, unknown>;
}

function fmtDate(s: string): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return s; }
}

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

const TYPE_LABELS: Record<string, string> = {
  standard: "F A C T U R E",
  acompte: "FACTURE D'ACOMPTE",
  avoir: "A V O I R",
};

export function InvoicePdfMinimal({ invoice, client, company = {} }: Props) {
  const totals = computeQuoteTotals(invoice as unknown as Parameters<typeof computeQuoteTotals>[0]);
  const totalPaid = invoice.totalPaid ?? 0;
  const remainingDue = Math.max(0, totals.totalTTC - totalPaid);
  const isPaid = remainingDue <= 0.01 && totals.totalTTC > 0;
  const companyName = get(company, "companyName") || get(company, "name") || "Mon entreprise";
  const companyAddress = [
    get(company, "addressLine1"),
    [get(company, "postalCode"), get(company, "city")].filter(Boolean).join(" "),
  ].filter(Boolean).join(" - ");

  const cName = clientName(client);
  const cLines = clientLines(client);
  // N° client : compte auxiliaire (411xxx) si présent, sinon fallback id
  const clientNum =
    client?.accountNumber ||
    (client?.id ?? "").slice(-6).toUpperCase() ||
    "—";

  // Tailles configurables (Paramètres > Documents)
  const MM_TO_PT = 2.83465;
  const logoSizeMm = Number(company.pdfLogoSizeMm) || 50;
  const logoHeightPt = logoSizeMm * MM_TO_PT;
  const logoWidthPt = logoHeightPt * 1.6;
  const companyNameSize = Number(company.pdfCompanyNameSize) || 18;
  const dynStyles = {
    companyLogo: { width: logoWidthPt, height: logoHeightPt, objectFit: "contain" as const },
    companyName: {
      fontSize: companyNameSize,
      fontFamily: "Helvetica-Bold",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
  };

  return (
    <Document title={invoice.reference || "Facture"} author={companyName}>
      <Page size="A4" style={styles.page}>
        {/* Tampon "PAYÉE" en haut à droite si payée */}
        {isPaid && <Text style={styles.statusStamp}>P A Y É E</Text>}

        <View style={styles.headerRow}>
          {typeof company.logoDataUrl === "string" && company.logoDataUrl && (
            <Image style={dynStyles.companyLogo} src={company.logoDataUrl as string} />
          )}
          <Text style={dynStyles.companyName}>{companyName}</Text>
        </View>
        {companyAddress && <Text style={styles.companyAddress}>{companyAddress}</Text>}
        <Text style={styles.companyDot}>•</Text>

        <View style={styles.topRow}>
          <View style={styles.topCol}>
            <View style={styles.infoTable}>
              <View style={styles.infoHeaderRow}>
                <Text style={[styles.infoHeaderCell, { width: "25%" }]}>Date</Text>
                <Text style={[styles.infoHeaderCell, { width: "25%" }]}>N° Client</Text>
                <Text style={[styles.infoHeaderCell, { width: "30%" }]}>N° Facture</Text>
                <Text style={[styles.infoHeaderCell, styles.infoCellLast, { width: "20%" }]}>
                  Échéance
                </Text>
              </View>
              <View style={styles.infoBodyRow}>
                <Text style={[styles.infoBodyCell, { width: "25%" }]}>{fmtDate(invoice.issueDate)}</Text>
                <Text style={[styles.infoBodyCell, { width: "25%" }]}>{clientNum}</Text>
                <Text style={[styles.infoBodyCell, { width: "30%" }]}>{invoice.reference || "—"}</Text>
                <Text style={[styles.infoBodyCell, styles.infoCellLast, { width: "20%" }]}>
                  {fmtDate(invoice.dueDate) || "—"}
                </Text>
              </View>
            </View>
            {get(company, "siret") && <Text style={styles.serviceLine}>SIRET : {get(company, "siret")}</Text>}
          </View>

          <View style={styles.topCol}>
            <View style={styles.recipientBox}>
              <Text style={[styles.recipientLine, { fontFamily: "Helvetica-Bold" }]}>{cName}</Text>
              {cLines.map((l, i) => <Text key={i} style={styles.recipientLine}>{l}</Text>)}
            </View>
          </View>
        </View>

        <Text style={styles.bigTitle}>{TYPE_LABELS[invoice.type] ?? "F A C T U R E"}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.tdQty]}>Qté</Text>
            <Text style={[styles.th, styles.tdDesc]}>Description</Text>
            <Text style={[styles.th, styles.tdPu]}>PU NET €</Text>
            <Text style={[styles.th, styles.tdMt]}>MT H.T. €</Text>
            <Text style={[styles.th, styles.thLast, styles.tdT]}>T</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              <Text style={styles.metaTextBold}>
                {(TYPE_LABELS[invoice.type] ?? "Facture").replace(/ /g, "")} N° {invoice.reference} du {fmtDate(invoice.issueDate)}
              </Text>
              {get(company, "phone") && `\nV/Tél : ${get(company, "phone")}`}
              {invoice.type === "acompte" && invoice.acomptePercent > 0 && `\nAcompte de ${invoice.acomptePercent}%`}
            </Text>
          </View>

          {invoice.introText && (
            <View style={[styles.metaRow, { paddingVertical: 6 }]}>
              <Text style={{ fontSize: 9 }}>{invoice.introText}</Text>
            </View>
          )}

          {invoice.items.map((item, idx) => {
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
                  {item.title && <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.title}</Text>}
                  {item.description && <Text>{item.description}</Text>}
                </View>
                <Text style={[styles.td, styles.tdPu]}>{formatEuros(item.unitPriceHT)}</Text>
                <Text style={[styles.td, styles.tdMt]}>{formatEuros(computeLineTotal(item))}</Text>
                <Text style={[styles.td, styles.tdLast, styles.tdT]}>{vatCode(item.vatRate)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totaux */}
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
            <View style={styles.totalLineFinal}>
              <Text>Total TTC</Text>
              <Text>{formatEuros(totals.totalTTC)}</Text>
            </View>
            {totalPaid > 0 && (
              <View style={styles.paidLine}>
                <Text>Déjà payé</Text>
                <Text>− {formatEuros(totalPaid)}</Text>
              </View>
            )}
            {!isPaid && totals.totalTTC > 0 && (
              <View style={[styles.totalLine, styles.totalLineLast, { backgroundColor: "#fee2e2" }]}>
                <Text style={styles.totalLabel}>Reste dû</Text>
                <Text style={styles.totalLabel}>{formatEuros(remainingDue)}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.paymentLine}>
          Règlement : {invoice.dueDate ? `À régler avant le ${fmtDate(invoice.dueDate)}` : `Sous ${invoice.paymentTermsDays || 30} jours`}
        </Text>

        {invoice.conditionsText && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{invoice.conditionsText}</Text>
          </View>
        )}

        {invoice.footerText ? (
          <Text style={styles.legalText}>{invoice.footerText}</Text>
        ) : (
          <Text style={styles.legalText}>
            Pénalités de retard : 3 fois le taux d'intérêt légal en vigueur (article L.441-10 du
            Code de commerce). Indemnité forfaitaire pour frais de recouvrement : 40 €.
            Paiement à réception sauf accord particulier.
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
