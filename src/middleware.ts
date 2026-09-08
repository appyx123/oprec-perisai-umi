import { defineMiddleware } from 'astro:middleware';
import { verifyJwt, getAuthToken } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect } = context;
  const pathname = url.pathname;

  // 1. Ambil JWT dari cookie dan verifikasi menggunakan jose
  const token = getAuthToken(cookies);

  if (token) {
    const user = await verifyJwt(token);
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
