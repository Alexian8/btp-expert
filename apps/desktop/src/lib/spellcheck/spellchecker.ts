// ═══════════════════════════════════════════════════════════════════════════
// spellchecker — moteur de correction orthographique française (Hunspell/nspell)
//
// Le dictionnaire (~1.4 Mo) est chargé une seule fois, à la demande, depuis
// /dict/fr.aff + /dict/fr.dic (servis depuis public/). Singleton partagé par
// toute l'app. Fonctionne en desktop (Electron) et web.
// ═══════════════════════════════════════════════════════════════════════════

import nspell from "nspell";

type Nspell = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
  add: (word: string) => void;
};

let instance: Nspell | null = null;
let loadingPromise: Promise<Nspell | null> | null = null;

// Mots toujours acceptés (vocabulaire métier + perso ajouté par l'utilisateur)
const customWords = new Set<string>();

const CUSTOM_WORDS_KEY = "btp.spell.customWords";

function loadCustomWords(): void {
  try {
    const raw = localStorage.getItem(CUSTOM_WORDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      for (const w of arr) customWords.add(w);
    }
  } catch {
    /* ignore */
  }
}

function persistCustomWords(): void {
  try {
    localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify([...customWords]));
  } catch {
    /* ignore */
  }
}

/**
 * Charge (une seule fois) le dictionnaire français et instancie nspell.
 * Renvoie null si le chargement échoue (réseau, fichiers absents) — l'app
 * continue de fonctionner, juste sans correction.
 */
export async function loadSpellchecker(): Promise<Nspell | null> {
  if (instance) return instance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      loadCustomWords();
      // BASE_URL = "/" en web, "./" en desktop Electron (chemin relatif requis
      // pour fonctionner en file://).
      const base = import.meta.env.BASE_URL || "/";
      const [affRes, dicRes] = await Promise.all([
        fetch(`${base}dict/fr.aff`),
        fetch(`${base}dict/fr.dic`),
      ]);
      if (!affRes.ok || !dicRes.ok) throw new Error("Dictionnaire introuvable");
      const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
      const spell = nspell({ aff, dic }) as Nspell;
      // Injecter le vocabulaire métier + mots perso
      for (const w of BTP_VOCABULARY) {
        try { spell.add(w); } catch { /* ignore */ }
      }
      for (const w of customWords) {
        try { spell.add(w); } catch { /* ignore */ }
      }
      instance = spell;
      return spell;
    } catch (e) {
      console.warn("[spellchecker] chargement échoué :", (e as Error).message);
      return null;
    }
  })();

  return loadingPromise;
}

export function isSpellcheckerReady(): boolean {
  return instance !== null;
}

/** Vrai si le mot est correct (ou trop court / numérique / inconnu du moteur). */
export function checkWord(word: string): boolean {
  if (!instance) return true; // tant que pas chargé : on ne souligne rien
  const w = word.trim();
  if (w.length < 2) return true;
  // On ignore les nombres, montants, références (FACT-2026-0001), etc.
  if (/[0-9]/.test(w)) return true;
  if (customWords.has(w.toLowerCase())) return true;
  return instance.correct(w);
}

/** Suggestions de correction pour un mot (max 6). */
export function suggestWord(word: string): string[] {
  if (!instance) return [];
  try {
    return instance.suggest(word).slice(0, 6);
  } catch {
    return [];
  }
}

/** Ajoute un mot au dictionnaire personnel (persisté). */
export function addCustomWord(word: string): void {
  const w = word.trim();
  if (!w) return;
  customWords.add(w.toLowerCase());
  if (instance) {
    try { instance.add(w); } catch { /* ignore */ }
  }
  persistCustomWords();
}

// ─── Vocabulaire métier BTP (toujours considéré correct) ───────────────────
// Termes techniques, matériaux, corps d'état souvent absents des dicos
// génériques ou mal orthographiés par eux.
export const BTP_VOCABULARY: string[] = [
  // Corps d'état & métiers
  "maçonnerie", "maçon", "plâtrerie", "plaquiste", "carrelage", "carreleur",
  "couverture", "couvreur", "charpente", "charpentier", "menuiserie", "menuisier",
  "plomberie", "plombier", "électricité", "électricien", "peinture", "peintre",
  "terrassement", "terrassier", "étanchéité", "ravalement", "isolation",
  "platrier", "vitrerie", "serrurerie", "métallerie", "ferronnerie",
  // Matériaux
  "placo", "placoplâtre", "BA13", "fermacell", "parpaing", "parpaings",
  "agglo", "agglos", "béton", "bétons", "mortier", "enduit", "enduits",
  "crépi", "gravillon", "gravier", "ciment", "chaux", "plâtre", "lambris",
  "bardage", "bardages", "OSB", "contreplaqué", "aggloméré", "fermacell",
  "laine", "polystyrène", "polyuréthane", "ouate", "cellulose",
  "VMC", "placoplatre", "fibrociment", "ardoise", "ardoises", "tuile", "tuiles",
  "zinguerie", "gouttière", "gouttières", "chéneau", "faîtage", "solin",
  "parquet", "stratifié", "PVC", "carrelage", "faïence", "joint", "joints",
  "cloison", "cloisons", "doublage", "chape", "chapes", "ragréage",
  "placoplâtre", "Velux", "fenêtre", "fenêtres", "menuiseries", "huisserie",
  "huisseries", "volet", "volets", "store", "stores", "portail", "portails",
  // Termes techniques / prestations
  "fourniture", "fournitures", "pose", "dépose", "raccordement", "raccordements",
  "réseau", "réseaux", "évacuation", "alimentation", "branchement", "branchements",
  "tableau", "disjoncteur", "disjoncteurs", "prise", "prises", "interrupteur",
  "luminaire", "luminaires", "chauffe-eau", "ballon", "chaudière", "chaudières",
  "radiateur", "radiateurs", "plancher", "chauffant", "climatisation",
  "ventilation", "extraction", "insufflation", "tuyauterie", "canalisation",
  "canalisations", "regard", "fosse", "septique", "assainissement",
  "fondation", "fondations", "semelle", "semelles", "longrine", "linteau",
  "linteaux", "poutre", "poutres", "poutrelle", "hourdis", "ferraillage",
  "coffrage", "décoffrage", "banchage", "dallage", "dalle", "dalles",
  "ossature", "bastaing", "chevron", "chevrons", "liteau", "liteaux", "voliges",
  "réhausse", "rehausse", "VRD", "enrobé", "enrobés", "pavé", "pavés", "bordure",
  "bordures", "caniveau", "regard", "muret", "murets", "clôture", "clôtures",
  "grillage", "soubassement", "appui", "appuis", "seuil", "seuils",
  "décennale", "biennale", "parfait", "achèvement", "réception", "métré",
  "métrés", "DTU", "RGE", "Qualibat", "RT2012", "RE2020", "PMR",
  "ml", "m²", "m³", "forfait", "ensemble", "unité", "unitaire",
  "TTC", "HT", "TVA", "acompte", "acomptes", "situation", "situations",
  "avenant", "avenants", "sous-traitance", "sous-traitant", "sous-traitants",
];
