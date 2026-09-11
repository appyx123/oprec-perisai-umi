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

async function main() {
  console.log('🔄 Memastikan tabel peminatan di Turso DB...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS peminatan (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      nama TEXT NOT NULL UNIQUE,
      deskripsi TEXT NOT NULL,
      guidebook_url TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
  `);
  console.log('✅ Tabel peminatan siap!');

  const seeds = [
    {
      nama: 'KTI / Essay',
      deskripsi: 'Pengembangan kemampuan penulisan karya tulis ilmiah, esai kritis, serta perumusan gagasan solutif berbasis riset metodologis.',
      guidebook_url: 'https://oprec.perisai.site/docs/guidebook-kti-essay.pdf',
    },
    {
      nama: 'Business Plan',
      deskripsi: 'Penyusunan model bisnis inovatif, studi kelayakan pasar, perancangan proposal usaha rintisan berdaya saing tinggi.',
      guidebook_url: 'https://oprec.perisai.site/docs/guidebook-business-plan.pdf',
    },
    {
      nama: 'Debat',
      deskripsi: 'Asah ketajaman berpikir kritis, retorika argumentasi logis, dan penguasaan isu-isu strategis nasional maupun global.',
      guidebook_url: 'https://oprec.perisai.site/docs/guidebook-debat.pdf',
    },
    {
      nama: 'Poster',
      deskripsi: 'Visualisasi komunikasi data dan gagasan ilmiah ke dalam media grafis yang komunikatif, estetis, dan informatif.',
      guidebook_url: 'https://oprec.perisai.site/docs/guidebook-poster.pdf',
    },
    {
      nama: 'Video Graph',
      deskripsi: 'Eksplorasi sinematografi, storytelling visual, serta produksi video edukasi dan dokumenter berbobot ilmiah.',
      guidebook_url: 'https://oprec.perisai.site/docs/guidebook-videograph.pdf',
    },
  ];

  console.log('🌱 Menyemai data peminatan...');
  for (const item of seeds) {
    await client.execute({
      sql: `INSERT INTO peminatan (nama, deskripsi, guidebook_url, is_active)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(nama) DO UPDATE SET
              deskripsi = excluded.deskripsi,
              guidebook_url = excluded.guidebook_url,
              is_active = excluded.is_active;`,
      args: [item.nama, item.deskripsi, item.guidebook_url],
    });
    console.log(`  + Peminatan: ${item.nama}`);
  }

  const result = await client.execute('SELECT id, nama, deskripsi, guidebook_url, is_active FROM peminatan ORDER BY id ASC');
  console.log(`\n🎉 Berhasil menyemai ${result.rows.length} peminatan di Turso DB:`);
  console.table(result.rows);
}

main().catch((err) => {
  console.error('❌ Terjadi kesalahan saat seeding peminatan:', err);
  process.exit(1);
});
