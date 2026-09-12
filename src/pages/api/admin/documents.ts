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
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details,
        message: details || 'Gagal memuat daftar jenis dokumen.',
      }),
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
        JSON.stringify({ success: false, error: 'Forbidden', message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Wrap body parsing strictly in try/catch
    let data: Record<string, any>;
    try {
      data = (await request.json()) as Record<string, any>;
    } catch (parseError: any) {
      const details = parseError instanceof Error ? parseError.message : String(parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bad Request',
          details,
          message: 'Payload JSON tidak valid atau body kosong: ' + details,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data || typeof data !== 'object') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bad Request',
          details: 'Data payload bukan object JSON yang valid.',
          message: 'Payload JSON tidak valid atau kosong.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const label = String(data.label || '').trim();
    const group = String(data.group || 'wajib').toLowerCase().trim() as 'wajib' | 'opsional' | 'karya';
    const peminatanId = data.peminatanId ? Number(data.peminatanId) : null;
    const inputType = (String(data.inputType || 'file').toLowerCase() === 'link' ? 'link' : 'file') as 'file' | 'link';
    const acceptMime = inputType === 'link'
      ? (String(data.acceptMime || 'text/uri-list').trim() || 'text/uri-list')
      : (String(data.acceptMime || 'application/pdf').trim() || 'application/pdf');
    const maxSizeMB = inputType === 'link' ? 0 : Number(data.maxSizeMB || 2);
    const maxSizeBytes = inputType === 'link' ? 0 : (data.maxSizeBytes ? Number(data.maxSizeBytes) : Math.round(maxSizeMB * 1024 * 1024));
    const maxFiles = Math.max(1, Number(data.maxFiles || 1));
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;

    // Fallback validasi field wajib
    if (!label) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: 'Field "label" (nama dokumen) wajib diisi.',
          message: 'Nama dokumen (label) wajib diisi.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['wajib', 'opsional', 'karya'].includes(group)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: 'Field "group" harus salah satu dari: wajib, opsional, karya.',
          message: 'Kelompok dokumen harus bernilai wajib, opsional, atau karya.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb((locals as any)?.runtime?.env);

    // Buat slug unik dengan loop terbatas (maks 10 iterasi) untuk menghindari timeout hang
    let baseSlug = data.slug ? generateSlug(String(data.slug)) : generateSlug(label);
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
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details,
        message: details || 'Gagal menambahkan jenis dokumen.',
      }),
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
        JSON.stringify({ success: false, error: 'Forbidden', message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Wrap body parsing strictly in try/catch
    let data: Record<string, any>;
    try {
      data = (await request.json()) as Record<string, any>;
    } catch (parseError: any) {
      const details = parseError instanceof Error ? parseError.message : String(parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bad Request',
          details,
          message: 'Payload JSON tidak valid atau body kosong: ' + details,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data || typeof data !== 'object') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bad Request',
          details: 'Data payload bukan object JSON yang valid.',
          message: 'Payload JSON tidak valid atau kosong.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = Number(data.id);
    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: 'Field "id" Dokumen wajib disertakan dan harus berupa angka yang valid.',
          message: 'ID Dokumen harus berupa angka yang valid.',
        }),
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
        JSON.stringify({
          success: false,
          error: 'Not Found',
          details: `Dokumen dengan ID ${id} tidak ditemukan.`,
          message: 'Jenis dokumen tidak ditemukan.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData: Record<string, any> = {};

    if (data.label !== undefined) updateData.label = String(data.label).trim();
    if (data.group !== undefined) {
      const g = String(data.group).trim().toLowerCase();
      if (['wajib', 'opsional', 'karya'].includes(g)) {
        updateData.group = g;
      }
    }
    if (data.peminatanId !== undefined) {
      updateData.peminatanId = data.peminatanId ? Number(data.peminatanId) : null;
    }
    if (data.inputType !== undefined) {
      const it = String(data.inputType).toLowerCase();
      if (['file', 'link'].includes(it)) {
        updateData.inputType = it;
        if (it === 'link') {
          if (data.acceptMime === undefined) updateData.acceptMime = 'text/uri-list';
          if (data.maxSizeMB === undefined && data.maxSizeBytes === undefined) updateData.maxSizeBytes = 0;
        }
      }
    }
    if (data.acceptMime !== undefined) {
      updateData.acceptMime = String(data.acceptMime).trim();
    }
    if (data.maxSizeMB !== undefined) {
      updateData.maxSizeBytes = Math.round(Number(data.maxSizeMB) * 1024 * 1024);
    } else if (data.maxSizeBytes !== undefined) {
      updateData.maxSizeBytes = Number(data.maxSizeBytes);
    }
    if (data.maxFiles !== undefined) {
      updateData.maxFiles = Math.max(1, Number(data.maxFiles));
    }
    if (data.isActive !== undefined) {
      updateData.isActive = Boolean(data.isActive);
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
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details,
        message: details || 'Gagal memperbarui jenis dokumen.',
      }),
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
        JSON.stringify({ success: false, error: 'Forbidden', message: 'Akses ditolak.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Safely parse body if sent, otherwise fallback to url param
    let data: Record<string, any> | null = null;
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        data = JSON.parse(text) as Record<string, any>;
      }
    } catch {
      data = null;
    }

    const idParam = url.searchParams.get('id');
    const id = Number(data?.id || idParam);

    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: 'ID Dokumen wajib disertakan dan berupa angka.',
          message: 'ID Dokumen wajib disertakan dan berupa angka.',
        }),
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
        JSON.stringify({
          success: false,
          error: 'Not Found',
          details: `Dokumen dengan ID ${id} tidak ditemukan.`,
          message: 'Jenis dokumen tidak ditemukan.',
        }),
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
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details,
        message: details || 'Gagal menonaktifkan dokumen.',
      }),
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
