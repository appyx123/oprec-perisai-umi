import type { APIRoute } from 'astro';
import { eq, desc } from 'drizzle-orm';
import { createDb } from '../../../db';
import { publicQna } from '../../../db/schema';

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
    const questions = await db
      .select()
      .from(publicQna)
      .orderBy(desc(publicQna.createdAt));

    return new Response(
      JSON.stringify({ success: true, questions }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching questions:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Gagal memuat daftar pertanyaan.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, any> | null;
    if (!body || !body.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID pertanyaan tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = Number(body.id);
    const updateData: Record<string, any> = {};

    if (body.answer !== undefined) {
      updateData.answer = body.answer ? String(body.answer).trim() : null;
    }

    if (body.isPublished !== undefined) {
      updateData.isPublished = Boolean(body.isPublished);
    }

    const db = createDb();
    const [existing] = await db
      .select({ id: publicQna.id })
      .from(publicQna)
      .where(eq(publicQna.id, id))
      .limit(1);

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, message: 'Pertanyaan tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [updated] = await db
      .update(publicQna)
      .set(updateData)
      .where(eq(publicQna.id, id))
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data tanya jawab berhasil diperbarui.',
        data: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating question:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan saat memperbarui tanya jawab.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, locals, url }) => {
  try {
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let id: number | null = null;
    const queryId = url.searchParams.get('id');
    if (queryId) {
      id = Number(queryId);
    } else {
      const body = (await request.json().catch(() => null)) as Record<string, any> | null;
      if (body && body.id) {
        id = Number(body.id);
      }
    }

    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID pertanyaan tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();
    await db.delete(publicQna).where(eq(publicQna.id, id));

    return new Response(
      JSON.stringify({ success: true, message: 'Pertanyaan berhasil dihapus.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting question:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan saat menghapus pertanyaan.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
