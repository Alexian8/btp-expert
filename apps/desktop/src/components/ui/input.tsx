import * as React from "react";
import { cn } from "@btp/ui";
import { SmartInput } from "./smart-text";

// ═══════════════════════════════════════════════════════════════════════════
// Input — champ de saisie. Avec `smart`, active la correction orthographique
// et la prédiction de mots (pour les champs de texte libre : désignations,
// titres…). Désactivé par défaut (champs nombres/dates/emails non concernés).
// ═══════════════════════════════════════════════════════════════════════════

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  smart?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, smart = false, value, onChange, ...props }, ref) => {
    if (smart && (type === undefined || type === "text")) {
      const handleValueChange = (v: string) => {
        if (!onChange) return;
        const fakeTarget = { value: v } as HTMLInputElement;
        onChange({ target: fakeTarget, currentTarget: fakeTarget } as React.ChangeEvent<HTMLInputElement>);
      };
      return (
        <SmartInput
          ref={ref}
          value={String(value ?? "")}
          onValueChange={handleValueChange}
          className={className}
          {...props}
        />
      );
    }

    return (
      <input
        type={type}
        ref={ref}
        value={value}
        onChange={onChange}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-soft-sm transition-colors",
          "placeholder:text-muted-foreground",
          "hover:border-muted-foreground/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
