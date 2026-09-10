/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: import('./lib/auth').AuthUser | null;
    [key: string]: any;
  }
}

declare namespace Cloudflare {
  interface Env {
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    APP_URL?: string;
    PUBLIC_APP_URL?: string;
    [key: string]: any;
  }
}

interface Env {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  APP_URL?: string;
  PUBLIC_APP_URL?: string;
  [key: string]: any;
}
