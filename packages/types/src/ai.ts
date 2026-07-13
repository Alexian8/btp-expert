// ═══════════════════════════════════════════════════════════════════════════
// Types IA locale — assistant embarqué côté serveur (node-llama-cpp, GGUF)
//
// L'inférence tourne SUR le serveur (routes /api/ai/*) : le web et iOS y
// accèdent via REST, le desktop (SQLite local, sans serveur) expose des stubs
// « indisponible » et l'UI masque les boutons IA.
// ⚠️ Le serveur ne peut pas importer @btp/types à l'exécution (package
// source-only) : les formes ci-dessous sont dupliquées dans
// apps/server/src/ai/ — garder les deux alignées.
// ═══════════════════════════════════════════════════════════════════════════

import type { ExpenseCategory } from "./accounting";

/** Statut du service IA vu par le serveur (jamais de chemin complet ni secret). */
export interface AiStatus {
  /** Prêt à répondre : activé + module installé + fichier modèle présent. */
  available: boolean;
  /** AI_MODEL_PATH est configuré côté serveur. */
  enabled: boolean;
  /** Le modèle est déjà chargé en RAM (chargement paresseux à la 1ʳᵉ requête). */
  modelLoaded: boolean;
  /** Nom du fichier GGUF (basename uniquement). */
  modelFile: string;
  /** Si !available : explication actionnable (module manquant, fichier introuvable…). */
  reason?: string;
  threads?: number;
  contextSize?: number;
}

// ─── Suggestion de description de ligne de devis ─────────────────────────
export interface AiSuggestQuoteLineArgs {
  /** Désignation de la ligne (ex: « Pose de carrelage 30×30 »). */
  title: string;
  /** Description existante / points à intégrer (optionnel). */
  description?: string;
}

export interface AiSuggestQuoteLineResult {
  success: boolean;
  description?: string;
  durationMs?: number;
  error?: string;
}

// ─── Catégorisation automatique d'une dépense ─────────────────────────────
export interface AiCategorizeExpenseArgs {
  /** Libellé de la dépense (ex: « 12 sacs de ciment + tasseaux »). */
  description: string;
  supplierName?: string;
}

export interface AiCategorizeExpenseResult {
  success: boolean;
  category?: ExpenseCategory;
  durationMs?: number;
  error?: string;
}

// ─── Test admin (Paramètres → IA locale) ──────────────────────────────────
export interface AiTestResult {
  success: boolean;
  output?: string;
  durationMs?: number;
  modelFile?: string;
  error?: string;
}
