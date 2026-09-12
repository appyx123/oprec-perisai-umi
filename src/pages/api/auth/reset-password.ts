export const prerender = false;

import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { createDb } from '../../../db';
import { cagens, passwordResets } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyPasswordResetJwt } from '../../../lib/auth';

/**
 * POST /api/auth/reset-password
 * Menyetel kata sandi baru berdasarkan token valid dari tabel password_resets (atau fallback token JWT).
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Bad Request',
        message: 'Format payload JSON tidak valid.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = String(body?.token || '').trim();
  const newPassword = String(body?.newPassword || body?.password || '').trim();
  const confirmPassword = body?.confirmPassword !== undefined ? String(body.confirmPassword).trim() : undefined;

  // 1. Validasi token & input kata sandi
  if (!token) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Validation Error',
        message: 'Token reset kata sandi wajib disertakan.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!newPassword || newPassword.length < 6) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Validation Error',
        message: 'Kata sandi baru minimal harus terdiri dari 6 karakter.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Validation Error',
        message: 'Konfirmasi kata sandi tidak cocok.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = createDb();
    let targetUserId: number | null = null;
    let resetRecordId: number | null = null;

    // 2. Cari token di tabel password_resets
    const [dbTokenRecord] = await db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.token, token), eq(passwordResets.used, false)))
      .limit(1);

    if (dbTokenRecord) {
      const now = new Date();
      const expiresAt = new Date(dbTokenRecord.expiresAt);

      if (now > expiresAt) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Token Expired',
            message: 'Tautan pengaturan ulang kata sandi telah kedaluwarsa. Silakan ajukan permohonan baru.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      targetUserId = dbTokenRecord.userId;
      resetRecordId = dbTokenRecord.id;
    } else {
      // Fallback: periksa token JWT lama jika ada
      const jwtPayload = await verifyPasswordResetJwt(token);
      if (jwtPayload && jwtPayload.userId) {
        targetUserId = Number(jwtPayload.userId);
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid Token',
          message: 'Tautan pengaturan ulang kata sandi tidak valid atau sudah pernah digunakan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    // 4. Hash kata sandi baru menggunakan bcryptjs
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. Perbarui kata sandi peserta di tabel cagens
    await db
      .update(cagens)
      .set({
        password: hashedPassword,
      })
      .where(eq(cagens.id, cagenUser.id));

    // 6. Tandai token sebagai telah digunakan (used = true)
    if (resetRecordId) {
      await db
        .update(passwordResets)
        .set({
          used: true,
        })
        .where(eq(passwordResets.id, resetRecordId));
    }

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
