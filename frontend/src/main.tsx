import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { ThemedApp } from "./ThemedApp";
import "./index.css";
// Initialize i18next synchronously (resources are bundled, not lazy) so the
// first paint already has translations and we never flash i18n keys.
import "./i18n";

// Self-hosted error monitoring. No-op when VITE_SENTRY_DSN is empty (the
// dev default) so a developer running locally without GlitchTip configured
// pays no runtime cost and ships no events.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: import.meta.env.VITE_GIT_SHA as string | undefined,
    environment: (import.meta.env.VITE_APP_ENV as string | undefined) ?? "development",
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE ?? 0),
    // Don't send PII in form fields by default — emails are already in
    // pipeline messages so this only matters for password fields.
    sendDefaultPii: false,
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>
);
