// ═══════════════════════════════════════════════════════════════════════════
// references.ts — Génération de références séquentielles uniformes
//
// Format : <PREFIX>-<YYYY>-<NNNN>  (ex: FACT-2026-0001, DEVIS-2026-0001,
// DEP-2026-0001). Le compteur redémarre à 1 chaque année.
//
// Utilisé côté serveur pour aligner le comportement sur celui du desktop
// Electron (apps/desktop/electron/main.js : nextInvoiceReference, etc.).
// Une référence vide ou non fournie déclenche l'auto-génération.
// ═══════════════════════════════════════════════════════════════════════════

import type { DB as Pool, RowDataPacket } from "../db";

function genUuid(): string {
  // Compatible MySQL VARCHAR(64). Pas besoin d'UUID strict.
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Génère la prochaine référence pour une table donnée.
 * Cherche le MAX(reference) matching `<prefix>-<year>-XXXX` et ajoute 1.
 */
export type ReferenceTable = "invoices" | "quotes" | "expenses" | "expense_notes";

export async function nextReference(
  db: Pool,
  table: ReferenceTable,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT reference FROM \`${table}\`
     WHERE reference LIKE ?
     ORDER BY reference DESC LIMIT 1`,
    [like]
  );
  let next = 1;
  const last = rows[0] as { reference?: string } | undefined;
  if (last && last.reference) {
    const m = last.reference.match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

/**
 * Helper pour les hooks beforeCreate des routes CRUD :
 *   - Si `id` n'est pas fourni → en génère un avec le préfixe donné
 *   - Si `reference` n'est pas fournie / vide → la génère via nextReference
 */
export function makeReferenceHook(opts: {
  db: Pool;
  idPrefix: string;
  table: ReferenceTable;
  referencePrefix: string;
}) {
  return async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const out: Record<string, unknown> = { ...body };
    if (!out.id || typeof out.id !== "string" || !out.id) {
      out.id = `${opts.idPrefix}_${genUuid()}`;
    }
    const currentRef = out.reference;
    if (
      currentRef === undefined ||
      currentRef === null ||
      (typeof currentRef === "string" && currentRef.trim() === "")
    ) {
      out.reference = await nextReference(opts.db, opts.table, opts.referencePrefix);
    }
    return out;
  };
}
