import type { APIRoute } from 'astro';
import { createDb } from '../../../db';
import { publicQna } from '../../../db/schema';

export const POST: APIRoute = async ({ request }) => {
  try {
    let askerName = '';
    let question = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as Record<string, any> | null;
      if (body) {
        askerName = String(body.askerName || body.name || '').trim();
        question = String(body.question || '').trim();
      }
    } else {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        askerName = String(formData.get('askerName') || formData.get('name') || '').trim();
        question = String(formData.get('question') || '').trim();
      }
    }

    if (!question) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Kolom pertanyaan wajib diisi.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (question.length < 5) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pertanyaan terlalu pendek. Mohon tuliskan pertanyaan dengan jelas.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (question.length > 500) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pertanyaan maksimal 500 karakter.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb();
    const [inserted] = await db
      .insert(publicQna)
      .values({
        askerName: askerName || 'Anonim',
        question,
        answer: null,
        isPublished: false,
      })
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pertanyaan Anda berhasil dikirim! Panitia akan meninjau dan menjawab pertanyaan Anda segera.',
        data: { id: inserted.id },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error submitting question:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kendala saat mengirim pertanyaan. Silakan coba kembali.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
