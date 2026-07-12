import { useRef } from "react";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  Monitor,
  Check,
  Smartphone,
  LaptopMinimal,
  Sparkles,
  Square,
  Feather,
  Droplets,
  Grid3x3,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsSectionWrapper } from "./SettingsPage";
import {
  useThemeStore,
  LIQUID_DEFAULTS,
  type Mode,
  type AccentColor,
  type Radius,
  type Density,
  type UiStyle,
  type LiquidSettings,
} from "@/stores/themeStore";
import { useDeviceModeStore, type DeviceMode } from "@/stores/deviceModeStore";
import { useAuthStore } from "@/stores/authStore";
import { getDataService } from "@/lib/dataService";

// ═══════════════════════════════════════════════════════════════════════════
// AppearanceSection — Personnalisation visuelle en temps réel
// ═══════════════════════════════════════════════════════════════════════════

const UI_STYLE_OPTIONS: Array<{
  key: UiStyle;
  label: string;
  desc: string;
  icon: React.ElementType;
}> = [
  { key: "classique", label: "Classique", desc: "L'interface BatiDesk standard", icon: Square },
  { key: "epure", label: "Épuré", desc: "Thème shadcn/ui — neutre, monochrome", icon: Feather },
  { key: "liquid", label: "Liquid glass", desc: "Verre dépoli intégral (sidebar, barre, menus)", icon: Droplets },
  { key: "techno", label: "Techno", desc: "Coins nets, grille de fond, néon", icon: Grid3x3 },
];

const MODE_OPTIONS: Array<{ key: Mode; label: string; icon: React.ElementType }> = [
  { key: "light", label: "Clair", icon: Sun },
  { key: "dark", label: "Sombre", icon: Moon },
  { key: "system", label: "Système", icon: Monitor },
];

const ACCENT_OPTIONS: Array<{ key: AccentColor; label: string; colorClass: string }> = [
  { key: "blue", label: "Bleu", colorClass: "bg-blue-500" },
  { key: "violet", label: "Violet", colorClass: "bg-violet-500" },
  { key: "emerald", label: "Émeraude", colorClass: "bg-emerald-500" },
  { key: "amber", label: "Ambre", colorClass: "bg-amber-500" },
  { key: "rose", label: "Rose", colorClass: "bg-rose-500" },
  { key: "slate", label: "Ardoise", colorClass: "bg-slate-500" },
];

const RADIUS_OPTIONS: Array<{ key: Radius; label: string; sample: string }> = [
  { key: "none", label: "Aucun", sample: "rounded-none" },
  { key: "sm", label: "Petit", sample: "rounded-sm" },
  { key: "md", label: "Moyen", sample: "rounded-md" },
  { key: "lg", label: "Grand", sample: "rounded-lg" },
  { key: "xl", label: "Très grand", sample: "rounded-xl" },
  { key: "full", label: "Arrondi", sample: "rounded-full" },
];

const DENSITY_OPTIONS: Array<{ key: Density; label: string; desc: string }> = [
  { key: "compact", label: "Compact", desc: "Plus d'infos à l'écran" },
  { key: "normal", label: "Normal", desc: "Équilibre par défaut" },
  { key: "comfortable", label: "Confortable", desc: "Plus d'espace" },
];

const DEVICE_MODE_OPTIONS: Array<{
  key: DeviceMode;
  label: string;
  desc: string;
  icon: React.ElementType;
}> = [
  { key: "auto", label: "Auto", desc: "Détecte iPhone/iPad/Android automatiquement", icon: Sparkles },
  { key: "mobile", label: "Mobile", desc: "Force l'UI tactile (drawer, gros boutons)", icon: Smartphone },
  { key: "desktop", label: "Desktop", desc: "Force l'UI bureau (sidebar fixe, dense)", icon: LaptopMinimal },
];

