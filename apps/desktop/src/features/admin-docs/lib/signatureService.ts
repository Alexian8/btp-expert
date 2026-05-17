// ═══════════════════════════════════════════════════════════════════════════
// Service de signature pour les documents administratifs.
//
// Une seule interface qui couvre :
//   - signature manuscrite locale (canvas → data URL PNG)
//   - signature électronique tierce (Yousign / Docusign) — pas encore branché
//
// L'UI ne dépend que de l'interface. Pour brancher Yousign plus tard, il suffit
// d'ajouter un provider qui implémente `requestSignature()` en appelant son API.
// ═══════════════════════════════════════════════════════════════════════════

export type SignatureProvider = "canvas" | "yousign" | "docusign";

export interface SignatureRequest {
  /** Type de document à signer (informatif, sert au libellé UI / audit) */
  docType: "reception" | "tva" | "dc4" | "rge";
  /** ID interne du document */
  docId: string;
  /** Identification humaine du signataire */
  signerName: string;
  signerRole?: string;
  signerEmail?: string;
  /** Champ qui recevra la data URL (ownerSignatureDataUrl, etc.) */
  fieldName: string;
}

export interface SignatureResult {
  /** Provider qui a produit la signature */
  provider: SignatureProvider;
  /** Data URL PNG (canvas) ou URL externe (provider tiers) */
  signatureDataUrl: string;
  /** Date ISO où la signature a été produite */
  signedAt: string;
  /** ID de transaction côté provider tiers, si applicable */
  externalId?: string;
}

export interface SignatureService {
  readonly provider: SignatureProvider;
  /**
   * Affiche le flow de signature (modal canvas ou redirect Yousign).
   * Le caller (composant React) gère le rendu visuel — ici on retourne
   * une promesse qui résoud quand la signature est faite.
   */
  isAvailable(): boolean;
}

// ─── Provider local : canvas ───────────────────────────────────────────────
// Toujours disponible côté front. La signature est embarquée dans le PDF lors
// de la prochaine génération (les templates HTML insèrent l'<img> data URL).
export const canvasSignatureService: SignatureService = {
  provider: "canvas",
  isAvailable: () => true,
};

// ─── Provider Yousign (placeholder, à brancher ultérieurement) ─────────────
// L'enveloppe est créée par l'API Yousign, qui envoie un email au signataire
// avec un lien sécurisé. On stocke l'externalId et on attend le webhook.
// TODO: implémenter dans une session dédiée (clés API à provisionner).
export const yousignSignatureService: SignatureService = {
  provider: "yousign",
  isAvailable: () => false, // intégration tierce non encore activée
};

// ─── Sélection du provider courant ─────────────────────────────────────────
// Pour l'instant, toujours canvas. Plus tard : configurable via /api/settings
// (clé "signatureProvider" → "canvas" | "yousign").
export function getActiveSignatureService(): SignatureService {
  if (yousignSignatureService.isAvailable()) return yousignSignatureService;
  return canvasSignatureService;
}
