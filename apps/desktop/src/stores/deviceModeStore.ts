import { create } from "zustand";
import { persist } from "zustand/middleware";

// ═══════════════════════════════════════════════════════════════════════════
// Device Mode Store — choix UI mobile / desktop / auto
//
// Détecte automatiquement :
//   • Mobile : user agent iOS/Android, ou écran < 768px
//   • Standalone PWA : display-mode: standalone (Add to Home Screen iOS)
//
// L'utilisateur peut surcharger via 3 modes :
//   • "auto"    (défaut) — suit la détection
//   • "mobile"  — force le layout mobile (drawer sidebar, big tap targets)
//   • "desktop" — force le layout desktop (sidebar fixe, dense)
// ═══════════════════════════════════════════════════════════════════════════

export type DeviceMode = "auto" | "mobile" | "desktop";

interface DeviceModeState {
  mode: DeviceMode;
  setMode: (m: DeviceMode) => void;

  // Détection auto (mises à jour via initDeviceDetection())
  isAutoMobile: boolean;
  isAutoStandalone: boolean;
  isIOS: boolean;
  setAutoFlags: (flags: { isAutoMobile: boolean; isAutoStandalone: boolean; isIOS: boolean }) => void;
}

export const useDeviceModeStore = create<DeviceModeState>()(
  persist(
    (set) => ({
      mode: "auto",
      setMode: (mode) => set({ mode }),

      isAutoMobile: false,
      isAutoStandalone: false,
      isIOS: false,
      setAutoFlags: (flags) => set(flags),
    }),
    {
      name: "batidesk.device-mode",
      // On ne persiste QUE le choix manuel ; l'auto-détection se refait au boot
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);

/**
 * Vrai si l'app doit utiliser l'UI mobile.
 * Override "mobile" / "desktop" gagne sur l'auto.
 */
export function useIsMobile(): boolean {
  const mode = useDeviceModeStore((s) => s.mode);
  const isAutoMobile = useDeviceModeStore((s) => s.isAutoMobile);
  if (mode === "mobile") return true;
  if (mode === "desktop") return false;
  return isAutoMobile;
}

/**
 * Initialise la détection auto + écoute les changements de viewport
 * et de display-mode. À appeler une fois au boot (App.tsx).
 */
export function initDeviceDetection(): () => void {
  if (typeof window === "undefined") return () => {};

  const ua = navigator.userAgent || "";
  // iOS = iPhone / iPad / iPod, ou iPad récent qui se présente comme Mac
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document);
  const isAndroid = /Android/i.test(ua);
  const isMobileUA = isIOS || isAndroid || /Mobile|Tablet/i.test(ua);

  const update = () => {
    const isSmallScreen = window.innerWidth < 768;
    const isAutoMobile = isMobileUA || isSmallScreen;
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    // iOS Safari standalone a un flag custom
    const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
    const isAutoStandalone = standaloneQuery.matches || iosStandalone;

    useDeviceModeStore.getState().setAutoFlags({
      isAutoMobile,
      isAutoStandalone,
      isIOS,
    });
  };

  update();

  const onResize = () => update();
  window.addEventListener("resize", onResize);

  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const onStandaloneChange = () => update();
  if (typeof standaloneQuery.addEventListener === "function") {
    standaloneQuery.addEventListener("change", onStandaloneChange);
  } else {
    // Safari < 14
    (standaloneQuery as unknown as { addListener: (cb: () => void) => void }).addListener(
      onStandaloneChange
    );
  }

  return () => {
    window.removeEventListener("resize", onResize);
    if (typeof standaloneQuery.removeEventListener === "function") {
      standaloneQuery.removeEventListener("change", onStandaloneChange);
    }
  };
}
