// ═══════════════════════════════════════════════════════════════════════════
// Prompts IA — construction des prompts et parsing des réponses (logique pure)
//
// Aucune dépendance au moteur d'inférence : tout est testable en vitest.
// Les prompts sont calibrés pour un PETIT modèle instruct (0.5B–1.5B, ex.
// Qwen2.5-1.5B-Instruct Q4_K_M) : consignes courtes, format de sortie strict.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catégories de dépenses proposées au modèle.
 * ⚠️ Dupliqué depuis packages/types/src/accounting.ts (ExpenseCategory /
 * EXPENSE_CATEGORY_META) car le serveur ne peut pas importer @btp/types à
 * l'exécution (package source-only) — garder les deux listes alignées.
 */
export const AI_EXPENSE_CATEGORIES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "materiaux", label: "Matériaux de construction" },
  { key: "outillage", label: "Matériel et outillage" },
  { key: "carburant", label: "Carburant véhicules" },
  { key: "vehicule", label: "Entretien / réparation / location véhicule" },
  { key: "sous_traitance", label: "Sous-traitants" },
  { key: "loyer", label: "Loyer atelier ou local" },
  { key: "energie", label: "Électricité, gaz, eau du local" },
  { key: "telecom", label: "Téléphone, internet" },
  { key: "assurance", label: "Assurances pro (décennale, RC…)" },
  { key: "frais_bancaires", label: "Frais bancaires, commissions, agios" },
  { key: "honoraires", label: "Expert-comptable, avocat" },
  { key: "fourniture", label: "Fournitures de bureau, EPI" },
  { key: "repas", label: "Restaurant, déjeuner chantier" },
  { key: "deplacement", label: "Péages, parking, hôtel" },
  { key: "formation", label: "Formations professionnelles" },
  { key: "logiciel", label: "Abonnements logiciels" },
  { key: "publicite", label: "Marketing, publicité, cartes de visite" },
  { key: "autre", label: "Autre" },
];

// ─── Devis : description de ligne ─────────────────────────────────────────

export function buildQuoteLinePrompts(args: {
  title: string;
  description?: string;
}): { system: string; prompt: string } {
  const system =
    "Tu es l'assistant d'un artisan du bâtiment français. " +
    "Tu rédiges des descriptions courtes, professionnelles et techniques pour ses lignes de devis. " +
    "Réponds uniquement avec le texte demandé : pas de préambule, pas de guillemets, pas de liste à puces, pas de prix.";

  const notes = (args.description ?? "").trim();
  const prompt =
    `Rédige la description d'une ligne de devis intitulée : « ${args.title.trim()} ». ` +
    (notes ? `Points à intégrer : ${notes}. ` : "") +
    "2 à 3 phrases (60 mots maximum) décrivant la prestation, les matériaux et la mise en œuvre. " +
    "N'invente ni marque, ni prix, ni dimension non fournie.";

  return { system, prompt };
}

/**
 * Nettoie la sortie du modèle pour une description de ligne : retire
 * guillemets/puces/markdown, compresse les espaces, borne la longueur.
 */
export function sanitizeQuoteLineDescription(raw: string): string {
  let text = String(raw ?? "").trim();
  // Retire un éventuel bloc « Description : » en tête
  text = text.replace(/^description\s*:\s*/i, "");
  // Retire les puces / numérotations de début de ligne
  text = text
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+[.)]\s+/, ""))
    .join(" ");
  // Retire guillemets englobants et gras markdown
  text = text.replace(/\*\*/g, "").replace(/^["'«\s]+/, "").replace(/["'»\s]+$/, "");
  // Espaces multiples → simple
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > 600) {
    // Coupe à la dernière phrase complète avant 600 caractères
    const cut = text.slice(0, 600);
    const lastDot = cut.lastIndexOf(".");
    text = lastDot > 100 ? cut.slice(0, lastDot + 1) : cut;
  }
  return text;
}

// ─── Dépenses : catégorisation ─────────────────────────────────────────────

export function buildExpenseCategoryPrompts(args: {
  description: string;
  supplierName?: string;
}): { system: string; prompt: string } {
  const system =
    "Tu es l'assistant comptable d'un artisan du bâtiment français. " +
    "Tu classes les dépenses. Tu réponds toujours par UN SEUL MOT : la clé de catégorie, rien d'autre.";

  const keys = AI_EXPENSE_CATEGORIES.map((c) => `${c.key} = ${c.label}`).join("\n");
  const supplier = (args.supplierName ?? "").trim();
  const prompt =
    `Clés de catégorie possibles :\n${keys}\n\n` +
    `Dépense : « ${args.description.trim()} »` +
    (supplier ? ` (fournisseur : ${supplier})` : "") +
    ".\nRéponds uniquement par la clé (ex: materiaux).";

  return { system, prompt };
}

/** Minuscules + sans accents + séparateurs unifiés, pour comparaison tolérante. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_");
}

/**
 * Extrait une clé de catégorie valide de la sortie du modèle.
 * Tolère la ponctuation, les accents, les tirets (« sous-traitance ») et les
 * réponses verbeuses (« La catégorie est : carburant. »). Retourne null si
 * aucune catégorie reconnue.
 */
export function parseExpenseCategory(raw: string): string | null {
  const text = normalize(String(raw ?? ""));
  if (!text) return null;

  // 1) Match exact d'une clé sur le premier mot significatif
  const firstWord = text.replace(/^[^a-z_]+/, "").split(/[^a-z_]+/)[0] ?? "";
  for (const { key } of AI_EXPENSE_CATEGORIES) {
    if (firstWord === key) return key;
  }

  // 2) Clé présente quelque part dans la réponse (réponse verbeuse).
  //    Les clés longues d'abord pour éviter qu'une clé courte contenue dans
  //    une plus longue ne gagne à tort.
  const byLength = [...AI_EXPENSE_CATEGORIES].sort((a, b) => b.key.length - a.key.length);
  for (const { key } of byLength) {
    if (text.includes(key)) return key;
  }

  // 3) Match sur le libellé (le modèle a répondu « Matériaux de construction »)
  for (const { key, label } of byLength) {
    if (text.includes(normalize(label))) return key;
  }

  return null;
}
