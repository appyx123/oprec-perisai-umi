/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: import('./lib/auth').AuthUser | null;
    [key: string]: any;
  }
}

declare module 'cloudflare:workers' {
  export const env: Record<string, any>;
}
