import type { APIRoute } from 'astro';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, getS3BucketName, type S3EnvConfig } from '../../../lib/s3';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Verifikasi status otentikasi user
    const user = locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Sesi tidak valid atau telah berakhir. Silakan login terlebih dahulu.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Baca payload request
    const body = await request.json().catch(() => null);
    if (!body || !body.filename || !body.contentType) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter filename dan contentType wajib disertakan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { filename, contentType, category } = body;

    // 3. Sanitasi dan susun nama file yang unik dan aman
    // Format: user_{userId}_{kategori}_{timestamp}_{randomHex}.{ext}
    const sanitizedCategory = String(category || 'ktm')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    const rawExt = String(filename).includes('.')
      ? String(filename).substring(String(filename).lastIndexOf('.')).toLowerCase()
      : '';
    // Cegah ekstensi berbahaya
    const safeExt = rawExt.replace(/[^a-z0-9.]/g, '');

    const timestamp = Math.floor(Date.now() / 1000);
    const randomHex = Math.random().toString(36).substring(2, 8);
    const finalFileName = `user_${user.id}_${sanitizedCategory}_${timestamp}_${randomHex}${safeExt}`;

    // 4. Resolusi environment variables untuk S3
    const runtimeEnv = (locals.runtime?.env ?? {}) as S3EnvConfig;
    const s3 = getS3Client(runtimeEnv);
    const bucketName = getS3BucketName(runtimeEnv);

    // 5. Generate Pre-signed PUT URL (berlaku 15 menit = 900 detik)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: finalFileName,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    return new Response(
      JSON.stringify({
        success: true,
        uploadUrl,
        finalFileName,
        expiresIn: 900,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating presigned S3 URL:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal membuat URL unggah berkas S3.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
