// ═══════════════════════════════════════════════════════════════════════════
// addressService — API BAN (Base Adresse Nationale) via api-adresse.data.gouv.fr
//
// Avantages :
//   - Aucun token à gérer (API publique française officielle)
//   - Données IGN + La Poste officielles
//   - Recherche par texte libre ultra rapide
//   - Autocomplete incluse (endpoint /search)
//   - Géocodage inverse possible (endpoint /reverse)
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = "https://api-adresse.data.gouv.fr";

// ─── Types de retour ─────────────────────────────────────────────────────
export interface BanAddress {
  id: string;                // ex: "55230_abc_00012"
  label: string;             // ex: "12 rue de la République 55230 Muzeray"
  housenumber?: string;      // "12"
  street?: string;           // "rue de la République"
  postcode: string;          // "55230"
  city: string;              // "Muzeray"
  citycode?: string;         // code INSEE "55375"
  context?: string;          // "55, Meuse, Grand Est"
  latitude: number;
  longitude: number;
  type: "housenumber" | "street" | "locality" | "municipality";
  score: number;             // 0..1 (pertinence)
}

// ─── Mapper la réponse brute vers notre type ─────────────────────────────
function mapFeature(f: any): BanAddress {
  const props = f.properties || {};
  const coords = f.geometry?.coordinates || [0, 0];
  return {
    id: props.id || `${props.postcode || ""}_${props.street || ""}_${props.housenumber || ""}`,
    label: props.label || "",
    housenumber: props.housenumber,
    street: props.street || props.name,
    postcode: props.postcode || "",
    city: props.city || "",
    citycode: props.citycode,
    context: props.context,
    latitude: coords[1] || 0,
    longitude: coords[0] || 0,
    type: props.type || "street",
    score: props.score || 0,
  };
}

// ─── Recherche par texte libre (autocomplete) ────────────────────────────
export async function searchAddress(query: string, limit = 8): Promise<BanAddress[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${API_BASE}/search/?q=${encodeURIComponent(q)}&limit=${limit}&autocomplete=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.features || []).map(mapFeature);
  } catch {
    return [];
  }
}

// ─── Géocodage inverse (depuis lat/lng vers adresse) ─────────────────────
export async function reverseAddress(lat: number, lon: number): Promise<BanAddress | null> {
  const url = `${API_BASE}/reverse/?lat=${lat}&lon=${lon}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const feat = (data.features || [])[0];
    return feat ? mapFeature(feat) : null;
  } catch {
    return null;
  }
}

// ─── Helper : reconstruire la ligne 1 depuis un résultat ─────────────────
export function buildAddressLine1(addr: BanAddress): string {
  if (addr.housenumber && addr.street) return `${addr.housenumber} ${addr.street}`;
  if (addr.street) return addr.street;
  return "";
}
