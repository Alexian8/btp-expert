import { useEffect, useState } from "react";
import { Image as ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// LogoUpload — Composant d'upload du logo de l'entreprise
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  logoPath?: string;
  onChange: (newPath: string) => void;
}

export function LogoUpload({ logoPath, onChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Charger le preview à partir du chemin local
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!logoPath) {
        setPreview(null);
        return;
      }
      if (!window.btpAPI?.companyReadLogo) return;
      const url = await window.btpAPI.companyReadLogo(logoPath);
      if (!cancelled) setPreview(url);
    })();
    return () => { cancelled = true; };
  }, [logoPath]);

  const handleUpload = async () => {
    if (!window.btpAPI?.companyUploadLogo) return;
    setUploading(true);
    const r = await window.btpAPI.companyUploadLogo();
    setUploading(false);
    if (r && r.success && r.logoPath) {
      onChange(r.logoPath);
      toast.success("Logo uploadé");
    } else if (r && !r.success) {
      toast.error(r.error || "Erreur lors de l'upload");
    }
  };

  const handleDelete = async () => {
    if (!window.btpAPI?.companyDeleteLogo) return;
    const r = await window.btpAPI.companyDeleteLogo();
    if (r.success) {
      onChange("");
      setPreview(null);
      toast.success("Logo supprimé");
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className={cn(
        "w-28 h-28 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 bg-muted/40",
        preview ? "border-solid border-border" : "border-border"
      )}>
        {preview ? (
          <img src={preview} alt="Logo" className="max-w-full max-h-full object-contain" />
        ) : (
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-1">Logo de l'entreprise</p>
        <p className="text-xs text-muted-foreground mb-2">
          Affiché en haut du PDF des devis et factures.<br/>
          PNG, JPG ou SVG — 500×500 recommandé.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleUpload} loading={uploading}>
            <Upload className="w-3.5 h-3.5" />
            {preview ? "Remplacer" : "Choisir un logo"}
          </Button>
          {preview && (
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
