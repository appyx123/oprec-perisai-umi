export const prerender = false;

import type { APIRoute } from 'astro';
import { createDb } from '../../../db';
import { cagens, passwordResets } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getEnvVar } from '../../../lib/env';

/**
 * POST /api/auth/forgot-password
 * Menghasilkan token unik reset password dan mengirimkan tautan via Resend.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    let data: Record<string, any>;
    try {
      data = (await request.json()) as Record<string, any>;
    } catch (parseErr: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'Format payload JSON tidak valid.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const email = String(data?.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation Error',
          message: 'Alamat email yang valid wajib diisi.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();

    // 1. Cari user di database berdasarkan email
    const [cagenRecord] = await db
      .select({
        id: cagens.id,
        email: cagens.email,
        namaLengkap: cagens.namaLengkap,
      })
      .from(cagens)
      .where(eq(cagens.email, email))
      .limit(1);

    // 2. Jika akun tidak ditemukan, tetap kembalikan pesan sukses generik
    // guna mencegah serangan email enumeration (keamanan informasi)
    const genericSuccessMessage =
      'Jika alamat email terdaftar di sistem kami, tautan pengaturan ulang kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau spam.';

    if (!cagenRecord) {
      return new Response(
        JSON.stringify({
          success: true,
          message: genericSuccessMessage,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generate token aman (panjang 64 karakter) & waktu kedaluwarsa 1 jam
    const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    // 4. Simpan ke tabel password_resets
    await db.insert(passwordResets).values({
      userId: cagenRecord.id,
      token: rawToken,
      expiresAt,
      used: false,
    });

    // 5. Siapkan URL reset password
    const appBaseUrl =
      getEnvVar('APP_URL') ||
      getEnvVar('PUBLIC_APP_URL') ||
      'https://oprec.perisai.site';

    const resetUrl = `${appBaseUrl.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

    // 6. Kirim email via Resend API
    const resendApiKey = getEnvVar('RESEND_API_KEY');
    const resendFrom =
      getEnvVar('RESEND_FROM_EMAIL') ||
      'PERISAI UMI <noreply@perisai.site>';

    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY tidak dikonfigurasi. Tautan reset password langsung:', resetUrl);
    } else {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [cagenRecord.email],
            subject: 'Permintaan Penggantian Kata Sandi - PERISAI UMI',
            html: `
              <!DOCTYPE html>
              <html lang="id">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Penggantian Kata Sandi Akun PERISAI UMI</title>
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c0e; color: #f3f4f6; margin: 0; padding: 24px;">
                <div style="max-width: 560px; margin: 0 auto; background-color: #141418; border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
                  
                  <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <h2 style="color: #f59e0b; margin: 0 0 6px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">PERISAI UMI</h2>
                    <p style="color: #9ca3af; margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Sistem Rekrutmen Calon Anggota</p>
                  </div>
                  
                  <div style="margin-bottom: 24px; font-size: 15px; line-height: 1.6; color: #e5e7eb;">
                    <p style="margin-top: 0;">Halo, <strong>${cagenRecord.namaLengkap}</strong>,</p>
                    <p>Kami menerima permohonan untuk mengatur ulang kata sandi akun pendaftaran Anda di portal OPREC UKM PERISAI UMI.</p>
                    <p>Silakan klik tombol di bawah ini untuk mengatur kata sandi baru. Tautan ini bersifat rahasia dan hanya berlaku selama <strong>1 jam</strong>:</p>
                  </div>

                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${resetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);">
                      Atur Ulang Kata Sandi
                    </a>
                  </div>

                  <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #9ca3af; line-height: 1.5;">
                    <p style="margin-bottom: 8px;">Jika tombol di atas tidak berfungsi, buka tautan berikut di peramban (browser) Anda:</p>
                    <p style="word-break: break-all; color: #f59e0b;">${resetUrl}</p>
                    <p style="margin-top: 16px; color: #6b7280;">Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini. Akun Anda tetap terlindungi dan aman.</p>
                  </div>

                </div>
              </body>
              </html>
            `,
          }),
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          console.error('[Resend Error] Gagal mengirim email reset password:', resendRes.status, errText);
        }
      } catch (sendErr) {
        console.error('[Resend Error] Exception saat menghubungi API Resend:', sendErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: genericSuccessMessage,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API /api/auth/forgot-password Error]:', error);
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details,
        message: 'Gagal memproses permintaan reset password. Silakan coba lagi nanti.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
