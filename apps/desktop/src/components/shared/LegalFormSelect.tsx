import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// LegalFormSelect — Sélecteur de forme juridique (Session S26.3)
// Catégories visuelles : Entreprise individuelle / Sociétés / Associations
// Permet la saisie libre pour les cas particuliers
// ═══════════════════════════════════════════════════════════════════════════

interface FormGroup {
  label: string;
  forms: Array<{ value: string; description?: string }>;
}

const LEGAL_FORM_GROUPS: FormGroup[] = [
  {
    label: "Entreprise individuelle",
    forms: [
      { value: "EI", description: "Entreprise individuelle (depuis 2022)" },
      { value: "EIRL", description: "EI à responsabilité limitée (avant 2022)" },
      { value: "Auto-entrepreneur", description: "Micro-entreprise / régime simplifié" },
      { value: "Micro-entreprise", description: "Régime de la micro-entreprise" },
    ],
  },
  {
    label: "Sociétés à responsabilité limitée",
    forms: [
      { value: "SARL", description: "Société à responsabilité limitée" },
      { value: "EURL", description: "SARL à associé unique" },
      { value: "SARL de famille", description: "SARL constituée entre parents" },
    ],
  },
  {
    label: "Sociétés par actions",
    forms: [
      { value: "SAS", description: "Société par actions simplifiée" },
      { value: "SASU", description: "SAS à associé unique" },
      { value: "SA", description: "Société anonyme" },
      { value: "SCA", description: "Société en commandite par actions" },
    ],
  },
  {
    label: "Sociétés civiles & particulières",
    forms: [
      { value: "SCI", description: "Société civile immobilière" },
      { value: "SNC", description: "Société en nom collectif" },
      { value: "SCS", description: "Société en commandite simple" },
      { value: "SCOP", description: "Société coopérative" },
      { value: "SCM", description: "Société civile de moyens" },
      { value: "GIE", description: "Groupement d'intérêt économique" },
    ],
  },
  {
    label: "Associations & autres",
    forms: [
      { value: "Association loi 1901", description: "Association à but non lucratif" },
      { value: "Profession libérale", description: "Activité libérale" },
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

export function LegalFormSelect({
  value,
  onChange,
  placeholder = "SARL, SAS, EI, Auto-entrepreneur...",
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchValue(value);
  }, [value]);

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

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  const search = searchValue.toLowerCase().trim();
  const filteredGroups = LEGAL_FORM_GROUPS.map((group) => ({
    ...group,
    forms: group.forms.filter((f) =>
      !search ||
      f.value.toLowerCase().includes(search) ||
      (f.description && f.description.toLowerCase().includes(search))
    ),
  })).filter((group) => group.forms.length > 0);

  const handleSelect = (formValue: string) => {
    onChange(formValue);
    setSearchValue(formValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setSearchValue(newValue);
    onChange(newValue);
    if (!open) setOpen(true);
  };

  // Vérifier si la valeur actuelle est dans les options connues
  const isKnownValue = LEGAL_FORM_GROUPS.some((g) => g.forms.some((f) => f.value === value));

  return (
    <div ref={containerRef} className={cn("relative", className)}>
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
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover shadow-soft-xl">
          {filteredGroups.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">
              Aucune suggestion. Vous pouvez saisir librement votre forme juridique.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/40 border-b border-border sticky top-0">
                  {group.label}
                </div>
                {group.forms.map((form) => {
                  const isSelected = form.value === value;
                  return (
                    <button
                      key={form.value}
                      type="button"
                      onClick={() => handleSelect(form.value)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm flex items-start gap-2 transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/50"
                      )}
                    >
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium font-mono text-xs">{form.value}</div>
                        {form.description && (
                          <div className="text-[10px] text-muted-foreground">{form.description}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}

          {searchValue && !isKnownValue && (
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
              💡 « {searchValue} » sera enregistré comme forme juridique personnalisée
            </div>
          )}
        </div>
      )}
    </div>
  );
}
