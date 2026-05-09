import { useRef, useState } from "react";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// ImageDataUrlUpload — Upload d'image stockée en base64 (DataURL)
// (Session S25 — utilisé pour cachet et signature dirigeant)
//
// Pourquoi base64 ? Pour ne pas dépendre du backend company:uploadLogo
// existant qui ne gère que le logo. Ce mécanisme stocke directement la valeur
// en string dans settings — simple et sans risque.
//
// Limite : ~5 Mo de fichier max (limite raisonnable pour cachet/signature).
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  /** Valeur actuelle (data URL : "data:image/png;base64,...") ou "" */
  value: string;
  /** Appelé avec la nouvelle data URL ou "" si supprimé */
  onChange: (dataUrl: string) => void;
  /** Texte affiché dans le placeholder vide */
  emptyLabel: string;
  /** Format ratio recommandé pour la box */
  aspectClass?: string;
  /** Conseils affichés sous la box */
  tip?: string;
}

const MAX_SIZE_MB = 5;

export function ImageDataUrlUpload({
  value,
  onChange,
  emptyLabel,
  aspectClass = "aspect-square",
  tip,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation taille
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      toast.error(`Fichier trop volumineux (${sizeMb.toFixed(1)} Mo). Maximum ${MAX_SIZE_MB} Mo.`);
      return;
    }

    // Validation type
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image (PNG, JPG, etc.)");
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        onChange(result);
        toast.success("Image importée");
      } else {
        toast.error("Erreur lors de la lecture du fichier");
      }
      setIsProcessing(false);
    };
    reader.onerror = () => {
      toast.error("Erreur lors de la lecture du fichier");
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);

    // Reset input pour permettre de re-uploader le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange("");
    toast.success("Image supprimée");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {/* Aperçu */}
        <div
          className={cn(
            "relative shrink-0 w-24 rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden",
            aspectClass
          )}
        >
          {value ? (
            <img
              src={value}
              alt="Aperçu"
              className="w-full h-full object-contain"
              style={{
                // Damier transparence pour bien voir le fond
                backgroundImage:
                  "linear-gradient(45deg, rgba(127,127,127,0.15) 25%, transparent 25%), linear-gradient(-45deg, rgba(127,127,127,0.15) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(127,127,127,0.15) 75%), linear-gradient(-45deg, transparent 75%, rgba(127,127,127,0.15) 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
              }}
            />
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-1 p-2 text-center">
              <ImageIcon className="w-5 h-5" />
              <p className="text-[10px]">{emptyLabel}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={isProcessing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            {value ? "Remplacer" : "Choisir un fichier"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Tip */}
      {tip && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{tip}</p>
      )}

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
