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
// InvoicePdfDocument — Template PDF d'une facture
// (très proche du QuotePdfDocument, avec mentions spécifiques factures)
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = {
  primary: "#0f766e", // teal pour différencier des devis
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  bgMuted: "#f8fafc",
  bgPrimary: "#f0fdfa",
  paid: "#10b981",
  unpaid: "#dc2626",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: COLORS.text, fontFamily: "Helvetica" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  companyBlock: { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  companyLogo: { width: 60, height: 60, objectFit: "contain" },
  companyText: { flex: 1 },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: COLORS.primary, marginBottom: 4 },
  companyLine: { fontSize: 8, color: COLORS.muted, lineHeight: 1.4 },
  docTypeBlock: { alignItems: "flex-end", minWidth: 200 },
  docType: { fontSize: 22, fontFamily: "Helvetica-Bold", color: COLORS.text },
  docRef: { fontSize: 11, color: COLORS.muted, fontFamily: "Helvetica-Bold", marginTop: 2 },
  docMeta: { fontSize: 8, color: COLORS.muted, marginTop: 8, textAlign: "right" },

  // Bandeau de statut paiement
  statusBanner: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBannerText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  metaRow: { flexDirection: "row", gap: 14, marginBottom: 18 },
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
  metaValue: { fontSize: 10, color: COLORS.text, lineHeight: 1.4 },

  introText: { fontSize: 9, color: COLORS.text, lineHeight: 1.5, marginBottom: 12 },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  tableHeaderCell: { color: "#ffffff", paddingHorizontal: 4 },
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
  tableSectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: COLORS.primary },
  colDesc:  { width: "44%", paddingHorizontal: 4 },
  colQty:   { width: "8%",  paddingHorizontal: 4, textAlign: "right" },
  colUnit:  { width: "8%",  paddingHorizontal: 4, textAlign: "center" },
  colPrice: { width: "12%", paddingHorizontal: 4, textAlign: "right" },
  colVat:   { width: "8%",  paddingHorizontal: 4, textAlign: "right" },
  colDisc:  { width: "8%",  paddingHorizontal: 4, textAlign: "right" },
  colTotal: { width: "12%", paddingHorizontal: 4, textAlign: "right", fontFamily: "Helvetica-Bold" },

  itemTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 1 },
  itemDesc: { fontSize: 8, color: COLORS.muted, lineHeight: 1.3 },

  totalsBlock: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end" },
  totalsTable: {
    width: 280,
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
  paidLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#dcfce7",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: COLORS.paid,
  },
  remainingLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#fee2e2",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.unpaid,
  },

  conditionsBlock: { marginTop: 22, padding: 10, backgroundColor: COLORS.bgMuted, borderRadius: 4 },
  conditionsTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: COLORS.text, marginBottom: 4 },
  conditionsText: { fontSize: 8, color: COLORS.muted, lineHeight: 1.5 },

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
  invoice: Invoice;
  client: Client | undefined;
  company?: Record<string, unknown>;
}

function fmtDate(s: string): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
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

function computeLineTotal(item: { quantity: number; unitPriceHT: number; discountMode: string; discountPercent: number; discountAmount: number }): number {
  const subtotal = item.quantity * item.unitPriceHT;
  if (item.discountMode === "percent") return subtotal * (1 - (item.discountPercent ?? 0) / 100);
  if (item.discountMode === "amount") return Math.max(0, subtotal - (item.discountAmount ?? 0));
  return subtotal;
}
function formatDiscountLabel(item: { discountMode: string; discountPercent: number; discountAmount: number }): string {
  if (item.discountMode === "percent" && item.discountPercent > 0) return `−${item.discountPercent}%`;
  if (item.discountMode === "amount" && item.discountAmount > 0) return `−${formatEuros(item.discountAmount)}`;
  return "—";
}

const STATUS_LABELS: Record<string, { label: string; bg: string }> = {
  brouillon: { label: "BROUILLON", bg: "#94a3b8" },
  envoyee: { label: "ENVOYÉE", bg: "#3b82f6" },
  "partiellement-payee": { label: "PARTIELLEMENT PAYÉE", bg: "#f59e0b" },
  payee: { label: "✓ PAYÉE", bg: COLORS.paid },
  en_retard: { label: "⚠ EN RETARD", bg: COLORS.unpaid },
  annulee: { label: "ANNULÉE", bg: "#64748b" },
};

const TYPE_LABELS: Record<string, string> = {
  standard: "FACTURE",
  acompte: "FACTURE D'ACOMPTE",
  avoir: "AVOIR",
};

