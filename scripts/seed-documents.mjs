import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client/http';

function loadEnvFile() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('❌ Error: TURSO_DATABASE_URL tidak ditemukan di file .env');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function seedDocumentTypes() {
  console.log('🔄 Memastikan skema tabel dokumen relasional di Turso DB...');

  // 1. DDL: Pastikan tabel document_types dan cagen_documents ada
  await client.execute(`
    CREATE TABLE IF NOT EXISTS document_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      [group] TEXT NOT NULL,
      peminatan_id INTEGER REFERENCES peminatan(id) ON DELETE SET NULL,
      max_files INTEGER DEFAULT 1 NOT NULL,
      accept_mime TEXT NOT NULL,
      max_size_bytes INTEGER DEFAULT 2097152 NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS cagen_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      cagen_id INTEGER NOT NULL REFERENCES cagens(id) ON DELETE CASCADE,
      document_type_id INTEGER NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
      s3_key TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      uploaded_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
  `);

  console.log('✅ Tabel document_types & cagen_documents siap!');

  // 2. Ambil referensi peminatan_id
  const peminatanRows = await client.execute('SELECT id, nama FROM peminatan');
  const peminatanMap = new Map();
  for (const row of peminatanRows.rows) {
    const cleanName = String(row.nama).toLowerCase().replace(/[^a-z0-9]/g, '');
    peminatanMap.set(cleanName, Number(row.id));
  }

  const getPeminatanId = (keyword) => {
    const clean = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
    return peminatanMap.get(clean) || null;
  };

  // 3. Data master 12+ jenis dokumen berdasarkan Official Guidebook
  const docTypes = [
    // --- GRUP 1: WAJIB ADMINISTRASI ---
    {
      slug: 'ktm',
      label: 'Kartu Tanda Mahasiswa (KTM)',
      group: 'wajib',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'application/pdf,image/jpeg,image/png',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'transkrip',
      label: 'Transkrip Nilai Akademik',
      group: 'wajib',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'application/pdf',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'pas_foto',
      label: 'Pas Foto Formal Berlatar Merah',
      group: 'wajib',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'image/jpeg,image/png',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'cv',
      label: 'Curriculum Vitae (CV)',
      group: 'wajib',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'application/pdf',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },

    // --- GRUP 2: WAJIB MEDIA SOSIAL ---
    {
      slug: 'bukti_follow',
      label: 'Bukti Follow Instagram & TikTok',
      group: 'wajib',
      peminatan_id: null,
      max_files: 5,
      accept_mime: 'image/jpeg,image/png',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'bukti_subscribe',
      label: 'Bukti Subscribe YouTube PERISAI UMI',
      group: 'wajib',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'image/jpeg,image/png',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'bukti_share',
      label: 'Bukti Share Pamflet OPREC ke Grup WA',
      group: 'wajib',
      peminatan_id: null,
      max_files: 5,
      accept_mime: 'image/jpeg,image/png',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },

    // --- GRUP 3: OPSIONAL / PORTOFOLIO ---
    {
      slug: 'sertifikat_prestasi',
      label: 'Sertifikat Prestasi / Kejuaraan',
      group: 'opsional',
      peminatan_id: null,
      max_files: 5,
      accept_mime: 'application/pdf',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'sertifikat_bahasa',
      label: 'Sertifikat Kemampuan Bahasa',
      group: 'opsional',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'application/pdf',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'sertifikat_organisasi',
      label: 'Sertifikat Organisasi / Kepanitiaan',
      group: 'opsional',
      peminatan_id: null,
      max_files: 5,
      accept_mime: 'application/pdf',
      max_size_bytes: 2 * 1024 * 1024, // 2MB
    },
    {
      slug: 'portfolio_linkedin',
      label: 'Tautan LinkedIn / Portofolio Online',
      group: 'opsional',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'text/plain,text/uri-list',
      max_size_bytes: 1 * 1024 * 1024, // 1MB
    },

    // --- GRUP 4: KARYA PEMINATAN (TERHUBUNG KE PEMINATAN_ID) ---
    {
      slug: 'karya_kti',
      label: 'Karya Tulis Ilmiah / Esai Ilmiah',
      group: 'karya',
      peminatan_id: getPeminatanId('ktiessay'),
      max_files: 1,
      accept_mime: 'application/pdf',
      max_size_bytes: 10 * 1024 * 1024, // 10MB
    },
    {
      slug: 'karya_poster',
      label: 'Karya Desain Poster Ilmiah/Publik',
      group: 'karya',
      peminatan_id: getPeminatanId('poster'),
      max_files: 1,
      accept_mime: 'image/jpeg,image/png,application/pdf',
      max_size_bytes: 5 * 1024 * 1024, // 5MB
    },
    {
      slug: 'karya_debat',
      label: 'Video Monolog Debat Ilmiah',
      group: 'karya',
      peminatan_id: getPeminatanId('debat'),
      max_files: 1,
      accept_mime: 'video/mp4,video/webm,text/plain,text/uri-list',
      max_size_bytes: 50 * 1024 * 1024, // 50MB
    },
    {
      slug: 'karya_videograph',
      label: 'Karya Video Editing / Sinematografi',
      group: 'karya',
      peminatan_id: getPeminatanId('videograph'),
      max_files: 1,
      accept_mime: 'video/mp4,video/webm,text/plain,text/uri-list',
      max_size_bytes: 50 * 1024 * 1024, // 50MB
    },
    {
      slug: 'karya_business_plan',
      label: 'Proposal Business Plan (BMC & RAB)',
      group: 'karya',
      peminatan_id: getPeminatanId('businessplan'),
      max_files: 1,
      accept_mime: 'application/pdf',
      max_size_bytes: 15 * 1024 * 1024, // 15MB
    },
    {
      slug: 'file_karya',
      label: 'File Karya Peminatan (Umum)',
      group: 'karya',
      peminatan_id: null,
      max_files: 1,
      accept_mime: 'application/pdf,application/zip,video/mp4,image/jpeg,image/png',
      max_size_bytes: 50 * 1024 * 1024, // 50MB
    },
  ];

  console.log('🌱 Menyemai data master document_types...');
  for (const item of docTypes) {
    await client.execute({
      sql: `INSERT INTO document_types (slug, label, [group], peminatan_id, max_files, accept_mime, max_size_bytes, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(slug) DO UPDATE SET
              label = excluded.label,
              [group] = excluded.[group],
              peminatan_id = excluded.peminatan_id,
              max_files = excluded.max_files,
              accept_mime = excluded.accept_mime,
              max_size_bytes = excluded.max_size_bytes,
              is_active = excluded.is_active;`,
      args: [
        item.slug,
        item.label,
        item.group,
        item.peminatan_id,
        item.max_files,
        item.accept_mime,
        item.max_size_bytes,
      ],
    });
    console.log(`  + [${item.group}] ${item.slug} -> ${item.label}`);
  }

  const result = await client.execute('SELECT id, slug, label, [group], peminatan_id, max_size_bytes FROM document_types ORDER BY id ASC');
  console.log(`\n🎉 Berhasil menyemai ${result.rows.length} tipe dokumen di Turso DB:`);
  console.table(result.rows);
}

seedDocumentTypes().catch((err) => {
  console.error('❌ Terjadi kesalahan saat seeding document_types:', err);
  process.exit(1);
});
