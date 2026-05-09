import { motion } from "framer-motion";
import { Sun, Moon, Monitor, Check } from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsSectionWrapper } from "./SettingsPage";
import { useThemeStore, type Mode, type AccentColor, type Radius, type Density } from "@/stores/themeStore";

// ═══════════════════════════════════════════════════════════════════════════
// AppearanceSection — Personnalisation visuelle en temps réel
// ═══════════════════════════════════════════════════════════════════════════

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

export function AppearanceSection() {
  const { mode, accent, radius, density, hideSidebarBadges, setMode, setAccent, setRadius, setDensity, setHideSidebarBadges, reset } =
    useThemeStore();

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
