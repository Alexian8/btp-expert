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
// QuotePdfClassique — Template DEVIS classique BTP
// Style traditionnel : police Times serif, bordures épaisses, encadrés
// double-ligne. Inspiré des devis pro BTP papier des années 90-2000.
// ═══════════════════════════════════════════════════════════════════════════

const BLACK = "#000000";
const ACCENT = "#7c2d12"; // brun terre, esprit BTP

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    color: BLACK,
    fontFamily: "Times-Roman",
  },

  // Header en double bordure
  outerFrame: {
    borderWidth: 2,
    borderColor: BLACK,
    padding: 4,
    marginBottom: 14,
  },
  innerFrame: {
    borderWidth: 1,
    borderColor: BLACK,
    padding: 12,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flex: 1 },
  companyTagline: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#444",
    marginTop: 2,
  },
  companyDetails: { fontSize: 8, marginTop: 6, lineHeight: 1.4 },

  bigTitle: {
    fontSize: 26,
    fontFamily: "Times-Bold",
    letterSpacing: 4,
    textAlign: "center",
    marginVertical: 16,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: BLACK,
  },

  // Bandeau infos
  infoBlock: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  infoLeft: { flex: 1 },
  infoRight: { flex: 1, borderWidth: 1, borderColor: BLACK, padding: 10 },
  infoLabel: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BLACK,
  },
  infoLine: { fontSize: 10, marginBottom: 2 },
  infoLineBold: { fontFamily: "Times-Bold", fontSize: 11 },

  introBox: {
    borderWidth: 1,
    borderColor: BLACK,
    padding: 10,
    marginBottom: 14,
    backgroundColor: "#fafaf5",
  },
  introText: { fontSize: 10, lineHeight: 1.5, fontStyle: "italic" },

  // Table prestations
  table: { borderWidth: 2, borderColor: BLACK },
  thead: { flexDirection: "row", backgroundColor: BLACK },
  th: {
    color: "#ffffff",
    padding: 6,
    fontSize: 9,
    fontFamily: "Times-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderRightWidth: 1,
    borderRightColor: "#ffffff",
  },
  thLast: { borderRightWidth: 0 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: BLACK,
    minHeight: 22,
  },
  td: {
    padding: 5,
    fontSize: 9,
    borderRightWidth: 0.6,
    borderRightColor: BLACK,
  },
  tdLast: { borderRightWidth: 0 },
  tdQty: { width: "8%", textAlign: "right" },
  tdDesc: { width: "52%" },
  tdUnit: { width: "8%", textAlign: "center" },
  tdPu: { width: "13%", textAlign: "right" },
  tdVat: { width: "7%", textAlign: "center" },
  tdMt: { width: "12%", textAlign: "right", fontFamily: "Times-Bold" },

  sectionRow: {
    flexDirection: "row",
    backgroundColor: "#f0e9d2",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: BLACK,
  },
  sectionTitle: { fontFamily: "Times-Bold", fontSize: 11, color: ACCENT, letterSpacing: 0.5 },

  // Totaux
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totalsBox: { width: 280, borderWidth: 2, borderColor: BLACK },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 10,
    borderBottomWidth: 0.6,
    borderBottomColor: BLACK,
  },
  totalLabel: { fontFamily: "Times-Bold" },
  totalLineFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: BLACK,
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Times-Bold",
    letterSpacing: 0.5,
  },

  conditionsBlock: {
    marginTop: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: BLACK,
    backgroundColor: "#fafaf5",
  },
  conditionsTitle: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    color: ACCENT,
  },
  conditionsText: { fontSize: 9, lineHeight: 1.6 },

  signatureRow: { flexDirection: "row", gap: 16, marginTop: 22 },
  signatureBox: {
    flex: 1,
    minHeight: 80,
    borderWidth: 1,
    borderColor: BLACK,
    padding: 8,
  },
  signatureLabel: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: BLACK,
  },
  signatureNote: { fontSize: 8, fontStyle: "italic", color: "#555" },

  pageNumber: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    fontStyle: "italic",
  },

  legalText: { fontSize: 7, marginTop: 14, lineHeight: 1.5, color: "#444" },
});

interface Props {
  quote: Quote;
  client: Client | undefined;
  company?: Record<string, unknown>;
}

function fmtDate(s: string): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return s; }
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
  return lines;
}
function get(c: Record<string, unknown>, k: string): string {
  return typeof c[k] === "string" ? (c[k] as string) : "";
}
function lineDiscountLabel(item: { discountMode: string; discountPercent: number; discountAmount: number }): string {
  if (item.discountMode === "percent" && item.discountPercent > 0) return `Remise −${item.discountPercent} %`;
  if (item.discountMode === "amount" && item.discountAmount > 0) return `Remise −${formatEuros(item.discountAmount)}`;
  return "";
}

function computeLineTotal(item: { quantity: number; unitPriceHT: number; discountMode: string; discountPercent: number; discountAmount: number }): number {
  const sub = item.quantity * item.unitPriceHT;
  if (item.discountMode === "percent") return sub * (1 - (item.discountPercent ?? 0) / 100);
  if (item.discountMode === "amount") return Math.max(0, sub - (item.discountAmount ?? 0));
  return sub;
}

