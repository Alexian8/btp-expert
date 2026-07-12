import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// PhoneInput — saisie téléphone verrouillée sur la France (+33), formatage en
// temps réel (retrait du 0 initial, nettoyage espaces/points, groupage
// X XX XX XX XX). La valeur stockée est "+33 6 12 34 56 78" (ou "" si vide),
// prête pour les liens tel:/sms:.
// ═══════════════════════════════════════════════════════════════════════════

/** Extrait les 9 chiffres nationaux depuis une valeur quelconque. */
function nationalDigits(value: string): string {
  let d = (value || "").replace(/\D/g, "");
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length > 9) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}

/** Groupe "612345678" → "6 12 34 56 78". */
function groupNational(d: string): string {
  if (!d) return "";
  const parts = [d.slice(0, 1), d.slice(1, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder = "6 12 34 56 78", id, className }: Props) {
  const national = groupNational(nationalDigits(value));

  const handle = (raw: string): void => {
    const d = nationalDigits(raw);
    onChange(d ? `+33 ${groupNational(d)}` : "");
  };

  return (
    <div className={cn("flex items-stretch rounded-md border border-input bg-muted/50 overflow-hidden focus-within:ring-2 focus-within:ring-ring", className)}>
      <span className="flex items-center gap-1.5 px-3 bg-muted text-sm font-medium text-foreground border-r border-input select-none">
        <span aria-hidden>🇫🇷</span> +33
      </span>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-11 px-3 bg-transparent text-base outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
