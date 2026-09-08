import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client/http';
import bcrypt from 'bcryptjs';

// Manually load .env with UTF-8 BOM stripping for reliability
function loadEnvFile() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    // Strip UTF-8 BOM if present
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
        // Strip quotes if present
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

console.log('🔗 Menghubungkan ke database Turso:', url);
const client = createClient({ url, authToken });

async function seed() {
  try {
    // 1. Pastikan tabel sudah ada (CREATE TABLE IF NOT EXISTS)
    console.log('📦 Memeriksa / membuat tabel jika belum ada...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        nama_lengkap TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS cagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        nama_lengkap TEXT NOT NULL,
        nama_panggilan TEXT NOT NULL,
        nim TEXT NOT NULL UNIQUE,
        no_wa TEXT NOT NULL,
        fakultas TEXT NOT NULL,
        jurusan TEXT NOT NULL,
        angkatan TEXT NOT NULL,
        status_pendaftaran TEXT DEFAULT 'Belum Melengkapi' NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS berkas_cagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        cagen_id INTEGER NOT NULL,
        ktm TEXT NOT NULL,
        transkrip_nilai TEXT NOT NULL,
        pas_foto TEXT NOT NULL,
        cv TEXT NOT NULL,
        bukti_follow TEXT NOT NULL,
        bukti_share TEXT NOT NULL,
        sertifikat_prestasi TEXT,
        sertifikat_bahasa TEXT,
        sertifikat_organisasi TEXT,
        peminatan TEXT NOT NULL,
        file_karya TEXT NOT NULL,
        waktu_upload INTEGER DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (cagen_id) REFERENCES cagens(id) ON UPDATE NO ACTION ON DELETE CASCADE
      )
    `);

    // 2. Hash default password "password"
    const rawPassword = 'password';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    console.log('🔑 Password default terenkripsi bcrypt berhasil digenerate.');

    // 3. Seeder untuk Role: ADMIN
    const adminUsername = 'admin';
    const adminNama = 'Administrator OREC';

    const existingAdmin = await client.execute({
      sql: 'SELECT id, username, nama_lengkap FROM admins WHERE username = ? LIMIT 1',
      args: [adminUsername],
    });

    if (existingAdmin.rows.length === 0) {
      await client.execute({
        sql: `INSERT INTO admins (nama_lengkap, username, password) VALUES (?, ?, ?)`,
        args: [adminNama, adminUsername, hashedPassword],
      });
      console.log(`✅ [ADMIN] Berhasil dibuat: Username="${adminUsername}" | Password="${rawPassword}"`);
    } else {
      await client.execute({
        sql: `UPDATE admins SET password = ?, nama_lengkap = ? WHERE username = ?`,
        args: [hashedPassword, adminNama, adminUsername],
      });
      console.log(`ℹ️ [ADMIN] Sudah ada (id=${existingAdmin.rows[0].id}), password telah di-update ke: "${rawPassword}"`);
    }

    // 4. Seeder untuk Role: USER (Peserta / Cagen)
    const cagenEmail = 'peserta@perisai.umi.ac.id';
    const cagenNim = '13020210001';
    const cagenNama = 'Ahmad Fauzi';
    const cagenPanggilan = 'Fauzi';
    const cagenNoWa = '081234567890';
    const cagenFakultas = 'Fakultas Ilmu Komputer';
    const cagenJurusan = 'Teknik Informatika';
    const cagenAngkatan = '2024';

    const existingCagen = await client.execute({
      sql: 'SELECT id, email, nim, nama_lengkap FROM cagens WHERE email = ? OR nim = ? LIMIT 1',
      args: [cagenEmail, cagenNim],
    });

    if (existingCagen.rows.length === 0) {
      await client.execute({
        sql: `INSERT INTO cagens (
          email, password, nama_lengkap, nama_panggilan, nim, no_wa, fakultas, jurusan, angkatan, status_pendaftaran
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Melengkapi')`,
        args: [
          cagenEmail,
          hashedPassword,
          cagenNama,
          cagenPanggilan,
          cagenNim,
          cagenNoWa,
          cagenFakultas,
          cagenJurusan,
          cagenAngkatan,
        ],
      });
      console.log(`✅ [USER/CAGEN] Berhasil dibuat: Email="${cagenEmail}" / NIM="${cagenNim}" | Password="${rawPassword}"`);
    } else {
      await client.execute({
        sql: `UPDATE cagens SET password = ?, nama_lengkap = ? WHERE id = ?`,
        args: [hashedPassword, cagenNama, existingCagen.rows[0].id],
      });
      console.log(`ℹ️ [USER/CAGEN] Sudah ada (id=${existingCagen.rows[0].id}), password telah di-update ke: "${rawPassword}"`);
    }

    console.log('\n🎉 Seeding selesai dengan sukses!');
    console.log('───────────────────────────────────────────────────────');
    console.log('Akun Admin:');
    console.log('   Username : admin');
    console.log('   Password : password');
    console.log('\nAkun Peserta/User:');
    console.log('   Email    : peserta@perisai.umi.ac.id');
    console.log('   NIM      : 13020210001');
    console.log('   Password : password');
    console.log('───────────────────────────────────────────────────────');
  } catch (err) {
    console.error('❌ Gagal menjalankan seeder:', err);
    process.exit(1);
  }
}

seed();