export function InvoicePdfDocument({ invoice, client, company = {} }: Props) {
  const totals = computeQuoteTotals(invoice as unknown as Parameters<typeof computeQuoteTotals>[0]);
  const totalPaid = invoice.totalPaid ?? 0;
  const remainingDue = Math.max(0, totals.totalTTC - totalPaid);
  const isPaid = remainingDue <= 0.01 && totals.totalTTC > 0;
  const companyName = (company.companyName as string) || (company.name as string) || "Mon entreprise";
  const companyLines = companyHeaderLines(company);
  const clientLines = clientFullAddress(client);
  const status = STATUS_LABELS[invoice.status] ?? STATUS_LABELS.brouillon!;
  const typeLabel = TYPE_LABELS[invoice.type] ?? "FACTURE";

  return (
    <Document title={invoice.reference || "Facture"} author={companyName} subject={invoice.title}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.companyBlock}>
            {typeof company.logoDataUrl === "string" && company.logoDataUrl && (
              <Image style={styles.companyLogo} src={company.logoDataUrl as string} />
            )}
            <View style={styles.companyText}>
              <Text style={styles.companyName}>{companyName}</Text>
              {companyLines.map((l, i) => <Text key={i} style={styles.companyLine}>{l}</Text>)}
            </View>
          </View>
          <View style={styles.docTypeBlock}>
            <Text style={styles.docType}>{typeLabel}</Text>
            <Text style={styles.docRef}>{invoice.reference || "—"}</Text>
            <Text style={styles.docMeta}>
              Émise le {fmtDate(invoice.issueDate)}
              {invoice.dueDate ? `\nÉchéance : ${fmtDate(invoice.dueDate)}` : ""}
            </Text>
          </View>
        </View>

        {/* Statut */}
        <View style={[styles.statusBanner, { backgroundColor: status.bg }]}>
          <Text style={styles.statusBannerText}>{status.label}</Text>
          {invoice.type === "acompte" && invoice.acomptePercent > 0 && (
            <Text style={styles.statusBannerText}>Acompte de {invoice.acomptePercent}%</Text>
          )}
        </View>

        {/* Méta */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Client</Text>
              {clientLines.length > 0 ? (
                clientLines.map((l, i) => <Text key={i} style={styles.metaValue}>{l}</Text>)
              ) : (
                <Text style={styles.metaValue}>—</Text>
              )}
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Objet</Text>
              <Text style={styles.metaValue}>{invoice.title || "—"}</Text>
            </View>
          </View>
        </View>

        {invoice.introText && <Text style={styles.introText}>{invoice.introText}</Text>}

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Désignation</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Qté</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unité</Text>
          <Text style={[styles.tableHeaderCell, styles.colPrice]}>P.U. HT</Text>
          <Text style={[styles.tableHeaderCell, styles.colVat]}>TVA</Text>
          <Text style={[styles.tableHeaderCell, styles.colDisc]}>Rem.</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
        </View>

        {invoice.items.map((item, idx) => {
          if (item.kind === "section") {
            return (
              <View key={item.id || idx} style={styles.tableRowSection} wrap={false}>
                <Text style={styles.tableSectionTitle}>{item.title || "Section"}</Text>
              </View>
            );
          }
          return (
            <View key={item.id || idx} style={styles.tableRow} wrap={false}>
              <View style={styles.colDesc}>
                {item.title && <Text style={styles.itemTitle}>{item.title}</Text>}
                {item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{formatEuros(item.unitPriceHT)}</Text>
              <Text style={styles.colVat}>{item.vatRate}%</Text>
              <Text style={styles.colDisc}>{formatDiscountLabel(item)}</Text>
              <Text style={styles.colTotal}>{formatEuros(computeLineTotal(item))}</Text>
            </View>
          );
        })}

        {/* Totaux + paiement */}
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
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatEuros(totals.totalHT)}</Text>
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
            {totalPaid > 0 && (
              <View style={styles.paidLine}>
                <Text>Déjà payé</Text>
                <Text>{formatEuros(totalPaid)}</Text>
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

        {/* Conditions */}
        {invoice.conditionsText && (
          <View style={styles.conditionsBlock} wrap={false}>
            <Text style={styles.conditionsTitle}>Conditions de paiement</Text>
            <Text style={styles.conditionsText}>{invoice.conditionsText}</Text>
          </View>
        )}

        {/* Footer */}
        {invoice.footerText && (
          <Text style={[styles.conditionsText, { marginTop: 20, fontSize: 7 }]}>
            {invoice.footerText}
          </Text>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${invoice.reference} · Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
