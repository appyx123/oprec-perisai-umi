import { AwsClient } from 'aws4fetch';
import { getEnvVar } from './env';

export interface S3Config {
  endpoint: string;
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Mengambil dan memvalidasi konfigurasi S3 / B2 dari environment (Cloudflare Workers / locals / env).
 */
export function getS3Config(source?: any): S3Config {
  let endpoint = getEnvVar('S3_ENDPOINT', source) || 'https://s3.eu-central-003.backblazeb2.com';
  const region = getEnvVar('S3_REGION', source) || 'auto';
  const bucketName = getEnvVar('S3_BUCKET_NAME', source) || 'oprec-perisai';
  const accessKeyId = getEnvVar('AWS_ACCESS_KEY_ID', source);
  const secretAccessKey = getEnvVar('AWS_SECRET_ACCESS_KEY', source);

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Kredensial S3 tidak ditemukan. Pastikan AWS_ACCESS_KEY_ID dan AWS_SECRET_ACCESS_KEY telah dikonfigurasi di environment atau Cloudflare secrets.'
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
export function getAwsClient(source?: any): { client: AwsClient; config: S3Config } {
  const config = getS3Config(source);

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
  source?: any,
  expiresInSeconds = 900
): Promise<string> {
  const { client, config } = getAwsClient(source);

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
  source?: any,
  expiresInSeconds = 900
): Promise<string> {
  const { client, config } = getAwsClient(source);

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
