"use strict";
// Sentry instrumentation for the Node server.
//
// Must be required/imported BEFORE express so Sentry's auto-instrumentation
// can hook into HTTP.
//
// Critically: Sentry must NEVER crash the server boot. If the optional
// @sentry/node dependency isn't installed on the target host (e.g. cPanel
// where `npm install` is run manually and may lag behind package.json),
// the server must still come up. Hence the defensive require + try/catch.
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupExpressErrorHandler = setupExpressErrorHandler;
let sentryReady = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentryModule = null;
const dsn = process.env.SENTRY_DSN;
if (dsn) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sentryModule = require("@sentry/node");
        sentryModule.init({
            dsn,
            environment: process.env.NODE_ENV ?? "development",
            sendDefaultPii: false,
            // Errors only by default. Set SENTRY_TRACES_SAMPLE_RATE to enable.
            tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            beforeSend(event) {
                // Strip auth-bearing headers from any captured request.
                const headers = event.request?.headers;
                if (headers && typeof headers === "object") {
                    const h = headers;
                    delete h.Authorization;
                    delete h.authorization;
                    delete h.Cookie;
                    delete h.cookie;
                }
                return event;
            },
        });
        sentryReady = true;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[sentry] init skipped: ${msg}`);
    }
}
/**
 * Wires Sentry's Express error handler onto the given app, if Sentry
 * was successfully initialized. No-op otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupExpressErrorHandler(app) {
    if (!sentryReady || !sentryModule)
        return;
    try {
        sentryModule.setupExpressErrorHandler(app);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[sentry] express handler skipped: ${msg}`);
    }
}
//# sourceMappingURL=instrument.js.map