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

  // 2. Proteksi rute Admin (/admin/* dan /api/admin/*)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!locals.user) {
      return redirect('/auth/login', 302);
    }
    // Verifikasi role admin secara komprehensif (role === 'admin' atau flag isAdmin === true)
    const isAdmin = locals.user.role === 'admin' || locals.user.isAdmin === true || String(locals.user.role).toLowerCase() === 'admin';
    if (!isAdmin) {
      return redirect(locals.user.role === 'user' ? '/user/dashboard' : '/auth/login', 302);
    }
  }

  // 3. Proteksi rute User / Cagen (/user/*, /dashboard/*, dan /api/user/*)
  if (pathname.startsWith('/user') || pathname.startsWith('/dashboard') || pathname.startsWith('/api/user')) {
    if (!locals.user) {
      return redirect('/auth/login', 302);
    }
    const isUser = locals.user.role === 'user' && !locals.user.isAdmin;
    // Jika panitia/admin mengakses area user, arahkan langsung ke dashboard admin
    if (!isUser) {
      return redirect('/admin/dashboard', 302);
    }
  }

  return next();
});
