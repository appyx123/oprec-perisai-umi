import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { createDb } from '../../../db';
import { admins, cagens } from '../../../db/schema';
import { signJwt, setAuthCookie, type AuthUser } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    let identifier = '';
    let password = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        identifier = String(body.identifier || body.email || body.username || '').trim();
        password = String(body.password || '').trim();
      } catch {
        return new Response(
          JSON.stringify({ success: false, message: 'Format request JSON tidak valid.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      try {
        const formData = await request.formData();
        identifier = String(formData.get('identifier') || formData.get('email') || formData.get('username') || '').trim();
        password = String(formData.get('password') || '').trim();
      } catch {
        return new Response(
          JSON.stringify({ success: false, message: 'Format formulir tidak valid.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!identifier || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email/Username dan kata sandi harus diisi!',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Resolusi Environment Variables untuk Cloudflare Edge Runtime / Vite Dev
    const runtimeEnv = (locals.runtime?.env ?? {}) as Record<string, string | undefined>;
    const tursoUrl =
      runtimeEnv.TURSO_DATABASE_URL ||
      (typeof import.meta !== 'undefined' && import.meta.env?.TURSO_DATABASE_URL) ||
      (typeof process !== 'undefined' && process.env?.TURSO_DATABASE_URL) ||
      '';
    const tursoToken =
      runtimeEnv.TURSO_AUTH_TOKEN ||
      (typeof import.meta !== 'undefined' && import.meta.env?.TURSO_AUTH_TOKEN) ||
      (typeof process !== 'undefined' && process.env?.TURSO_AUTH_TOKEN) ||
      '';
    const jwtSecret =
      runtimeEnv.JWT_SECRET ||
      (typeof import.meta !== 'undefined' && import.meta.env?.JWT_SECRET) ||
      (typeof process !== 'undefined' && process.env?.JWT_SECRET);

    if (!tursoUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Koneksi database belum disiapkan (TURSO_DATABASE_URL belum diisi).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb({
      TURSO_DATABASE_URL: tursoUrl,
      TURSO_AUTH_TOKEN: tursoToken,
    });

    // 1. Cek tabel admins terlebih dahulu
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, identifier))
      .limit(1);

    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (isMatch) {
        const authUser: AuthUser = {
          id: admin.id,
          role: 'admin',
          name: admin.namaLengkap,
          username: admin.username,
        };

        const token = await signJwt(authUser, jwtSecret);
        setAuthCookie(cookies, token);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Login admin berhasil.',
            user: authUser,
            redirectUrl: '/admin/dashboard',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Jika bukan admin, cek tabel cagens (peserta) berdasarkan email atau NIM
    const [cagen] = await db
      .select()
      .from(cagens)
      .where(or(eq(cagens.email, identifier), eq(cagens.nim, identifier)))
      .limit(1);

    if (cagen) {
      const isMatch = await bcrypt.compare(password, cagen.password);
      if (isMatch) {
        const authUser: AuthUser = {
          id: cagen.id,
          role: 'user',
          name: cagen.namaLengkap,
          email: cagen.email,
          nim: cagen.nim,
        };

        const token = await signJwt(authUser, jwtSecret);
        setAuthCookie(cookies, token);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Login peserta berhasil.',
            user: authUser,
            redirectUrl: '/user/dashboard',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Kredensial tidak cocok di kedua tabel
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Kredensial tidak ditemukan atau kata sandi salah!',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan pada server saat proses login.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
