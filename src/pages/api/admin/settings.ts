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
    let waNumberRaw: string | undefined = undefined;
    let waMessageRaw: string | undefined = undefined;
    let kriteriaUmumRaw: string | undefined = undefined;
    let teksSumpahIntegritasRaw: string | undefined = undefined;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as Record<string, any> | null;
      if (body) {
        isRegistrationOpen = Boolean(body.isRegistrationOpen);
        registrationStartRaw = body.registrationStart;
        registrationEndRaw = body.registrationEnd;
        if (body.waNumber !== undefined) waNumberRaw = String(body.waNumber).trim();
        if (body.waMessage !== undefined) waMessageRaw = String(body.waMessage).trim();
        if (body.kriteriaUmum !== undefined) kriteriaUmumRaw = String(body.kriteriaUmum).trim();
        if (body.teksSumpahIntegritas !== undefined) teksSumpahIntegritasRaw = String(body.teksSumpahIntegritas).trim();
      }
    } else {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        isRegistrationOpen = formData.get('isRegistrationOpen') === 'true' || formData.get('isRegistrationOpen') === 'on' || formData.get('isRegistrationOpen') === '1';
        registrationStartRaw = formData.get('registrationStart');
        registrationEndRaw = formData.get('registrationEnd');
        if (formData.has('waNumber')) waNumberRaw = String(formData.get('waNumber') || '').trim();
        if (formData.has('waMessage')) waMessageRaw = String(formData.get('waMessage') || '').trim();
        if (formData.has('kriteriaUmum')) kriteriaUmumRaw = String(formData.get('kriteriaUmum') || '').trim();
        if (formData.has('teksSumpahIntegritas')) teksSumpahIntegritasRaw = String(formData.get('teksSumpahIntegritas') || '').trim();
      }
    }

    const parseDate = (val: any): Date | null => {
      if (!val || val === '' || val === 'null' || val === 'undefined') return null;
      let str = String(val).trim();
      // Jika string waktu tidak memiliki timezone offset (misalnya format YYYY-MM-DDTHH:mm dari datetime-local),
      // asumsikan zona waktu resmi WITA (+08:00)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
        str = `${str.length === 16 ? str + ':00' : str}+08:00`;
      }
      const d = new Date(str);
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

    const updatePayload: Record<string, any> = {
      isRegistrationOpen,
      registrationStart: startDate,
      registrationEnd: endDate,
    };
    if (waNumberRaw !== undefined) updatePayload.waNumber = waNumberRaw;
    if (waMessageRaw !== undefined) updatePayload.waMessage = waMessageRaw;
    if (kriteriaUmumRaw !== undefined) updatePayload.kriteriaUmum = kriteriaUmumRaw;
    if (teksSumpahIntegritasRaw !== undefined) updatePayload.teksSumpahIntegritas = teksSumpahIntegritasRaw;

    if (existing) {
      await db
        .update(systemSettings)
        .set(updatePayload)
        .where(eq(systemSettings.id, 1));
    } else {
      await db.insert(systemSettings).values({
        id: 1,
        isRegistrationOpen,
        registrationStart: startDate,
        registrationEnd: endDate,
        waNumber: waNumberRaw || null,
        waMessage: waMessageRaw || null,
        kriteriaUmum: kriteriaUmumRaw || null,
        teksSumpahIntegritas: teksSumpahIntegritasRaw || null,
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
