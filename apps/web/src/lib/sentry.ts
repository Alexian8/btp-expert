// Sentry init for the web (browser) build. No-op if VITE_SENTRY_DSN is unset.
import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      // Errors only by default. Set VITE_SENTRY_TRACES_SAMPLE_RATE to enable.
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0),
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
  } catch (e) {
    console.warn("[sentry] web init failed:", e);
  }
}
