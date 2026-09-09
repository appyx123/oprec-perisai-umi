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

  // STEP 1: EXTRACT DATA
  // Mendukung parameter baru: nim, jenisBerkas, fileName
  // Serta fallback kompatibilitas: category, filename
  const rawNim = String(body.nim || user.nim || '').trim();
  const rawJenisBerkas = String(body.jenisBerkas || body.category || '').trim();
  const rawFileName = String(body.fileName || body.filename || '').trim();
  const rawContentType = String(body.contentType || 'application/octet-stream').trim();

  if (!rawNim) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Parameter nim wajib disertakan.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!rawJenisBerkas) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Parameter jenisBerkas wajib disertakan (contoh: KTM, CV, Pas Foto).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!rawFileName) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Parameter fileName wajib disertakan untuk menentukan format berkas.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // STEP 2: SANITIZE & FORMAT
  // 1. Ekstrak ekstensi berkas asli
  const rawExt = rawFileName.includes('.')
    ? rawFileName.substring(rawFileName.lastIndexOf('.')).toLowerCase()
    : '';
  const safeExt = rawExt.replace(/[^a-z0-9.]/g, '');

  // 2. Sanitasi jenisBerkas: huruf kecil, spasi menjadi tanda hubung (-), hapus karakter khusus
  const sanitizedJenisBerkas = rawJenisBerkas
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-');

  // 3. Sanitasi NIM: hanya alfanumerik untuk keamanan path traversal
  const sanitizedNim = rawNim.replace(/[^a-zA-Z0-9_-]/g, '');

  // 4. Generate Unix timestamp (dalam detik)
  const timestamp = Math.floor(Date.now() / 1000);

  // STEP 3: CONSTRUCT THE OBJECT KEY
  // Template: cagen/[nim]/[sanitized-jenisBerkas]-[timestamp][extension]
  // Contoh: cagen/13020210001/pas-foto-1788917002.jpg
  const fileKey = `cagen/${sanitizedNim}/${sanitizedJenisBerkas}-${timestamp}${safeExt}`;

  // STEP 4: GENERATE PRESIGNED URL
  try {
    const presignedUrl = await createPresignedPutUrl(
      fileKey,
      rawContentType,
      locals,
      900
    );

    return new Response(
      JSON.stringify({
        success: true,
        presignedUrl,
        fileKey,
        // Alias backward compatibility untuk frontend
        uploadUrl: presignedUrl,
        finalFileName: fileKey,
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
