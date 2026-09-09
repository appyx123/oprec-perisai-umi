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
  nomorRegistrasi?: string;
  isAdmin?: boolean;
}

/**
 * Menghasilkan Nomor Registrasi acak 7 digit angka (hanya angka 0-9).
 * Contoh hasil: "7829104", "4829153", "9102845"
 */
export function generateNomorRegistrasi(length = 7): string {
  const digits = '0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let result = '';
  // Digit pertama 1-9 agar tidak diawali angka 0
  result += String((array[0] % 9) + 1);
  for (let i = 1; i < length; i++) {
    result += digits[array[i] % 10];
  }
  return result;
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
 * Secara eksplisit menyematkan properti `role: 'admin' | 'user'` dan `isAdmin: boolean`.
 * Masa berlaku token di-set selama 7 hari.
 */
export async function signJwt(user: AuthUser, secretOrEnv?: JwtSecretOrEnv): Promise<string> {
  const secretKey = getJwtSecretKey(secretOrEnv);
  const normalizedRole: UserRole = String(user.role).toLowerCase() === 'admin' ? 'admin' : 'user';
  const isAdmin = normalizedRole === 'admin' || user.isAdmin === true;

  return new SignJWT({
    id: Number(user.id),
    role: normalizedRole,
    isAdmin,
    name: user.name || user.username || (isAdmin ? 'Administrator' : 'Peserta'),
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
 * Dilengkapi pengecekan fleksibel untuk tipe ID dan properti role/isAdmin.
 */
export async function verifyJwt(token: string, secretOrEnv?: JwtSecretOrEnv): Promise<AuthUser | null> {
  try {
    const secretKey = getJwtSecretKey(secretOrEnv);
    const { payload } = await jwtVerify(token, secretKey);

    const rawId = payload.id;
    const numId = Number(rawId);
    if (isNaN(numId)) {
      return null;
    }

    const rawRole = String(payload.role || '').toLowerCase();
    const isAdmin = payload.isAdmin === true || rawRole === 'admin';
    const role: UserRole = isAdmin ? 'admin' : 'user';

    const name =
      typeof payload.name === 'string' && payload.name.trim() !== ''
        ? payload.name
        : typeof payload.username === 'string' && payload.username.trim() !== ''
          ? payload.username
          : isAdmin ? 'Administrator' : 'Peserta';

    return {
      id: numId,
      role,
      isAdmin,
      name,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      username: typeof payload.username === 'string' ? payload.username : undefined,
      nim: typeof payload.nim === 'string' ? payload.nim : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Menyimpan JWT ke dalam HttpOnly, Secure, SameSite=Lax cookie.
 * Menggunakan SameSite=Lax agar cookie tetap terbawa saat browser dialihkan (302 redirect) ke halaman dashboard.
 */
export function setAuthCookie(cookies: AstroCookies, token: string): void {
  const isProd = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD);

  cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // True di Cloudflare production HTTPS, false saat dev HTTP di localhost
    sameSite: 'lax',
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
