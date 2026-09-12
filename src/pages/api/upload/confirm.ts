import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../../../db';
import { berkasCagens, cagens, documentTypes, cagenDocuments } from '../../../db/schema';
import { deleteS3Object, extractS3Key } from '../../../lib/s3';

// Normalisasi pemetaan kategori/slug fleksibel (mendukung camelCase, kebab-case, snake_case)
const SLUG_ALIASES: Record<string, string> = {
  ktm: 'ktm',
  transkrip: 'transkrip',
  transkripnilai: 'transkrip',
  'transkrip-nilai': 'transkrip',
  transkripNilai: 'transkrip',
  pasfoto: 'pas_foto',
  'pas-foto': 'pas_foto',
  pasFoto: 'pas_foto',
  pas_foto: 'pas_foto',
  cv: 'cv',
  buktifollow: 'bukti_follow',
  'bukti-follow': 'bukti_follow',
  buktiFollow: 'bukti_follow',
  bukti_follow: 'bukti_follow',
  buktisubscribe: 'bukti_subscribe',
  'bukti-subscribe': 'bukti_subscribe',
  buktiSubscribe: 'bukti_subscribe',
  bukti_subscribe: 'bukti_subscribe',
  buktishare: 'bukti_share',
  'bukti-share': 'bukti_share',
  buktiShare: 'bukti_share',
  bukti_share: 'bukti_share',
  sertifikatprestasi: 'sertifikat_prestasi',
  'sertifikat-prestasi': 'sertifikat_prestasi',
  sertifikatPrestasi: 'sertifikat_prestasi',
  sertifikat_prestasi: 'sertifikat_prestasi',
  sertifikatbahasa: 'sertifikat_bahasa',
  'sertifikat-bahasa': 'sertifikat_bahasa',
  sertifikatBahasa: 'sertifikat_bahasa',
  sertifikat_bahasa: 'sertifikat_bahasa',
  sertifikatorganisasi: 'sertifikat_organisasi',
  'sertifikat-organisasi': 'sertifikat_organisasi',
  sertifikatOrganisasi: 'sertifikat_organisasi',
  sertifikat_organisasi: 'sertifikat_organisasi',
  linkedin: 'portfolio_linkedin',
  portfolio: 'portfolio_linkedin',
  portfolio_linkedin: 'portfolio_linkedin',
  karyakti: 'karya_kti',
  'karya-kti': 'karya_kti',
  karya_kti: 'karya_kti',
  karyaposter: 'karya_poster',
  'karya-poster': 'karya_poster',
  karya_poster: 'karya_poster',
  karyadebat: 'karya_debat',
  'karya-debat': 'karya_debat',
  karya_debat: 'karya_debat',
  karyavideograph: 'karya_videograph',
  'karya-videograph': 'karya_videograph',
  karya_videograph: 'karya_videograph',
  karyabusinessplan: 'karya_business_plan',
  'karya-business-plan': 'karya_business_plan',
  karya_business_plan: 'karya_business_plan',
  filekarya: 'file_karya',
  'file-karya': 'file_karya',
  fileKarya: 'file_karya',
  file_karya: 'file_karya',
};

