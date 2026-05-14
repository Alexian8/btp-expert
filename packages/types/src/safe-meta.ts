// ═══════════════════════════════════════════════════════════════════════════
// safeMeta — rend les maps "META" incassables face aux clés inconnues.
//
// PROBLÈME : partout dans l'app, du code fait
//     META[entity.status].colorTw   ou   META[entity.category].label
// Si la valeur de données ne correspond à AUCUNE clé connue (donnée serveur
// désynchronisée, enum élargi, champ vide en base...), `META[x]` vaut
// `undefined` et l'accès `.colorTw` crashe toute la page React.
//
// SOLUTION : safeMeta() wrappe la map dans un Proxy :
//   - clé connue   → valeur réelle (inchangé)
//   - clé inconnue → entrée NEUTRE incassable ("—", gris) au lieu d'undefined
//
// Object.keys / Object.entries / for...in ne sont PAS affectés : ils
// n'itèrent que les vraies clés. Seul l'accès direct META[x] est protégé.
// ═══════════════════════════════════════════════════════════════════════════

// Entrée neutre : tout accès de propriété renvoie une valeur d'affichage sûre,
// quelle que soit la forme attendue (label / colorTw / color / rate...).
const NEUTRAL_ENTRY: Record<string, unknown> = new Proxy(
  {},
  {
    get(_t, prop): unknown {
      if (typeof prop === "symbol") return undefined;
      const p = String(prop);
      if (/label|description|text|title|name/i.test(p)) return "—";
      if (p === "colorTw") return "bg-slate-500/15 text-slate-500";
      if (p === "color") return "slate";
      if (/rate|percent|days|count|order|num/i.test(p)) return 0;
      return "";
    },
  }
);

/**
 * Wrappe un objet META pour qu'un accès par clé inconnue retourne une
 * entrée neutre au lieu de `undefined`. Le type d'origine est préservé.
 */
export function safeMeta<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop, receiver): unknown {
      if (typeof prop === "symbol" || prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      // Clé string inconnue → entrée neutre incassable.
      return NEUTRAL_ENTRY;
    },
  }) as T;
}
