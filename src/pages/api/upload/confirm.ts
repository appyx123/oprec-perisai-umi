import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { createDb } from '../../../db';
import { berkasCagens } from '../../../db/schema';

// Whitelist kolom berkas yang valid untuk mencegah modifikasi kolom sembarangan
const VALID_CATEGORIES = [
  'ktm',
  'transkripNilai',
  'pasFoto',
  'cv',
  'buktiFollow',
  'buktiShare',
  'fileKarya',
  'sertifikatPrestasi',
  'sertifikatBahasa',
  'sertifikatOrganisasi',
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Verifikasi status otentikasi (wajib login sebagai peserta/user)
    const user = locals.user;
    if (!user || user.role !== 'user') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Hanya peserta (role user) yang berwenang mengonfirmasi berkas.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Baca payload request
    const body = (await request.json().catch(() => null)) as Record<string, any> | null;
    if (!body || !body.finalFileName || !body.category) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter finalFileName dan category wajib disertakan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { finalFileName, category } = body as { finalFileName: string; category: string };

    // 3. Validasi kategori terhadap whitelist
    if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Kategori '${category}' tidak valid. Pilihan yang diperbolehkan: ${VALID_CATEGORIES.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Pastikan file diawali identitas user yang bersangkutan
    if (!finalFileName.startsWith(`user_${user.id}_`)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Nama file tidak sesuai dengan identitas akun Anda.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Inisialisasi DB client
    let db;
    try {
      db = createDb();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Koneksi database belum disiapkan (TURSO_DATABASE_URL tidak ditemukan).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Cek apakah entri berkas_cagens sudah ada untuk user ini
    const [existingRecord] = await db
      .select()
      .from(berkasCagens)
      .where(eq(berkasCagens.cagenId, user.id))
      .limit(1);

    if (existingRecord) {
      // UPDATE kolom yang sesuai
      await db
        .update(berkasCagens)
        .set({
          [category]: finalFileName,
          waktuUpload: new Date(),
        })
        .where(eq(berkasCagens.id, existingRecord.id));
    } else {
      // INSERT record baru dengan nilai placeholder sementara untuk kolom NOT NULL
      await db.insert(berkasCagens).values({
        cagenId: user.id,
        ktm: category === 'ktm' ? finalFileName : '',
        transkripNilai: category === 'transkripNilai' ? finalFileName : '',
        pasFoto: category === 'pasFoto' ? finalFileName : '',
        cv: category === 'cv' ? finalFileName : '',
        buktiFollow: category === 'buktiFollow' ? finalFileName : '',
        buktiShare: category === 'buktiShare' ? finalFileName : '',
        sertifikatPrestasi: category === 'sertifikatPrestasi' ? finalFileName : null,
        sertifikatBahasa: category === 'sertifikatBahasa' ? finalFileName : null,
        sertifikatOrganisasi: category === 'sertifikatOrganisasi' ? finalFileName : null,
        peminatan: 'KTI/ESSAY',
        fileKarya: category === 'fileKarya' ? finalFileName : '',
        waktuUpload: new Date(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Berkas berhasil dikaitkan dan tersimpan di database.',
        data: {
          cagenId: user.id,
          category,
          finalFileName,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error confirming upload in database:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memperbarui catatan berkas pada database.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
