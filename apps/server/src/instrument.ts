// Must be required/imported BEFORE express so Sentry's auto-instrumentation
// can hook into HTTP. No-op if SENTRY_DSN is unset.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
    // Errors only by default. Set SENTRY_TRACES_SAMPLE_RATE to enable.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    beforeSend(event) {
      // Strip auth-bearing headers from any captured request.
      const headers = event.request?.headers;
      if (headers && typeof headers === "object") {
        const h = headers as Record<string, string>;
        delete h.Authorization;
        delete h.authorization;
        delete h.Cookie;
        delete h.cookie;
      }
      return event;
    },
  });
}
