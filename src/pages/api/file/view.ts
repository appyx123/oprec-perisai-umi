import type { APIRoute } from 'astro';
import { getAwsClient, extractS3Key } from '../../../lib/s3';

// Peta MIME type berdasarkan ekstensi berkas
const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  zip: 'application/zip',
};

/**
 * GET /api/file/view
 * Menampilkan berkas pribadi pendaftar (KTM, CV, Pas Foto, Portofolio, Transkrip)
 * dengan verifikasi otorisasi ketat + Cloudflare Edge Caching (caches.default).
 * Mencegah 302 Redirect langsung ke B2 yang menghabiskan 2.500 transaksi Class B harian.
 */
export const GET: APIRoute = async ({ url, locals }) => {
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

    // 2. Ambil parameter nama file dari query string
    const fileName = (url.searchParams.get('name') || url.searchParams.get('fileKey') || url.searchParams.get('key') || '').trim();
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
    // - Admin dapat melihat semua file peserta
    // - Peserta (user) HANYA diizinkan melihat file miliknya sendiri
    if (user.role === 'user') {
      const allowedLegacy = `user_${user.id}_`;
      const allowedNewNim = user.nim ? `cagen/${user.nim}/` : null;
      const allowedNewId = `cagen/${user.id}/`;

      const isOwner =
        fileName.startsWith(allowedLegacy) ||
        (allowedNewNim && fileName.startsWith(allowedNewNim)) ||
        fileName.startsWith(allowedNewId);

      if (!isOwner) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Akses ditolak. Anda tidak memiliki izin untuk melihat berkas milik peserta lain.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Periksa Cloudflare Edge Cache (caches.default)
    // Cache key unik berbasis nama file yang sudah lolos otorisasi
    const cache = (caches as any).default;
    const cacheKey = new Request(`https://internal-cache.perisai.site/file/${encodeURIComponent(fileName)}`, {
      method: 'GET',
    });

    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        // Cache Hit: Mengalirkan berkas langsung dari Cloudflare Edge (0 kuota B2 Class B)
        const hitHeaders = new Headers(cachedResponse.headers);
        hitHeaders.set('X-Edge-Cache', 'HIT');
        // Klien browser WAJIB menerima header private demi privasi berkas peserta
        hitHeaders.set('Cache-Control', 'private, no-cache, no-transform');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers: hitHeaders,
        });
      }
    } catch {
      // Abaikan jika cache API tidak aktif di environment lokal dev
    }

    // 5. Cache Miss: Ambil berkas dari Backblaze B2 via signed request aws4fetch
    const { client, config } = getAwsClient();
    const cleanKey = extractS3Key(fileName, config.bucketName);

    if (!cleanKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Key dokumen tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetUrl = `${config.endpoint}/${config.bucketName}/${cleanKey.replace(/^\/+/, '')}`;
    const s3Response = await client.fetch(targetUrl, {
      method: 'GET',
    });

    if (!s3Response.ok || !s3Response.body) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Dokumen tidak ditemukan di penyimpanan Backblaze B2 (HTTP ${s3Response.status}).`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Tentukan Content-Type dan Content-Disposition yang aman
    const ext = cleanKey.split('.').pop()?.toLowerCase() || '';
    const contentType = EXTENSION_MIME_MAP[ext] || s3Response.headers.get('content-type') || 'application/octet-stream';
    const baseFilename = cleanKey.split('/').pop() || 'dokumen';

    // 7. Respon khusus untuk disimpan di internal Cloudflare Edge Cache (caches.default)
    const cacheStorageResponse = new Response(s3Response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${baseFilename}"`,
        // Khusus internal Edge Cache Worker: disimpan 7 hari
        'Cache-Control': 'public, max-age=604800',
      },
    });

    // Simpan ke Cloudflare Edge Cache internal
    try {
      await cache.put(cacheKey, cacheStorageResponse.clone());
    } catch (cacheErr) {
      console.warn('Gagal menyimpan file ke Edge Cache:', cacheErr);
    }

    // 8. Respon keluar ke Browser Klien (WAJIB PRIVATE UNTUK PRIVASI DOKUMEN PESERTA)
    return new Response(cacheStorageResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${baseFilename}"`,
        // Mencegah Web Cache Deception & caching di proxy/CDN publik
        'Cache-Control': 'private, no-cache, no-transform',
        'X-Edge-Cache': 'MISS',
      },
    });
  } catch (error: any) {
    console.error('Error serving private file with Cloudflare Edge Cache:', error);
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
