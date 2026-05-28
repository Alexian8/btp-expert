// ═══════════════════════════════════════════════════════════════════════════
// prediction — moteur de prédiction / autocomplétion de mots.
//
// 3 sources combinées et pondérées :
//   1. Apprentissage : les mots que l'utilisateur a déjà tapés (localStorage,
//      avec compteur de fréquence) → poids le plus fort.
//   2. Vocabulaire BTP : termes métier (matériaux, prestations…).
//   3. Dictionnaire français : mots courants chargés depuis le .dic Hunspell.
//
// La prédiction renvoie les meilleurs mots commençant par le préfixe saisi.
// ═══════════════════════════════════════════════════════════════════════════

import { BTP_VOCABULARY } from "./spellchecker";

const LEARN_KEY = "btp.predict.learned";
const MAX_LEARNED = 2000;

// Mot → nombre d'utilisations
let learned: Record<string, number> = {};
let frenchWords: string[] = [];
let frenchLoaded = false;
let loadingPromise: Promise<void> | null = null;

function loadLearned(): void {
  try {
    const raw = localStorage.getItem(LEARN_KEY);
    if (raw) learned = JSON.parse(raw) as Record<string, number>;
  } catch {
    learned = {};
  }
}

function persistLearned(): void {
  try {
    // Si trop d'entrées, on garde les plus fréquentes
    const entries = Object.entries(learned);
    if (entries.length > MAX_LEARNED) {
      entries.sort((a, b) => b[1] - a[1]);
      learned = Object.fromEntries(entries.slice(0, MAX_LEARNED));
    }
    localStorage.setItem(LEARN_KEY, JSON.stringify(learned));
  } catch {
    /* ignore */
  }
}

/**
 * Charge la liste des mots français depuis le dictionnaire Hunspell (.dic).
 * Le format est "mot/flags" — on ne garde que la racine. Une seule fois.
 */
export async function loadPredictionDictionary(): Promise<void> {
  if (frenchLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadLearned();
  loadingPromise = (async () => {
    try {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${base}dict/fr.dic`);
      if (!res.ok) throw new Error("dico introuvable");
      const text = await res.text();
      const lines = text.split("\n");
      const out: string[] = [];
      // 1ʳᵉ ligne = nombre d'entrées, on la saute
      for (let i = 1; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw) continue;
        const word = raw.split("/")[0].trim();
        // On garde les mots alphabétiques de 3+ lettres, en minuscules,
        // sans apostrophe ni tiret initial (pour une prédiction propre).
        if (word.length >= 3 && /^[a-zàâäçéèêëîïôöùûüÿœæ-]+$/i.test(word)) {
          out.push(word.toLowerCase());
        }
      }
      frenchWords = out;
      frenchLoaded = true;
    } catch (e) {
      console.warn("[prediction] dico non chargé :", (e as Error).message);
      frenchLoaded = true; // on ne réessaie pas en boucle
    }
  })();
  return loadingPromise;
}

/** Enregistre les mots d'un texte saisi par l'utilisateur (apprentissage). */
export function learnFromText(text: string): void {
  if (!text) return;
  const words = text
    .toLowerCase()
    .split(/[^a-zàâäçéèêëîïôöùûüÿœæ-]+/i)
    .filter((w) => w.length >= 3 && w.length <= 30);
  let changed = false;
  for (const w of words) {
    learned[w] = (learned[w] || 0) + 1;
    changed = true;
  }
  if (changed) persistLearned();
}

const BTP_SET = new Set(BTP_VOCABULARY.map((w) => w.toLowerCase()));

/**
 * Renvoie jusqu'à `limit` suggestions commençant par `prefix`.
 * Priorité : mots appris (forte fréquence) > BTP > français courant.
 * Préserve la casse du préfixe (Maj initiale).
 */
export function predict(prefix: string, limit = 5): string[] {
  const p = prefix.trim().toLowerCase();
  if (p.length < 2) return [];

  const scored = new Map<string, number>();
  const consider = (word: string, baseScore: number) => {
    if (word === p) return; // pas de suggestion identique au préfixe complet
    if (!word.startsWith(p)) return;
    const prev = scored.get(word) ?? 0;
    if (baseScore > prev) scored.set(word, baseScore);
  };

  // 1. Mots appris (score = fréquence d'usage, fortement pondérée)
  for (const [word, count] of Object.entries(learned)) {
    if (word.startsWith(p)) consider(word, 10000 + count * 100);
  }

  // 2. Vocabulaire BTP
  for (const word of BTP_SET) {
    if (word.startsWith(p)) consider(word, 5000 - word.length);
  }

  // 3. Français courant (les plus courts d'abord = souvent plus fréquents)
  if (frenchWords.length) {
    let found = 0;
    for (const word of frenchWords) {
      if (word.startsWith(p)) {
        consider(word, 1000 - word.length);
        if (++found > 200) break; // limite le balayage
      }
    }
  }

  const ranked = [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, limit)
    .map(([w]) => w);

  // Restaurer la casse : si le préfixe commence par une majuscule
  const startsUpper = prefix[0] === prefix[0]?.toUpperCase() && /[a-zàâäçéèêëîïôöùûüÿœæ]/i.test(prefix[0] || "");
  if (startsUpper) {
    return ranked.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  }
  return ranked;
}
