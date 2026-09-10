import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "https://1a3a2da128023e47d28879951701821a@o4512063776489472.ingest.de.sentry.io/4512063789596752",
  tracesSampleRate: 1.0,
});
