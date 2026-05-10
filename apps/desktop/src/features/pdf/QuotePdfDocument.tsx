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
// QuotePdfDocument — Template PDF d'un devis (rendu client-side via @react-pdf)
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = {
  primary: "#2563eb",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  bgMuted: "#f8fafc",
  bgPrimary: "#eff6ff",
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    color: COLORS.text,
    fontFamily: "Helvetica",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  companyBlock: { flex: 1 },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: 4,
  },
  companyLine: { fontSize: 8, color: COLORS.muted, lineHeight: 1.4 },
  docTypeBlock: {
    alignItems: "flex-end",
    minWidth: 200,
  },
  docType: {
    fontSize: 22,
    fontWeight: 700,
    color: COLORS.text,
  },
  docRef: {
    fontSize: 11,
    color: COLORS.muted,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  docMeta: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 8,
    textAlign: "right",
  },

  // Bloc client / infos
  metaRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
  },
  metaCol: { flex: 1 },
  metaCard: {
    padding: 10,
    backgroundColor: COLORS.bgMuted,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  metaLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  metaValue: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.4,
  },

  // Titre section
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    marginTop: 18,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  introText: {
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.5,
    marginBottom: 12,
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  tableHeaderCell: {
    color: "#ffffff",
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 24,
  },
  tableRowSection: {
    flexDirection: "row",
    backgroundColor: COLORS.bgPrimary,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  tableSectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: COLORS.primary,
  },
  // Colonnes (% des largeurs)
  colDesc:  { width: "44%", paddingHorizontal: 4 },
  colQty:   { width: "8%",  paddingHorizontal: 4, textAlign: "right" },
  colUnit:  { width: "8%",  paddingHorizontal: 4, textAlign: "center" },
  colPrice: { width: "12%", paddingHorizontal: 4, textAlign: "right" },
  colVat:   { width: "8%",  paddingHorizontal: 4, textAlign: "right" },
  colDisc:  { width: "8%",  paddingHorizontal: 4, textAlign: "right" },
  colTotal: { width: "12%", paddingHorizontal: 4, textAlign: "right", fontFamily: "Helvetica-Bold" },

  itemTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 1,
  },
  itemDesc: {
    fontSize: 8,
    color: COLORS.muted,
    lineHeight: 1.3,
  },

  // Totaux
  totalsBlock: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsTable: {
    width: 250,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  totalRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primary,
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },

  // Footer
  conditionsBlock: {
    marginTop: 22,
    padding: 10,
    backgroundColor: COLORS.bgMuted,
    borderRadius: 4,
  },
  conditionsTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: COLORS.text,
    marginBottom: 4,
  },
  conditionsText: {
    fontSize: 8,
    color: COLORS.muted,
    lineHeight: 1.5,
  },
  signatureRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 28,
  },
  signatureBox: {
    flex: 1,
    minHeight: 70,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
  },
  signatureLabel: {
    fontSize: 8,
    color: COLORS.muted,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },

  pageNumber: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7,
    color: COLORS.muted,
  },
});

interface Props {
  quote: Quote;
  client: Client | undefined;
  company?: Record<string, unknown>;
}

