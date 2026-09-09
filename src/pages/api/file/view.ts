import type { APIRoute } from 'astro';
import { createPresignedGetUrl } from '../../../lib/s3';

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

    // 4. Buat presigned GET URL menggunakan aws4fetch dengan masa berlaku 15 menit (900 detik)
    const signedUrl = await createPresignedGetUrl(fileName, locals, 900);

    // 5. Alihkan (redirect) langsung ke presigned URL S3
    return redirect(signedUrl, 302);
  } catch (error: any) {
    console.error('Error serving private file viewer URL with aws4fetch:', error);
    const errorMessage = error?.message || 'Gagal memuat dokumen yang diminta.';
    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        error: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

