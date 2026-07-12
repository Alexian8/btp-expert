import { create } from "zustand";
import { persist } from "zustand/middleware";

// ═══════════════════════════════════════════════════════════════════════════
// Theme Store — Gère l'apparence de l'app (mode, accent, radius, densité)
// Persiste dans localStorage via zustand/persist
// ═══════════════════════════════════════════════════════════════════════════

export type Mode = "light" | "dark" | "system";
export type AccentColor = "blue" | "violet" | "emerald" | "amber" | "rose" | "slate";
export type Radius = "none" | "sm" | "md" | "lg" | "xl" | "full";
export type Density = "compact" | "normal" | "comfortable";
/** Style visuel global de l'app (réglé par l'admin, partagé via settings). */
export type UiStyle = "classique" | "epure" | "liquid" | "techno";

export const UI_STYLES: UiStyle[] = ["classique", "epure", "liquid", "techno"];

/** Réglages fins du thème Liquid glass (admin, partagés via settings). */
export interface LiquidSettings {
  /** Intensité du flou de verre, en px (0–30). */
  blur: number;
  /** Opacité des cartes, 0.35–0.9 (plus bas = plus transparent). */
  cardOpacity: number;
  /** Intensité des halos colorés du fond, multiplicateur 0–2. */
  glow: number;
}

export const LIQUID_DEFAULTS: LiquidSettings = { blur: 18, cardOpacity: 0.6, glow: 1 };

interface ThemeState {
  mode: Mode;
  accent: AccentColor;
  radius: Radius;
  density: Density;
  uiStyle: UiStyle;
  liquid: LiquidSettings;

  // Préférences sidebar (Session 20)
  hideSidebarBadges: boolean;

  setMode: (mode: Mode) => void;
  setAccent: (accent: AccentColor) => void;
  setRadius: (radius: Radius) => void;
  setDensity: (density: Density) => void;
  setUiStyle: (style: UiStyle) => void;
  setLiquid: (patch: Partial<LiquidSettings>) => void;
  setHideSidebarBadges: (v: boolean) => void;
  reset: () => void;

  // Applique les classes/attributs sur <html> pour que le CSS variable réagisse
  applyTheme: () => void;
}

const DEFAULT_STATE = {
  mode: "dark" as Mode,
  accent: "blue" as AccentColor,
  radius: "lg" as Radius,
  density: "normal" as Density,
  uiStyle: "classique" as UiStyle,
  liquid: { ...LIQUID_DEFAULTS },
  hideSidebarBadges: false,
};

function applyToDOM(state: Pick<ThemeState, "mode" | "accent" | "radius" | "density" | "uiStyle" | "liquid">) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Mode (light / dark / system)
  const resolvedMode =
    state.mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : state.mode;
  if (resolvedMode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");

  // Accent / radius / density / style visuel (via data attributes)
  root.setAttribute("data-accent", state.accent);
  root.setAttribute("data-radius", state.radius);
  root.setAttribute("data-density", state.density);
  root.setAttribute("data-ui-style", state.uiStyle);

  // Réglages fins Liquid glass (consommés uniquement par le bloc CSS liquid)
  const lq = state.liquid ?? LIQUID_DEFAULTS;
  root.style.setProperty("--liquid-blur", `${lq.blur}px`);
  root.style.setProperty("--liquid-card-alpha", String(lq.cardOpacity));
  root.style.setProperty("--liquid-glow", String(lq.glow));
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setMode: (mode) => {
        set({ mode });
        applyToDOM({ ...get(), mode });
      },
      setAccent: (accent) => {
        set({ accent });
        applyToDOM({ ...get(), accent });
      },
      setRadius: (radius) => {
        set({ radius });
        applyToDOM({ ...get(), radius });
      },
      setDensity: (density) => {
        set({ density });
        applyToDOM({ ...get(), density });
      },
      setUiStyle: (uiStyle) => {
        set({ uiStyle });
        applyToDOM({ ...get(), uiStyle });
      },
      setLiquid: (patch) => {
        const liquid = { ...(get().liquid ?? LIQUID_DEFAULTS), ...patch };
        set({ liquid });
        applyToDOM({ ...get(), liquid });
      },
      setHideSidebarBadges: (hideSidebarBadges) => set({ hideSidebarBadges }),
      reset: () => {
        set(DEFAULT_STATE);
        applyToDOM(DEFAULT_STATE);
      },
      applyTheme: () => {
        applyToDOM(get());
      },
    }),
    {
      name: "btp-theme",
    }
  )
);
