import { AwsClient } from 'aws4fetch';
import { env } from 'cloudflare:workers';

export interface S3Config {
  endpoint: string;
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Mengambil dan memvalidasi konfigurasi S3 / B2 dari Cloudflare Workers runtime env.
 */
export function getS3Config(): S3Config {
  const accessKeyId =
    env.B2_ACCESS_KEY_ID ||
    env.AWS_ACCESS_KEY_ID ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.B2_ACCESS_KEY_ID || import.meta.env?.AWS_ACCESS_KEY_ID)) ||
    (typeof process !== 'undefined' && (process.env?.B2_ACCESS_KEY_ID || process.env?.AWS_ACCESS_KEY_ID)) ||
    '';

  const secretAccessKey =
    env.B2_SECRET_ACCESS_KEY ||
    env.AWS_SECRET_ACCESS_KEY ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.B2_SECRET_ACCESS_KEY || import.meta.env?.AWS_SECRET_ACCESS_KEY)) ||
    (typeof process !== 'undefined' && (process.env?.B2_SECRET_ACCESS_KEY || process.env?.AWS_SECRET_ACCESS_KEY)) ||
    '';

  const region =
    env.B2_REGION ||
    env.S3_REGION ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.B2_REGION || import.meta.env?.S3_REGION)) ||
    (typeof process !== 'undefined' && (process.env?.B2_REGION || process.env?.S3_REGION)) ||
    'auto';

  let endpoint =
    env.B2_ENDPOINT ||
    env.S3_ENDPOINT ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.B2_ENDPOINT || import.meta.env?.S3_ENDPOINT)) ||
    (typeof process !== 'undefined' && (process.env?.B2_ENDPOINT || process.env?.S3_ENDPOINT)) ||
    'https://s3.eu-central-003.backblazeb2.com';

  const bucketName =
    env.B2_BUCKET_NAME ||
    env.S3_BUCKET_NAME ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.B2_BUCKET_NAME || import.meta.env?.S3_BUCKET_NAME)) ||
    (typeof process !== 'undefined' && (process.env?.B2_BUCKET_NAME || process.env?.S3_BUCKET_NAME)) ||
    'oprec-perisai';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Kredensial S3 / Backblaze B2 tidak ditemukan. Pastikan B2_ACCESS_KEY_ID / AWS_ACCESS_KEY_ID dan B2_SECRET_ACCESS_KEY / AWS_SECRET_ACCESS_KEY telah dikonfigurasi di Cloudflare Environment Variables / Secrets.'
    );
  }

  // Normalisasi endpoint agar diawali https:// dan tanpa trailing slash
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }
  endpoint = endpoint.replace(/\/+$/, '');

  return {
    endpoint,
    region,
    bucketName,
    accessKeyId,
    secretAccessKey,
  };
}

/**
 * Membuat instance AwsClient dari aws4fetch yang 100% native Edge / Cloudflare Workers.
 */
export function getAwsClient(): { client: AwsClient; config: S3Config } {
  const config = getS3Config();

  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: 's3',
  });

  return { client, config };
}

/**
 * Membuat Presigned URL untuk PUT (Upload) berkas ke S3 / B2 / R2.
 */
export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900
): Promise<string> {
  const { client, config } = getAwsClient();

  const cleanKey = key.replace(/^\/+/, '');
  const url = new URL(`${config.endpoint}/${config.bucketName}/${cleanKey}`);
  url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));

  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    aws: {
      signQuery: true,
    },
  });

  return signed.url;
}

/**
 * Membuat Presigned URL untuk GET (View / Download) berkas dari S3 / B2 / R2.
 */
export async function createPresignedGetUrl(
  key: string,
  expiresInSeconds = 900
): Promise<string> {
  const { client, config } = getAwsClient();

  const cleanKey = key.replace(/^\/+/, '');
  const url = new URL(`${config.endpoint}/${config.bucketName}/${cleanKey}`);
  url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));

  const signed = await client.sign(url.toString(), {
    method: 'GET',
    aws: {
      signQuery: true,
    },
  });

  return signed.url;
}

/**
 * Mengunggah file langsung ke S3 / Backblaze B2 menggunakan PUT request bertanda tangan aws4fetch.
 */
