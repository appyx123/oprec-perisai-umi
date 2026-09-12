export const prerender = false;

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
    const user = (locals as any)?.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb((locals as any)?.runtime?.env);
    let list: any[] = [];

    try {
      list = await db
        .select({
          id: documentTypes.id,
          slug: documentTypes.slug,
          label: documentTypes.label,
          group: documentTypes.group,
          peminatanId: documentTypes.peminatanId,
          peminatanNama: peminatan.nama,
          maxFiles: documentTypes.maxFiles,
          inputType: documentTypes.inputType,
          acceptMime: documentTypes.acceptMime,
          maxSizeBytes: documentTypes.maxSizeBytes,
          isActive: documentTypes.isActive,
          createdAt: documentTypes.createdAt,
        })
        .from(documentTypes)
        .leftJoin(peminatan, eq(documentTypes.peminatanId, peminatan.id))
        .orderBy(asc(documentTypes.id));
    } catch (queryErr: any) {
      // Graceful fallback jika schema turso production belum memiliki kolom input_type
      if (String(queryErr?.message || '').toLowerCase().includes('input_type')) {
        console.warn('[API /api/admin/documents GET] Kolom input_type belum ada di DB, menggunakan fallback query');
        const fallbackList = await db
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

        list = fallbackList.map((item: any) => ({ ...item, inputType: 'file' }));
      } else {
        throw queryErr;
      }
    }

    return new Response(
      JSON.stringify({ success: true, documents: list }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API /api/admin/documents GET Error]:', error);
    return new Response(
      JSON.stringify({ success: false, message: String(error?.message || error || 'Gagal memuat daftar jenis dokumen.') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 2. POST: Tambah jenis dokumen baru
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any)?.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Wrap body parsing strictly in try/catch
    let body: Record<string, any> | null = null;
    try {
      body = (await request.json()) as Record<string, any>;
    } catch (parseError: any) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payload JSON tidak valid atau body kosong: ' + String(parseError?.message || parseError),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ success: false, message: 'Payload JSON tidak valid atau kosong.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const label = String(body.label || '').trim();
    const group = String(body.group || 'wajib').toLowerCase() as 'wajib' | 'opsional' | 'karya';
    const peminatanId = body.peminatanId ? Number(body.peminatanId) : null;
    const inputType = (String(body.inputType || 'file').toLowerCase() === 'link' ? 'link' : 'file') as 'file' | 'link';
    const acceptMime = inputType === 'link' ? String(body.acceptMime || 'text/uri-list').trim() : String(body.acceptMime || 'application/pdf').trim();
    const maxSizeMB = inputType === 'link' ? 0 : Number(body.maxSizeMB || 2);
    const maxSizeBytes = inputType === 'link' ? 0 : (body.maxSizeBytes ? Number(body.maxSizeBytes) : Math.round(maxSizeMB * 1024 * 1024));
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

    const db = createDb((locals as any)?.runtime?.env);

    // Buat slug unik dengan loop terbatas (maks 10 iterasi) untuk menghindari timeout hang
    let baseSlug = body.slug ? generateSlug(String(body.slug)) : generateSlug(label);
    if (!baseSlug) baseSlug = 'dokumen_' + Date.now();
    let finalSlug = baseSlug;

    for (let counter = 1; counter <= 10; counter++) {
      const [existing] = await db
        .select({ id: documentTypes.id })
        .from(documentTypes)
        .where(eq(documentTypes.slug, finalSlug))
        .limit(1);

      if (!existing) break;
      finalSlug = `${baseSlug}_${counter}`;
      if (counter === 10) {
        finalSlug = `${baseSlug}_${Date.now()}`;
      }
    }

    let inserted: any = null;

    try {
      const result = await db
        .insert(documentTypes)
        .values({
          slug: finalSlug,
          label,
          group,
          peminatanId,
          maxFiles,
          inputType,
          acceptMime,
          maxSizeBytes,
          isActive,
        })
        .returning();

      inserted = result[0] || null;
    } catch (insertError: any) {
      // Fallback jika database production belum memuat kolom input_type
      if (String(insertError?.message || '').toLowerCase().includes('input_type')) {
        console.warn('[API /api/admin/documents POST] Kolom input_type belum ada di DB, fallback insert');
        const fallbackValues: any = {
          slug: finalSlug,
          label,
          group,
          peminatanId,
          maxFiles,
          acceptMime,
          maxSizeBytes,
          isActive,
        };
        const result = await db.insert(documentTypes).values(fallbackValues).returning();
        inserted = result[0] || null;
        if (inserted) inserted.inputType = 'file';
      } else {
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Jenis dokumen persyaratan berhasil ditambahkan.',
        document: inserted || { slug: finalSlug, label, group, inputType },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API /api/admin/documents POST Error]:', error);
    return new Response(
      JSON.stringify({ success: false, message: String(error?.message || error || 'Gagal menambahkan jenis dokumen.') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 3. PUT: Perbarui konfigurasi jenis dokumen
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any)?.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Wrap body parsing strictly in try/catch
    let body: Record<string, any> | null = null;
    try {
      body = (await request.json()) as Record<string, any>;
    } catch (parseError: any) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payload JSON tidak valid atau body kosong: ' + String(parseError?.message || parseError),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body || !body.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID Dokumen wajib disertakan.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = Number(body.id);
    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID Dokumen harus berupa angka yang valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb((locals as any)?.runtime?.env);

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
    if (body.inputType !== undefined) {
      const it = String(body.inputType).toLowerCase();
      if (['file', 'link'].includes(it)) {
        updateData.inputType = it;
        if (it === 'link') {
          if (body.acceptMime === undefined) updateData.acceptMime = 'text/uri-list';
          if (body.maxSizeMB === undefined && body.maxSizeBytes === undefined) updateData.maxSizeBytes = 0;
        }
      }
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

    let updated: any = null;

    try {
      const result = await db
        .update(documentTypes)
        .set(updateData)
        .where(eq(documentTypes.id, id))
        .returning();

      updated = result[0] || null;
    } catch (updateErr: any) {
      // Fallback jika kolom input_type belum ada di DB
      if (String(updateErr?.message || '').toLowerCase().includes('input_type') && updateData.inputType) {
        console.warn('[API /api/admin/documents PUT] Kolom input_type belum ada di DB, fallback update');
        delete updateData.inputType;
        const result = await db
          .update(documentTypes)
          .set(updateData)
          .where(eq(documentTypes.id, id))
          .returning();
        updated = result[0] || null;
      } else {
        throw updateErr;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pengaturan jenis dokumen berhasil diperbarui.',
        document: updated || { id, ...updateData },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API /api/admin/documents PUT Error]:', error);
    return new Response(
      JSON.stringify({ success: false, message: String(error?.message || error || 'Gagal memperbarui jenis dokumen.') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 4. DELETE: Soft delete (set is_active = false)
export const DELETE: APIRoute = async ({ request, url, locals }) => {
  try {
    const user = (locals as any)?.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Safely parse body if sent, otherwise fallback to url param
    let body: Record<string, any> | null = null;
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text) as Record<string, any>;
      }
    } catch {
      body = null;
    }

    const idParam = url.searchParams.get('id');
    const id = Number(body?.id || idParam);

    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID Dokumen wajib disertakan dan berupa angka.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb((locals as any)?.runtime?.env);
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
    console.error('[API /api/admin/documents DELETE Error]:', error);
    return new Response(
      JSON.stringify({ success: false, message: String(error?.message || error || 'Gagal menonaktifkan dokumen.') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 5. OPTIONS: Preflight response untuk Cloudflare Workers
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

// 6. ALL Fallback untuk method HTTP yang tidak didukung
export const ALL: APIRoute = async () => {
  return new Response(
    JSON.stringify({ success: false, message: 'Metode HTTP tidak diizinkan.' }),
    { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'GET, POST, PUT, DELETE, OPTIONS' } }
  );
};
