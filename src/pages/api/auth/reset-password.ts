import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { createDb } from '../../../db';
import { cagens } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { verifyPasswordResetJwt } from '../../../lib/auth';

export const prerender = false;

/**
 * POST /api/auth/reset-password
 * Menyetel kata sandi baru untuk akun calon anggota berdasarkan token verifikasi JWT yang valid.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Format payload tidak valid.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { token, password, confirmPassword } = body || {};

  // 1. Validasi input dasar
  if (!token || typeof token !== 'string') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Token verifikasi tidak valid atau tidak ditemukan.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Kata sandi baru minimal harus terdiri dari 6 karakter.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (password !== confirmPassword) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Konfirmasi kata sandi tidak cocok.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Verifikasi token JWT reset password
  const payload = await verifyPasswordResetJwt(token);
  if (!payload || !payload.userId) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Tautan ganti kata sandi tidak valid atau telah kedaluwarsa. Silakan ajukan ulang permohonan tautan baru.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = createDb();

    // 3. Pastikan user dengan ID dan email sesuai masih ada di DB
    const [user] = await db
      .select({ id: cagens.id, email: cagens.email })
      .from(cagens)
      .where(eq(cagens.id, payload.userId))
      .limit(1);

    if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akun calon anggota tidak ditemukan atau sudah tidak aktif.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Hash kata sandi baru menggunakan bcryptjs
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Perbarui kata sandi di Turso Database
    await db
      .update(cagens)
      .set({
        password: hashedPassword,
      })
      .where(eq(cagens.id, user.id));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Kata sandi akun Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in reset-password endpoint:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan sistem saat memperbarui kata sandi.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
