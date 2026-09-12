import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('DATABASE_URL or TURSO_DATABASE_URL missing.');
  process.exit(1);
}

const client = createClient({ url, authToken });

const defaultCriteria = JSON.stringify([
  {
    title: 'Mahasiswa Aktif UMI',
    pill: 'Angkatan 2024 atau 2025',
    desc: 'Terdaftar sebagai mahasiswa aktif Universitas Muslim Indonesia pada jenjang Sarjana (S1) maupun Diploma, dari seluruh program studi di lingkungan kampus UMI.',
    tag: 'Status Kampus'
  },
  {
    title: 'Akademik Cemerlang',
    pill: 'IPK Minimal 3.25',
    desc: 'Memiliki Indeks Prestasi Kumulatif (IPK) minimal 3.25 sebagai cerminan komitmen belajar, disiplin intelektual, serta kemampuan analisis yang matang.',
    tag: 'Standar Prestasi'
  },
  {
    title: 'Rekam Jejak Bersih',
    pill: 'Bebas Sanksi Akademik & Organisasi',
    desc: 'Bersih dari segala sanksi akademik institusi maupun catatan buruk organisasi, serta bersedia mematuhi nilai-nilai kejujuran ilmiah UKM PERISAI UMI.',
    tag: 'Etika & Integritas'
  }
], null, 2);

const defaultTeksSumpah = 'Saya menyatakan bahwa saya adalah mahasiswa aktif UMI angkatan 2024/2025, memiliki IPK minimal 3.25, dan bersedia mematuhi seluruh kriteria OREC PERISAI UMI.';

async function run() {
  console.log('Applying columns to system_settings in Turso DB...');
  
  try {
    await client.execute('ALTER TABLE system_settings ADD COLUMN kriteria_umum TEXT;');
    console.log('Added column kriteria_umum.');
  } catch (e) {
    console.log('Column kriteria_umum might already exist:', e.message);
  }

  try {
    await client.execute('ALTER TABLE system_settings ADD COLUMN teks_sumpah_integritas TEXT;');
    console.log('Added column teks_sumpah_integritas.');
  } catch (e) {
    console.log('Column teks_sumpah_integritas might already exist:', e.message);
  }

  // Update default value if currently null or empty
  const res = await client.execute('SELECT id, kriteria_umum, teks_sumpah_integritas FROM system_settings WHERE id = 1 LIMIT 1;');
  if (res.rows.length === 0) {
    await client.execute({
      sql: 'INSERT INTO system_settings (id, kriteria_umum, teks_sumpah_integritas, is_registration_open) VALUES (1, ?, ?, 0);',
      args: [defaultCriteria, defaultTeksSumpah]
    });
    console.log('Inserted default system_settings row.');
  } else {
    const row = res.rows[0];
    const updateKriteria = !row.kriteria_umum;
    const updateSumpah = !row.teks_sumpah_integritas;

    if (updateKriteria || updateSumpah) {
      await client.execute({
        sql: `UPDATE system_settings SET 
          kriteria_umum = COALESCE(kriteria_umum, ?), 
          teks_sumpah_integritas = COALESCE(teks_sumpah_integritas, ?)
        WHERE id = 1;`,
        args: [defaultCriteria, defaultTeksSumpah]
      });
      console.log('Updated fallback default values for kriteria_umum and teks_sumpah_integritas.');
    } else {
      console.log('system_settings already has values.');
    }
  }

  const check = await client.execute('SELECT id, kriteria_umum, teks_sumpah_integritas FROM system_settings WHERE id = 1;');
  console.log('Current system_settings:', JSON.stringify(check.rows[0], null, 2));
}

run().catch(console.error);
