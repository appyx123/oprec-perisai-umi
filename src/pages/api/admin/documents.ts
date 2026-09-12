import type { APIRoute } from 'astro';
import { eq, asc } from 'drizzle-orm';
import { createDb } from '../../../db';
import { documentTypes, peminatan } from '../../../db/schema';

function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// 1. GET: Ambil seluruh daftar jenis dokumen
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
      .select({
        id: documentTypes.id,
        slug: documentTypes.slug,
        label: documentTypes.label,
        group: documentTypes.group,
        peminatanId: documentTypes.peminatanId,
        peminatanNama: peminatan.nama,
        maxFiles: documentTypes.maxFiles,
        acceptMime: documentTypes.acceptMime,
        maxSizeBytes: documentTypes.maxSizeBytes,
        isActive: documentTypes.isActive,
        createdAt: documentTypes.createdAt,
      })
      .from(documentTypes)
      .leftJoin(peminatan, eq(documentTypes.peminatanId, peminatan.id))
      .orderBy(asc(documentTypes.id));

    return new Response(
      JSON.stringify({ success: true, documents: list }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching document types:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Gagal memuat daftar jenis dokumen.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 2. POST: Tambah jenis dokumen baru
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
        JSON.stringify({ success: false, message: 'Payload JSON tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const label = String(body.label || '').trim();
    const group = String(body.group || 'wajib').toLowerCase() as 'wajib' | 'opsional' | 'karya';
    const peminatanId = body.peminatanId ? Number(body.peminatanId) : null;
    const acceptMime = String(body.acceptMime || 'application/pdf').trim();
    const maxSizeMB = Number(body.maxSizeMB || 2);
    const maxSizeBytes = body.maxSizeBytes ? Number(body.maxSizeBytes) : Math.round(maxSizeMB * 1024 * 1024);
    const maxFiles = Math.max(1, Number(body.maxFiles || 1));
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

    if (!label) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nama dokumen (label) wajib diisi.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['wajib', 'opsional', 'karya'].includes(group)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Kelompok dokumen harus bernilai wajib, opsional, atau karya.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();

    // Buat slug unik
    let baseSlug = body.slug ? generateSlug(String(body.slug)) : generateSlug(label);
    if (!baseSlug) baseSlug = 'dokumen_' + Date.now();
    let finalSlug = baseSlug;
    let counter = 1;

    while (true) {
      const [existing] = await db
        .select({ id: documentTypes.id })
        .from(documentTypes)
        .where(eq(documentTypes.slug, finalSlug))
        .limit(1);

      if (!existing) break;
      finalSlug = `${baseSlug}_${counter++}`;
    }

    const [inserted] = await db
      .insert(documentTypes)
      .values({
        slug: finalSlug,
        label,
        group,
        peminatanId,
        maxFiles,
        acceptMime,
        maxSizeBytes,
        isActive,
      })
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Jenis dokumen persyaratan berhasil ditambahkan.',
        document: inserted,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating document type:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Gagal menambahkan jenis dokumen.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 3. PUT: Perbarui konfigurasi jenis dokumen
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
        JSON.stringify({ success: false, message: 'ID Dokumen wajib disertakan.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = Number(body.id);
    const db = createDb();

    const [existing] = await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.id, id))
      .limit(1);

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, message: 'Jenis dokumen tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData: Record<string, any> = {};

    if (body.label !== undefined) updateData.label = String(body.label).trim();
    if (body.group !== undefined && ['wajib', 'opsional', 'karya'].includes(String(body.group).toLowerCase())) {
      updateData.group = String(body.group).toLowerCase();
    }
    if (body.peminatanId !== undefined) {
      updateData.peminatanId = body.peminatanId ? Number(body.peminatanId) : null;
    }
    if (body.acceptMime !== undefined) {
      updateData.acceptMime = String(body.acceptMime).trim();
    }
    if (body.maxSizeMB !== undefined) {
      updateData.maxSizeBytes = Math.round(Number(body.maxSizeMB) * 1024 * 1024);
    } else if (body.maxSizeBytes !== undefined) {
      updateData.maxSizeBytes = Number(body.maxSizeBytes);
    }
    if (body.maxFiles !== undefined) {
      updateData.maxFiles = Math.max(1, Number(body.maxFiles));
    }
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    const [updated] = await db
      .update(documentTypes)
      .set(updateData)
      .where(eq(documentTypes.id, id))
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pengaturan jenis dokumen berhasil diperbarui.',
        document: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error updating document type:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Gagal memperbarui jenis dokumen.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 4. DELETE: Soft delete (set is_active = false)
export const DELETE: APIRoute = async ({ request, url, locals }) => {
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
    const idParam = url.searchParams.get('id');
    const id = Number(body?.id || idParam);

    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID Dokumen wajib disertakan.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();
    const [existing] = await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.id, id))
      .limit(1);

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, message: 'Jenis dokumen tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Soft delete
    await db
      .update(documentTypes)
      .set({ isActive: false })
      .where(eq(documentTypes.id, id));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Dokumen "${existing.label}" berhasil dinonaktifkan.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error deactivating document type:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Gagal menonaktifkan dokumen.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
