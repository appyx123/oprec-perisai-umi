import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { safeLike } from '../../lib/db-utils';
import { createDb } from '../../db';
import { peminatan } from '../../db/schema';
import { getAwsClient, extractS3Key } from '../../lib/s3';

/**
 * GET /api/guidebook
 * Menyajikan berkas Guidebook PDF publik dengan proteksi Cloudflare Edge Caching (caches.default).
 * Mencegah pemborosan kuota transaksi Class B harian Backblaze B2 (limit 2.500/hari).
 */
export const GET: APIRoute = async ({ request, url, redirect }) => {
  try {
    // 1. Cek Cloudflare Edge Cache terlebih dahulu
    // Menggunakan caches.default native Cloudflare Workers
    const cache = (caches as any).default;
    const cacheKey = new Request(url.toString(), {
      method: 'GET',
      headers: request.headers,
    });

    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        // Cache Hit: Mengembalikan dokumen dari CDN Edge tanpa menyentuh Turso DB maupun B2 API!
        const hitHeaders = new Headers(cachedResponse.headers);
        hitHeaders.set('X-Edge-Cache', 'HIT');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers: hitHeaders,
        });
      }
    } catch {
      // Abaikan jika cache API tidak aktif di environment lokal dev
    }

    // 2. Cache Miss: Ambil metadata dari Turso Database
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
        .where(safeLike(peminatan.guidebookUrl, keyParam))
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

    // Jika berupa link eksternal (misal Google Drive), alihkan dengan 302
    if (!rawUrl.includes('backblazeb2.com') && !rawUrl.includes('guidebooks/')) {
      return redirect(rawUrl, 302);
    }

    // 3. Ekstrak S3 Key & Ambil berkas dari Backblaze B2 via signed request
    const { client, config } = getAwsClient();
    const cleanKey = extractS3Key(rawUrl, config.bucketName);

    if (!cleanKey) {
      return redirect(rawUrl, 302);
    }

    const targetUrl = `${config.endpoint}/${config.bucketName}/${cleanKey.replace(/^\/+/, '')}`;
    const s3Response = await client.fetch(targetUrl, {
      method: 'GET',
    });

    if (s3Response.ok && s3Response.body) {
      const safeFilename = `Guidebook-${record.nama.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      
      const edgeResponse = new Response(s3Response.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${safeFilename}"`,
          // s-maxage=604800 (Cache di Cloudflare CDN selama 7 hari), max-age=7200 (Cache di browser 2 jam)
          'Cache-Control': 'public, max-age=7200, s-maxage=604800',
          'X-Edge-Cache': 'MISS',
        },
      });

      // 4. Simpan hasil fetch ke Cloudflare Edge Cache agar pemanggilan berikutnya tidak ke B2
      try {
        await cache.put(cacheKey, edgeResponse.clone());
      } catch (cacheErr) {
        console.warn('Gagal menyimpan ke Edge Cache:', cacheErr);
      }

      return edgeResponse;
    }

    // Jika B2 gagal memuat file
    return new Response(
      JSON.stringify({
        success: false,
        message: `Berkas Guidebook tidak dapat ditemukan di penyimpanan cloud (HTTP ${s3Response.status}).`,
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
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
