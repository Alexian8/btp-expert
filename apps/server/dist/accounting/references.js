"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextReference = nextReference;
exports.makeReferenceHook = makeReferenceHook;
function genUuid() {
    // Compatible MySQL VARCHAR(64). Pas besoin d'UUID strict.
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
async function nextReference(db, table, prefix) {
    const year = new Date().getFullYear();
    const like = `${prefix}-${year}-%`;
    const [rows] = await db.query(`SELECT reference FROM \`${table}\`
     WHERE reference LIKE ?
     ORDER BY reference DESC LIMIT 1`, [like]);
    let next = 1;
    const last = rows[0];
    if (last && last.reference) {
        const m = last.reference.match(/-(\d+)$/);
        if (m)
            next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}
/**
 * Helper pour les hooks beforeCreate des routes CRUD :
 *   - Si `id` n'est pas fourni → en génère un avec le préfixe donné
 *   - Si `reference` n'est pas fournie / vide → la génère via nextReference
 */
function makeReferenceHook(opts) {
    return async (body) => {
        const out = { ...body };
        if (!out.id || typeof out.id !== "string" || !out.id) {
            out.id = `${opts.idPrefix}_${genUuid()}`;
        }
        const currentRef = out.reference;
        if (currentRef === undefined ||
            currentRef === null ||
            (typeof currentRef === "string" && currentRef.trim() === "")) {
            out.reference = await nextReference(opts.db, opts.table, opts.referencePrefix);
        }
        return out;
    };
}