// Map slug baru ke kolom legacy berkas_cagens untuk backward compatibility
const LEGACY_COLUMN_MAP: Record<string, keyof typeof berkasCagens.$inferInsert> = {
  ktm: 'ktm',
  transkrip: 'transkripNilai',
  pas_foto: 'pasFoto',
  cv: 'cv',
  bukti_follow: 'buktiFollow',
  bukti_share: 'buktiShare',
  sertifikat_prestasi: 'sertifikatPrestasi',
  sertifikat_bahasa: 'sertifikatBahasa',
  sertifikat_organisasi: 'sertifikatOrganisasi',
  karya_kti: 'fileKarya',
  karya_poster: 'fileKarya',
  karya_debat: 'fileKarya',
  karya_videograph: 'fileKarya',
  karya_business_plan: 'fileKarya',
  file_karya: 'fileKarya',
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Otentikasi user
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

    // 2. Baca body payload
    const body = (await request.json().catch(() => null)) as Record<string, any> | null;
    const finalFileName = (body?.fileKey || body?.finalFileName || '') as string;
    const rawCategory = (body?.category || body?.jenisBerkas || body?.slug || '') as string;
    const originalFilename = String(body?.originalFilename || body?.fileName || (finalFileName.startsWith('http') ? finalFileName : finalFileName.split('/').pop()) || finalFileName).trim();
    const contentType = String(body?.contentType || (finalFileName.startsWith('http') ? 'text/url' : 'application/octet-stream')).trim();

    if (!body || !finalFileName || !rawCategory) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter fileKey/finalFileName dan category/slug wajib disertakan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Normalisasi slug
    const cleanRaw = rawCategory.trim().toLowerCase().replace(/[\s_-]+/g, '');
    const matchedSlug = SLUG_ALIASES[rawCategory] || SLUG_ALIASES[cleanRaw] || rawCategory.toLowerCase();

    // 4. Validasi kepemilikan file (hanya untuk path lokal S3/B2, bukan URL eksternal)
    const isExternalUrl = finalFileName.startsWith('http://') || finalFileName.startsWith('https://');
    if (!isExternalUrl) {
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
    }

    // 5. Inisialisasi Database
    const db = createDb();

    // 6. Cari record document_types
    const [docType] = await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.slug, matchedSlug))
      .limit(1);

    const deletedFiles: string[] = [];

    // 7. STEP 1: RELATIONAL INSERT/UPDATE (cagen_documents)
    if (docType) {
      const [existingDoc] = await db
        .select()
        .from(cagenDocuments)
        .where(
          and(
            eq(cagenDocuments.cagenId, user.id),
            eq(cagenDocuments.documentTypeId, docType.id)
          )
        )
        .limit(1);

      if (existingDoc) {
        // Hapus file lama di S3 jika ada dan berbeda
        if (existingDoc.s3Key && existingDoc.s3Key !== finalFileName && !existingDoc.s3Key.startsWith('http')) {
          try {
            const cleanOldKey = extractS3Key(existingDoc.s3Key);
            if (cleanOldKey) {
              const delRes = await deleteS3Object(cleanOldKey);
              if (delRes.success) deletedFiles.push(cleanOldKey);
            }
          } catch (delErr) {
            console.warn('[RELATIONAL] Error deleting previous document in S3:', delErr);
          }
        }

        // Update record
        await db
          .update(cagenDocuments)
          .set({
            s3Key: finalFileName,
            originalFilename: originalFilename,
            contentType: contentType,
            uploadedAt: new Date(),
          })
          .where(eq(cagenDocuments.id, existingDoc.id));
      } else {
        // Insert record baru
        await db.insert(cagenDocuments).values({
          cagenId: user.id,
          documentTypeId: docType.id,
          s3Key: finalFileName,
          originalFilename: originalFilename,
          contentType: contentType,
          uploadedAt: new Date(),
        });
      }
    }

    // 8. STEP 2: LEGACY TABLE COMPATIBILITY (berkas_cagens)
    // ponytail: Pertahankan backward compatibility untuk admin dashboard & fitur lama
    const legacyCol = LEGACY_COLUMN_MAP[matchedSlug];
    if (legacyCol) {
      const [existingLegacy] = await db
        .select()
        .from(berkasCagens)
        .where(eq(berkasCagens.cagenId, user.id))
        .limit(1);

      if (existingLegacy) {
        await db
          .update(berkasCagens)
          .set({
            [legacyCol]: finalFileName,
            waktuUpload: new Date(),
          })
          .where(eq(berkasCagens.id, existingLegacy.id));
      } else {
        await db.insert(berkasCagens).values({
          cagenId: user.id,
          ktm: legacyCol === 'ktm' ? finalFileName : '',
          transkripNilai: legacyCol === 'transkripNilai' ? finalFileName : '',
          pasFoto: legacyCol === 'pasFoto' ? finalFileName : '',
          cv: legacyCol === 'cv' ? finalFileName : '',
          buktiFollow: legacyCol === 'buktiFollow' ? finalFileName : '',
          buktiShare: legacyCol === 'buktiShare' ? finalFileName : '',
          sertifikatPrestasi: legacyCol === 'sertifikatPrestasi' ? finalFileName : null,
          sertifikatBahasa: legacyCol === 'sertifikatBahasa' ? finalFileName : null,
          sertifikatOrganisasi: legacyCol === 'sertifikatOrganisasi' ? finalFileName : null,
          peminatan: 'KTI/ESSAY',
          fileKarya: legacyCol === 'fileKarya' ? finalFileName : '',
          waktuUpload: new Date(),
        });
      }
    }

    // 9. Periksa kelengkapan berkas wajib untuk pembaruan status pendaftaran
    const mandatoryTypes = await db
      .select({ id: documentTypes.id })
      .from(documentTypes)
      .where(and(eq(documentTypes.group, 'wajib'), eq(documentTypes.isActive, true)));

    const userUploadedDocs = await db
      .select({ docTypeId: cagenDocuments.documentTypeId })
      .from(cagenDocuments)
      .where(eq(cagenDocuments.cagenId, user.id));

    const uploadedTypeIds = new Set(userUploadedDocs.map(d => d.docTypeId));
    const isAllMandatoryCompleted = mandatoryTypes.every(m => uploadedTypeIds.has(m.id));

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
        message: 'Berkas berhasil diverifikasi dan disimpan ke skema relasional.',
        data: {
          cagenId: user.id,
          slug: matchedSlug,
          documentTypeId: docType?.id || null,
          fileKey: finalFileName,
          isAllMandatoryCompleted,
          deletedOldFiles: deletedFiles,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error confirming upload in relational document storage:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memperbarui catatan berkas pendaftaran: ' + (error?.message || 'Internal Server Error'),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = POST;
