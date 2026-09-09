import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { createDb } from '../../../db';
import { systemSettings } from '../../../db/schema';

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
    let [settings] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, 1))
      .limit(1);

    if (!settings) {
      // Inisialisasi default jika belum ada
      await db.insert(systemSettings).values({
        id: 1,
        registrationStart: null,
        registrationEnd: null,
        isRegistrationOpen: false,
      });

      [settings] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.id, 1))
        .limit(1);
    }

    return new Response(
      JSON.stringify({ success: true, settings }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Gagal mengambil pengaturan sistem.' }),
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
        JSON.stringify({ success: false, message: 'Akses ditolak. Tindakan ini hanya untuk Administrator / Panitia.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let isRegistrationOpen = false;
    let registrationStartRaw: any = null;
    let registrationEndRaw: any = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as Record<string, any> | null;
      if (body) {
        isRegistrationOpen = Boolean(body.isRegistrationOpen);
        registrationStartRaw = body.registrationStart;
        registrationEndRaw = body.registrationEnd;
      }
    } else {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        isRegistrationOpen = formData.get('isRegistrationOpen') === 'true' || formData.get('isRegistrationOpen') === 'on' || formData.get('isRegistrationOpen') === '1';
        registrationStartRaw = formData.get('registrationStart');
        registrationEndRaw = formData.get('registrationEnd');
      }
    }

    const parseDate = (val: any): Date | null => {
      if (!val || val === '' || val === 'null' || val === 'undefined') return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const startDate = parseDate(registrationStartRaw);
    const endDate = parseDate(registrationEndRaw);

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Waktu mulai pendaftaran tidak boleh lebih akhir daripada waktu penutupan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();

    // Periksa apakah baris dengan id=1 sudah ada
    const [existing] = await db
      .select({ id: systemSettings.id })
      .from(systemSettings)
      .where(eq(systemSettings.id, 1))
      .limit(1);

    if (existing) {
      await db
        .update(systemSettings)
        .set({
          isRegistrationOpen,
          registrationStart: startDate,
          registrationEnd: endDate,
        })
        .where(eq(systemSettings.id, 1));
    } else {
      await db.insert(systemSettings).values({
        id: 1,
        isRegistrationOpen,
        registrationStart: startDate,
        registrationEnd: endDate,
      });
    }

    // Ambil data terbaru untuk konfirmasi
    const [updatedSettings] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, 1))
      .limit(1);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pengaturan pendaftaran berhasil disimpan.',
        settings: updatedSettings,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating system settings:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan saat menyimpan pengaturan sistem.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
