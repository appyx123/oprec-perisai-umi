import type { APIRoute } from 'astro';
import { eq, like } from 'drizzle-orm';
import { createDb } from '../../db';
import { peminatan } from '../../db/schema';
import { getAwsClient, createPresignedGetUrl, extractS3Key } from '../../lib/s3';

export const GET: APIRoute = async ({ url, redirect }) => {
  try {
    const idParam = url.searchParams.get('id');
    const trackParam = url.searchParams.get('peminatan') || url.searchParams.get('track');
    const keyParam = url.searchParams.get('key');

    const db = createDb();
    let record: any = null;

    if (idParam && !isNaN(Number(idParam))) {
      const [row] = await db
        .select()
        .from(peminatan)
        .where(eq(peminatan.id, Number(idParam)))
        .limit(1);
      record = row;
    } else if (trackParam) {
      const cleanTrack = trackParam.trim().toLowerCase();
      const rows = await db
        .select()
        .from(peminatan);
      record = rows.find(
        (r) =>
          r.nama.toLowerCase() === cleanTrack ||
          r.nama.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTrack.replace(/[^a-z0-9]/g, '')
      );
    } else if (keyParam) {
      const [row] = await db
        .select()
        .from(peminatan)
        .where(like(peminatan.guidebookUrl, `%${keyParam.trim()}%`))
        .limit(1);
      record = row;
    }

    if (!record || !record.guidebookUrl) {
      return new Response(
        `<!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>Guidebook Belum Tersedia - PERISAI UMI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#121217] text-white min-h-screen flex items-center justify-center p-6">
          <div class="max-w-md w-full bg-[#181820] border border-amber-500/20 rounded-3xl p-8 text-center shadow-2xl">
            <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h1 class="text-xl font-bold mb-2">Guidebook Belum Tersedia</h1>
            <p class="text-sm text-gray-400 mb-6">
              Berkas panduan resmi untuk bidang peminatan ini belum diunggah oleh panitia seleksi. Silakan cek kembali secara berkala.
            </p>
            <a href="/" class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors">
              Kembali ke Beranda
            </a>
          </div>
        </body>
        </html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const rawUrl = String(record.guidebookUrl).trim();

    // Jika bukan URL Backblaze B2 (misalnya link Google Drive, Docs eksternal, dll.)
    if (!rawUrl.includes('backblazeb2.com') && !rawUrl.includes('guidebooks/')) {
      return redirect(rawUrl, 302);
    }

    // Ekstrak S3 Key dari URL Backblaze B2
    const { client, config } = getAwsClient();
    const cleanKey = extractS3Key(rawUrl, config.bucketName);

    if (!cleanKey) {
      return redirect(rawUrl, 302);
    }

    // Ambil file dari Backblaze B2 menggunakan signed request aws4fetch
    const targetUrl = `${config.endpoint}/${config.bucketName}/${cleanKey.replace(/^\/+/, '')}`;
    const s3Response = await client.fetch(targetUrl, {
      method: 'GET',
    });

    if (s3Response.ok && s3Response.body) {
      const safeFilename = `Guidebook-${record.nama.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      return new Response(s3Response.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${safeFilename}"`,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      });
    }

    // Fallback: Jika streaming langsung tidak didukung atau terkendala, alihkan ke presigned GET URL bertanda tangan
    const signedUrl = await createPresignedGetUrl(cleanKey, 3600);
    return redirect(signedUrl, 302);
  } catch (error: any) {
    console.error('Error serving guidebook PDF:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memuat berkas Guidebook PDF dari penyimpanan.',
        error: error?.message || String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