export function AppearanceSection() {
  const { mode, accent, radius, density, uiStyle, hideSidebarBadges, setMode, setAccent, setRadius, setDensity, setUiStyle, setHideSidebarBadges, reset } =
    useThemeStore();
  const deviceMode = useDeviceModeStore((s) => s.mode);
  const setDeviceMode = useDeviceModeStore((s) => s.setMode);
  const isAutoMobile = useDeviceModeStore((s) => s.isAutoMobile);
  const isAutoStandalone = useDeviceModeStore((s) => s.isAutoStandalone);
  const isIOS = useDeviceModeStore((s) => s.isIOS);
  const isAdmin = useAuthStore((s) => s.user)?.role === "admin";

  const liquid = useThemeStore((st) => st.liquid) ?? LIQUID_DEFAULTS;
  const setLiquid = useThemeStore((st) => st.setLiquid);
  const liquidSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réglage fin Liquid : application instantanée (variables CSS) puis
  // persistance débouncée dans les settings partagés (unités entières).
  const handleLiquidChange = (patch: Partial<LiquidSettings>): void => {
    setLiquid(patch);
    if (liquidSaveTimer.current) clearTimeout(liquidSaveTimer.current);
    liquidSaveTimer.current = setTimeout(() => {
      const lq = { ...useThemeStore.getState().liquid };
      getDataService()
        .updateSettings({
          themeLiquidBlur: Math.round(lq.blur),
          themeLiquidCardOpacity: Math.round(lq.cardOpacity * 100),
          themeLiquidGlow: Math.round(lq.glow * 100),
        })
        .then(() => window.dispatchEvent(new Event("btp:settings-updated")))
        .catch(() => toast.error("Échec de l'enregistrement des réglages Liquid"));
    }, 600);
  };

  const handleLiquidReset = (): void => {
    handleLiquidChange({ ...LIQUID_DEFAULTS });
  };

  // Style global : appliqué localement tout de suite, puis persisté dans les
  // settings serveur pour que TOUS les utilisateurs le récupèrent au login.
  const handleUiStyle = async (style: UiStyle): Promise<void> => {
    setUiStyle(style);
    try {
      await getDataService().updateSettings({ themeStyle: style });
      window.dispatchEvent(new Event("btp:settings-updated"));
      toast.success(`Style « ${UI_STYLE_OPTIONS.find((o) => o.key === style)?.label} » appliqué à toute l'application`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement du style");
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode clair / sombre / système */}
      <SettingsSectionWrapper
        title="Mode"
        description="Choisissez entre clair, sombre ou laisser l'app suivre votre système"
      >
        <div className="grid grid-cols-3 gap-3">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                mode === opt.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent"
              )}
            >
              <opt.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{opt.label}</span>
              {mode === opt.key && (
                <motion.div
                  layoutId="mode-check"
                  className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </SettingsSectionWrapper>

      {/* Style visuel global (admin : appliqué à toute l'application) */}
      {isAdmin && (
        <SettingsSectionWrapper
          title="Style de l'application"
          description="Personnalité visuelle globale — appliquée à tous les utilisateurs, sur toutes les pages."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {UI_STYLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = uiStyle === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => void handleUiStyle(opt.key)}
                  className={cn(
                    "relative flex flex-col items-start gap-2 p-4 rounded-lg border-2 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-snug">{opt.desc}</span>
                  {selected && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Réglages fins Liquid glass — visibles quand le style est actif */}
          {uiStyle === "liquid" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 p-4 rounded-lg border border-border bg-card space-y-5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-primary" />
                  Réglages Liquid glass
                </p>
                <Button variant="outline" size="sm" onClick={handleLiquidReset}>
                  Réinitialiser
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="liquid-blur" className="text-xs">Intensité du flou (verre)</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(liquid.blur)} px</span>
                </div>
                <input
                  id="liquid-blur"
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={liquid.blur}
                  onChange={(e) => handleLiquidChange({ blur: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
                <p className="text-[11px] text-muted-foreground">0 = verre net · 30 = très flouté</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="liquid-opacity" className="text-xs">Opacité des cartes</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(liquid.cardOpacity * 100)} %</span>
                </div>
                <input
                  id="liquid-opacity"
                  type="range"
                  min={35}
                  max={90}
                  step={1}
                  value={Math.round(liquid.cardOpacity * 100)}
                  onChange={(e) => handleLiquidChange({ cardOpacity: Number(e.target.value) / 100 })}
                  className="w-full accent-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Plus bas = plus transparent (attention à la lisibilité en plein soleil)
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="liquid-glow" className="text-xs">Intensité du fond coloré (halos)</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(liquid.glow * 100)} %</span>
                </div>
                <input
                  id="liquid-glow"
                  type="range"
                  min={0}
                  max={200}
                  step={10}
                  value={Math.round(liquid.glow * 100)}
                  onChange={(e) => handleLiquidChange({ glow: Number(e.target.value) / 100 })}
                  className="w-full accent-primary"
                />
                <p className="text-[11px] text-muted-foreground">0 % = fond uni · 200 % = halos très présents</p>
              </div>

              <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                Appliqué en direct chez vous, enregistré automatiquement pour tous les
                utilisateurs (comme le style).
              </p>
            </motion.div>
          )}
        </SettingsSectionWrapper>
      )}

      {/* Mode d'affichage : Auto / Mobile / Desktop */}
      <SettingsSectionWrapper
        title="Mode d'affichage"
        description="Adapte l'UI selon ton appareil. En mode Auto, l'app détecte iPhone/Android et passe en UI tactile."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {DEVICE_MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = deviceMode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDeviceMode(opt.key)}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-3 rounded-lg border-2 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80 hover:bg-accent/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                <span className="text-[11px] text-muted-foreground leading-snug">
                  {opt.desc}
                </span>
                {selected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Diagnostic auto-detection */}
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3 space-y-1">
          <div className="font-medium text-foreground mb-1">Détection automatique</div>
          <div>
            <span className="opacity-70">Appareil : </span>
            <span>{isIOS ? "iOS (iPhone/iPad)" : isAutoMobile ? "Mobile / Tablette" : "Bureau"}</span>
          </div>
          <div>
            <span className="opacity-70">Installée à l'écran d'accueil : </span>
            <span>{isAutoStandalone ? "Oui" : "Non"}</span>
          </div>
          {isIOS && !isAutoStandalone && (
            <div className="mt-2 pt-2 border-t border-border/50">
              💡 <strong>Astuce iPhone :</strong> ouvre l'app dans Safari → bouton Partager → "Sur l'écran d'accueil". L'app s'affichera en plein écran comme une vraie app.
            </div>
          )}
        </div>
      </SettingsSectionWrapper>

      {/* Couleur d'accent */}
      <SettingsSectionWrapper
        title="Couleur d'accent"
        description="La teinte principale de votre interface (boutons, liens, éléments actifs)"
      >
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setAccent(opt.key)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                accent === opt.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent"
              )}
              title={opt.label}
            >
              <div className={cn("w-8 h-8 rounded-full shadow-soft-sm", opt.colorClass)} />
              <span className="text-xs font-medium">{opt.label}</span>
              {accent === opt.key && (
                <motion.div
                  layoutId="accent-check"
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </SettingsSectionWrapper>

      {/* Rayon des bordures */}
      <SettingsSectionWrapper
        title="Rayon des bordures"
        description="Ajuste les coins arrondis des boutons, cartes et champs"
      >
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRadius(opt.key)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 border-2 transition-all",
                opt.sample,
                radius === opt.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 bg-primary/20",
                  opt.sample
                )}
              />
              <span className="text-xs font-medium">{opt.label}</span>
              {radius === opt.key && (
                <motion.div
                  layoutId="radius-check"
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </SettingsSectionWrapper>

      {/* Densité */}
      <SettingsSectionWrapper
        title="Densité d'affichage"
        description="Plus compact pour voir plus d'infos, plus confortable pour une lecture aisée"
      >
        <div className="grid grid-cols-3 gap-3">
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDensity(opt.key)}
              className={cn(
                "relative flex flex-col items-start gap-1 p-4 rounded-lg border-2 text-left transition-all",
                density === opt.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent"
              )}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.desc}</span>
              {density === opt.key && (
                <motion.div
                  layoutId="density-check"
                  className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </SettingsSectionWrapper>

      {/* Sidebar — Affichage des badges (Session 20) */}
      <SettingsSectionWrapper
        title="Sidebar"
        description="Personnalisation de la barre latérale"
      >
        <button
          onClick={() => setHideSidebarBadges(!hideSidebarBadges)}
          className={cn(
            "w-full flex items-center justify-between p-4 rounded-lg border-2 text-left transition-all",
            hideSidebarBadges ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
          )}
        >
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-sm font-semibold">Masquer les compteurs à côté des onglets</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cache les badges chiffrés (3 devis, 12 factures...) à côté des items de la sidebar pour une apparence plus épurée
            </p>
          </div>
          <div className={cn(
            "w-10 h-6 rounded-full transition-colors flex items-center shrink-0",
            hideSidebarBadges ? "bg-primary justify-end" : "bg-muted justify-start"
          )}>
            <span className="w-5 h-5 rounded-full bg-white shadow-soft-sm m-0.5" />
          </div>
        </button>
      </SettingsSectionWrapper>

      {/* Reset */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={reset}>
          Réinitialiser l'apparence
        </Button>
      </div>
    </div>
  );
}

// ─── Label pour les sous-sections ────────────────────────────────────────
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs uppercase tracking-wider text-muted-foreground">{children}</Label>;
}
