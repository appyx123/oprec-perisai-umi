import { defineMiddleware } from 'astro:middleware';
import { verifyJwt, getAuthToken } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect } = context;
  const pathname = url.pathname;

  // 1. Ambil JWT dari cookie dan verifikasi menggunakan jose
  const token = getAuthToken(cookies);
  const runtimeEnv = (locals.runtime?.env ?? {}) as Record<string, string | undefined>;
  const jwtSecret =
    runtimeEnv.JWT_SECRET ||
    (typeof import.meta !== 'undefined' && import.meta.env?.JWT_SECRET) ||
    (typeof process !== 'undefined' && process.env?.JWT_SECRET);

  if (token) {
    const user = await verifyJwt(token, jwtSecret);
    locals.user = user;
  } else {
    locals.user = null;
  }

  // 2. Proteksi rute Admin (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!locals.user) {
      return redirect('/', 302);
    }
    // Cegah akses tidak berwenang (misal: role 'user' mencoba akses area admin)
    if (locals.user.role !== 'admin') {
      return redirect(locals.user.role === 'user' ? '/user/dashboard' : '/', 302);
    }
  }

  // 3. Proteksi rute User / Cagen (/user/*)
  if (pathname.startsWith('/user')) {
    if (!locals.user) {
      return redirect('/', 302);
    }
    // Jika admin mengakses /user/*, arahkan ke dashboard admin
    if (locals.user.role !== 'user') {
      return redirect('/admin/dashboard', 302);
    }
  }

  return next();
});
