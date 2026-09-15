import { sql, type SQL, type AnyColumn } from 'drizzle-orm';

/**
 * Melakukan escape pada karakter wildcard SQLite LIKE (%, _, \)
 * untuk mencegah Full Table Scan / Wildcard Denial of Service (DoS).
 */
export function escapeLikePattern(input: string): string {
  return (input || '').replace(/([%_\\])/g, '\\$1');
}

/**
 * Menghasilkan ekspresi Drizzle SQL untuk pencarian LIKE yang aman di SQLite
 * dengan menyertakan klausul ESCAPE '\\'.
 *
 * Contoh hasil SQL: "cagens"."nama_lengkap" LIKE ? ESCAPE '\'
 */
export function safeLike(column: AnyColumn, query: string): SQL {
  const escaped = escapeLikePattern(query.trim());
  return sql`${column} LIKE ${`%${escaped}%`} ESCAPE '\\'`;
}
