import { S3Client } from '@aws-sdk/client-s3';

export interface S3EnvConfig {
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET_NAME?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
}

/**
 * Membuat instance S3Client dengan konfigurasi eksplisit.
 * Kompatibel dengan Edge Runtime (Cloudflare Pages Functions).
 * Tidak bergantung pada implicit Node.js process.env.
 *
 * @param env - Objek berisi variabel environment Cloudflare runtime / Vite env
 */
export function getS3Client(env?: S3EnvConfig): S3Client {
  const endpoint =
    env?.S3_ENDPOINT ||
    (typeof import.meta !== 'undefined' && import.meta.env?.S3_ENDPOINT) ||
    (typeof process !== 'undefined' && process.env?.S3_ENDPOINT) ||
    undefined;

  const region =
    env?.S3_REGION ||
    (typeof import.meta !== 'undefined' && import.meta.env?.S3_REGION) ||
    (typeof process !== 'undefined' && process.env?.S3_REGION) ||
    'auto';

  const accessKeyId =
    env?.AWS_ACCESS_KEY_ID ||
    (typeof import.meta !== 'undefined' && import.meta.env?.AWS_ACCESS_KEY_ID) ||
    (typeof process !== 'undefined' && process.env?.AWS_ACCESS_KEY_ID) ||
    '';

  const secretAccessKey =
    env?.AWS_SECRET_ACCESS_KEY ||
    (typeof import.meta !== 'undefined' && import.meta.env?.AWS_SECRET_ACCESS_KEY) ||
    (typeof process !== 'undefined' && process.env?.AWS_SECRET_ACCESS_KEY) ||
    '';

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // forcePathStyle: true direkomendasikan untuk S3-compatible storage seperti Backblaze / MinIO
    forcePathStyle: true,
  });
}

/**
 * Mendapatkan nama bucket S3/B2 dari environment.
 */
export function getS3BucketName(env?: S3EnvConfig): string {
  return (
    env?.S3_BUCKET_NAME ||
    (typeof import.meta !== 'undefined' && import.meta.env?.S3_BUCKET_NAME) ||
    (typeof process !== 'undefined' && process.env?.S3_BUCKET_NAME) ||
    'orec-perisai-berkas'
  );
}
