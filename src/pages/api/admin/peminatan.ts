import type { APIRoute } from 'astro';
import { eq, asc } from 'drizzle-orm';
import { createDb } from '../../../db';
import { peminatan } from '../../../db/schema';

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

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { id, guidebookUrl, deskripsi, isActive } = body;

    if (!id || typeof id !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: 'ID Peminatan wajib disertakan dan berupa angka.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validasi URL jika diisi
    const cleanedGuidebookUrl = typeof guidebookUrl === 'string' ? guidebookUrl.trim() : null;
    if (cleanedGuidebookUrl) {
      try {
        new URL(cleanedGuidebookUrl);
      } catch {
        return new Response(
          JSON.stringify({ success: false, message: 'URL Guidebook tidak valid. Pastikan menyertakan http:// atau https://' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const updateData: Record<string, any> = {
      guidebookUrl: cleanedGuidebookUrl ? cleanedGuidebookUrl : null,
    };

    if (typeof deskripsi === 'string' && deskripsi.trim().length > 0) {
      updateData.deskripsi = deskripsi.trim();
    }

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const db = createDb();
    const result = await db
      .update(peminatan)
      .set(updateData)
      .where(eq(peminatan.id, id))
      .returning();

    if (!result || result.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Peminatan tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Guidebook Peminatan berhasil diperbarui.',
        data: result[0],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating peminatan:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Gagal memperbarui data peminatan.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
