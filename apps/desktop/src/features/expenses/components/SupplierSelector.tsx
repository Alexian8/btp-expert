import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Building2, X, Plus } from "lucide-react";

import { cn } from "@btp/ui";
import { Input } from "@/components/ui/input";
import { useSuppliersStore } from "@/stores/suppliersStore";
import type { Supplier } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// SupplierSelector — Composant d'autocomplete pour fournisseurs
// Permet aussi de saisir un nom libre (sans fournisseur enregistré)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  value: string;             // supplierId si lié, "" sinon
  freeText: string;          // nom libre si pas de fournisseur lié
  onChange: (supplierId: string, supplierName: string) => void;
  placeholder?: string;
  className?: string;
}

export function SupplierSelector({ value, freeText, onChange, placeholder, className }: Props) {
  const { suppliers, fetch } = useSuppliersStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Si on a un supplierId, afficher le supplier sélectionné
  const selectedSupplier = value ? suppliers.find((s) => s.id === value) : null;

  const filtered = query.trim()
    ? suppliers.filter((s) =>
        s.companyName?.toLowerCase().includes(query.toLowerCase()) ||
        `${s.contactFirstName || ""} ${s.contactLastName || ""}`.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : suppliers.slice(0, 8);

  const handleSelectSupplier = (supplier: Supplier) => {
    onChange(supplier.id, supplier.companyName);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("", "");
    setQuery("");
  };

  const handleFreeTextChange = (val: string) => {
    setQuery(val);
    if (!value) {
      onChange("", val);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {selectedSupplier ? (
        <div className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-card">
          <div className="w-8 h-8 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedSupplier.companyName}</p>
            {(selectedSupplier.contactFirstName || selectedSupplier.contactLastName) && (
              <p className="text-xs text-muted-foreground truncate">
                {selectedSupplier.contactFirstName} {selectedSupplier.contactLastName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={freeText || query}
              onChange={(e) => handleFreeTextChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder || "Nom du fournisseur ou rechercher..."}
              className="pl-9"
            />
          </div>

          <AnimatePresence>
            {open && filtered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-soft-lg z-20 max-h-64 overflow-y-auto"
              >
                {filtered.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => handleSelectSupplier(supplier)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{supplier.companyName}</p>
                      {(supplier.contactFirstName || supplier.contactLastName) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {supplier.contactFirstName} {supplier.contactLastName}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {(freeText || query) && !value && (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Plus className="w-3 h-3" />
              Saisie libre — non lié à un fournisseur enregistré
            </p>
          )}
        </>
      )}
    </div>
  );
}
