import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

import { cn } from "@btp/ui";
import { Input } from "@/components/ui/input";
import { useDesignationHistory, type DesignationSuggestion } from "../hooks/useDesignationHistory";
import { formatEuros } from "../quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// DesignationInput — Input "Désignation" avec autocomplete sur l'historique
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  value: string;
  onChange: (value: string) => void;
  onApply: (suggestion: DesignationSuggestion) => void;
  placeholder?: string;
  className?: string;
}

export function DesignationInput({ value, onChange, onApply, placeholder, className }: Props) {
  const { search } = useDesignationHistory();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const matches = focused && value.length >= 2 ? search(value, 5) : [];
  const showDropdown = open && focused && matches.length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className="font-medium"
        autoComplete="off"
      />

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-soft-md z-30 max-h-72 overflow-y-auto"
          >
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 font-semibold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Déjà utilisé dans vos devis
            </div>
            {matches.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onApply(s);
                  setOpen(false);
                }}
                className="w-full flex items-start gap-2 p-2 hover:bg-accent text-left border-b border-border last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{s.title}</p>
                  {s.description && (
                    <p className="text-[10px] text-muted-foreground truncate">{s.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold tabular-nums">{formatEuros(s.unitPriceHT)}</p>
                  <p className="text-[10px] text-muted-foreground">/ {s.unit} · {s.vatRate}%</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
