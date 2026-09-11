import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createDb } from '../../../db';
import { cagens } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { signPasswordResetJwt, type AuthUser } from '../../../lib/auth';
import { getEnvVar } from '../../../lib/env';

export const prerender = false;

/**
 * POST /api/auth/request-reset
 * Menghasilkan token JWT reset kata sandi berumur pendek (1 jam)
 * dan mengirim tautan verifikasi ke email terdaftar pengguna via Resend API.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    let targetEmail: string | undefined;
    let targetId: number | undefined;

    const loggedUser = locals.user as AuthUser | null | undefined;

    if (loggedUser && loggedUser.role === 'user') {
      targetId = loggedUser.id;
    }

    // Periksa apakah ada email yang dikirim dalam request body
    try {
      const body: any = await request.json();
      if (body?.email && typeof body.email === 'string') {
        targetEmail = body.email.trim().toLowerCase();
      }
    } catch {
      // Body kosong atau bukan JSON (misalnya dipanggil tanpa payload oleh user terautentikasi)
    }

    const db = createDb();

    let cagenRecord: any = null;
    if (targetId) {
      const [found] = await db
        .select({
          id: cagens.id,
          email: cagens.email,
          namaLengkap: cagens.namaLengkap,
        })
        .from(cagens)
        .where(eq(cagens.id, targetId))
        .limit(1);
      cagenRecord = found;
    } else if (targetEmail) {
      const [found] = await db
        .select({
          id: cagens.id,
          email: cagens.email,
          namaLengkap: cagens.namaLengkap,
        })
        .from(cagens)
        .where(eq(cagens.email, targetEmail))
        .limit(1);
      cagenRecord = found;
    }

    // Jika tidak ditemukan, tetap kembalikan pesan generik demi alasan keamanan (mencegah email enumeration)
    if (!cagenRecord) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Jika akun terdaftar, tautan verifikasi ganti kata sandi telah dikirim ke email Anda.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Generate token reset JWT berlaku 1 jam
    const resetToken = await signPasswordResetJwt(cagenRecord.id, cagenRecord.email);

    // 2. Siapkan URL reset password
    const appBaseUrl =
      env.APP_URL ||
      env.PUBLIC_APP_URL ||
      getEnvVar('APP_URL') ||
      'https://oprec.perisai.site';
    const resetUrl = `${appBaseUrl.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

    // 3. Konfigurasi Resend API
    const resendApiKey = env.RESEND_API_KEY || getEnvVar('RESEND_API_KEY');
    const resendFrom =
      env.RESEND_FROM_EMAIL ||
      getEnvVar('RESEND_FROM_EMAIL') ||
      'PERISAI UMI <noreply@perisai.site>';

    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY tidak dikonfigurasi. Tautan reset password langsung:', resetUrl);
    } else {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
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
                    <p>Kami menerima permintaan untuk mengganti kata sandi akun pendaftaran Anda di portal OPREC UKM PERISAI UMI.</p>
                    <p>Untuk melanjutkan penggantian kata sandi dengan aman, silakan klik tombol di bawah ini. Tautan ini hanya berlaku selama <strong>1 jam</strong>:</p>
                  </div>

                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${resetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);">
                      Ganti Kata Sandi Sekarang
                    </a>
                  </div>

                  <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #9ca3af; line-height: 1.5;">
                    <p style="margin-bottom: 8px;">Jika tombol di atas tidak berfungsi, salin dan buka tautan berikut di browser Anda:</p>
                    <p style="word-break: break-all; color: #f59e0b;">${resetUrl}</p>
                    <p style="margin-top: 16px; color: #6b7280;">Jika Anda tidak merasa mengajukan penggantian kata sandi ini, silakan abaikan email ini. Akun Anda tetap aman.</p>
                  </div>

                </div>
              </body>
              </html>
            `,
          }),
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          console.error('Gagal mengirim email reset password via Resend:', resendRes.status, errText);
        }
      } catch (sendErr) {
        console.error('Error saat menghubungi API Resend:', sendErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tautan pengaturan ulang kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam Anda.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error in request-reset API:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan sistem saat memproses permintaan reset kata sandi.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
