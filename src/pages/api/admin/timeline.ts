import type { APIRoute } from 'astro';
import { eq, asc } from 'drizzle-orm';
import { createDb } from '../../../db';
import { timelineEvents } from '../../../db/schema';

function parseDateWITA(val: any): Date | null {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null;
  let str = String(val).trim();
  // Jika format datetime-local (YYYY-MM-DDTHH:mm), tambahkan detik dan offset WITA (+08:00)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    str = `${str.length === 16 ? str + ':00' : str}+08:00`;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

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
    const events = await db
      .select()
      .from(timelineEvents)
      .orderBy(asc(timelineEvents.sequenceOrder), asc(timelineEvents.startDate));

    return new Response(
      JSON.stringify({ success: true, events }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching timeline events:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Gagal memuat daftar tahapan seleksi.' }),
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

    const body = (await request.json().catch(() => null)) as Record<string, any> | null;
    if (!body) {
      return new Response(
        JSON.stringify({ success: false, message: 'Format data tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const title = String(body.title || '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const startDate = parseDateWITA(body.startDate);
    const endDate = parseDateWITA(body.endDate);
    const sequenceOrder = Number(body.sequenceOrder) || 1;

    if (!title) {
      return new Response(
        JSON.stringify({ success: false, message: 'Judul tahapan wajib diisi.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!startDate) {
      return new Response(
        JSON.stringify({ success: false, message: 'Waktu mulai wajib diisi.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (endDate && startDate.getTime() > endDate.getTime()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Waktu mulai tidak boleh lebih lambat daripada waktu selesai.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();
    const [inserted] = await db
      .insert(timelineEvents)
      .values({
        title,
        description,
        startDate,
        endDate: endDate || null,
        sequenceOrder,
      })
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tahapan seleksi berhasil ditambahkan.',
        event: inserted,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating timeline event:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan saat menambahkan tahapan seleksi.' }),
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

    const body = (await request.json().catch(() => null)) as Record<string, any> | null;
    if (!body || !body.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID tahapan wajib disertakan.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = Number(body.id);
    const title = String(body.title || '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const startDate = parseDateWITA(body.startDate);
    const endDate = parseDateWITA(body.endDate);
    const sequenceOrder = Number(body.sequenceOrder) || 1;

    if (!title) {
      return new Response(
        JSON.stringify({ success: false, message: 'Judul tahapan wajib diisi.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!startDate) {
      return new Response(
        JSON.stringify({ success: false, message: 'Waktu mulai wajib diisi.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (endDate && startDate.getTime() > endDate.getTime()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Waktu mulai tidak boleh lebih lambat daripada waktu selesai.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();
    const [existing] = await db
      .select({ id: timelineEvents.id })
      .from(timelineEvents)
      .where(eq(timelineEvents.id, id))
      .limit(1);

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tahapan seleksi tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [updated] = await db
      .update(timelineEvents)
      .set({
        title,
        description,
        startDate,
        endDate: endDate || null,
        sequenceOrder,
      })
      .where(eq(timelineEvents.id, id))
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tahapan seleksi berhasil diperbarui.',
        event: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating timeline event:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan saat memperbarui tahapan seleksi.' }),
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
        JSON.stringify({ success: false, message: 'ID tahapan tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();
    await db
      .delete(timelineEvents)
      .where(eq(timelineEvents.id, id));

    return new Response(
      JSON.stringify({ success: true, message: 'Tahapan seleksi berhasil dihapus.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting timeline event:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan saat menghapus tahapan seleksi.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
