import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { createDb } from '../../../db';
import { cagens, STATUS_PENDAFTARAN, type StatusPendaftaran } from '../../../db/schema';

export const POST: APIRoute = async ({ request, locals }) => {
  return handleStatusUpdate(request, locals);
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  return handleStatusUpdate(request, locals);
};

async function handleStatusUpdate(request: Request, locals: App.Locals): Promise<Response> {
  try {
    // 1. Verifikasi hak akses admin
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Tindakan ini hanya diperuntukkan bagi Administrator / Panitia OREC.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse payload request (mendukung JSON dan FormData)
    let id: number | null = null;
    let statusPendaftaran: string | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as Record<string, any> | null;
      if (body) {
        id = Number(body.id ?? body.cagenId);
        statusPendaftaran = body.statusPendaftaran ?? body.status ?? null;
      }
    } else {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        const rawId = formData.get('id') ?? formData.get('cagenId');
        id = rawId ? Number(rawId) : null;
        const rawStatus = formData.get('statusPendaftaran') ?? formData.get('status');
        statusPendaftaran = rawStatus ? String(rawStatus) : null;
      }
    }

    // 3. Validasi ID
    if (!id || isNaN(id) || id <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter ID calon anggota tidak valid.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validasi status seleksi
    if (!statusPendaftaran || !STATUS_PENDAFTARAN.includes(statusPendaftaran as StatusPendaftaran)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Status seleksi tidak valid. Pilihan yang diperbolehkan: ${STATUS_PENDAFTARAN.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Inisialisasi DB dan cek keberadaan pendaftar
    const db = createDb();
    const [existingCagen] = await db
      .select({ id: cagens.id, namaLengkap: cagens.namaLengkap, statusPendaftaran: cagens.statusPendaftaran })
      .from(cagens)
      .where(eq(cagens.id, id))
      .limit(1);

    if (!existingCagen) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Calon anggota dengan ID #${id} tidak ditemukan di sistem.`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Update status pendaftaran
    await db
      .update(cagens)
      .set({
        statusPendaftaran: statusPendaftaran as StatusPendaftaran,
      })
      .where(eq(cagens.id, id));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Status seleksi untuk ${existingCagen.namaLengkap} berhasil diubah menjadi "${statusPendaftaran}".`,
        data: {
          id,
          previousStatus: existingCagen.statusPendaftaran,
          newStatus: statusPendaftaran,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating cagen status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan pada server saat memperbarui status peserta.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
