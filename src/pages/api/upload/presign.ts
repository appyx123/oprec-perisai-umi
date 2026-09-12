import type { APIRoute } from 'astro';
import { AwsClient } from 'aws4fetch';
import { getEnvVar } from '../../../lib/env';

/**
 * POST /api/upload/presign
 * Menghasilkan URL presigned S3/Backblaze B2 bertanda tangan aman (aws4fetch)
 * dengan masa berlaku 15 menit agar browser dapat langsung mengunggah file.
 */
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

  // 3. Sanitasi NIM: hanya alfanumerik
  const sanitizedNim = rawNim.replace(/[^a-zA-Z0-9_-]/g, '');

  // 4. Generate Unix timestamp (dalam detik)
  const timestamp = Math.floor(Date.now() / 1000);

  // STEP 3: CONSTRUCT THE OBJECT KEY
  // Template: cagen/[nim]/[sanitized-jenisBerkas]-[timestamp][extension]
  const fileKey = `cagen/${sanitizedNim}/${sanitizedJenisBerkas}-${timestamp}${safeExt}`;

  // STEP 4: GENERATE PRESIGNED URL USING aws4fetch & import { env } from 'cloudflare:workers'
  try {
    const accessKeyId = getEnvVar('AWS_ACCESS_KEY_ID') || getEnvVar('B2_ACCESS_KEY_ID');
    const secretAccessKey = getEnvVar('AWS_SECRET_ACCESS_KEY') || getEnvVar('B2_SECRET_ACCESS_KEY');
    const region = getEnvVar('S3_REGION') || getEnvVar('B2_REGION') || 'auto';
    let endpoint =
      getEnvVar('S3_ENDPOINT') ||
      getEnvVar('B2_ENDPOINT') ||
      'https://s3.eu-central-003.backblazeb2.com';
    const bucketName =
      getEnvVar('S3_BUCKET_NAME') ||
      getEnvVar('B2_BUCKET_NAME') ||
      'oprec-perisai';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'Kredensial S3 tidak ditemukan. Pastikan AWS_ACCESS_KEY_ID dan AWS_SECRET_ACCESS_KEY telah dikonfigurasi pada Cloudflare Environment Variables / Secrets.'
      );
    }

    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    endpoint = endpoint.replace(/\/+$/, '');

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
      service: 's3',
    });

    const cleanKey = fileKey.replace(/^\/+/, '');
    const targetUrl = new URL(`${endpoint}/${bucketName}/${cleanKey}`);
    targetUrl.searchParams.set('X-Amz-Expires', '900');

    const signed = await aws.sign(targetUrl.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': rawContentType,
      },
      aws: {
        signQuery: true,
      },
    });

    const presignedUrl = signed.url;

    return new Response(
      JSON.stringify({
        success: true,
        presignedUrl,
        fileKey,
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
