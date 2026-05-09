import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User as UserIcon, Building2, Check, X } from "lucide-react";

import { cn } from "@btp/ui";
import { Input } from "@/components/ui/input";
import { useClientsStore } from "@/stores/clientsStore";
import type { Client } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// ClientSelector — Recherche + sélection d'un client dans la base
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  value: string;                       // clientId sélectionné (vide si aucun)
  onChange: (clientId: string, client: Client | null) => void;
  placeholder?: string;
  className?: string;
}

export function ClientSelector({ value, onChange, placeholder = "Rechercher un client...", className }: Props) {
  const { clients, fetch } = useClientsStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch();
  }, []);

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

  const selected = clients.find((c) => c.id === value);

  const filtered = clients.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [
      c.firstName, c.lastName, c.companyName,
      c.email, c.phoneMobile, c.city, c.postalCode,
    ].join(" ").toLowerCase().includes(q);
  });

  const displayName = (c: Client) =>
    c.type === "pro" && c.companyName
      ? c.companyName
      : `${c.firstName} ${c.lastName}`.trim() || "—";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Display when selected */}
      {selected && !open ? (
        <div
          onClick={() => { setOpen(true); setQuery(""); }}
          className="flex items-center gap-2 p-2 rounded-md border border-input bg-background hover:bg-accent cursor-pointer"
        >
          <div className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
            selected.type === "pro" ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/15 text-violet-500"
          )}>
            {selected.type === "pro" ? <Building2 className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName(selected)}</p>
            {(selected.city || selected.email) && (
              <p className="text-xs text-muted-foreground truncate">
                {selected.city || selected.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange("", null); setQuery(""); }}
            className="text-muted-foreground hover:text-foreground"
            title="Désélectionner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-9"
          />
        </div>
      )}

      {/* Suggestions */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-soft-md z-30 max-h-80 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {clients.length === 0
                  ? "Aucun client dans votre base. Créez-en un d'abord."
                  : "Aucun résultat"}
              </div>
            ) : (
              filtered.slice(0, 50).map((c) => {
                const isSelected = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c.id, c);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 hover:bg-accent text-left transition-colors border-b border-border last:border-0",
                      isSelected && "bg-accent/60"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                      c.type === "pro" ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/15 text-violet-500"
                    )}>
                      {c.type === "pro" ? <Building2 className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{displayName(c)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.city && `${c.city}`}
                        {c.city && c.phoneMobile && " · "}
                        {c.phoneMobile}
                      </p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
