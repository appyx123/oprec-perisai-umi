import { env } from 'cloudflare:workers';

export interface AppEnv {
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
}

/**
 * Mendapatkan nilai environment variable dengan urutan prioritas:
 * 1. Runtime Cloudflare Workers: `env` dari 'cloudflare:workers'
 * 2. Explicit dictionary override (jika dilewatkan pemanggil)
 * 3. Vite / Astro import.meta.env (misal saat astro dev / SSR)
 * 4. Node.js process.env
 */
export function getEnvVar(key: string, source?: any): string {
  // 1. Runtime Cloudflare Workers: `env` dari 'cloudflare:workers'
  try {
    const rawCf = env as Record<string, any> | undefined;
    if (rawCf && typeof rawCf[key] !== 'undefined') {
      const val = String(rawCf[key]).trim();
      if (val !== '') return val;
    }
  } catch {
    // Abaikan jika env belum siap atau di luar worker context
  }

  // 2. Explicit dictionary override
  if (source && typeof source === 'object') {
    try {
      if (typeof source[key] !== 'undefined') {
        const val = String(source[key]).trim();
        if (val !== '') return val;
      }
    } catch {
      // Abaikan jika getter melempar error
    }
  }

  // 3. Vite / Astro import.meta.env (misal saat astro dev / SSR)
  try {
    if (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      typeof import.meta.env[key] !== 'undefined'
    ) {
      const val = String(import.meta.env[key]).trim();
      if (val !== '') return val;
    }
  } catch {
    // Abaikan
  }

  // 4. Node.js process.env
  try {
    if (
      typeof process !== 'undefined' &&
      process.env &&
      typeof process.env[key] !== 'undefined'
    ) {
      const val = String(process.env[key]).trim();
      if (val !== '') return val;
    }
  } catch {
    // Abaikan
  }

  return '';
}

export function getAllEnv(source?: any): AppEnv {
  let cf: Record<string, any> = {};
  try {
    if (env) cf = env as Record<string, any>;
  } catch {}

  let sourceEnv: Record<string, any> = {};
  if (source && typeof source === 'object') {
    try {
      sourceEnv = { ...source };
    } catch {}
  }

  return {
    ...(typeof process !== 'undefined' ? process.env : {}),
    ...(typeof import.meta !== 'undefined' ? import.meta.env : {}),
    ...cf,
    ...sourceEnv,
  };
}