export function QuotePdfClassique({ quote, client, company = {} }: Props) {
  const totals = computeQuoteTotals(quote);
  const companyName = get(company, "companyName") || get(company, "name") || "Mon entreprise";
  const cName = clientName(client);
  const cLines = clientLines(client);

  // Tailles configurables (Paramètres > Documents)
  const MM_TO_PT = 2.83465;
  const logoSizeMm = Number(company.pdfLogoSizeMm) || 35;
  const logoHeightPt = logoSizeMm * MM_TO_PT;
  const logoWidthPt = logoHeightPt * 1.4;
  const companyNameSize = Number(company.pdfCompanyNameSize) || 22;
  const dynStyles = {
    companyLogo: {
      width: logoWidthPt,
      height: logoHeightPt,
      objectFit: "contain" as const,
      marginBottom: 6,
    },
    companyName: {
      fontSize: companyNameSize,
      fontFamily: "Times-Bold",
      color: ACCENT,
      letterSpacing: 0.5,
    },
  };

  return (
    <Document title={quote.reference || "Devis"} author={companyName}>
      <Page size="A4" style={styles.page}>
        {/* Header bordure double */}
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                {typeof company.logoDataUrl === "string" && company.logoDataUrl && (
                  <Image style={dynStyles.companyLogo} src={company.logoDataUrl as string} />
                )}
                <Text style={dynStyles.companyName}>{companyName}</Text>
                {get(company, "tagline") && (
                  <Text style={styles.companyTagline}>« {get(company, "tagline")} »</Text>
                )}
                <View style={styles.companyDetails}>
                  {get(company, "addressLine1") && <Text>{get(company, "addressLine1")}</Text>}
                  {[get(company, "postalCode"), get(company, "city")].filter(Boolean).length > 0 && (
                    <Text>{[get(company, "postalCode"), get(company, "city")].filter(Boolean).join(" ")}</Text>
                  )}
                  {(get(company, "phoneMobile") || get(company, "phoneFixed")) && <Text>Tél : {get(company, "phoneMobile") || get(company, "phoneFixed")}</Text>}
                  {get(company, "email") && <Text>{get(company, "email")}</Text>}
                  {get(company, "siret") && <Text>SIRET : {get(company, "siret")}</Text>}
                  {get(company, "tvaIntracom") && <Text>TVA : {get(company, "tvaIntracom")}</Text>}
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.bigTitle}>D E V I S</Text>

        {/* Infos émission + destinataire */}
        <View style={styles.infoBlock}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoLabel}>N° et Date</Text>
            <Text style={styles.infoLineBold}>{quote.reference || "—"}</Text>
            <Text style={styles.infoLine}>Émis le {fmtDate(quote.issueDate)}</Text>
            {quote.validUntil && (
              <Text style={styles.infoLine}>Valable jusqu'au {fmtDate(quote.validUntil)}</Text>
            )}
            {quote.title && <Text style={[styles.infoLine, { marginTop: 6 }]}>Objet : {quote.title}</Text>}
          </View>
          <View style={styles.infoRight}>
            <Text style={styles.infoLabel}>Destinataire</Text>
            <Text style={[styles.infoLine, { fontFamily: "Times-Bold", fontSize: 11 }]}>{cName}</Text>
            {cLines.map((l, i) => <Text key={i} style={styles.infoLine}>{l}</Text>)}
          </View>
        </View>

        {/* Intro libre */}
        {quote.introText && (
          <View style={styles.introBox}>
            <Text style={styles.introText}>{quote.introText}</Text>
          </View>
        )}

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.tdQty]}>Qté</Text>
            <Text style={[styles.th, styles.tdDesc]}>Désignation</Text>
            <Text style={[styles.th, styles.tdUnit]}>Unité</Text>
            <Text style={[styles.th, styles.tdPu]}>P.U. HT</Text>
            <Text style={[styles.th, styles.tdVat]}>TVA</Text>
            <Text style={[styles.th, styles.thLast, styles.tdMt]}>Total HT</Text>
          </View>

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
                  {item.title && <Text style={{ fontFamily: "Times-Bold" }}>{item.title}</Text>}
                  {item.description && <Text>{item.description}</Text>}
                  {lineDiscountLabel(item) ? (
                    <Text style={{ fontSize: 8, color: "#777", fontStyle: "italic" }}>
                      {lineDiscountLabel(item)}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.td, styles.tdUnit]}>{item.unit}</Text>
                <Text style={[styles.td, styles.tdPu]}>{formatEuros(item.unitPriceHT)}</Text>
                <Text style={[styles.td, styles.tdVat]}>{item.vatRate}%</Text>
                <Text style={[styles.td, styles.tdLast, styles.tdMt]}>
                  {formatEuros(computeLineTotal(item))}
                </Text>
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
                  <Text>TVA {rate}%</Text>
                  <Text>{formatEuros(v.tax)}</Text>
                </View>
              ))}
            <View style={styles.totalLineFinal}>
              <Text>Total TTC</Text>
              <Text>{formatEuros(totals.totalTTC)}</Text>
            </View>
          </View>
        </View>

        {/* Conditions */}
        {quote.conditionsText && (
          <View style={styles.conditionsBlock}>
            <Text style={styles.conditionsTitle}>Conditions de Règlement</Text>
            <Text style={styles.conditionsText}>{quote.conditionsText}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Bon pour Accord</Text>
            <Text style={styles.signatureNote}>
              Date et signature précédées de la mention manuscrite « Bon pour accord »
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>L'Entreprise</Text>
            <Text style={styles.signatureNote}>{companyName}</Text>
          </View>
        </View>

        {quote.footerText && <Text style={styles.legalText}>{quote.footerText}</Text>}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `— ${pageNumber} / ${totalPages} —`}
          fixed
        />
      </Page>
    </Document>
  );
}
