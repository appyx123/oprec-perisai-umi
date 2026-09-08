import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/http';
import * as schema from './schema';

export interface DbEnvConfig {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  [key: string]: any;
}

/**
 * Resolves Turso credentials from provided runtime env object (e.g. locals.runtime?.env),
 * import.meta.env (Vite/Astro), or process.env (Node.js).
 */
export function resolveDbCredentials(env?: DbEnvConfig): { url: string; authToken: string } {
  const url =
    (env?.TURSO_DATABASE_URL && String(env.TURSO_DATABASE_URL).trim()) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.TURSO_DATABASE_URL && String(import.meta.env.TURSO_DATABASE_URL).trim()) ||
    (typeof process !== 'undefined' && process.env?.TURSO_DATABASE_URL && String(process.env.TURSO_DATABASE_URL).trim()) ||
    '';

  const authToken =
    (env?.TURSO_AUTH_TOKEN && String(env.TURSO_AUTH_TOKEN).trim()) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.TURSO_AUTH_TOKEN && String(import.meta.env.TURSO_AUTH_TOKEN).trim()) ||
    (typeof process !== 'undefined' && process.env?.TURSO_AUTH_TOKEN && String(process.env.TURSO_AUTH_TOKEN).trim()) ||
    '';

  return { url, authToken };
}

/**
 * Factory function untuk membuat instance Drizzle yang terhubung ke Turso.
 *
 * PENTING: Menggunakan '@libsql/client/http' (bukan '@libsql/client' biasa)
 * karena Cloudflare Workers tidak mendukung native TCP connections.
 * HTTP transport adalah satu-satunya cara untuk terkoneksi ke Turso dari edge.
 *
 * @param env - Opsional. Runtime environment variables dari Cloudflare locals.runtime.env / Astro
 */
export function createDb(env?: DbEnvConfig) {
  const { url, authToken } = resolveDbCredentials(env);

  if (!url) {
    throw new Error(
      'TURSO_DATABASE_URL is not configured. Please verify your environment variables in Cloudflare or .env file.'
    );
  }

  const client = createClient({
    url,
    authToken,
  });

  return drizzle(client, { schema });
}

// Type helper untuk digunakan di seluruh aplikasi
export type Db = ReturnType<typeof createDb>;
