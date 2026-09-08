import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/http';
import * as schema from './schema';

/**
 * Factory function untuk membuat instance Drizzle yang terhubung ke Turso.
 *
 * PENTING: Menggunakan '@libsql/client/http' (bukan '@libsql/client' biasa)
 * karena Cloudflare Workers tidak mendukung native TCP connections.
 * HTTP transport adalah satu-satunya cara untuk terkoneksi ke Turso dari edge.
 *
 * @param env - Runtime environment variables dari Cloudflare
 */
export function createDb(env: {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}) {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  return drizzle(client, { schema });
}

// Type helper untuk digunakan di seluruh aplikasi
export type Db = ReturnType<typeof createDb>;
