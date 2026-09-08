import { S3Client } from '@aws-sdk/client-s3';

export interface S3EnvConfig {
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET_NAME?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  [key: string]: any;
}

/**
 * Helper to resolve individual string env variable from an env object (e.g. locals.runtime?.env),
 * import.meta.env (Vite/Astro), or process.env (Node.js).
 */
function resolveEnvVar(key: string, env?: S3EnvConfig): string | undefined {
  if (env && typeof env[key] === 'string' && env[key].trim() !== '') {
    return env[key].trim();
  }

  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env[key] === 'string' &&
    import.meta.env[key].trim() !== ''
  ) {
    return import.meta.env[key].trim();
  }

  if (
    typeof process !== 'undefined' &&
    process.env &&
    typeof process.env[key] === 'string' &&
    process.env[key].trim() !== ''
  ) {
    return process.env[key].trim();
  }

  return undefined;
}

/**
 * Membuat instance S3Client dengan konfigurasi eksplisit.
 * Kompatibel dengan Edge Runtime (Cloudflare Workers / Pages).
 * Mengutamakan objek runtime env (misal dari locals.runtime?.env),
 * lalu import.meta.env, dan process.env.
 *
 * @param env - Objek berisi variabel environment Cloudflare runtime / Vite env
 */
export function getS3Client(env?: S3EnvConfig): S3Client {
  const endpoint = resolveEnvVar('S3_ENDPOINT', env);
  const region = resolveEnvVar('S3_REGION', env) || 'auto';
  const accessKeyId = resolveEnvVar('AWS_ACCESS_KEY_ID', env) || '';
  const secretAccessKey = resolveEnvVar('AWS_SECRET_ACCESS_KEY', env) || '';

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
export function getS3BucketName(env?: S3EnvConfig): string {
  return resolveEnvVar('S3_BUCKET_NAME', env) || 'orec-perisai-berkas';
}
