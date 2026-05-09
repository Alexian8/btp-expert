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

interface ThemeState {
  mode: Mode;
  accent: AccentColor;
  radius: Radius;
  density: Density;

  // Préférences sidebar (Session 20)
  hideSidebarBadges: boolean;

  setMode: (mode: Mode) => void;
  setAccent: (accent: AccentColor) => void;
  setRadius: (radius: Radius) => void;
  setDensity: (density: Density) => void;
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
  hideSidebarBadges: false,
};

function applyToDOM(state: Pick<ThemeState, "mode" | "accent" | "radius" | "density">) {
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

  // Accent / radius / density (via data attributes)
  root.setAttribute("data-accent", state.accent);
  root.setAttribute("data-radius", state.radius);
  root.setAttribute("data-density", state.density);
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
