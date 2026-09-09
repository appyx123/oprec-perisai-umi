import type { APIRoute } from 'astro';
import { createPresignedPutUrl } from '../../../lib/s3';

export const POST: APIRoute = async ({ request, locals }) => {
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

  // 2. Parse request body secara aman
  let body: Record<string, any> | null = null;
  try {
    body = await request.json();
  } catch (parseErr: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Format request body tidak valid. Format JSON diperlukan.',
        error: parseErr?.message || 'Invalid JSON format',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body || typeof body !== 'object') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Payload request tidak boleh kosong.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { filename, contentType, category } = body;

  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Parameter filename wajib diisi dengan nama berkas yang valid.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!contentType || typeof contentType !== 'string' || contentType.trim() === '') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Parameter contentType wajib disertakan.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Sanitasi dan susun nama file yang unik dan aman
  // Format: user_{userId}_{kategori}_{timestamp}_{randomHex}.{ext}
  const sanitizedCategory = String(category || 'ktm')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

  const trimmedFilename = filename.trim();
  const rawExt = trimmedFilename.includes('.')
    ? trimmedFilename.substring(trimmedFilename.lastIndexOf('.')).toLowerCase()
    : '';
  // Cegah ekstensi berbahaya
  const safeExt = rawExt.replace(/[^a-z0-9.]/g, '');

  const timestamp = Math.floor(Date.now() / 1000);
  const randomHex = Math.random().toString(36).substring(2, 8);
  const finalFileName = `user_${user.id}_${sanitizedCategory}_${timestamp}_${randomHex}${safeExt}`;

  // 4. Buat Presigned PUT URL menggunakan aws4fetch (Edge-Native)
  try {
    // Teruskan `locals` agar kredensial diambil dari Cloudflare Workers runtime env / secrets
    const uploadUrl = await createPresignedPutUrl(
      finalFileName,
      contentType.trim(),
      locals,
      900
    );

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
  } catch (error: any) {
    console.error('Error generating presigned S3 URL with aws4fetch:', error);
    const errorMessage = error?.message || 'Gagal menghasilkan URL presigned S3.';

    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        error: errorMessage,
        code: error?.name || 'S3PresignError',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

