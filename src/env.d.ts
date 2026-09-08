/// <reference types="astro/client" />

type CloudflareRuntime = import('@astrojs/cloudflare').Runtime;

declare namespace App {
  interface Locals extends CloudflareRuntime {
    user?: import('./lib/auth').AuthUser | null;
    runtime?: {
      env?: Record<string, string | undefined>;
      cf?: unknown;
    };
  }
}
