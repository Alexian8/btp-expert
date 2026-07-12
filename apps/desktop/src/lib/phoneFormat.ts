// ═══════════════════════════════════════════════════════════════════════════
// phoneFormat.ts — Formatage automatique des numéros de téléphone (Session 20)
//
// Convertit en format normalisé "+33 6 12 34 56 78" depuis :
//   - 0612345678              → +33 6 12 34 56 78
//   - 06 12 34 56 78          → +33 6 12 34 56 78
//   - 06.12.34.56.78          → +33 6 12 34 56 78
//   - +33612345678            → +33 6 12 34 56 78
//   - +33 6 12 34 56 78       → +33 6 12 34 56 78  (déjà bon)
//   - 0033612345678           → +33 6 12 34 56 78
//
// Pour les numéros internationaux (pas FR), on retourne juste le nettoyage
// avec espaces tous les 2 chiffres après l'indicatif.
// ═══════════════════════════════════════════════════════════════════════════

export interface PhoneFormatResult {
  formatted: string;          // version formatée pour affichage (+33 6 12 34 56 78)
  international: string;      // version compacte sans espaces (+33612345678)
  isValid: boolean;           // numéro semble valide ?
  countryCode: string;        // ex: "+33"
}

/**
 * Formate un numéro de téléphone en format français standard.
 *
 * Règles :
 * - Si commence par 0 : on remplace par +33 et retire le 0 initial
 * - Si commence par 00 : on retire les 00 et préfixe par +
 * - Si commence par +33 : on garde
 * - Sinon : nettoyage minimal
 *
 * Le formatage standard FR : +33 X XX XX XX XX
 */
export function formatPhone(input: string): PhoneFormatResult {
  if (!input || typeof input !== "string") {
    return { formatted: "", international: "", isValid: false, countryCode: "" };
  }

  // Nettoyer : ne garder que digits et le +
  let raw = input.replace(/[^\d+]/g, "");
  if (!raw) {
    return { formatted: "", international: "", isValid: false, countryCode: "" };
  }

  // Conversion en format international
  let normalized = raw;
  if (normalized.startsWith("00")) {
    normalized = "+" + normalized.slice(2);
  } else if (normalized.startsWith("0")) {
    // Numéro français local (06... 01...)
    normalized = "+33" + normalized.slice(1);
  } else if (!normalized.startsWith("+")) {
    // Pas d'indicatif → on suppose français
    if (normalized.length >= 9) {
      normalized = "+33" + normalized;
    }
  }

  // Format français : +33 X XX XX XX XX (+33 + 9 chiffres)
  if (normalized.startsWith("+33")) {
    const digits = normalized.slice(3); // les 9 chiffres après +33
    if (digits.length === 9) {
      const formatted = `+33 ${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
      return {
        formatted,
        international: "+33" + digits,
        isValid: true,
        countryCode: "+33",
      };
    }
    // Pas le bon nombre de chiffres → on retourne tel quel
    return {
      formatted: normalized,
      international: normalized,
      isValid: false,
      countryCode: "+33",
    };
  }

  // Numéros internationaux non FR : on tente un formatage simple par paires
  if (normalized.startsWith("+")) {
    // Détection des indicatifs courants (Belgique, Suisse, Lux, ...)
    const knownPrefixes = ["+32", "+33", "+34", "+39", "+41", "+44", "+49", "+352"];
    let prefix = "";
    for (const p of knownPrefixes) {
      if (normalized.startsWith(p)) {
        prefix = p;
        break;
      }
    }
    if (!prefix) {
      // Indicatif inconnu : on prend les 2-3 premiers chiffres
      const m = normalized.match(/^\+(\d{1,3})/);
      prefix = m ? `+${m[1]}` : "";
    }
    const rest = normalized.slice(prefix.length);
    // Espacer par paires
    const grouped = rest.match(/.{1,2}/g)?.join(" ") || rest;
    return {
      formatted: `${prefix} ${grouped}`,
      international: normalized,
      isValid: rest.length >= 6 && rest.length <= 12,
      countryCode: prefix,
    };
  }

  // Cas inhabituel
  return {
    formatted: normalized,
    international: normalized,
    isValid: false,
    countryCode: "",
  };
}

/**
 * Helper court pour usage dans onBlur d'un input :
 * Retourne juste la version formatée, ou la valeur d'origine si vide.
 */
export function autoFormatPhone(input: string): string {
  if (!input || !input.trim()) return "";
  const result = formatPhone(input);
  return result.formatted || input;
}

/** Numéro nettoyé (chiffres + `+`) pour les liens `tel:` / `sms:`. */
export function phoneDigits(input: string): string {
  if (!input) return "";
  const intl = formatPhone(input).international;
  return intl || input.replace(/[^\d+]/g, "");
}

/** Lien `tel:` prêt à l'emploi (numéro sanitisé). */
export function telHref(input: string): string {
  return `tel:${phoneDigits(input)}`;
}

/** Lien `sms:` prêt à l'emploi (numéro sanitisé). */
export function smsHref(input: string): string {
  return `sms:${phoneDigits(input)}`;
}