function fmtDate(s: string): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function clientFullAddress(c: Client | undefined): string[] {
  if (!c) return [];
  const lines: string[] = [];
  const name =
    c.type === "pro" && c.companyName
      ? c.companyName
      : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  if (name) lines.push(name);
  if (c.addressLine1) lines.push(c.addressLine1);
  if (c.addressLine2) lines.push(c.addressLine2);
  const cityLine = [c.postalCode, c.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (c.country && c.country !== "France") lines.push(c.country);
  return lines;
}

function companyHeaderLines(company: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const get = (k: string): string =>
    typeof company[k] === "string" ? (company[k] as string) : "";
  if (get("addressLine1")) lines.push(get("addressLine1"));
  if (get("addressLine2")) lines.push(get("addressLine2"));
  const cityLine = [get("postalCode"), get("city")].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  const contact = [get("phone"), get("email")].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  if (get("website")) lines.push(get("website"));
  if (get("siret")) lines.push(`SIRET ${get("siret")}`);
  if (get("tvaIntracom")) lines.push(`TVA ${get("tvaIntracom")}`);
  return lines;
}

export function QuotePdfDocument({ quote, client, company = {} }: Props) {
  const totals = computeQuoteTotals(quote);
  const companyName =
    (company.companyName as string) ||
    (company.name as string) ||
    "Mon entreprise";
  const companyLines = companyHeaderLines(company);
  const clientLines = clientFullAddress(client);

  const docType =
    quote.status === "accepte"
      ? "DEVIS ACCEPTÉ"
      : quote.status === "refuse"
        ? "DEVIS REFUSÉ"
        : "DEVIS";

  return (
    <Document
      title={quote.reference || "Devis"}
      author={companyName}
      subject={quote.title}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{companyName}</Text>
            {companyLines.map((l, i) => (
              <Text key={i} style={styles.companyLine}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.docTypeBlock}>
            <Text style={styles.docType}>{docType}</Text>
            <Text style={styles.docRef}>{quote.reference || "—"}</Text>
            <Text style={styles.docMeta}>
              Émis le {fmtDate(quote.issueDate)}
              {quote.validUntil ? `\nValable jusqu'au ${fmtDate(quote.validUntil)}` : ""}
            </Text>
          </View>
        </View>

        {/* Méta : client + objet */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Client</Text>
              {clientLines.length > 0 ? (
                clientLines.map((l, i) => (
                  <Text key={i} style={styles.metaValue}>
                    {l}
                  </Text>
                ))
              ) : (
                <Text style={styles.metaValue}>—</Text>
              )}
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Objet du devis</Text>
              <Text style={styles.metaValue}>{quote.title || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Intro */}
        {quote.introText && <Text style={styles.introText}>{quote.introText}</Text>}

        {/* Table des prestations */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Désignation</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Qté</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unité</Text>
          <Text style={[styles.tableHeaderCell, styles.colPrice]}>P.U. HT</Text>
          <Text style={[styles.tableHeaderCell, styles.colVat]}>TVA</Text>
          <Text style={[styles.tableHeaderCell, styles.colDisc]}>Rem.</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
        </View>

        {quote.items.map((item, idx) => {
          if (item.kind === "section") {
            return (
              <View key={item.id || idx} style={styles.tableRowSection} wrap={false}>
                <Text style={styles.tableSectionTitle}>{item.title || "Section"}</Text>
              </View>
            );
          }
          const lineTotalHT = computeLineTotal(item);
          const discountLabel = formatDiscountLabel(item);
          return (
            <View key={item.id || idx} style={styles.tableRow} wrap={false}>
              <View style={styles.colDesc}>
                {item.title && <Text style={styles.itemTitle}>{item.title}</Text>}
                {item.description && (
                  <Text style={styles.itemDesc}>{item.description}</Text>
                )}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{formatEuros(item.unitPriceHT)}</Text>
              <Text style={styles.colVat}>{item.vatRate}%</Text>
              <Text style={styles.colDisc}>{discountLabel}</Text>
              <Text style={styles.colTotal}>{formatEuros(lineTotalHT)}</Text>
            </View>
          );
        })}

        {/* Totaux */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text>Sous-total HT</Text>
              <Text>{formatEuros(totals.subtotalAfterLineDiscountsHT)}</Text>
            </View>
            {totals.globalDiscount > 0 && (
              <View style={styles.totalRow}>
                <Text>Remise globale</Text>
                <Text>− {formatEuros(totals.globalDiscount)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Total HT</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {formatEuros(totals.totalHT)}
              </Text>
            </View>
            {(Object.entries(totals.vatDetail) as [string, { base: number; tax: number }][])
              .filter(([, v]) => v.tax > 0)
              .map(([rate, v]) => (
                <View key={rate} style={styles.totalRow}>
                  <Text>TVA {rate}% sur {formatEuros(v.base)}</Text>
                  <Text>{formatEuros(v.tax)}</Text>
                </View>
              ))}
            <View style={styles.totalRowFinal}>
              <Text>Total TTC</Text>
              <Text>{formatEuros(totals.totalTTC)}</Text>
            </View>
          </View>
        </View>

        {/* Conditions */}
        {quote.conditionsText && (
          <View style={styles.conditionsBlock} wrap={false}>
            <Text style={styles.conditionsTitle}>Conditions</Text>
            <Text style={styles.conditionsText}>{quote.conditionsText}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Bon pour accord — Le client</Text>
            <Text style={styles.conditionsText}>
              Date et signature précédées de la mention "Bon pour accord"
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>L'entreprise</Text>
            <Text style={styles.conditionsText}>{companyName}</Text>
          </View>
        </View>

        {/* Footer (mentions) */}
        {quote.footerText && (
          <Text style={[styles.conditionsText, { marginTop: 20, fontSize: 7 }]}>
            {quote.footerText}
          </Text>
        )}

        {/* Numéro de page */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${quote.reference} · Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function computeLineTotal(item: { quantity: number; unitPriceHT: number; discountMode: string; discountPercent: number; discountAmount: number }): number {
  const subtotal = item.quantity * item.unitPriceHT;
  if (item.discountMode === "percent") {
    return subtotal * (1 - (item.discountPercent ?? 0) / 100);
  }
  if (item.discountMode === "amount") {
    return Math.max(0, subtotal - (item.discountAmount ?? 0));
  }
  return subtotal;
}

function formatDiscountLabel(item: { discountMode: string; discountPercent: number; discountAmount: number }): string {
  if (item.discountMode === "percent" && item.discountPercent > 0) {
    return `−${item.discountPercent}%`;
  }
  if (item.discountMode === "amount" && item.discountAmount > 0) {
    return `−${formatEuros(item.discountAmount)}`;
  }
  return "—";
}
