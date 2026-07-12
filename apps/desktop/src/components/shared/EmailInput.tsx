import { useMemo, useRef, useState } from "react";
import { Mail } from "lucide-react";

import { cn } from "@btp/ui";
import { EMAIL_DOMAINS } from "@/lib/clientHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// EmailInput — champ email avec autocomplétion "flash" des domaines : dès que
// l'utilisateur tape "@", une liste cliquable des fournisseurs courants
// apparaît sous le champ pour compléter instantanément.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function EmailInput({ value, onChange, placeholder = "email@exemple.fr", id, className }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atIndex = value.indexOf("@");
  const local = atIndex >= 0 ? value.slice(0, atIndex) : value;
  const domainPart = atIndex >= 0 ? value.slice(atIndex + 1) : "";

  const suggestions = useMemo(() => {
    if (atIndex < 0 || !local) return [];
    // Filtre par ce qui est déjà tapé après le @ ; complet si domaine déjà valide
    if (domainPart.includes(".") && EMAIL_DOMAINS.some((d) => d === domainPart)) return [];
    return EMAIL_DOMAINS.filter((d) => d.startsWith(domainPart.toLowerCase())).slice(0, 7);
  }, [atIndex, local, domainPart]);

  const showList = open && suggestions.length > 0;

  const pick = (domain: string): void => {
    onChange(`${local}@${domain}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className={cn("flex items-stretch rounded-md border border-input bg-muted/50 overflow-hidden focus-within:ring-2 focus-within:ring-ring", className)}>
        <span className="flex items-center px-3 bg-muted border-r border-input">
          <Mail className="w-4 h-4 text-muted-foreground" />
        </span>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(suggestions[active]!);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 h-11 px-3 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showList && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-soft-lg py-1"
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {suggestions.map((d, i) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => pick(d)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-base flex items-center gap-1.5",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
              >
                <span className="text-muted-foreground">{local}</span>
                <span className="font-medium">@{d}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
