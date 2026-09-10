import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/http';
import * as schema from './schema';
import { getEnvVar } from '../lib/env';

export interface DbEnvConfig {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  [key: string]: any;
}

/**
 * Resolves Turso credentials from provided override object,
 * 'cloudflare:workers' env, import.meta.env, or process.env.
 */
export function resolveDbCredentials(override?: DbEnvConfig): { url: string; authToken: string } {
  const url = override?.TURSO_DATABASE_URL || env.TURSO_DATABASE_URL || getEnvVar('TURSO_DATABASE_URL', override);
  const authToken = override?.TURSO_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || getEnvVar('TURSO_AUTH_TOKEN', override);

  return { url, authToken };
}

/**
 * Factory function untuk membuat instance Drizzle yang terhubung ke Turso.
 *
 * PENTING: Menggunakan '@libsql/client/http' (bukan '@libsql/client' biasa)
 * karena Cloudflare Workers tidak mendukung native TCP connections.
 * HTTP transport adalah satu-satunya cara untuk terkoneksi ke Turso dari edge.
 *
 * @param env - Opsional. Override environment variables jika ada
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
