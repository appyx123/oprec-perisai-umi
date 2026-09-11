import type { APIRoute } from 'astro';
import { createDb } from '../../../db';
import { cagens, berkasCagens } from '../../../db/schema';
import { eq, desc, and, or, like } from 'drizzle-orm';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Verifikasi hak akses admin
    const user = locals.user;
    const isAdmin = user?.role === 'admin' || user?.isAdmin === true || String(user?.role).toLowerCase() === 'admin';

    if (!user || !isAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Endpoint ini hanya untuk Administrator / Panitia OPREC.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse query parameters
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? url.searchParams.get('search') ?? '').trim();
    const status = (url.searchParams.get('status') ?? '').trim();

    const db = createDb();
    const whereConditions = [];

    // Filter status jika spesifik
    if (status && status !== 'SEMUA') {
      whereConditions.push(eq(cagens.statusPendaftaran, status as any));
    }

    // Optimasi pencarian LIKE across nama, nim, dan nomor_registrasi
    if (q) {
      whereConditions.push(
        or(
          like(cagens.namaLengkap, `%${q}%`),
          like(cagens.nim, `%${q}%`),
          like(cagens.nomorRegistrasi, `%${q}%`)
        )
      );
    }

    // 3. Query dengan LIMIT 20 strictly untuk menjaga payload mikroskopis & respon kilat
    let query = db
      .select({
        id: cagens.id,
        nomorRegistrasi: cagens.nomorRegistrasi,
        namaLengkap: cagens.namaLengkap,
        nim: cagens.nim,
        fakultas: cagens.fakultas,
        jurusan: cagens.jurusan,
        statusPendaftaran: cagens.statusPendaftaran,
        peminatan: berkasCagens.peminatan,
      })
      .from(cagens)
      .leftJoin(berkasCagens, eq(cagens.id, berkasCagens.cagenId))
      .orderBy(desc(cagens.createdAt))
      .limit(20);

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions)) as any;
    }

    const rows = await query;

    const data = rows.map((r) => ({
      id: r.id,
      nomorRegistrasi: r.nomorRegistrasi || null,
      namaLengkap: r.namaLengkap,
      nim: r.nim,
      fakultas: r.fakultas,
      jurusan: r.jurusan,
      statusPendaftaran: r.statusPendaftaran,
      peminatan: r.peminatan || null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data,
        total: data.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err) {
    console.error('Error in /api/admin/search-applicants:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal melakukan pencarian calon anggota.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
