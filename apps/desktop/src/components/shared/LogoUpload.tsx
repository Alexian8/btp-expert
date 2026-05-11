import { useRef, useState } from "react";
import { Image as ImageIcon, Upload, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/companyStore";

// ═══════════════════════════════════════════════════════════════════════════
// LogoUpload — Upload du logo de l'entreprise
//
// Web-native : utilise <input type="file"> + FileReader pour convertir en
// data URL (base64), puis sauvegarde dans company.data.logoDataUrl via
// companyUpdate. Pas de filesystem séparé, le logo voyage avec les autres
// champs entreprise.
//
// La data URL est utilisée directement par les templates PDF (@react-pdf
// <Image src={...} />) — pas besoin de fetch séparé.
// ═══════════════════════════════════════════════════════════════════════════

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB max
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

interface Props {
  /** @deprecated Le logo vient maintenant directement du companyStore. */
  logoPath?: string;
  /** @deprecated callback obsolète, on utilise companyStore. */
  onChange?: (newPath: string) => void;
}

export function LogoUpload(_props: Props) {
  const company = useCompanyStore((s) => s.company) as { logoDataUrl?: string };
  const updateCompany = useCompanyStore((s) => s.update);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const logoDataUrl = company?.logoDataUrl ?? "";

  const handlePickFile = (): void => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // permet de reupload le même fichier ensuite

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Format non supporté. Utilise PNG, JPG, SVG ou WEBP.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(`Fichier trop gros (${Math.round(file.size / 1024)} KB). Limite : 2 MB.`);
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await updateCompany({ logoDataUrl: dataUrl } as Record<string, unknown>);
      toast.success("Logo enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!confirm("Supprimer le logo ?")) return;
    try {
      await updateCompany({ logoDataUrl: "" } as Record<string, unknown>);
      toast.success("Logo supprimé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const sizeKb = logoDataUrl ? Math.round((logoDataUrl.length * 0.75) / 1024) : 0;

  return (
    <div className="flex items-start gap-4">
      <div
        className={cn(
          "w-28 h-28 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 bg-muted/40",
          logoDataUrl ? "border-solid border-border" : "border-border"
        )}
      >
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt="Logo"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-1">Logo de l'entreprise</p>
        <p className="text-xs text-muted-foreground mb-2">
          Affiché en en-tête des PDF (devis et factures).<br />
          PNG transparent recommandé · 500×500 minimum · 2 MB max
        </p>

        {logoDataUrl && (
          <p className="text-[11px] text-muted-foreground mb-2 font-mono">
            ≈ {sizeKb} KB stocké
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePickFile}
            loading={uploading}
            type="button"
          >
            <Upload className="w-3.5 h-3.5" />
            {logoDataUrl ? "Remplacer" : "Choisir un logo"}
          </Button>
          {logoDataUrl && (
            <Button variant="outline" size="sm" onClick={handleDelete} type="button">
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />

        {sizeKb > 200 && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              Logo lourd ({sizeKb} KB) — pour des PDF plus rapides à générer, considère
              compresser à &lt; 200 KB ou utiliser un SVG.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Lecture du fichier impossible"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Erreur lors de la lecture"));
    reader.readAsDataURL(file);
  });
}
