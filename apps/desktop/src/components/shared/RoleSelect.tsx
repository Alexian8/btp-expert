import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// RoleSelect — Sélecteur de fonction (gérant, président...) avec catégories
// (Session S26.2)
//
// Comportements :
//   • Cliquer ouvre une liste avec catégories visuelles
//   • Taper filtre dynamiquement les options
//   • Permet aussi la SAISIE LIBRE (pas de contrainte sur les valeurs)
//   • Ferme au clic en dehors / Échap
// ═══════════════════════════════════════════════════════════════════════════

interface RoleGroup {
  label: string;
  roles: string[];
}

const ROLE_GROUPS: RoleGroup[] = [
  {
    label: "Entreprise individuelle",
    roles: [
      "Entrepreneur individuel",
      "Auto-entrepreneur",
      "Artisan",
      "Maître artisan",
      "Chef d'entreprise",
    ],
  },
  {
    label: "SARL / EURL",
    roles: [
      "Gérant",
      "Co-gérant",
      "Gérant majoritaire",
      "Gérant minoritaire",
      "Gérant non associé",
    ],
  },
  {
    label: "SAS / SASU / SA",
    roles: [
      "Président",
      "Présidente",
      "Directeur Général",
      "Directrice Générale",
      "Président-Directeur Général",
      "Directeur Général Délégué",
    ],
  },
  {
    label: "Autres",
    roles: [
      "Mandataire social",
      "Représentant légal",
      "Conjoint collaborateur",
      "Salarié gérant",
    ],
  },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function RoleSelect({
  value,
  onChange,
  placeholder = "Gérant, Président, Entrepreneur individuel...",
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync value externe → searchValue interne
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Fermer au clic dehors
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Fermer sur Échap
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  // Filtre les groupes selon la recherche
  const filteredGroups = ROLE_GROUPS.map((group) => ({
    ...group,
    roles: group.roles.filter((role) =>
      role.toLowerCase().includes(searchValue.toLowerCase())
    ),
  })).filter((group) => group.roles.length > 0);

  const handleSelect = (role: string) => {
    onChange(role);
    setSearchValue(role);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setSearchValue(newValue);
    onChange(newValue);
    if (!open) setOpen(true);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={searchValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-soft-xs transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            if (!open) inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          <ChevronDown
            className={cn("w-4 h-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-soft-xl">
          {filteredGroups.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">
              Aucune suggestion. Vous pouvez saisir librement votre fonction.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.label}>
                {/* Séparateur de catégorie */}
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/40 border-b border-border">
                  {group.label}
                </div>
                {/* Options */}
                {group.roles.map((role) => {
                  const isSelected = role === value;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleSelect(role)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/50"
                      )}
                    >
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <span>{role}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}

          {/* Hint pour saisie libre */}
          {searchValue && !ROLE_GROUPS.some((g) => g.roles.includes(searchValue)) && (
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
              💡 « {searchValue} » sera enregistré comme fonction personnalisée
            </div>
          )}
        </div>
      )}
    </div>
  );
}
