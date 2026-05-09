// ═══════════════════════════════════════════════════════════════════════════
// Formatters — helpers de formatage réutilisables (compatible toutes plateformes)
// ═══════════════════════════════════════════════════════════════════════════

export const formatCurrency = (value: number | string | null | undefined): string => {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

export const formatNumber = (value: number | string | null | undefined, decimals = 2): string => {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

export const formatDate = (
  date: string | Date | null | undefined,
  format: "short" | "long" | "numeric" = "short"
): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  switch (format) {
    case "long":
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    case "numeric":
      return d.toLocaleDateString("fr-FR");
    default:
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return `${formatDate(d)} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};

export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
};

export const formatSiret = (siret: string | null | undefined): string => {
  if (!siret) return "";
  const digits = siret.replace(/\D/g, "");
  if (digits.length !== 14) return siret;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4");
};
