import { S3Client } from '@aws-sdk/client-s3';
import { getEnvVar } from './env';

export interface S3EnvConfig {
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET_NAME?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  [key: string]: any;
}

/**
 * Membuat instance S3Client dengan konfigurasi eksplisit.
 * Kompatibel dengan Edge Runtime (Cloudflare Workers / Pages).
 * Mengutamakan Cloudflare Workers runtime env ('cloudflare:workers'),
 * lalu import.meta.env, dan process.env.
 *
 * @param override - Objek override opsional
 */
export function getS3Client(override?: S3EnvConfig): S3Client {
  const endpoint = getEnvVar('S3_ENDPOINT', override) || undefined;
  const region = getEnvVar('S3_REGION', override) || 'auto';
  const accessKeyId = getEnvVar('AWS_ACCESS_KEY_ID', override);
  const secretAccessKey = getEnvVar('AWS_SECRET_ACCESS_KEY', override);

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // forcePathStyle: true direkomendasikan untuk S3-compatible storage seperti Backblaze / MinIO / R2
    forcePathStyle: true,
  });
}

/**
 * Mendapatkan nama bucket S3/B2 dari environment.
 */
export function getS3BucketName(override?: S3EnvConfig): string {
  return getEnvVar('S3_BUCKET_NAME', override) || 'orec-perisai-berkas';
}
