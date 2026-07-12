import { useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useCountUp — anime un nombre de 0 → valeur cible (ease-out) en `duration` ms.
// Utilisé pour faire défiler les gros chiffres du dashboard (CA…).
// ═══════════════════════════════════════════════════════════════════════════
export function useCountUp(target: number, duration = 500): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // Respecte "prefers-reduced-motion" : pas d'animation
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    startRef.current = null;
    const from = 0;
    const step = (ts: number): void => {
      if (startRef.current == null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(from + (target - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}
