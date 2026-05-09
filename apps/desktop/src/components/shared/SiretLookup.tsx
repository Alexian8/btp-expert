import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Building2, Loader2, Check, AlertTriangle, X, Info } from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  lookupBySiret,
  searchByName,
  formatSiret,
  cleanSiret,
  isValidSiretFormat,
  etatLabel,
  type SireneCompany,
} from "@/lib/sireneService";

// ═══════════════════════════════════════════════════════════════════════════
// SiretLookup — Composant réutilisable pour rechercher une entreprise
//
// Deux modes :
//   - SIRET : saisie des 14 chiffres → 1 clic sur Vérifier → résultat unique
//   - Nom : saisie libre → suggestions en temps réel → clic pour sélectionner
//
// Quand l'utilisateur trouve et valide une entreprise, on appelle onSelect(company)
// pour pré-remplir les champs du formulaire parent.
// ═══════════════════════════════════════════════════════════════════════════

type Mode = "siret" | "name";

interface SiretLookupProps {
  onSelect: (company: SireneCompany) => void;
  defaultMode?: Mode;
  label?: string;
  className?: string;
}

export function SiretLookup({ onSelect, defaultMode = "siret", label, className }: SiretLookupProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [siret, setSiret] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SireneCompany | null>(null);
  const [suggestions, setSuggestions] = useState<SireneCompany[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Recherche par SIRET (bouton) ─────────────────────────────────────
  const handleSiretSearch = async () => {
    setError(null);
    setResult(null);
    if (!isValidSiretFormat(siret)) {
      setError("Le SIRET doit contenir 14 chiffres");
      return;
    }
    setLoading(true);
    try {
      const res = await lookupBySiret(siret);
      if (!res) {
        setError("Aucune entreprise trouvée pour ce SIRET");
      } else {
        setResult(res);
      }
    } catch (e: any) {
      setError(e.message || "Erreur de recherche");
    }
    setLoading(false);
  };

  // ─── Recherche par nom (auto, débouncée) ──────────────────────────────
  useEffect(() => {
    if (mode !== "name") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setError(null);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchByName(query, 8);
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch (e: any) {
        setError(e.message || "Erreur de recherche");
        setSuggestions([]);
      }
      setLoading(false);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  // ─── Sélectionner un résultat ─────────────────────────────────────────
  const handleSelect = (company: SireneCompany) => {
    setResult(company);
    setShowSuggestions(false);
    setSuggestions([]);
    onSelect(company);
  };

  const handleClear = () => {
    setSiret("");
    setQuery("");
    setResult(null);
    setSuggestions([]);
    setError(null);
  };

  const etat = result ? etatLabel(result.etat) : null;

  return (
    <div className={cn("space-y-3", className)}>
      {label && <Label>{label}</Label>}

      {/* Toggle mode */}
      <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
        <button
          type="button"
          onClick={() => { setMode("siret"); handleClear(); }}
          className={cn(
            "px-3 py-1.5 rounded transition-colors",
            mode === "siret" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Par SIRET
        </button>
        <button
          type="button"
          onClick={() => { setMode("name"); handleClear(); }}
          className={cn(
            "px-3 py-1.5 rounded transition-colors",
            mode === "name" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Par nom
        </button>
      </div>

      {/* Mode SIRET */}
      {mode === "siret" && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={siret}
              onChange={(e) => {
                // Formatage auto pendant la saisie
                const raw = cleanSiret(e.target.value);
                if (raw.length <= 14) {
                  setSiret(formatSiret(raw));
                }
              }}
              placeholder="123 456 789 00012"
              className="pl-9 font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSiretSearch();
                }
              }}
            />
          </div>
          <Button
            type="button"
            onClick={handleSiretSearch}
            loading={loading}
            disabled={!isValidSiretFormat(siret)}
          >
            <Search className="w-4 h-4" />
            Vérifier
          </Button>
        </div>
      )}

      {/* Mode Nom */}
      {mode === "name" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom de la société, ville..."
            className="pl-9"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}

          {/* Suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-soft-md z-20 max-h-80 overflow-y-auto"
              >
                {suggestions.map((s) => {
                  const e = etatLabel(s.etat);
                  return (
                    <button
                      key={s.siret}
                      type="button"
                      onClick={() => handleSelect(s)}
                      className="w-full flex items-start gap-3 p-3 hover:bg-accent text-left transition-colors border-b border-border last:border-0"
                    >
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{s.nom}</p>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            e.color === "success" && "bg-success/15 text-success",
                            e.color === "warning" && "bg-warning/15 text-warning",
                            e.color === "destructive" && "bg-destructive/15 text-destructive",
                            e.color === "muted" && "bg-muted text-muted-foreground"
                          )}>{e.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.formeJuridique && <span>{s.formeJuridique} · </span>}
                          <span className="font-mono">{formatSiret(s.siret)}</span>
                        </p>
                        {(s.codePostal || s.ville) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {s.codePostal} {s.ville}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Résultat trouvé */}
      <AnimatePresence>
        {result && etat && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-lg border-2 space-y-2",
              etat.color === "success" && "border-success/30 bg-success/5",
              etat.color === "warning" && "border-warning/30 bg-warning/5",
              etat.color === "destructive" && "border-destructive/30 bg-destructive/5"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {etat.color === "success" ? (
                  <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className={cn(
                    "w-5 h-5 shrink-0 mt-0.5",
                    etat.color === "warning" && "text-warning",
                    etat.color === "destructive" && "text-destructive"
                  )} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-base">{result.nom}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {result.formeJuridique}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
              <Info2 label="SIRET" value={formatSiret(result.siret)} mono />
              <Info2 label="TVA Intra" value={result.tvaIntracom || "—"} mono />
              <Info2 label="Code APE" value={result.codeAPE || "—"} />
              <Info2 label="État" value={etat.label} />
              {result.libelleAPE && (
                <div className="col-span-2">
                  <Info2 label="Activité" value={result.libelleAPE} />
                </div>
              )}
              {(result.adresse || result.ville) && (
                <div className="col-span-2">
                  <Info2
                    label="Siège social"
                    value={[result.adresse, result.codePostal, result.ville].filter(Boolean).join(" ")}
                  />
                </div>
              )}
            </div>

            {etat.color !== "success" && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  {etat.color === "destructive"
                    ? "Cette entreprise est fermée. Évitez les facturations."
                    : "Cette entreprise a cessé son activité."}
                </span>
              </p>
            )}

            <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
              <Info className="w-3 h-3" />
              Données INSEE via recherche-entreprises.api.gouv.fr
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Petit utilitaire ────────────────────────────────────────────────────
function Info2({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate", mono && "font-mono")}>{value}</p>
    </div>
  );
}
