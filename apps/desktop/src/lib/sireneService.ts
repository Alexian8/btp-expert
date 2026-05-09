// ═══════════════════════════════════════════════════════════════════════════
// sireneService — API SIRENE / INSEE via recherche-entreprises.api.gouv.fr
//
// Avantages de cet endpoint public :
//   - Aucun token à gérer (gratuit, sans auth)
//   - Rate limit confortable (7 req/sec)
//   - Données INSEE officielles et à jour
//   - Supporte recherche par SIRET, SIREN, ou texte libre (nom)
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = "https://recherche-entreprises.api.gouv.fr";

// ─── Types de retour ─────────────────────────────────────────────────────
export interface SireneCompany {
  siren: string;
  siret: string;
  nom: string; // raison sociale ou nom+prénom pour entrepreneur individuel
  nomCommercial?: string;
  formeJuridique?: string; // ex: "SAS, société par actions simplifiée"
  codeFormeJuridique?: string; // ex: "5710"
  codeAPE?: string; // ex: "4120A"
  libelleAPE?: string; // ex: "Construction de maisons individuelles"
  categorie?: string; // "PME", "GE", "ETI"...
  etat: "A" | "F" | "C" | string; // Actif, Fermé, Cessé
  dateCreation?: string;
  effectif?: string;
  // Adresse
  adresse?: string;
  codePostal?: string;
  ville?: string;
  // Calculé
  tvaIntracom?: string;
}

export interface SireneSearchResult {
  total: number;
  results: SireneCompany[];
}

// ─── Calcul de la clé TVA intracommunautaire ─────────────────────────────
// Formule officielle : [12 + 3 * (SIREN modulo 97)] modulo 97
function computeTvaIntracom(siren: string): string | undefined {
  const cleaned = siren.replace(/\D/g, "");
  if (cleaned.length !== 9) return undefined;
  try {
    const n = BigInt(cleaned);
    const key = (12n + 3n * (n % 97n)) % 97n;
    const keyStr = key.toString().padStart(2, "0");
    return `FR${keyStr}${cleaned}`;
  } catch {
    return undefined;
  }
}

// ─── Mapper la réponse brute de l'API vers notre format ──────────────────
function mapResult(raw: any): SireneCompany {
  const siege = raw.siege || {};
  const uniteLegale = raw.unite_legale || {};

  const siren: string = raw.siren || "";
  const siret: string = siege.siret || raw.siret || `${siren}00000`;

  // Nom : pour personne morale = nom_complet ou nom_raison_sociale
  //       pour entrepreneur individuel = prénom + nom
  let nom: string = raw.nom_complet || raw.nom_raison_sociale || "";
  if (!nom) {
    const nomNaissance = raw.nom || uniteLegale.nom || "";
    const prenoms = raw.prenom || uniteLegale.prenom_usuel || "";
    nom = `${prenoms} ${nomNaissance}`.trim();
  }

  // État administratif : A = actif, F = fermé, C = cessé
  const etatBrut = (siege.etat_administratif || raw.etat_administratif || "A") as string;

  // Adresse
  const adresseArr: string[] = [];
  if (siege.numero_voie) adresseArr.push(siege.numero_voie);
  if (siege.indice_repetition) adresseArr.push(siege.indice_repetition);
  if (siege.type_voie) adresseArr.push(siege.type_voie);
  if (siege.libelle_voie) adresseArr.push(siege.libelle_voie);
  if (siege.complement_adresse) adresseArr.push(siege.complement_adresse);
  const adresse = adresseArr.join(" ").trim();

  return {
    siren,
    siret,
    nom: nom.trim(),
    nomCommercial: raw.nom_commercial || undefined,
    formeJuridique: raw.libelle_nature_juridique || raw.nature_juridique || undefined,
    codeFormeJuridique: raw.nature_juridique || undefined,
    codeAPE: raw.activite_principale || undefined,
    libelleAPE: raw.libelle_activite_principale || undefined,
    categorie: raw.categorie_entreprise || undefined,
    etat: etatBrut,
    dateCreation: raw.date_creation || undefined,
    effectif: raw.tranche_effectif_salarie || undefined,
    adresse: adresse || undefined,
    codePostal: siege.code_postal || undefined,
    ville: siege.libelle_commune || undefined,
    tvaIntracom: computeTvaIntracom(siren),
  };
}

// ─── Nettoyer / valider un SIRET ─────────────────────────────────────────
export function cleanSiret(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidSiretFormat(siret: string): boolean {
  const cleaned = cleanSiret(siret);
  return cleaned.length === 14;
}

export function isValidSirenFormat(siren: string): boolean {
  const cleaned = cleanSiret(siren);
  return cleaned.length === 9;
}

// ─── Formatter un SIRET (14 chiffres → "123 456 789 00012") ──────────────
export function formatSiret(siret: string): string {
  const c = cleanSiret(siret);
  if (c.length !== 14) return siret;
  return `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 9)} ${c.slice(9)}`;
}

// ─── Recherche par SIRET exact ───────────────────────────────────────────
export async function lookupBySiret(siret: string): Promise<SireneCompany | null> {
  const clean = cleanSiret(siret);
  if (!isValidSiretFormat(clean)) {
    throw new Error("Le SIRET doit contenir 14 chiffres");
  }
  const url = `${API_BASE}/search?q=${clean}&per_page=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur API (${response.status})`);
  }
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    return null;
  }
  return mapResult(data.results[0]);
}

// ─── Recherche par texte libre (nom de société) ──────────────────────────
export async function searchByName(query: string, limit = 10): Promise<SireneCompany[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${API_BASE}/search?q=${encodeURIComponent(q)}&per_page=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur API (${response.status})`);
  }
  const data = await response.json();
  return (data.results || []).map(mapResult);
}

// ─── Helper : état humain ────────────────────────────────────────────────
export function etatLabel(etat: string): { label: string; color: "success" | "warning" | "destructive" | "muted" } {
  switch (etat?.toUpperCase()) {
    case "A":
      return { label: "Active", color: "success" };
    case "F":
      return { label: "Fermée", color: "destructive" };
    case "C":
      return { label: "Cessée", color: "warning" };
    default:
      return { label: etat || "Inconnu", color: "muted" };
  }
}
