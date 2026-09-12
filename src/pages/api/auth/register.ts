import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { createDb } from '../../../db';
import { cagens, systemSettings } from '../../../db/schema';
import { generateNomorRegistrasi } from '../../../lib/auth';
import { getEnvVar } from '../../../lib/env';

export const POST: APIRoute = async ({ request }) => {
  try {
    let payload: Record<string, any> = {};

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = (await request.json().catch(() => ({}))) || {};
    } else {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        for (const [key, value] of formData.entries()) {
          payload[key] = typeof value === 'string' ? value.trim() : value;
        }
      }
    }

    const namaLengkap = String(payload.namaLengkap || '').trim();
    const namaPanggilan = String(payload.namaPanggilan || '').trim();
    const nim = String(payload.nim || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    const noWa = String(payload.noWa || '').trim();
    const fakultas = String(payload.fakultas || '').trim();
    const jurusan = String(payload.jurusan || '').trim();
    const angkatan = String(payload.angkatan || '').trim();

    // 1. Validasi Keberadaan Database
    let db;
    try {
      db = createDb();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Layanan pendaftaran sedang tidak dapat diakses. Silakan coba kembali.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. BACKEND SECURITY GUARD: Periksa Jendela Waktu & Akses Pendaftaran
    const [settings] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, 1))
      .limit(1);

    const now = new Date();
    const isOpen = settings?.isRegistrationOpen ?? false;
    const start = settings?.registrationStart ? new Date(settings.registrationStart) : null;
    const end = settings?.registrationEnd ? new Date(settings.registrationEnd) : null;

    const isBeforeStart = start ? now < start : false;
    const isAfterEnd = end ? now > end : false;

    if (!isOpen || isBeforeStart || isAfterEnd) {
      let message = 'Pendaftaran calon anggota baru saat ini sedang ditutup.';
      if (!isOpen) {
        message = 'Pendaftaran saat ini dinonaktifkan oleh panitia seleksi.';
      } else if (isBeforeStart && start) {
        message = `Pendaftaran belum dibuka. Pendaftaran dibuka pada ${start.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' })}.`;
      } else if (isAfterEnd) {
        message = 'Masa pendaftaran calon anggota baru telah resmi berakhir.';
      }

      return new Response(
        JSON.stringify({
          success: false,
          code: 'REGISTRATION_CLOSED',
          message,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validasi Kelengkapan Field
    if (
      !namaLengkap ||
      !namaPanggilan ||
      !nim ||
      !email ||
      !password ||
      !noWa ||
      !fakultas ||
      !jurusan ||
      !angkatan
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Semua kolom formulir pendaftaran wajib diisi dengan lengkap.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Kata sandi minimal harus terdiri dari 6 karakter.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Periksa Duplikasi Email atau NIM
    const [existing] = await db
      .select({ id: cagens.id, email: cagens.email, nim: cagens.nim })
      .from(cagens)
      .where(or(eq(cagens.email, email), eq(cagens.nim, nim)))
      .limit(1);

    if (existing) {
      const isEmailDuplicate = existing.email.toLowerCase() === email;
      return new Response(
        JSON.stringify({
          success: false,
          message: isEmailDuplicate
            ? 'Alamat email ini sudah terdaftar. Silakan gunakan email lain atau langsung masuk.'
            : 'NIM ini sudah terdaftar di sistem. Silakan langsung masuk dengan akun Anda.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Enkripsi Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Generate Nomor Registrasi Unik 7 Digit Angka Acak
    let nomorRegistrasi = generateNomorRegistrasi(7);
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      const [dup] = await db
        .select({ id: cagens.id })
        .from(cagens)
        .where(eq(cagens.nomorRegistrasi, nomorRegistrasi))
        .limit(1);
      if (!dup) {
        isUnique = true;
      } else {
        nomorRegistrasi = generateNomorRegistrasi(7);
        attempts++;
      }
    }

    // 7. Generate Secure Random Verification Token
    const verificationToken = crypto.randomUUID();

    // 8. Simpan Peserta Baru ke Database (is_verified: false)
    await db
      .insert(cagens)
      .values({
        namaLengkap,
        namaPanggilan,
        nim,
        email,
        password: hashedPassword,
        noWa,
        fakultas,
        jurusan,
        angkatan,
        nomorRegistrasi,
        statusPendaftaran: 'Belum Melengkapi',
        isVerified: false,
        verificationToken,
      });

    // 9. Kirim Email Verifikasi via Resend REST API (Native Fetch untuk Cloudflare Edge)
    const resendApiKey = getEnvVar('RESEND_API_KEY');
    const resendFrom =
      getEnvVar('RESEND_FROM_EMAIL') ||
      'Admin PERISAI UMI <admin@perisai.site>';
    const appBaseUrl =
      getEnvVar('APP_URL') ||
      getEnvVar('PUBLIC_APP_URL') ||
      new URL(request.url).origin;
    const verificationUrl = `${appBaseUrl}/verify?token=${verificationToken}`;

    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY tidak dikonfigurasi. Tautan verifikasi langsung:', verificationUrl);
    } else {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [email],
            subject: 'Verifikasi Akun Pendaftaran PERISAI UMI',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <title>Verifikasi Akun Pendaftaran PERISAI UMI</title>
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c0e; color: #f3f4f6; margin: 0; padding: 24px;">
                <div style="max-width: 560px; margin: 0 auto; background-color: #141418; border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #f59e0b; margin: 0 0 6px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">PERISAI UMI</h2>
                    <p style="color: #9ca3af; margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Open Recruitment Calon Anggota</p>
                  </div>
                  
                  <div style="margin-bottom: 24px; font-size: 15px; line-height: 1.6; color: #e5e7eb;">
                    <p>Halo, <strong>${namaLengkap}</strong>!</p>
                    <p>Terima kasih telah mendaftar sebagai Calon Anggota UKM PERISAI Universitas Muslim Indonesia.</p>
                    <p>Untuk mengaktifkan akun Anda dan melanjutkan proses pendaftaran, silakan verifikasi alamat email Anda.</p>
                    <p>Klik tautan ini untuk memverifikasi akun Anda: <a href="${verificationUrl}" style="color: #f59e0b; text-decoration: underline; font-weight: bold;">Verifikasi Akun</a></p>
                  </div>

                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${verificationUrl}" style="background-color: #f59e0b; color: #000000; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);">
                      Verifikasi Akun Sekarang
                    </a>
                  </div>

                  <p style="font-size: 12px; color: #6b7280; line-height: 1.5; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px; margin-top: 24px;">
                    Jika tombol di atas tidak dapat diklik, salin dan buka tautan berikut di peramban Anda:<br>
                    <a href="${verificationUrl}" style="color: #f59e0b; word-break: break-all;">${verificationUrl}</a>
                  </p>

                  <div style="margin-top: 24px; font-size: 11px; color: #4b5563; text-align: center;">
                    Jika Anda tidak merasa mendaftar di OPREC PERISAI UMI, silakan abaikan email ini.<br>
                    &copy; ${new Date().getFullYear()} UKM PERISAI Universitas Muslim Indonesia.
                  </div>
                </div>
              </body>
              </html>
            `,
          }),
        });

        if (!resendResponse.ok) {
          const resendError = await resendResponse.text().catch(() => '');
          console.error(`Resend API response error (${resendResponse.status}):`, resendError);
        } else {
          console.log(`✅ Email verifikasi berhasil dikirim via Resend ke: ${email}`);
        }
      } catch (err) {
        console.error('Resend fetch network error:', err);
      }
    }

    // 10. Kembalikan Respon Sukses Pendaftaran & Instruksi Verifikasi
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pendaftaran berhasil! Silakan periksa email Anda untuk memverifikasi akun.',
        requiresVerification: true,
        redirectUrl: `/verify?pending=1&email=${encodeURIComponent(email)}`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Registration API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kendala pada server saat memproses pendaftaran.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
