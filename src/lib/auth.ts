import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';
import { getEnvVar } from './env';

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

export type JwtSecretOrEnv = string | { JWT_SECRET?: string; [key: string]: any };

// Default secret key untuk local development
const DEFAULT_DEV_SECRET = 'orec_perisai_umi_super_secret_jwt_key_edge_compatible_2026_default';

/**
 * Resolves the JWT secret string from a direct string, an override object,
 * Cloudflare Workers runtime env, import.meta.env, process.env, or development fallback.
 */
export function resolveJwtSecret(secretOrEnv?: JwtSecretOrEnv): string {
  if (typeof secretOrEnv === 'string' && secretOrEnv.trim() !== '') {
    return secretOrEnv.trim();
  }

  if (typeof secretOrEnv === 'object' && secretOrEnv !== null) {
    if (typeof secretOrEnv.JWT_SECRET === 'string' && secretOrEnv.JWT_SECRET.trim() !== '') {
      return secretOrEnv.JWT_SECRET.trim();
    }
  }

  const resolved = getEnvVar('JWT_SECRET');
  if (resolved) {
    return resolved;
  }

  return DEFAULT_DEV_SECRET;
}

/**
 * Mendapatkan Secret Key dalam bentuk Uint8Array untuk digunakan oleh library jose.
 */
export function getJwtSecretKey(secretOrEnv?: JwtSecretOrEnv): Uint8Array {
  const resolved = resolveJwtSecret(secretOrEnv);
  return new TextEncoder().encode(resolved);
}

/**
 * Membuat dan menandatangani (sign) JWT payload untuk 'admin' atau 'user'.
 * Masa berlaku token di-set selama 7 hari.
 */
export async function signJwt(user: AuthUser, secretOrEnv?: JwtSecretOrEnv): Promise<string> {
  const secretKey = getJwtSecretKey(secretOrEnv);

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
export async function verifyJwt(token: string, secretOrEnv?: JwtSecretOrEnv): Promise<AuthUser | null> {
  try {
    const secretKey = getJwtSecretKey(secretOrEnv);
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