export async function uploadS3Object(
  key: string,
  body: ArrayBuffer | Uint8Array | ReadableStream | Blob,
  contentType = 'application/pdf'
): Promise<{ success: boolean; url: string; key: string; error?: string }> {
  try {
    const { client, config } = getAwsClient();
    const cleanKey = key.replace(/^\/+/, '');
    const targetUrl = `${config.endpoint}/${config.bucketName}/${cleanKey}`;

    const res = await client.fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: body as any,
    });

    if (res.ok || res.status === 200 || res.status === 201) {
      const publicUrl = `${config.endpoint}/${config.bucketName}/${cleanKey}`;
      return { success: true, url: publicUrl, key: cleanKey };
    }

    const errText = await res.text().catch(() => '');
    return {
      success: false,
      url: '',
      key: cleanKey,
      error: `Upload gagal ke storage (HTTP ${res.status}): ${errText}`,
    };
  } catch (err: any) {
    console.error(`[S3 UPLOAD ERROR] Gagal mengunggah file ke ${key}:`, err);
    return {
      success: false,
      url: '',
      key,
      error: err?.message || String(err),
    };
  }
}

/**
 * Mengekstrak S3 Object Key dari URL lengkap atau string path mentah.
 * Contoh:
 * - "https://s3.eu-central-003.backblazeb2.com/oprec-perisai/cagen/123/ktm-111.pdf" -> "cagen/123/ktm-111.pdf"
 * - "/oprec-perisai/cagen/123/ktm-111.pdf" -> "cagen/123/ktm-111.pdf"
 * - "cagen/123/ktm-111.pdf" -> "cagen/123/ktm-111.pdf"
 */
export function extractS3Key(keyOrUrl: string, bucketName?: string): string {
  if (!keyOrUrl) return '';
  let clean = keyOrUrl.trim();

  // Jika berupa URL lengkap (http:// atau https://)
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const parsed = new URL(clean);
      clean = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    } catch {
      // jika parsing URL gagal, lanjut pembersihan manual
    }
  }

  // Hilangkan leading slash
  clean = clean.replace(/^\/+/, '');

  // Hilangkan prefix bucket name jika ada (e.g. oprec-perisai/cagen/...)
  const bucket = bucketName || 'oprec-perisai';
  if (bucket && clean.startsWith(`${bucket}/`)) {
    clean = clean.slice(bucket.length + 1);
  }

  // Jika masih terdapat folder induk yang berulang atau path kompleks, prioritaskan format cagen/ atau user_
  const cagenIdx = clean.indexOf('cagen/');
  if (cagenIdx !== -1) {
    clean = clean.slice(cagenIdx);
  } else {
    const userIdx = clean.indexOf('user_');
    if (userIdx !== -1) {
      clean = clean.slice(userIdx);
    }
  }

  return clean;
}

/**
 * Menghapus file/objek dari S3 / Backblaze B2 menggunakan DELETE request bertanda tangan aws4fetch.
 * Berjalan aman (safe execution) dengan try...catch agar tidak menggagalkan proses utama jika terjadi kendala.
 */
export async function deleteS3Object(
  keyOrUrl: string
): Promise<{ success: boolean; key: string; error?: string }> {
  try {
    const { client, config } = getAwsClient();
    const cleanKey = extractS3Key(keyOrUrl, config.bucketName);

    if (!cleanKey) {
      return { success: false, key: '', error: 'Key objek S3 kosong atau tidak valid.' };
    }

    const cleanPath = cleanKey.replace(/^\/+/, '');
    const targetUrl = `${config.endpoint}/${config.bucketName}/${cleanPath}`;

    const res = await client.fetch(targetUrl, {
      method: 'DELETE',
    });

    // S3 DELETE returns 204 No Content (or 200 OK). Both indicate success.
    // 404 is also considered success in terms of deleting orphan files.
    if (res.ok || res.status === 204 || res.status === 404) {
      console.log(`[S3 DELETE SUCCESS] Berhasil menghapus file lama dari B2: ${cleanKey}`);
      return { success: true, key: cleanKey };
    }

    const errorText = await res.text().catch(() => '');
    console.warn(`[S3 DELETE WARNING] Respons S3 saat menghapus ${cleanKey}: HTTP ${res.status} - ${errorText}`);
    return { success: false, key: cleanKey, error: `HTTP ${res.status}: ${errorText}` };
  } catch (err: any) {
    console.error(`[S3 DELETE ERROR] Gagal menghapus file ${keyOrUrl}:`, err?.message || err);
    return { success: false, key: keyOrUrl, error: err?.message || String(err) };
  }
}

