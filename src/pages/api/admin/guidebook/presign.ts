import type { APIRoute } from 'astro';
import { AwsClient } from 'aws4fetch';
import { eq } from 'drizzle-orm';
import { createDb } from '../../../../db';
import { peminatan } from '../../../../db/schema';
import { getEnvVar } from '../../../../lib/env';

/**
 * POST /api/admin/guidebook/presign
 * Menghasilkan Presigned PUT URL Backblaze B2 khusus Administrator
 * agar browser Admin dapat mengunggah berkas PDF 25MB langsung ke storage
 * tanpa membebani memori (128MB RAM) Cloudflare Workers.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Verifikasi hak akses Administrator
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Tindakan ini hanya untuk Administrator.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse body request
    let body: Record<string, any> | null = null;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'Format JSON tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const peminatanId = Number(body?.id ?? body?.peminatanId);
    const fileName = String(body?.fileName || body?.filename || 'guidebook.pdf').trim();
    const contentType = String(body?.contentType || 'application/pdf').trim();

    if (!peminatanId || isNaN(peminatanId)) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID Peminatan wajib disertakan dan berupa angka.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validasi ekstensi harus PDF
    if (!fileName.toLowerCase().endsWith('.pdf') && contentType !== 'application/pdf') {
      return new Response(
        JSON.stringify({ success: false, message: 'Hanya berkas berformat PDF (.pdf) yang diperbolehkan.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Pastikan record peminatan ada di DB
    const db = createDb();
    const [existing] = await db
      .select({ id: peminatan.id, nama: peminatan.nama, guidebookUrl: peminatan.guidebookUrl })
      .from(peminatan)
      .where(eq(peminatan.id, peminatanId))
      .limit(1);

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data Peminatan tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Generate object key yang rapi dan aman
    const sanitizedNama = existing.nama
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const timestamp = Math.floor(Date.now() / 1000);
    const randomSalt = crypto.randomUUID().slice(0, 8);
    const fileKey = `guidebooks/guidebook-${sanitizedNama}-${timestamp}-${randomSalt}.pdf`;

    // 5. Inisialisasi kredensial S3 Backblaze B2
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
      throw new Error('Kredensial S3/B2 belum dikonfigurasi di Cloudflare Secrets.');
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
    targetUrl.searchParams.set('X-Amz-Expires', '900'); // 15 menit

    // Sign Presigned PUT URL
    const signed = await aws.sign(targetUrl.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      aws: {
        signQuery: true,
      },
    });

    const presignedUrl = signed.url;
    const finalPublicUrl = `${endpoint}/${bucketName}/${cleanKey}`;

    return new Response(
      JSON.stringify({
        success: true,
        presignedUrl,
        fileKey: cleanKey,
        publicUrl: finalPublicUrl,
        peminatanId: existing.id,
        peminatanNama: existing.nama,
        oldGuidebookUrl: existing.guidebookUrl,
        expiresIn: 900,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error generating admin guidebook presigned URL:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Gagal menghasilkan URL unggah Guidebook.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
