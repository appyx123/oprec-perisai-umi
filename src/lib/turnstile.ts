import { getEnvVar } from './env';

/**
 * Memvalidasi token Cloudflare Turnstile ke endpoint resmi siteverify.
 *
 * @param token - Nilai 'cf-turnstile-response' yang dikirimkan klien.
 * @param ip - Opsional. IP klien dari header 'CF-Connecting-IP'.
 * @returns boolean - True jika verifikasi berhasil dan valid.
 */
export async function verifyTurnstile(token?: string | null, ip?: string | null): Promise<boolean> {
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) {
    return false;
  }

  const secretKey = getEnvVar('TURNSTILE_SECRET_KEY');

  // Deteksi lingkungan production
  const isProd =
    (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD)) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

  // Jika di lingkungan dev lokal secret key belum dikonfigurasi, beri peringatan dan izinkan
  if (!secretKey) {
    if (!isProd) {
      console.warn(
        '⚠️ [SECURITY WARNING] TURNSTILE_SECRET_KEY belum dikonfigurasi. Bypass Turnstile diaktifkan untuk development lokal.'
      );
      return true;
    }
    console.error('FATAL: TURNSTILE_SECRET_KEY belum dikonfigurasi di Cloudflare Secrets.');
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', cleanToken);
    if (ip && typeof ip === 'string' && ip.trim() !== '') {
      formData.append('remoteip', ip.trim());
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(`Turnstile siteverify HTTP error: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };

    return Boolean(data?.success);
  } catch (err) {
    console.error('Error verifying Cloudflare Turnstile token:', err);
    return false;
  }
}
