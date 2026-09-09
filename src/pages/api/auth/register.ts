import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { createDb } from '../../../db';
import { cagens, systemSettings } from '../../../db/schema';
import { signJwt, setAuthCookie, type AuthUser } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
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
        message = `Pendaftaran belum dibuka. Pendaftaran dibuka pada ${start.toLocaleString('id-ID')}.`;
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

    // 6. Simpan Peserta Baru ke Database
    const [inserted] = await db
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
        statusPendaftaran: 'Belum Melengkapi',
      })
      .returning({ id: cagens.id });

    // 7. Otomatis Login Peserta
    const authUser: AuthUser = {
      id: inserted.id,
      role: 'user',
      isAdmin: false,
      name: namaLengkap,
      email,
      nim,
    };

    const token = await signJwt(authUser);
    setAuthCookie(cookies, token);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pendaftaran berhasil! Akun Anda telah aktif.',
        redirectUrl: '/user/dashboard',
        user: authUser,
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
