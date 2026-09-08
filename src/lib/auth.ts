import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';

export const AUTH_COOKIE_NAME = 'auth_token';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: number;
  role: UserRole;
  name: string;
  email?: string;
  username?: string;
  nim?: string;
}

// Default secret key untuk local development
const DEFAULT_DEV_SECRET = 'orec_perisai_umi_super_secret_jwt_key_edge_compatible_2026_default';

/**
 * Mendapatkan Secret Key dalam bentuk Uint8Array untuk digunakan oleh library jose.
 */
export function getJwtSecretKey(secret?: string): Uint8Array {
  const resolved =
    secret ||
    (typeof import.meta !== 'undefined' && import.meta.env?.JWT_SECRET) ||
    (typeof process !== 'undefined' && process.env?.JWT_SECRET) ||
    DEFAULT_DEV_SECRET;

  return new TextEncoder().encode(resolved);
}

/**
 * Membuat dan menandatangani (sign) JWT payload untuk 'admin' atau 'user'.
 * Masa berlaku token di-set selama 7 hari.
 */
export async function signJwt(user: AuthUser, secret?: string): Promise<string> {
  const secretKey = getJwtSecretKey(secret);

  return new SignJWT({
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    username: user.username,
    nim: user.nim,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

/**
 * Memverifikasi integritas JWT token menggunakan jose.
 * Mengembalikan objek AuthUser jika valid, atau null jika token rusak / kedaluwarsa.
 */
export async function verifyJwt(token: string, secret?: string): Promise<AuthUser | null> {
  try {
    const secretKey = getJwtSecretKey(secret);
    const { payload } = await jwtVerify(token, secretKey);

    if (
      typeof payload.id !== 'number' ||
      (payload.role !== 'admin' && payload.role !== 'user') ||
      typeof payload.name !== 'string'
    ) {
      return null;
    }

    return {
      id: payload.id,
      role: payload.role as UserRole,
      name: payload.name,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      username: typeof payload.username === 'string' ? payload.username : undefined,
      nim: typeof payload.nim === 'string' ? payload.nim : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Menyimpan JWT ke dalam HttpOnly, Secure, SameSite=Strict cookie.
 */
export function setAuthCookie(cookies: AstroCookies, token: string): void {
  const isProd = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD);

  cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // True di Cloudflare production HTTPS, false saat dev HTTP di localhost
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 hari dalam detik
  });
}

/**
 * Menghapus auth cookie saat logout.
 */
export function clearAuthCookie(cookies: AstroCookies): void {
  cookies.delete(AUTH_COOKIE_NAME, {
    path: '/',
  });
}

/**
 * Membaca raw JWT token dari cookie.
 */
export function getAuthToken(cookies: AstroCookies): string | undefined {
  return cookies.get(AUTH_COOKIE_NAME)?.value;
}
