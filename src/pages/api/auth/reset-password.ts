export const prerender = false;

import type { APIRoute } from 'astro';
import { createDb } from '../../../db';
import { cagens, passwordResets } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { verifyPasswordResetJwt } from '../../../lib/auth';
import { hashPassword } from '../../../lib/password';

/**
 * POST /api/auth/reset-password
 * Menyetel kata sandi baru berdasarkan token valid dari tabel password_resets (atau fallback token JWT).
 */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any> = {};
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      body = (await request.json()) as Record<string, any>;
    } else if (contentType.includes('form') || contentType.includes('multipart')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      try {
        body = (await request.json()) as Record<string, any>;
      } catch {
        const formData = await request.formData();
        body = Object.fromEntries(formData.entries());
      }
    }
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Format payload tidak valid. Harap kirimkan JSON atau Form Data yang valid.',
        message: 'Format payload tidak valid. Harap kirimkan JSON atau Form Data yang valid.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = String(body?.token || '').trim();
  const newPassword = String(body?.newPassword || body?.password || '').trim();
  const confirmPassword =
    (body?.confirmPassword ?? body?.password_confirmation) !== undefined
      ? String(body?.confirmPassword ?? body?.password_confirmation).trim()
      : undefined;

  // 1. Validasi token & input kata sandi
  if (!token) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Token reset kata sandi wajib disertakan.',
        message: 'Token reset kata sandi wajib disertakan.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!newPassword || newPassword.length < 6) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Kata sandi baru minimal harus terdiri dari 6 karakter.',
        message: 'Kata sandi baru minimal harus terdiri dari 6 karakter.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Konfirmasi kata sandi tidak cocok.',
        message: 'Konfirmasi kata sandi tidak cocok.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = createDb();

    // 2. Validasi token ke tabel password_resets (Wajib ada, belum used, dan belum expired)
    const [dbTokenRecord] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token))
      .limit(1);

    if (!dbTokenRecord) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tautan pengaturan ulang kata sandi tidak valid atau tidak ditemukan.',
          message: 'Tautan pengaturan ulang kata sandi tidak valid atau tidak ditemukan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (dbTokenRecord.used) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tautan pengaturan ulang kata sandi ini sudah pernah digunakan. Silakan ajukan permohonan baru.',
          message: 'Tautan pengaturan ulang kata sandi ini sudah pernah digunakan. Silakan ajukan permohonan baru.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const expiresAt = new Date(dbTokenRecord.expiresAt);
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tautan pengaturan ulang kata sandi telah kedaluwarsa. Silakan ajukan permohonan baru.',
          message: 'Tautan pengaturan ulang kata sandi telah kedaluwarsa. Silakan ajukan permohonan baru.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verifikasi integritas kriptografis token jika berupa JWT
    if (token.includes('.')) {
      const jwtPayload = await verifyPasswordResetJwt(token);
      if (!jwtPayload || Number(jwtPayload.userId) !== dbTokenRecord.userId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Tautan pengaturan ulang kata sandi tidak valid atau telah dimodifikasi.',
            message: 'Tautan pengaturan ulang kata sandi tidak valid atau telah dimodifikasi.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const targetUserId = dbTokenRecord.userId;
    const resetRecordId = dbTokenRecord.id;

    // 3. Pastikan user dengan ID terkait masih ada di DB
    const [cagenUser] = await db
      .select({ id: cagens.id })
      .from(cagens)
      .where(eq(cagens.id, targetUserId))
      .limit(1);

    if (!cagenUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User Not Found',
          message: 'Akun calon anggota tidak ditemukan atau sudah dinonaktifkan.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Hash kata sandi baru menggunakan Web Crypto API (PBKDF2)
    const hashedPassword = await hashPassword(newPassword);

    // 5. Perbarui kata sandi peserta di tabel cagens
    await db
      .update(cagens)
      .set({
        password: hashedPassword,
      })
      .where(eq(cagens.id, cagenUser.id));

    // 6. Tandai token sebagai telah digunakan (used = true) untuk memblokir Replay Attack
    await db
      .update(passwordResets)
      .set({
        used: true,
      })
      .where(eq(passwordResets.id, resetRecordId));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Kata sandi berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API /api/auth/reset-password Error]:', error);
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details,
        message: 'Terjadi kesalahan sistem saat memperbarui kata sandi.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
