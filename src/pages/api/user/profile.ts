import type { APIRoute } from 'astro';
import { createDb } from '../../../db';
import { cagens } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../../../lib/auth';
import { FAKULTAS_PRODI_MAP } from '../../../lib/constants/academic';

export const prerender = false;

/**
 * GET /api/user/profile
 * Mengambil data profil lengkap calon anggota yang sedang login (kecuali hash kata sandi).
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user as AuthUser | null | undefined;
  if (!user || user.role !== 'user') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Akses ditolak. Silakan masuk terlebih dahulu.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = createDb();
    const [cagen] = await db
      .select({
        id: cagens.id,
        email: cagens.email,
        namaLengkap: cagens.namaLengkap,
        namaPanggilan: cagens.namaPanggilan,
        nim: cagens.nim,
        noWa: cagens.noWa,
        fakultas: cagens.fakultas,
        jurusan: cagens.jurusan,
        angkatan: cagens.angkatan,
        nomorRegistrasi: cagens.nomorRegistrasi,
        statusPendaftaran: cagens.statusPendaftaran,
        isVerified: cagens.isVerified,
      })
      .from(cagens)
      .where(eq(cagens.id, user.id))
      .limit(1);

    if (!cagen) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Data profil calon anggota tidak ditemukan.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: cagen,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal mengambil data profil. Silakan coba lagi.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * PUT /api/user/profile
 * Memperbarui data diri calon anggota (Nama, Nama Panggilan, No WA, Fakultas, Program Studi, Angkatan).
 * CATATAN KEAMANAN: NIM, Email, dan Kata Sandi TIDAK DAPAT diubah melalui endpoint ini.
 */
export const PUT: APIRoute = async ({ request, locals }) => {
  const user = locals.user as AuthUser | null | undefined;
  if (!user || user.role !== 'user') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Akses ditolak. Silakan masuk terlebih dahulu.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

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

  const {
    namaLengkap,
    namaPanggilan,
    noWa,
    fakultas,
    jurusan,
    angkatan,
  } = body || {};

  // Validasi kelengkapan field
  if (!namaLengkap || !namaPanggilan || !noWa || !fakultas || !jurusan || !angkatan) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Semua data diri wajib diisi dengan lengkap.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cleanNamaLengkap = String(namaLengkap).trim();
  const cleanNamaPanggilan = String(namaPanggilan).trim();
  const cleanNoWa = String(noWa).trim();
  const cleanFakultas = String(fakultas).trim();
  const cleanJurusan = String(jurusan).trim();
  const cleanAngkatan = String(angkatan).trim();

  if (cleanNamaLengkap.length < 2) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Nama lengkap minimal terdiri dari 2 karakter.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (cleanNamaPanggilan.length < 2) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Nama panggilan minimal terdiri dari 2 karakter.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (cleanNoWa.length < 8) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Nomor WhatsApp tidak valid (minimal 8 digit).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validasi keselarasan Fakultas dan Program Studi
  const validProdis = FAKULTAS_PRODI_MAP[cleanFakultas];
  if (validProdis && !validProdis.includes(cleanJurusan)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Program studi "${cleanJurusan}" tidak terdaftar di Fakultas "${cleanFakultas}".`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = createDb();

    await db
      .update(cagens)
      .set({
        namaLengkap: cleanNamaLengkap,
        namaPanggilan: cleanNamaPanggilan,
        noWa: cleanNoWa,
        fakultas: cleanFakultas,
        jurusan: cleanJurusan,
        angkatan: cleanAngkatan,
      })
      .where(eq(cagens.id, user.id));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data profil Anda berhasil diperbarui.',
        data: {
          namaLengkap: cleanNamaLengkap,
          namaPanggilan: cleanNamaPanggilan,
          noWa: cleanNoWa,
          fakultas: cleanFakultas,
          jurusan: cleanJurusan,
          angkatan: cleanAngkatan,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan sistem saat memperbarui profil.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
