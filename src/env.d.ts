/// <reference types="astro/client" />

type CloudflareRuntime = import('@astrojs/cloudflare').Runtime;

declare namespace App {
  interface Locals extends CloudflareRuntime {
    user?: import('./lib/auth').AuthUser | null;
  }
}

declare module 'cloudflare:workers' {
  export const env: Record<string, any>;
}
