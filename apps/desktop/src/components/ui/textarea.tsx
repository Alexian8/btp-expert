import * as React from "react";
import { cn } from "@btp/ui";
import { SmartTextarea } from "./smart-text";

// ═══════════════════════════════════════════════════════════════════════════
// Textarea — zone de texte avec correction orthographique + prédiction
// activées par défaut (SmartTextarea). Pour désactiver : <Textarea smart={false}>.
//
// Conserve l'API standard (value + onChange) : un adaptateur convertit la
// nouvelle valeur en event synthétique minimal { target/currentTarget.value }.
// ═══════════════════════════════════════════════════════════════════════════

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Désactive la correction/prédiction (champ technique, code, etc.). */
  smart?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, smart = true, value, onChange, ...props }, ref) => {
    // Champ non-smart (ou contrôlé sans onChange string) : textarea classique.
    if (!smart) {
      return (
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground transition-colors",
            "hover:border-muted-foreground/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring",
            "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
            className
          )}
          {...props}
        />
      );
    }

    const handleValueChange = (v: string) => {
      if (!onChange) return;
      // Event synthétique minimal : couvre e.target.value / e.currentTarget.value
      const fakeTarget = { value: v } as HTMLTextAreaElement;
      onChange({
        target: fakeTarget,
        currentTarget: fakeTarget,
      } as React.ChangeEvent<HTMLTextAreaElement>);
    };

    return (
      <SmartTextarea
        ref={ref}
        value={String(value ?? "")}
        onValueChange={handleValueChange}
        className={className}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
