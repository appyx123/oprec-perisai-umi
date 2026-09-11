import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

// ============================================================
// TABLE: admins
// Menyimpan akun admin/panitia OPREC
// ============================================================
export const admins = sqliteTable('admins', {
  id: integer('id', { mode: 'number' })
    .primaryKey({ autoIncrement: true }),

  namaLengkap: text('nama_lengkap')
    .notNull(),

  username: text('username')
    .notNull()
    .unique(),

  // Bcrypt hash — tidak pernah plain text
  password: text('password')
    .notNull(),

  // Unix timestamp integer; Drizzle auto-konversi ke/dari JS Date object
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================
// TABLE: cagens (Calon Anggota / Peserta OPREC)
// ============================================================
export const cagens = sqliteTable('cagens', {
  id: integer('id', { mode: 'number' })
    .primaryKey({ autoIncrement: true }),

  email: text('email')
    .notNull()
    .unique(),

  // Bcrypt hash
  password: text('password')
    .notNull(),

  namaLengkap: text('nama_lengkap')
    .notNull(),

  namaPanggilan: text('nama_panggilan')
    .notNull(),

  nim: text('nim')
    .notNull()
    .unique(),

  noWa: text('no_wa')
    .notNull(),

  fakultas: text('fakultas')
    .notNull(),

  jurusan: text('jurusan')
    .notNull(),

  // Contoh: '2024', '2025'
  angkatan: text('angkatan')
    .notNull(),

  // Nomor Registrasi unik 5 karakter acak (contoh: '94C39', 'QBXAA')
  nomorRegistrasi: text('nomor_registrasi')
    .unique(),

  // MySQL ENUM -> SQLite text dengan constraint enum di TypeScript level
  // Validasi runtime tetap perlu dilakukan di application layer
  statusPendaftaran: text('status_pendaftaran', {
    enum: [
      'Belum Melengkapi',
      'Review Berkas',
      'Berkas Diterima',
      'Lulus',
      'Tidak Lulus',
    ],
  })
    .notNull()
    .default('Belum Melengkapi'),

  isVerified: integer('is_verified', { mode: 'boolean' })
    .notNull()
    .default(false),

  verificationToken: text('verification_token'),

  // Peminatan / Pilihan Divisi Calon Anggota
  peminatan: text('peminatan'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================
// TABLE: berkas_cagens (Berkas/Dokumen yang Diupload Peserta)
// ============================================================
export const berkasCagens = sqliteTable('berkas_cagens', {
  id: integer('id', { mode: 'number' })
    .primaryKey({ autoIncrement: true }),

  // FK ke cagens.id dengan ON DELETE CASCADE:
  // jika peserta dihapus, seluruh berkasnya ikut terhapus otomatis
  cagenId: integer('cagen_id', { mode: 'number' })
    .notNull()
    .references(() => cagens.id, { onDelete: 'cascade' }),

  // ---- Berkas Wajib ----
  // Nilai: nama file unik hasil upload ke object storage
  // Contoh: "ktm_1751980800_a3f2c1b4.pdf"
  ktm: text('ktm').notNull(),
  transkripNilai: text('transkrip_nilai').notNull(),
  pasFoto: text('pas_foto').notNull(),
  cv: text('cv').notNull(),
  buktiFollow: text('bukti_follow').notNull(),
  buktiShare: text('bukti_share').notNull(),

  // ---- Berkas Opsional ----
  // NULL = peserta tidak mengupload dokumen ini
  sertifikatPrestasi: text('sertifikat_prestasi'),
  sertifikatBahasa: text('sertifikat_bahasa'),
  sertifikatOrganisasi: text('sertifikat_organisasi'),

  // ---- Peminatan & Karya ----
  peminatan: text('peminatan', {
    enum: [
      'KTI/ESSAY',
      'Business Plan',
      'Debat',
      'Poster',
      'Video Graph',
    ],
  }).notNull(),

  // Nama file karya utama (PDF, PPT, MP4, dll.)
  fileKarya: text('file_karya').notNull(),

  waktuUpload: integer('waktu_upload', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================
// TABLE: system_settings
// Konfigurasi sistem: jendela waktu pendaftaran & kontrol manual
// ============================================================
export const systemSettings = sqliteTable('system_settings', {
  id: integer('id', { mode: 'number' })
    .primaryKey()
    .default(1),

  registrationStart: integer('registration_start', { mode: 'timestamp' }),
  registrationEnd: integer('registration_end', { mode: 'timestamp' }),
  isRegistrationOpen: integer('is_registration_open', { mode: 'boolean' })
    .notNull()
    .default(false),

  // WhatsApp Call Center
  waNumber: text('wa_number'),
  waMessage: text('wa_message'),
});

// ============================================================
// TABLE: timeline_events
// Linimasa/Jadwal tahapan seleksi Open Recruitment
// ============================================================
export const timelineEvents = sqliteTable('timeline_events', {
  id: integer('id', { mode: 'number' })
    .primaryKey({ autoIncrement: true }),

  title: text('title')
    .notNull(),

  description: text('description'),

  startDate: integer('start_date', { mode: 'timestamp' })
    .notNull(),

  endDate: integer('end_date', { mode: 'timestamp' }),

  sequenceOrder: integer('sequence_order', { mode: 'number' })
    .notNull()
    .default(1),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================
// TABLE: public_qna
// Tanya Jawab publik dan moderasi admin
// ============================================================
export const publicQna = sqliteTable('public_qna', {
  id: integer('id', { mode: 'number' })
    .primaryKey({ autoIncrement: true }),

  askerName: text('asker_name'),

  question: text('question')
    .notNull(),

  answer: text('answer'),

  isPublished: integer('is_published', { mode: 'boolean' })
    .notNull()
    .default(false),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================
// RELATIONS — Untuk Drizzle relational query API
// ============================================================

export const cagensRelations = relations(cagens, ({ one }) => ({
  berkas: one(berkasCagens, {
    fields: [cagens.id],
    references: [berkasCagens.cagenId],
  }),
}));

export const berkasCagensRelations = relations(berkasCagens, ({ one }) => ({
  cagen: one(cagens, {
    fields: [berkasCagens.cagenId],
    references: [cagens.id],
  }),
}));

// ============================================================
// TYPE EXPORTS — Inferred TypeScript types dari schema
// ============================================================

// Types untuk SELECT (membaca data dari DB)
export type Admin = typeof admins.$inferSelect;
export type Cagen = typeof cagens.$inferSelect;
export type BerkasCagen = typeof berkasCagens.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type PublicQna = typeof publicQna.$inferSelect;

// Types untuk INSERT (menulis data ke DB)
export type NewAdmin = typeof admins.$inferInsert;
export type NewCagen = typeof cagens.$inferInsert;
export type NewBerkasCagen = typeof berkasCagens.$inferInsert;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type NewTimelineEvent = typeof timelineEvents.$inferInsert;
export type NewPublicQna = typeof publicQna.$inferInsert;



// Extracted ENUM types untuk digunakan di seluruh aplikasi
export type StatusPendaftaran = Cagen['statusPendaftaran'];
export type Peminatan = BerkasCagen['peminatan'];

// Konstanta ENUM — single source of truth untuk validasi runtime
export const STATUS_PENDAFTARAN = [
  'Belum Melengkapi',
  'Review Berkas',
  'Berkas Diterima',
  'Lulus',
  'Tidak Lulus',
] as const satisfies StatusPendaftaran[];

export const PEMINATAN_LIST = [
  'KTI/ESSAY',
  'Business Plan',
  'Debat',
  'Poster',
  'Video Graph',
] as const satisfies Peminatan[];

