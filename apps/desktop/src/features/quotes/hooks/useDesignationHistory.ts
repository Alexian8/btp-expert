import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useDesignationHistory — Historique des désignations utilisées dans les devis
// ═══════════════════════════════════════════════════════════════════════════

export interface DesignationSuggestion {
  title: string;
  description: string;
  unit: string;
  unitPriceHT: number;
  vatRate: number;
  count: number;
}

export function useDesignationHistory() {
  const [suggestions, setSuggestions] = useState<DesignationSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.btpAPI?.quotesGetDesignationHistory) return;
      const list = await window.btpAPI.quotesGetDesignationHistory();
      if (!cancelled) {
        setSuggestions(list);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const search = (query: string, limit = 6): DesignationSuggestion[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return suggestions
      .filter((s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .slice(0, limit);
  };

  return { suggestions, loaded, search };
}
