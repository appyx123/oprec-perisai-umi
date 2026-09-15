import { defineMiddleware } from 'astro:middleware';
import { verifyJwt, getAuthToken } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect, request } = context;
  const pathname = url.pathname;
  const isApiRequest = pathname.startsWith('/api/');

  // Helper untuk respon penolakan akses (JSON untuk API, 302 Redirect untuk Halaman Browser)
  const denyAccess = (status: 401 | 403, message: string, redirectTarget: string) => {
    if (isApiRequest) {
      return new Response(
        JSON.stringify({
          success: false,
          error: status === 401 ? 'Unauthorized' : 'Forbidden',
          message,
        }),
        {
          status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      );
    }
    return redirect(redirectTarget, 302);
  };

  // 1. Pertahanan CSRF Lapis Ganda (Validasi Origin & Host untuk Metode Mutasi)
  const mutationMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (mutationMethods.includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return denyAccess(403, 'Akses ditolak: Permintaan lintas domain (CSRF) terdeteksi.', '/auth/login');
        }
      } catch {
        return denyAccess(403, 'Akses ditolak: Header Origin tidak valid.', '/auth/login');
      }
    }
  }

  // 2. Ambil JWT dari cookie dan verifikasi menggunakan jose
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
      return denyAccess(401, 'Autentikasi diperlukan. Silakan login terlebih dahulu.', '/auth/login');
    }
    // Verifikasi role admin secara komprehensif (role === 'admin' atau flag isAdmin === true)
    const isAdmin =
      locals.user.role === 'admin' ||
      locals.user.isAdmin === true ||
      String(locals.user.role).toLowerCase() === 'admin';

    if (!isAdmin) {
      const redirectTarget = locals.user.role === 'user' ? '/user/dashboard' : '/auth/login';
      return denyAccess(403, 'Akses ditolak. Diperlukan hak akses administrator.', redirectTarget);
    }
  }

  // 3. Proteksi rute User / Cagen (/user/*, /dashboard/*, dan /api/user/*)
  if (pathname.startsWith('/user') || pathname.startsWith('/dashboard') || pathname.startsWith('/api/user')) {
    if (!locals.user) {
      return denyAccess(401, 'Autentikasi diperlukan. Silakan login terlebih dahulu.', '/auth/login');
    }
    const isUser = locals.user.role === 'user' && !locals.user.isAdmin;
    // Jika panitia/admin mengakses area user browser, arahkan ke dashboard admin
    if (!isUser) {
      return denyAccess(403, 'Akses ditolak. Area ini khusus untuk peserta / calon anggota.', '/admin/dashboard');
    }
  }

  return next();
});
