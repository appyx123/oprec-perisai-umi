import type { APIRoute } from 'astro';
import { eq, asc } from 'drizzle-orm';
import { createDb } from '../../../db';
import { peminatan } from '../../../db/schema';
import { deleteS3Object } from '../../../lib/s3';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();
    const list = await db
      .select()
      .from(peminatan)
      .orderBy(asc(peminatan.id));

    return new Response(
      JSON.stringify({ success: true, peminatan: list }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching peminatan list:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Gagal mengambil data peminatan.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    const db = createDb();

    // 1. Tangani Multipart Form Data (Upload File PDF)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const idStr = formData.get('id');
      const action = String(formData.get('action') || '').toLowerCase();
      const id = Number(idStr);

      if (!id || isNaN(id)) {
        return new Response(
          JSON.stringify({ success: false, message: 'ID Peminatan wajib disertakan dan berupa angka.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Ambil data peminatan yang ada
      const [existing] = await db
        .select()
        .from(peminatan)
        .where(eq(peminatan.id, id))
        .limit(1);

      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, message: 'Data Peminatan tidak ditemukan.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Jika aksi hapus guidebook
      if (action === 'delete' || action === 'remove') {
        const oldUrl = existing.guidebookUrl;
        await db
          .update(peminatan)
          .set({ guidebookUrl: null })
          .where(eq(peminatan.id, id));

        if (oldUrl) {
          await deleteS3Object(oldUrl);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Guidebook PDF berhasil dihapus dari sistem.',
            data: { id, guidebookUrl: null },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Deprekasi upload fisik di memori Worker (mencegah OOM 128MB)
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Fitur ini telah dideprekasi demi stabilitas server. Silakan gunakan endpoint Presigned URL (/api/admin/guidebook/presign) untuk mengunggah berkas secara langsung.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fallback JSON Payload Update
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const { id, guidebookUrl, deskripsi, isActive } = body;

    if (!id || typeof id !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: 'ID Peminatan wajib disertakan dan berupa angka.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData: Record<string, any> = {};
    if (guidebookUrl !== undefined) {
      updateData.guidebookUrl = guidebookUrl ? String(guidebookUrl).trim() : null;
    }
    if (typeof deskripsi === 'string' && deskripsi.trim().length > 0) {
      updateData.deskripsi = deskripsi.trim();
    }
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const result = await db
      .update(peminatan)
      .set(updateData)
      .where(eq(peminatan.id, id))
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data Peminatan berhasil diperbarui.',
        data: result[0],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error handling peminatan POST:', error);
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Gagal memproses pembaruan peminatan.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async (context) => {
  // Alias PUT ke POST handler
  return POST(context);
};
