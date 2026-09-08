// @ts-ignore
import { env as cfEnv } from 'cloudflare:workers';

export interface AppEnv {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  JWT_SECRET?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET_NAME?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  [key: string]: any;
}

/**
 * Mendapatkan nilai environment variable dengan urutan prioritas:
 * 1. Override eksplisit yang dilewatkan pemanggil (jika ada)
 * 2. Runtime Cloudflare Workers: `env` dari 'cloudflare:workers'
 * 3. Vite / Astro import.meta.env (misal saat astro dev / SSR)
 * 4. Node.js process.env
 */
export function getEnvVar(key: string, override?: Record<string, any>): string {
  if (override && typeof override[key] === 'string' && override[key].trim() !== '') {
    return override[key].trim();
  }

  try {
    const rawCf = cfEnv as Record<string, any> | undefined;
    if (rawCf && typeof rawCf[key] === 'string' && rawCf[key].trim() !== '') {
      return rawCf[key].trim();
    }
  } catch {
    // Abaikan jika cfEnv belum siap atau tidak tersedia
  }

  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env[key] === 'string' &&
    import.meta.env[key].trim() !== ''
  ) {
    return import.meta.env[key].trim();
  }

  if (
    typeof process !== 'undefined' &&
    process.env &&
    typeof process.env[key] === 'string' &&
    process.env[key].trim() !== ''
  ) {
    return process.env[key].trim();
  }

  return '';
}

export function getAllEnv(override?: Record<string, any>): AppEnv {
  let cf: Record<string, any> = {};
  try {
    if (cfEnv) cf = cfEnv as Record<string, any>;
  } catch {}

  return {
    ...(typeof process !== 'undefined' ? process.env : {}),
    ...(typeof import.meta !== 'undefined' ? import.meta.env : {}),
    ...cf,
    ...(override || {}),
  };
}
