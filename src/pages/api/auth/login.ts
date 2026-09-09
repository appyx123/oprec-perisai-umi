import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { createDb } from '../../../db';
import { admins, cagens } from '../../../db/schema';
import { signJwt, setAuthCookie, type AuthUser } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    let identifier = '';
    let password = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = (await request.json()) as Record<string, any>;
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

    let db;
    try {
      db = createDb();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Layanan masuk sedang tidak dapat diakses. Silakan coba beberapa saat lagi.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
          isAdmin: true,
          name: admin.namaLengkap || admin.username || 'Administrator OREC',
          username: admin.username,
        };

        const token = await signJwt(authUser);
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
          isAdmin: false,
          name: cagen.namaLengkap,
          email: cagen.email,
          nim: cagen.nim,
          nomorRegistrasi: cagen.nomorRegistrasi || undefined,
        };

        const token = await signJwt(authUser);
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
