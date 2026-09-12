import type { APIRoute } from 'astro';
import { eq, asc } from 'drizzle-orm';
import { createDb } from '../../../db';
import { peminatan } from '../../../db/schema';
import { uploadS3Object, deleteS3Object } from '../../../lib/s3';

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

      // Upload file PDF
      const file = formData.get('guidebook') as File | null;
      if (!file || !(file instanceof File) || file.size === 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Silakan pilih berkas file PDF Guidebook untuk diunggah.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validasi tipe berkas (harus PDF)
      const fileNameLower = file.name.toLowerCase();
      if (file.type !== 'application/pdf' && !fileNameLower.endsWith('.pdf')) {
        return new Response(
          JSON.stringify({ success: false, message: 'Hanya berkas format PDF (.pdf) yang diperbolehkan untuk Guidebook.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validasi ukuran berkas (maksimal 25MB)
      const MAX_FILE_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ success: false, message: 'Ukuran berkas PDF melebihi batas maksimal 25MB.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Generate nama file yang rapi dan URL-friendly: guidebook-[nama-peminatan]-[timestamp].pdf
      const sanitizedNama = existing.nama
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const timestamp = Math.floor(Date.now() / 1000);
      const objectKey = `guidebooks/guidebook-${sanitizedNama}-${timestamp}.pdf`;

      // Unggah berkas langsung ke S3 / Backblaze B2
      const arrayBuffer = await file.arrayBuffer();
      const uploadResult = await uploadS3Object(objectKey, arrayBuffer, 'application/pdf');

      if (!uploadResult.success || !uploadResult.url) {
        return new Response(
          JSON.stringify({
            success: false,
            message: uploadResult.error || 'Gagal mengunggah berkas Guidebook ke penyimpanan cloud B2.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const newPublicUrl = uploadResult.url;
      const oldUrl = existing.guidebookUrl;

      // Update kolom guidebook_url di tabel peminatan Turso
      const [updatedRecord] = await db
        .update(peminatan)
        .set({ guidebookUrl: newPublicUrl })
        .where(eq(peminatan.id, id))
        .returning();

      // Hapus file lama di S3/B2 jika ada
      if (oldUrl && oldUrl !== newPublicUrl) {
        await deleteS3Object(oldUrl);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Guidebook PDF berhasil diunggah dan disimpan.',
          data: updatedRecord,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
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
