// ═══════════════════════════════════════════════════════════════════════════
// Helpers : génération automatique de l'email pro à partir du nom/prénom
//
// Format choisi : nom.prenom@domaine (ex: Jean Dupont → dupont.jean@…)
// Les accents sont retirés, espaces remplacés par tirets, tout en minuscules.
// ═══════════════════════════════════════════════════════════════════════════

/** Normalise une chaîne pour usage dans une adresse email :
 *  - Retire les accents (é → e, ç → c, ñ → n)
 *  - Met en minuscules
 *  - Garde uniquement [a-z0-9] et tirets
 *  - Supprime espaces et apostrophes
 */
export function slugifyName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques
    .toLowerCase()
    .replace(/['']/g, "") // apostrophes
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Construit le local-part de l'email professionnel : "nom.prenom".
 *  Si l'un des 2 manque, retourne juste l'autre. Si les 2 manquent, "". */
export function deriveEmailLocalPart(firstName: string, lastName: string): string {
  const f = slugifyName(firstName ?? "");
  const l = slugifyName(lastName ?? "");
  if (!f && !l) return "";
  if (!l) return f;
  if (!f) return l;
  return `${l}.${f}`;
}

/** Construit l'email pro complet local-part@domain. */
export function deriveProEmail(
  firstName: string,
  lastName: string,
  domain: string
): string {
  const local = deriveEmailLocalPart(firstName, lastName);
  if (!local || !domain) return "";
  return `${local}@${domain}`;
}
