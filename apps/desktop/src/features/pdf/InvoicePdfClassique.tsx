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
import { companyLegalLines } from "./pdfHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// InvoicePdfClassique — Template FACTURE classique BTP (Times serif + bordures)
// ═══════════════════════════════════════════════════════════════════════════

const BLACK = "#000000";
const ACCENT = "#7c2d12";
const PAID = "#15803d";
const UNPAID = "#b91c1c";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: BLACK, fontFamily: "Times-Roman" },

  outerFrame: { borderWidth: 2, borderColor: BLACK, padding: 4, marginBottom: 14 },
  innerFrame: { borderWidth: 1, borderColor: BLACK, padding: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flex: 1 },
  companyDetails: { fontSize: 8, marginTop: 6, lineHeight: 1.4 },

  bigTitle: {
    fontSize: 26, fontFamily: "Times-Bold", letterSpacing: 4,
    textAlign: "center", marginVertical: 16, paddingVertical: 8,
    borderTopWidth: 2, borderBottomWidth: 2, borderColor: BLACK,
  },

  paidStamp: {
    position: "absolute",
    top: 90, right: 30,
    borderWidth: 3, borderColor: PAID, padding: 8,
    fontSize: 18, fontFamily: "Times-Bold", color: PAID,
    letterSpacing: 3, transform: "rotate(-12deg)",
  },

  infoBlock: { flexDirection: "row", gap: 16, marginBottom: 16 },
  infoLeft: { flex: 1 },
  infoRight: { flex: 1, borderWidth: 1, borderColor: BLACK, padding: 10 },
  infoLabel: {
    fontFamily: "Times-Bold", fontSize: 10,
    textTransform: "uppercase", letterSpacing: 1,
    marginBottom: 6, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: BLACK,
  },
  infoLine: { fontSize: 10, marginBottom: 2 },
  infoLineBold: { fontFamily: "Times-Bold", fontSize: 11 },

  table: { borderWidth: 2, borderColor: BLACK },
  thead: { flexDirection: "row", backgroundColor: BLACK },
  th: {
    color: "#ffffff", padding: 6, fontSize: 9, fontFamily: "Times-Bold",
    textTransform: "uppercase", letterSpacing: 0.5,
    borderRightWidth: 1, borderRightColor: "#ffffff",
  },
  thLast: { borderRightWidth: 0 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: BLACK, minHeight: 22 },
  td: { padding: 5, fontSize: 9, borderRightWidth: 0.6, borderRightColor: BLACK },
  tdLast: { borderRightWidth: 0 },
  tdQty: { width: "8%", textAlign: "right" },
  tdDesc: { width: "52%" },
  tdUnit: { width: "8%", textAlign: "center" },
  tdPu: { width: "13%", textAlign: "right" },
  tdVat: { width: "7%", textAlign: "center" },
  tdMt: { width: "12%", textAlign: "right", fontFamily: "Times-Bold" },

  sectionRow: {
    flexDirection: "row", backgroundColor: "#f0e9d2",
    paddingVertical: 6, paddingHorizontal: 8,
    borderBottomWidth: 0.6, borderBottomColor: BLACK,
  },
  sectionTitle: { fontFamily: "Times-Bold", fontSize: 11, color: ACCENT },

  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totalsBox: { width: 290, borderWidth: 2, borderColor: BLACK },
  totalLine: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, paddingHorizontal: 10, fontSize: 10,
    borderBottomWidth: 0.6, borderBottomColor: BLACK,
  },
  totalLabel: { fontFamily: "Times-Bold" },
  totalLineFinal: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: BLACK, color: "#ffffff",
    fontSize: 13, fontFamily: "Times-Bold", letterSpacing: 0.5,
  },
  paidLine: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, paddingHorizontal: 10, fontSize: 10,
    borderBottomWidth: 0.6, borderBottomColor: BLACK,
    backgroundColor: "#dcfce7", color: PAID, fontFamily: "Times-Bold",
  },
  remainingLine: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 7, paddingHorizontal: 10, fontSize: 11,
    backgroundColor: "#fee2e2", color: UNPAID, fontFamily: "Times-Bold",
  },

  conditionsBlock: {
    marginTop: 18, padding: 10,
    borderWidth: 1, borderColor: BLACK, backgroundColor: "#fafaf5",
  },
  conditionsTitle: {
    fontFamily: "Times-Bold", fontSize: 10,
    textTransform: "uppercase", letterSpacing: 1,
    marginBottom: 6, color: ACCENT,
  },
  conditionsText: { fontSize: 9, lineHeight: 1.6 },

  legalText: { fontSize: 7, marginTop: 14, lineHeight: 1.5, color: "#444" },
  pageNumber: {
    position: "absolute", bottom: 14, left: 0, right: 0,
    textAlign: "center", fontSize: 8, fontStyle: "italic",
  },
});

