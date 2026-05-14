// Sentry init for the Electron renderer. The DSN itself is set up in the
// main process (electron/main.js); this init just opens the IPC bridge so
// renderer-side errors (React, async fetches, unhandled rejections) get
// captured and tagged with the renderer context.
import * as Sentry from "@sentry/electron/renderer";

export function initSentry(): void {
  try {
    Sentry.init({
      // No DSN here on purpose: the main process holds the DSN and routes
      // events. Passing dsn:'' is a noop bridge if main has no DSN either.
      tracesSampleRate: 0,
      beforeSend(event) {
        // Defensive scrub on the renderer too.
        if (event.request?.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
        }
        return event;
      },
    });
  } catch (e) {
    // Sentry should never crash the app. Swallow init errors.
    console.warn("[sentry] renderer init failed:", e);
  }
}

/**
 * Capture explicite d'une exception. Utilisé par les error boundaries
 * (React Router) : les erreurs de rendu attrapées par un boundary ne
 * remontent PAS jusqu'à window.onerror, il faut les pousser à la main.
 * No-op si Sentry n'est pas initialisé.
 */
export function captureException(error: unknown): void {
  try {
    Sentry.captureException(error);
  } catch {
    /* Sentry ne doit jamais crasher l'app */
  }
}
