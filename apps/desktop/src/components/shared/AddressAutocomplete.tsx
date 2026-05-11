import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";

import { cn } from "@btp/ui";
import { Input } from "@/components/ui/input";
import { searchAddress, buildAddressLine1, type BanAddress } from "@/lib/addressService";

// ═══════════════════════════════════════════════════════════════════════════
// AddressAutocomplete — Recherche d'adresse via Base Adresse Nationale
//
// Usage :
//   <AddressAutocomplete
//     value={formData.addressLine1}
//     onChange={(line1) => update_("addressLine1", line1)}
//     onSelect={(addr) => {
//       // remplit tout : ligne1, CP, ville
//     }}
//     placeholder="Commencez à taper..."
//   />
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (addr: BanAddress) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value, onChange, onSelect,
  placeholder = "Commencez à taper l'adresse...",
  className,
  disabled,
}: Props) {
  const [suggestions, setSuggestions] = useState<BanAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Recherche débouncée
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    // Si on a sélectionné juste avant, on attend que le user retape
    if (selectedId && value === selectedId) return;

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddress(value, 8);
      setSuggestions(results);
      setLoading(false);
      if (results.length > 0) setOpen(true);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSelect = (addr: BanAddress) => {
    const line1 = buildAddressLine1(addr);
    onChange(line1);
    setSelectedId(line1);
    onSelect(addr);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSelectedId(null);
            if (e.target.value.length >= 3) setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="pl-9"
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-soft-md z-30 max-h-80 overflow-y-auto"
          >
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full flex items-start gap-3 p-2.5 hover:bg-accent text-left transition-colors border-b border-border last:border-0"
              >
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  {s.context && (
                    <p className="text-xs text-muted-foreground truncate">{s.context}</p>
                  )}
                </div>
              </button>
            ))}
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border bg-muted/30">
              Données : Base Adresse Nationale (IGN · La Poste)
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
