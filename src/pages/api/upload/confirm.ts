import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { createDb } from '../../../db';
import { berkasCagens, cagens } from '../../../db/schema';

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

const CATEGORY_MAP: Record<string, ValidCategory> = {
  ktm: 'ktm',
  'transkrip-nilai': 'transkripNilai',
  transkripnilai: 'transkripNilai',
  transkripNilai: 'transkripNilai',
  'pas-foto': 'pasFoto',
  pasfoto: 'pasFoto',
  pasFoto: 'pasFoto',
  cv: 'cv',
  'bukti-follow': 'buktiFollow',
  buktifollow: 'buktiFollow',
  buktiFollow: 'buktiFollow',
  'bukti-share': 'buktiShare',
  buktishare: 'buktiShare',
  buktiShare: 'buktiShare',
  'file-karya': 'fileKarya',
  filekarya: 'fileKarya',
  fileKarya: 'fileKarya',
  'sertifikat-prestasi': 'sertifikatPrestasi',
  sertifikatprestasi: 'sertifikatPrestasi',
  sertifikatPrestasi: 'sertifikatPrestasi',
  'sertifikat-bahasa': 'sertifikatBahasa',
  sertifikatbahasa: 'sertifikatBahasa',
  sertifikatBahasa: 'sertifikatBahasa',
  'sertifikat-organisasi': 'sertifikatOrganisasi',
  sertifikatorganisasi: 'sertifikatOrganisasi',
  sertifikatOrganisasi: 'sertifikatOrganisasi',
};

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
    const finalFileName = (body?.fileKey || body?.finalFileName || '') as string;
    const rawCategory = (body?.category || body?.jenisBerkas || '') as string;

    if (!body || !finalFileName || !rawCategory) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter fileKey/finalFileName dan category wajib disertakan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Normalisasi kategori berkas
    const category = CATEGORY_MAP[rawCategory];
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Kategori '${rawCategory}' tidak valid. Pilihan yang diperbolehkan: ${VALID_CATEGORIES.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Pastikan file diawali identitas user yang bersangkutan (format cagen/[nim]/ atau legacy user_[id]_)
    const isLegacyMatch = finalFileName.startsWith(`user_${user.id}_`);
    const isNewNimMatch = Boolean(user.nim && finalFileName.startsWith(`cagen/${user.nim}/`));
    const isNewIdMatch = finalFileName.startsWith(`cagen/${user.id}/`);
    const isCagenFolder = finalFileName.startsWith('cagen/');

    if (!isLegacyMatch && !isNewNimMatch && !isNewIdMatch && !isCagenFolder) {
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
          message: 'Layanan penyimpanan data sedang tidak dapat diakses.',
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
      // PARTIAL UPDATE kolom yang sesuai tanpa mengganggu berkas lainnya
      await db
        .update(berkasCagens)
        .set({
          [category]: finalFileName,
          waktuUpload: new Date(),
        })
        .where(eq(berkasCagens.id, existingRecord.id));
    } else {
      // INSERT record baru dengan nilai default sementara
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

    // 7. Ambil catatan terbaru untuk memeriksa kelengkapan berkas wajib
    const [updatedRecord] = await db
      .select()
      .from(berkasCagens)
      .where(eq(berkasCagens.cagenId, user.id))
      .limit(1);

    const mandatoryCheck = [
      Boolean(updatedRecord?.ktm?.trim()),
      Boolean(updatedRecord?.transkripNilai?.trim()),
      Boolean(updatedRecord?.pasFoto?.trim()),
      Boolean(updatedRecord?.cv?.trim()),
      Boolean(updatedRecord?.buktiFollow?.trim()),
      Boolean(updatedRecord?.buktiShare?.trim()),
      Boolean(updatedRecord?.fileKarya?.trim()),
    ];

    const completedMandatoryCount = mandatoryCheck.filter(Boolean).length;
    const isAllMandatoryCompleted = completedMandatoryCount === mandatoryCheck.length;

    // Jika seluruh 7 berkas wajib sudah lengkap dan status masih 'Belum Melengkapi', naikkan ke 'Review Berkas'
    if (isAllMandatoryCompleted) {
      const [cagenRow] = await db
        .select({ status: cagens.statusPendaftaran })
        .from(cagens)
        .where(eq(cagens.id, user.id))
        .limit(1);

      if (cagenRow?.status === 'Belum Melengkapi') {
        await db
          .update(cagens)
          .set({ statusPendaftaran: 'Review Berkas' })
          .where(eq(cagens.id, user.id));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Berkas berhasil disimpan ke database.',
        data: {
          cagenId: user.id,
          category,
          finalFileName,
          fileKey: finalFileName,
          completedMandatoryCount,
          isAllMandatoryCompleted,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error confirming upload in database:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memperbarui catatan berkas pendaftaran.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = POST;
