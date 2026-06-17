import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SettingsSectionWrapper } from "./SettingsPage";
import { getDataService } from "@/lib/dataService";
import { DEFAULT_SESSION_INACTIVITY_MINUTES } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// SessionSection — politique de session : déconnexion automatique par
// inactivité. La valeur est partagée (réglage entreprise) et appliquée par
// <InactivityLogout/> sur web et desktop.
// ═══════════════════════════════════════════════════════════════════════════

const OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Désactivée" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 heure" },
  { value: 120, label: "2 heures" },
  { value: 240, label: "4 heures" },
];

export function SessionSection() {
  const [value, setValue] = useState<number>(DEFAULT_SESSION_INACTIVITY_MINUTES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getDataService().getSettings();
        const v = (s as { sessionInactivityMinutes?: number })?.sessionInactivityMinutes;
        if (alive) setValue(typeof v === "number" ? v : DEFAULT_SESSION_INACTIVITY_MINUTES);
      } catch {
        /* garde le défaut */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleChange = async (next: number): Promise<void> => {
    setValue(next);
    setSaving(true);
    try {
      await getDataService().updateSettings({ sessionInactivityMinutes: next });
      // Informe <InactivityLogout/> de recharger la durée immédiatement.
      window.dispatchEvent(new Event("btp:settings-updated"));
      toast.success(
        next === 0
          ? "Déconnexion automatique désactivée"
          : `Déconnexion automatique après ${next} min d'inactivité`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSectionWrapper
      title="Session & sécurité"
      description="Contrôle de la durée des sessions et de la déconnexion automatique."
    >
      <div className="max-w-md space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Déconnexion automatique après inactivité
        </Label>
        <div className="flex items-center gap-2">
          <NativeSelect
            value={String(value)}
            disabled={loading || saving}
            onChange={(e) => void handleChange(Number(e.target.value))}
            className="w-auto min-w-[180px]"
          >
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          {(loading || saving) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">
          Au-delà de cette durée sans activité, l'utilisateur est déconnecté
          (un avertissement s'affiche 60 secondes avant). S'applique à tous les
          utilisateurs, sur web et application desktop.
        </p>
      </div>
    </SettingsSectionWrapper>
  );
}
