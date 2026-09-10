/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: import('./lib/auth').AuthUser | null;
    [key: string]: any;
  }
}

declare module 'cloudflare:workers' {
  export const env: {
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
    JWT_SECRET?: string;
    S3_ENDPOINT?: string;
    S3_REGION?: string;
    S3_BUCKET_NAME?: string;
    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    APP_URL?: string;
    PUBLIC_APP_URL?: string;
    [key: string]: any;
  };
}
