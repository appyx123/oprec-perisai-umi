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
    env.AWS_ACCESS_KEY_ID ||
    (typeof import.meta !== 'undefined' && import.meta.env?.AWS_ACCESS_KEY_ID) ||
    (typeof process !== 'undefined' && process.env?.AWS_ACCESS_KEY_ID) ||
    '';

  const secretAccessKey =
    env.AWS_SECRET_ACCESS_KEY ||
    (typeof import.meta !== 'undefined' && import.meta.env?.AWS_SECRET_ACCESS_KEY) ||
    (typeof process !== 'undefined' && process.env?.AWS_SECRET_ACCESS_KEY) ||
    '';

  const region =
    env.S3_REGION ||
    (typeof import.meta !== 'undefined' && import.meta.env?.S3_REGION) ||
    (typeof process !== 'undefined' && process.env?.S3_REGION) ||
    'auto';

  let endpoint =
    env.S3_ENDPOINT ||
    (typeof import.meta !== 'undefined' && import.meta.env?.S3_ENDPOINT) ||
    (typeof process !== 'undefined' && process.env?.S3_ENDPOINT) ||
    'https://s3.eu-central-003.backblazeb2.com';

  const bucketName =
    env.S3_BUCKET_NAME ||
    (typeof import.meta !== 'undefined' && import.meta.env?.S3_BUCKET_NAME) ||
    (typeof process !== 'undefined' && process.env?.S3_BUCKET_NAME) ||
    'oprec-perisai';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Kredensial S3 tidak ditemukan. Pastikan AWS_ACCESS_KEY_ID dan AWS_SECRET_ACCESS_KEY telah dikonfigurasi di Cloudflare Environment Variables / Secrets.'
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