interface Props {
  invoice: Invoice;
  client: Client | undefined;
  company?: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  standard: "F A C T U R E",
  acompte: "FACTURE D'ACOMPTE",
  avoir: "A V O I R",
};

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
function computeLineTotal(item: { quantity: number; unitPriceHT: number; discountMode: string; discountPercent: number; discountAmount: number }): number {
  const sub = item.quantity * item.unitPriceHT;
  if (item.discountMode === "percent") return sub * (1 - (item.discountPercent ?? 0) / 100);
  if (item.discountMode === "amount") return Math.max(0, sub - (item.discountAmount ?? 0));
  return sub;
}

function lineDiscountLabel(item: { discountMode: string; discountPercent: number; discountAmount: number }): string {
  if (item.discountMode === "percent" && item.discountPercent > 0) return `Remise −${item.discountPercent} %`;
  if (item.discountMode === "amount" && item.discountAmount > 0) return `Remise −${formatEuros(item.discountAmount)}`;
  return "";
}

export function InvoicePdfClassique({ invoice, client, company = {} }: Props) {
  const totals = computeQuoteTotals(invoice as unknown as Parameters<typeof computeQuoteTotals>[0]);
  const totalPaid = invoice.totalPaid ?? 0;
  const remainingDue = Math.max(0, totals.totalTTC - totalPaid);
  const isPaid = remainingDue <= 0.01 && totals.totalTTC > 0;
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
    <Document title={invoice.reference || "Facture"} author={companyName}>
      <Page size="A4" style={styles.page}>
        {isPaid && <Text style={styles.paidStamp}>P A Y É E</Text>}

        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                {typeof company.logoDataUrl === "string" && company.logoDataUrl && (
                  <Image style={dynStyles.companyLogo} src={company.logoDataUrl as string} />
                )}
                <Text style={dynStyles.companyName}>{companyName}</Text>
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

        <Text style={styles.bigTitle}>{TYPE_LABELS[invoice.type] ?? "F A C T U R E"}</Text>

        <View style={styles.infoBlock}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoLabel}>N° et Date</Text>
            <Text style={styles.infoLineBold}>{invoice.reference || "—"}</Text>
            <Text style={styles.infoLine}>Émise le {fmtDate(invoice.issueDate)}</Text>
            {invoice.dueDate && (
              <Text style={[styles.infoLine, { fontFamily: "Times-Bold", color: ACCENT }]}>
                Échéance : {fmtDate(invoice.dueDate)}
              </Text>
            )}
            {invoice.title && <Text style={[styles.infoLine, { marginTop: 6 }]}>Objet : {invoice.title}</Text>}
            {invoice.type === "acompte" && invoice.acomptePercent > 0 && (
              <Text style={styles.infoLine}>Acompte de {invoice.acomptePercent}%</Text>
            )}
          </View>
          <View style={styles.infoRight}>
            <Text style={styles.infoLabel}>Destinataire</Text>
            <Text style={[styles.infoLine, { fontFamily: "Times-Bold", fontSize: 11 }]}>{cName}</Text>
            {cLines.map((l, i) => <Text key={i} style={styles.infoLine}>{l}</Text>)}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.tdQty]}>Qté</Text>
            <Text style={[styles.th, styles.tdDesc]}>Désignation</Text>
            <Text style={[styles.th, styles.tdUnit]}>Unité</Text>
            <Text style={[styles.th, styles.tdPu]}>P.U. HT</Text>
            <Text style={[styles.th, styles.tdVat]}>TVA</Text>
            <Text style={[styles.th, styles.thLast, styles.tdMt]}>Total HT</Text>
          </View>

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
            {totalPaid > 0 && (
              <View style={styles.paidLine}>
                <Text>Déjà payé</Text>
                <Text>− {formatEuros(totalPaid)}</Text>
              </View>
            )}
            {!isPaid && totals.totalTTC > 0 && (
              <View style={styles.remainingLine}>
                <Text>Reste dû</Text>
                <Text>{formatEuros(remainingDue)}</Text>
              </View>
            )}
          </View>
        </View>

        {invoice.conditionsText && (
          <View style={styles.conditionsBlock}>
            <Text style={styles.conditionsTitle}>Conditions de Paiement</Text>
            <Text style={styles.conditionsText}>{invoice.conditionsText}</Text>
          </View>
        )}

        {companyLegalLines(company).length > 0 && (
          <View style={{ marginTop: 12, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#999" }}>
            {companyLegalLines(company).map((l, i) => (
              <Text key={i} style={{ fontSize: 8, color: "#444", lineHeight: 1.5 }}>
                <Text style={{ fontFamily: "Times-Bold" }}>{l.label} : </Text>
                {l.value}
              </Text>
            ))}
          </View>
        )}

        {invoice.footerText && <Text style={styles.legalText}>{invoice.footerText}</Text>}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `— ${pageNumber} / ${totalPages} —`}
          fixed
        />
      </Page>
    </Document>
  );
}
