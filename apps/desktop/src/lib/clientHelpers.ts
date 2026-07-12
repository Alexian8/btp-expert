import type { Client } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// clientHelpers — utilitaires de l'onglet Clients (avatars, casse, email,
// Google Maps, couleurs d'étiquettes). Purs, testables, sans dépendance React.
// ═══════════════════════════════════════════════════════════════════════════

/** Nom affichable d'un client (raison sociale pour un pro, sinon nom complet). */
export function clientDisplayName(c: Pick<Client, "type" | "companyName" | "firstName" | "lastName">): string {
  if (c.type === "pro" && c.companyName) return c.companyName;
  const full = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return full || (c.companyName ?? "") || "—";
}

/** Deux initiales pour l'avatar (ex. "MB"). */
export function clientInitials(c: Pick<Client, "type" | "companyName" | "firstName" | "lastName">): string {
  if (c.type === "pro" && c.companyName) {
    const words = c.companyName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
    return c.companyName.trim().slice(0, 2).toUpperCase() || "?";
  }
  const f = (c.firstName ?? "").trim();
  const l = (c.lastName ?? "").trim();
  if (f && l) return (f[0]! + l[0]!).toUpperCase();
  const one = f || l;
  return (one.slice(0, 2) || "?").toUpperCase();
}

// Palette d'avatars (vert, bleu, orange, violet — spec terrain). Contraste fort.
const AVATAR_PALETTE = [
  "bg-emerald-500/20 text-emerald-300",
  "bg-blue-500/20 text-blue-300",
  "bg-amber-500/20 text-amber-300",
  "bg-violet-500/20 text-violet-300",
];

/** Couleur d'avatar déterministe (stable par client) depuis une graine. */
export function avatarColorClass(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

/** Domaines email proposés à la saisie du "@". */
export const EMAIL_DOMAINS = [
  "gmail.com",
  "orange.fr",
  "wanadoo.fr",
  "outlook.com",
  "outlook.fr",
  "icloud.com",
  "hotmail.fr",
];

/** MAJUSCULES (nom de famille). */
export function toUpperName(s: string): string {
  return s.toUpperCase();
}

/** Capitalise chaque mot (prénom) : "jean-luc" → "Jean-Luc". */
export function capitalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-zàâäéèêëîïôöùûüç])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** URL Google Maps (itinéraire) avec l'adresse complète encodée. */
export function googleMapsUrl(c: Pick<Client, "addressLine1" | "addressLine2" | "postalCode" | "city" | "country">): string {
  const parts = [c.addressLine1, c.addressLine2, `${c.postalCode ?? ""} ${c.city ?? ""}`.trim(), c.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Une adresse exploitable est-elle renseignée ? */
export function hasAddress(c: Pick<Client, "addressLine1" | "postalCode" | "city">): boolean {
  return Boolean((c.addressLine1 ?? "").trim() || (c.city ?? "").trim() || (c.postalCode ?? "").trim());
}

// ─── Couleurs d'étiquettes (clé → classes Tailwind) ────────────────────────
export const CLIENT_TAG_COLORS: Record<string, { chip: string; dot: string; label: string }> = {
  red:     { chip: "bg-red-500/15 text-red-400 border-red-500/30",         dot: "bg-red-500",     label: "Rouge" },
  amber:   { chip: "bg-amber-500/15 text-amber-400 border-amber-500/30",   dot: "bg-amber-500",   label: "Or" },
  yellow:  { chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", dot: "bg-yellow-400", label: "Jaune" },
  emerald: { chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500", label: "Vert" },
  blue:    { chip: "bg-blue-500/15 text-blue-400 border-blue-500/30",      dot: "bg-blue-500",    label: "Bleu" },
  violet:  { chip: "bg-violet-500/15 text-violet-400 border-violet-500/30", dot: "bg-violet-500", label: "Violet" },
  rose:    { chip: "bg-rose-500/15 text-rose-400 border-rose-500/30",      dot: "bg-rose-500",    label: "Rose" },
  slate:   { chip: "bg-slate-500/20 text-slate-200 border-slate-500/30",   dot: "bg-slate-400",   label: "Gris" },
};

export const CLIENT_TAG_COLOR_KEYS = Object.keys(CLIENT_TAG_COLORS);

export function tagChipClass(color: string): string {
  return (CLIENT_TAG_COLORS[color] ?? CLIENT_TAG_COLORS.slate!).chip;
}
