import type { APIRoute } from 'astro';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, getS3BucketName } from '../../../lib/s3';

export const GET: APIRoute = async ({ url, locals, redirect }) => {
  try {
    // 1. Verifikasi status otentikasi
    const user = locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Sesi tidak valid. Silakan login terlebih dahulu untuk melihat berkas.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Ambil parameter nama file dari query string (mendukung ?name= atau ?fileKey=)
    const fileName = url.searchParams.get('name') || url.searchParams.get('fileKey');
    if (!fileName) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter nama file (?name=... atau ?fileKey=...) wajib disertakan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Hak Akses (Authorization Guard)
    // - Admin dapat melihat semua file
    // - Peserta (user) HANYA diizinkan melihat file miliknya sendiri (prefix user_{id}_)
    if (user.role === 'user') {
      const allowedPrefix = `user_${user.id}_`;
      if (!fileName.startsWith(allowedPrefix)) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Akses ditolak. Anda tidak memiliki izin untuk melihat berkas milik peserta lain.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Konfigurasi S3 Client
    const s3 = getS3Client();
    const bucketName = getS3BucketName();

    // 5. Buat presigned GET URL dengan masa berlaku 15 menit (900 detik)
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // 6. Alihkan (redirect) langsung ke presigned URL S3
    return redirect(signedUrl, 302);
  } catch (error) {
    console.error('Error serving private file viewer URL:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memuat dokumen yang diminta.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
