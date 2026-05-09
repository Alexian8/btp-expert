import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, BookOpen, Plus } from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useLibraryStore } from "@/stores/libraryStore";
import { LIBRARY_CATEGORIES, type LibraryItem } from "@btp/types";
import { formatEuros } from "../quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// LibraryPicker — Modal de sélection d'une prestation depuis la bibliothèque
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (item: LibraryItem) => void;
}

export function LibraryPicker({ open, onClose, onSelect }: Props) {
  const { items, fetch } = useLibraryStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | string>("all");

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "all" && it.category !== category) return false;
      if (q) {
        const hay = `${it.title} ${it.description} ${it.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, category]);

  const handleSelect = (it: LibraryItem) => {
    onSelect(it);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Bibliothèque de prestations</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Filtres */}
            <div className="p-3 border-b border-border flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher dans la bibliothèque..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              <NativeSelect
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-auto min-w-[160px]"
              >
                <option value="all">Toutes catégories</option>
                {LIBRARY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </NativeSelect>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto p-3">
              {items.length === 0 ? (
                <div className="p-12 text-center">
                  <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">Bibliothèque vide</p>
                  <p className="text-xs text-muted-foreground">
                    Ajoutez vos prestations récurrentes dans Paramètres → Bibliothèque.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Aucune prestation ne correspond à votre recherche.
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => handleSelect(it)}
                      className="w-full flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/50 hover:border-primary/40 text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="font-medium text-sm">{it.title}</p>
                          {it.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {it.category}
                            </span>
                          )}
                          {it.usageCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              · utilisée {it.usageCount} fois
                            </span>
                          )}
                        </div>
                        {it.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{formatEuros(it.unitPriceHT)}</p>
                        <p className="text-[10px] text-muted-foreground">/ {it.unit} · TVA {it.vatRate}%</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground text-center">
                {filtered.length} prestation{filtered.length > 1 ? "s" : ""} · Triées par fréquence d'usage
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
