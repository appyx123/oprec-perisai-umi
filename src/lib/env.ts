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
export function getEnvVar(key: string, source?: any): string {
  // 1. Periksa dari source override / locals yang dilewatkan
  if (source) {
    // Jika source adalah Astro locals atau objek dengan properti runtime.env (Astro Cloudflare adapter)
    if (source.runtime?.env && typeof source.runtime.env[key] !== 'undefined') {
      const val = String(source.runtime.env[key]).trim();
      if (val !== '') return val;
    }
    // Jika source memiliki properti .env langsung
    if (source.env && typeof source.env[key] !== 'undefined') {
      const val = String(source.env[key]).trim();
      if (val !== '') return val;
    }
    // Jika source adalah dictionary key-value langsung
    if (typeof source[key] !== 'undefined') {
      const val = String(source[key]).trim();
      if (val !== '') return val;
    }
  }

  // 2. Runtime Cloudflare Workers: `env` dari 'cloudflare:workers'
  try {
    const rawCf = cfEnv as Record<string, any> | undefined;
    if (rawCf && typeof rawCf[key] !== 'undefined') {
      const val = String(rawCf[key]).trim();
      if (val !== '') return val;
    }
  } catch {
    // Abaikan jika cfEnv belum siap atau di luar worker context
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
    if (cfEnv) cf = cfEnv as Record<string, any>;
  } catch {}

  const sourceEnv =
    source?.runtime?.env ||
    source?.env ||
    (source && typeof source === 'object' ? source : {});

  return {
    ...(typeof process !== 'undefined' ? process.env : {}),
    ...(typeof import.meta !== 'undefined' ? import.meta.env : {}),
    ...cf,
    ...sourceEnv,
  };
}
