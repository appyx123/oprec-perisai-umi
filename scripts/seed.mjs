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
        nomor_registrasi TEXT UNIQUE,
        status_pendaftaran TEXT DEFAULT 'Belum Melengkapi' NOT NULL,
        is_verified INTEGER DEFAULT 0 NOT NULL,
        verification_token TEXT,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);

    // Migrasi kolom jika tabel sudah ada sebelumnya di Turso
    try {
      await client.execute(`ALTER TABLE cagens ADD COLUMN is_verified INTEGER DEFAULT 0 NOT NULL`);
    } catch (_) {}
    try {
      await client.execute(`ALTER TABLE cagens ADD COLUMN verification_token TEXT`);
    } catch (_) {}

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

    await client.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
        registration_start INTEGER,
        registration_end INTEGER,
        is_registration_open INTEGER DEFAULT 0 NOT NULL
      )
    `);

    // Inisialisasi baris pengaturan default jika belum ada
    const existingSettings = await client.execute('SELECT id FROM system_settings WHERE id = 1 LIMIT 1');
    if (existingSettings.rows.length === 0) {
      await client.execute(`
        INSERT INTO system_settings (id, registration_start, registration_end, is_registration_open)
        VALUES (1, NULL, NULL, 0)
      `);
      console.log('⚙️ Baris system_settings default (id=1) berhasil dibuat.');
    }

    await client.execute(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_date INTEGER NOT NULL,
        end_date INTEGER,
        sequence_order INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);

    // Inisialisasi tahapan linimasa default jika masih kosong
    const existingEvents = await client.execute('SELECT count(*) as total FROM timeline_events');
    if (Number(existingEvents.rows[0]?.total || 0) === 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const daySec = 86400;

      const initialEvents = [
        {
          title: 'Pendaftaran Online & Unggah Berkas',
          description: 'Pengisian biodata diri serta pengunggahan dokumen administrasi calon anggota baru.',
          start: nowSec - 2 * daySec,
          end: nowSec + 5 * daySec,
          order: 1,
        },
        {
          title: 'Seleksi & Verifikasi Berkas Administrasi',
          description: 'Pemeriksaan validitas berkas dan portofolio karya oleh tim panitia seleksi.',
          start: nowSec + 6 * daySec,
          end: nowSec + 9 * daySec,
          order: 2,
        },
        {
          title: 'Wawancara & Uji Gagasan Peminatan',
          description: 'Sesi wawancara komprehensif untuk mengeksplorasi motivasi, komitmen, dan wawasan riset.',
          start: nowSec + 10 * daySec,
          end: nowSec + 13 * daySec,
          order: 3,
        },
        {
          title: 'Pengumuman Kelulusan Akhir',
          description: 'Pengumuman resmi calon anggota yang dinyatakan diterima bergabung di UKM PERISAI UMI.',
          start: nowSec + 14 * daySec,
          end: nowSec + 15 * daySec,
          order: 4,
        },
      ];

      for (const ev of initialEvents) {
        await client.execute({
          sql: `INSERT INTO timeline_events (title, description, start_date, end_date, sequence_order) VALUES (?, ?, ?, ?, ?)`,
          args: [ev.title, ev.description, ev.start, ev.end, ev.order],
        });
      }
      console.log('📅 4 Tahapan Linimasa default berhasil dibuat.');
    }

    await client.execute(`
      CREATE TABLE IF NOT EXISTS public_qna (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        asker_name TEXT,
        question TEXT NOT NULL,
        answer TEXT,
        is_published INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);

    // Inisialisasi Q&A awal jika masih kosong
    const existingQna = await client.execute('SELECT count(*) as total FROM public_qna');
    if (Number(existingQna.rows[0]?.total || 0) === 0) {
      const initialQna = [
        {
          name: 'Mahasiswa Baru',
          question: 'Apakah mahasiswa semester 1 diperbolehkan mendaftar di UKM PERISAI UMI?',
          answer: 'Tentu saja! UKM PERISAI UMI sangat menyambut mahasiswa baru untuk bergabung dan mulai mengembangkan minat di bidang riset, karya tulis ilmiah, bisnis, debat, maupun media kreatif sejak awal perkuliahan.',
          isPublished: 1,
        },
        {
          name: 'Pendaftar FTI',
          question: 'Bagaimana jika saya belum memiliki sertifikat prestasi atau kejuaraan lomba?',
          answer: 'Sertifikat prestasi bersifat opsional (nilai tambah). Anda tetap memiliki peluang besar untuk lulus seleksi asalkan berkas wajib lengkap dan memiliki motivasi belajar yang tinggi.',
          isPublished: 1,
        },
        {
          name: 'Calon Anggota',
          question: 'Apakah boleh memilih peminatan yang belum pernah saya pelajari sebelumnya?',
          answer: 'Boleh sekali! Di UKM PERISAI UMI, seluruh calon anggota akan mendapatkan pembinaan, mentoring intensif dari senior berprestasi, serta pendampingan karya hingga siap berkompetisi di tingkat nasional.',
          isPublished: 1,
        },
      ];

      for (const q of initialQna) {
        await client.execute({
          sql: `INSERT INTO public_qna (asker_name, question, answer, is_published) VALUES (?, ?, ?, ?)`,
          args: [q.name, q.question, q.answer, q.isPublished],
        });
      }
      console.log('💬 3 Tanya Jawab publik default berhasil dibuat.');
    }




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

    const digits = '0123456789';
    function genReg() {
      let s = String(Math.floor(Math.random() * 9) + 1); // 1-9
      for (let i = 1; i < 7; i++) s += digits[Math.floor(Math.random() * digits.length)];
      return s;
    }

    if (existingCagen.rows.length === 0) {
      const regCode = genReg();
      await client.execute({
        sql: `INSERT INTO cagens (
          email, password, nama_lengkap, nama_panggilan, nim, no_wa, fakultas, jurusan, angkatan, nomor_registrasi, status_pendaftaran, is_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Melengkapi', 1)`,
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
          regCode,
        ],
      });
      console.log(`✅ [USER/CAGEN] Berhasil dibuat: Email="${cagenEmail}" / NIM="${cagenNim}" / NoReg="#${regCode}" | Password="${rawPassword}"`);
    } else {
      await client.execute({
        sql: `UPDATE cagens SET password = ?, nama_lengkap = ?, is_verified = 1 WHERE id = ?`,
        args: [hashedPassword, cagenNama, existingCagen.rows[0].id],
      });
      console.log(`ℹ️ [USER/CAGEN] Sudah ada (id=${existingCagen.rows[0].id}), password telah di-update ke: "${rawPassword}" (is_verified=1)`);
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
