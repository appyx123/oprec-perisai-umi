import type { APIRoute } from 'astro';
import { clearAuthCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  clearAuthCookie(cookies);

  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    return new Response(
      JSON.stringify({ success: true, message: 'Logout berhasil.', redirectUrl: '/' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return redirect('/', 302);
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  clearAuthCookie(cookies);
  return redirect('/', 302);
};
