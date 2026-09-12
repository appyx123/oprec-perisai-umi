# OREC PERISAI UMI — Project State & Architecture Map

**Generated:** 2026-09-12  
**Scope:** Read-only scan of the current repository. No application code was modified.  
**Source of truth for schema:** `src/db/schema.ts` (Drizzle). The committed SQL migration in `drizzle/` is **behind** this schema.

---

## 1. Tech Stack Summary

| Layer | Choice | Version / notes |
| --- | --- | --- |
| Runtime / UI | Astro (SSR) | `astro` **^7.3.1** (not v6). `output: 'server'`. |
| Edge adapter | `@astrojs/cloudflare` | **^14.3.0**. Entry: `@astrojs/cloudflare/entrypoints/server`. |
| Styling | Tailwind CSS v4 via Vite | `tailwindcss` **^4.3.3**, `@tailwindcss/vite` **^4.3.3**. |
| Database | Turso (libSQL) + Drizzle ORM | `@libsql/client` **^0.18.0** over **HTTP** (`@libsql/client/http`). `drizzle-orm` **^0.45.2**, `drizzle-kit` **^0.31.10**, dialect `turso`. |
| Auth | JWT in HttpOnly cookie | `jose` **^6.2.12**, HS256, 7-day session. Passwords: `bcryptjs` **^3.0.3**. Cookie name: `auth_token`. |
| Object storage | S3-compatible (Backblaze B2) | `aws4fetch` **^1.0.20**. Presigned PUT/GET + server-side PUT/DELETE. |
| Email | Resend REST API | Native `fetch` to `https://api.resend.com/emails`. **No Resend SDK.** |
| Monitoring | Sentry | `@sentry/astro` **^10.74.0**. Client + server init files. `@sentry/cloudflare` is installed but **not wired**. |
| Image UX | Local crop + compress | `cropperjs`, `browser-image-compression` on pas foto. **No Cloudflare Images binding.** |
| Types | TypeScript | **^6.0.3**. Node engines: `>=22.12.0`. |
| Worker tooling | Wrangler | **^4.129.1**. Config: `wrangler.jsonc` (no `wrangler.toml`). |

### 1.1 Astro / Cloudflare configuration

`astro.config.mjs`:

- Full SSR on Cloudflare Workers / Pages Functions.
- Sentry integration: org `perisai-umi-tech`, project `javascript-astro`, `SENTRY_AUTH_TOKEN` from env (source maps).
- Adapter: `cloudflare()` with default settings (no custom `platformProxy` / Images plugin).

`wrangler.jsonc`:

- Worker name: `oprec-perisai`.
- `compatibility_date`: `2026-09-07`.
- Flags: `global_fetch_strictly_public`, `nodejs_compat`.
- Binding: `ASSETS` → `./dist`.
- Observability: enabled.
- **No** D1, R2, KV, Queues, or Cloudflare Images bindings. Turso, S3, JWT, and Resend are **plain environment secrets**, not Wrangler bindings.

### 1.2 Environment variables (expected)

From `.env.example` + `worker-configuration.d.ts` + `src/lib/env.ts`:

| Variable | Used for |
| --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | DB |
| `JWT_SECRET` | Session + password-reset JWTs (dev fallback exists in code) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_NAME` | B2/S3 |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | B2/S3 signing |
| `B2_*` aliases | Supported in `src/lib/s3.ts` only; **presign API currently reads `AWS_*` / `S3_*` only** |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Verification + password reset emails |
| `APP_URL` / `PUBLIC_APP_URL` | Absolute links in emails |
| `SENTRY_AUTH_TOKEN` | Build-time Sentry (not runtime DSN) |

Default B2 endpoint in code: `https://s3.eu-central-003.backblazeb2.com`, bucket `oprec-perisai`.

### 1.3 Layout of application code

```
src/
  db/           schema.ts, index.ts (createDb)
  lib/          auth.ts, s3.ts, env.ts, constants/academic.ts
  layouts/      MainLayout.astro
  middleware.ts JWT + route guards
  pages/        UI + API routes
  styles/       global.css (Tailwind)
scripts/        seed.mjs, seed-peminatan.mjs
drizzle/        0000_unusual_slayback.sql (stale vs schema)
sentry.client.config.js / sentry.server.config.js
```

There is **no** `src/components/` directory; UI is page-local Astro + inline `<script>`.

---

## 2. Routing Map

Middleware (`src/middleware.ts`) attaches `locals.user` from JWT and enforces:

| Prefix | Who |
| --- | --- |
| `/admin/*`, `/api/admin/*` | Admin JWT (`role === 'admin'` or `isAdmin`) |
| `/user/*`, `/dashboard/*`, `/api/user/*` | Cagen JWT (`role === 'user'` and not admin) |
| Other `/api/*` | Mixed (see table). Upload/file APIs check auth inside the handler. |

### 2.1 Public / shared UI

```
/
├── /                              Landing (timeline, QnA, CTA)
├── /auth/login                    Unified admin + cagen login
├── /auth/register                 Cagen registration (gated by system_settings)
├── /auth/reset-password           New password form (token query)
└── /verify                        Email verification (?token= / ?pending=1)
```

### 2.2 Cagen dashboard UI (auth required)

```
/user/
├── /user/dashboard                Status, guidebook link, progress
├── /user/form-daftar              Presigned B2 upload UI (7 wajib + 3 opsional)
└── /user/settings                 302 → /dashboard/settings

/dashboard/
└── /dashboard/settings            Edit biodata + peminatan + request password reset
```

### 2.3 Admin UI (auth required)

```
/admin/
├── /admin/dashboard               Applicant list + live search
├── /admin/peserta/[id]            Applicant detail + berkas review + status change
├── /admin/peminatan               Guidebook PDF upload to B2 (update existing tracks)
├── /admin/pengaturan              Registration window + WA call center
├── /admin/timeline                Timeline CRUD
└── /admin/qna                     Moderate public QnA
```

### 2.4 API tree

```
/api/
├── auth/
│   ├── POST   /api/auth/register
│   ├── POST   /api/auth/login
│   ├── GET|POST /api/auth/logout
│   ├── POST   /api/auth/request-reset     (JWT reset token + Resend)
│   └── POST   /api/auth/reset-password
├── user/
│   ├── GET    /api/user/profile
│   └── PUT    /api/user/profile           (biodata + peminatan; NIM/email/password locked)
├── upload/
│   ├── POST   /api/upload/presign         (any logged-in user; PUT URL 15 min)
│   └── POST|PATCH /api/upload/confirm     (cagen only; writes berkas_cagens)
├── file/
│   └── GET    /api/file/view?name=        (presigned GET; owner or admin)
├── guidebook/
│   └── GET    /api/guidebook?id=|&peminatan=|&key=   (public PDF stream / redirect)
├── qna/
│   └── POST   /api/qna/submit             (public)
└── admin/   (middleware: admin only)
    ├── GET|POST|PUT /api/admin/peminatan  (guidebook multipart + metadata; no create-track)
    ├── GET|POST     /api/admin/settings
    ├── GET|POST|PUT|DELETE /api/admin/timeline
    ├── GET|PATCH|DELETE /api/admin/qna
    ├── POST|PATCH   /api/admin/status
    └── GET          /api/admin/search-applicants?q=&status=  (limit 20)
```

---

## 3. Database Schema (Drizzle / Turso)

SQLite via Turso. IDs are integer autoincrement. Timestamps are Unix epoch integers (`mode: 'timestamp'`).

### 3.1 Entity relationship (current)

```
admins  (standalone panitia accounts)

cagens 1 ─── 0..1 berkas_cagens     (relation in Drizzle is `one`; DB has NO unique on cagen_id)
cagens.peminatan  ──text──►  peminatan.nama   (NO foreign key; name matching in app)

peminatan          (catalog + guidebook_url)
system_settings    (singleton id=1)
timeline_events
public_qna
```

There is **no** `users` table. Applicants live in `cagens`; panitia in `admins`.

### 3.2 `admins`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | |
| `nama_lengkap` | text NN | |
| `username` | text NN unique | Login identifier |
| `password` | text NN | bcrypt |
| `created_at` | timestamp NN | default `unixepoch()` |

### 3.3 `cagens` (applicants)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | JWT `id` for role `user` |
| `email` | text NN unique | |
| `password` | text NN | bcrypt |
| `nama_lengkap`, `nama_panggilan` | text NN | |
| `nim` | text NN unique | Used in S3 key `cagen/{nim}/...` |
| `no_wa`, `fakultas`, `jurusan`, `angkatan` | text NN | |
| `nomor_registrasi` | text unique nullable | 7-digit code at register |
| `status_pendaftaran` | text enum NN | `Belum Melengkapi` (default), `Review Berkas`, `Berkas Diterima`, `Lulus`, `Tidak Lulus` |
| `is_verified` | boolean NN | default false; login blocked until true |
| `verification_token` | text nullable | UUID; cleared after `/verify` |
| `peminatan` | text nullable | **Free text**, not FK to `peminatan.id` |
| `created_at` | timestamp NN | |

File object keys are **not** stored on `cagens`. They live on `berkas_cagens`.

### 3.4 `berkas_cagens` (wide document row)

One intended row per applicant. Columns store **S3 object keys** (sometimes comma-separated for multi-image follow/share).

| Column | Required | Role |
| --- | --- | --- |
| `id` | PK | |
| `cagen_id` | NN, FK → `cagens.id` ON DELETE CASCADE | |
| `ktm` | NN | |
| `transkrip_nilai` | NN | |
| `pas_foto` | NN | |
| `cv` | NN | |
| `bukti_follow` | NN | multi-file CSV keys |
| `bukti_share` | NN | multi-file CSV keys |
| `sertifikat_prestasi` | nullable | optional |
| `sertifikat_bahasa` | nullable | optional |
| `sertifikat_organisasi` | nullable | optional |
| `peminatan` | NN enum | `KTI/ESSAY`, `Business Plan`, `Debat`, `Poster`, `Video Graph` — **no Riset**, naming differs from UI |
| `file_karya` | NN | currently treated as a single ZIP in the form |
| `waktu_upload` | timestamp NN | last confirm |

Confirm API treats empty string as “not uploaded” for NOT NULL columns so a row can be inserted before all files exist.

### 3.5 `peminatan`

| Column | Notes |
| --- | --- |
| `id` | PK |
| `nama` | unique |
| `deskripsi` | NN |
| `guidebook_url` | nullable (B2 URL or external) |
| `is_active` | boolean default true |
| `created_at` | |

Seeded tracks (`scripts/seed-peminatan.mjs`): KTI / Essay, Business Plan, Debat, Poster, Video Graph.

### 3.6 `system_settings` (singleton)

`id=1`, `registration_start`, `registration_end`, `is_registration_open`, `wa_number`, `wa_message`.

### 3.7 `timeline_events`

`title`, `description`, `start_date`, `end_date`, `sequence_order`, `created_at`.

### 3.8 `public_qna`

`asker_name`, `question`, `answer`, `is_published` (default false), `created_at`.

### 3.9 Schema vs migration vs seed drift

| Artifact | Reality |
| --- | --- |
| `drizzle/0000_unusual_slayback.sql` | Only `admins`, partial `cagens` (no nomor_registrasi / verify / peminatan), `berkas_cagens`. **Missing** later tables. |
| `scripts/seed.mjs` | CREATE IF NOT EXISTS for most tables; ALTER for `is_verified` + `verification_token` only. **Does not ALTER** `cagens.peminatan`, `system_settings.wa_*`. |
| Live Turso | Depends on historical `db:push` / seed. Treat production as “schema.ts + ad-hoc ALTERs”, not the SQL file. |

---

## 4. Feature State Evaluation

### 4.1 Authentication — **implemented (with gaps)**

| Flow | Status |
| --- | --- |
| Register | Complete: validation, duplicate email/NIM, bcrypt, nomor registrasi, `is_verified=false`, Resend HTML email, registration window guard. |
| Email verify | Complete: `/verify?token=` sets `is_verified` and clears token. |
| Login | Complete: admin by username, cagen by email/NIM; unverified cagen → 403. Unified `/auth/login`. |
| Logout | Complete: GET/POST clear cookie. |
| Password reset (cagen) | Backend complete (1h JWT + Resend). **UI only from `/dashboard/settings` (logged in).** Login page has **no** “lupa kata sandi”. Unauthenticated users can still POST `/api/auth/request-reset` with `{ email }` if they know the URL. |
| Admin password reset | **Missing.** |
| Token revocation / rotation after reset | **Missing** (old session JWT still valid 7 days). |
| JWT payload | `id`, `role`, `isAdmin`, `name`, `email`, `username`, `nim`. `nomorRegistrasi` is **not** signed into the cookie. |

### 4.2 Profile settings & peminatan — **implemented (catalog mismatch)**

- `/dashboard/settings` + `GET/PUT /api/user/profile`.
- Editable: nama, panggilan, WA, fakultas, prodi, angkatan, peminatan.
- Locked: NIM, email, password (password via reset email).
- Fakultas/prodi map: `src/lib/constants/academic.ts`.
- Peminatan options in UI: `KTI / Essay`, `Business Plan`, `Debat`, `Poster`, `Video Graph`, **`Riset`**.
- Writes `cagens.peminatan`; if a `berkas_cagens` row exists, also updates its enum column (will **fail or coerce badly** if UI sends `Riset` or `KTI / Essay` vs schema `KTI/ESSAY`).
- User dashboard resolves guidebook by **string name match** against `peminatan` table, not by ID.

### 4.3 Admin panel — **dashboard + ops complete; peminatan CRUD partial**

| Area | Status |
| --- | --- |
| Dashboard UI | Search (nama/NIM/no. registrasi), status filter, link to detail. |
| Applicant detail | 10-slot berkas checklist, `/api/file/view`, status PATCH. |
| Status workflow | `POST/PATCH /api/admin/status`. |
| Peminatan | **Update-only:** guidebook PDF (multipart → B2 `guidebooks/...`), delete guidebook, deskripsi, `isActive`. **No create/delete of peminatan rows** in API/UI. New tracks = seed script. |
| File upload to S3/B2 | Admin: guidebook via Worker PUT. Cagen: browser PUT to presigned URL then `/api/upload/confirm`. |
| Settings / timeline / QnA | Implemented. |

### 4.4 Error monitoring — **client/server Sentry yes; Workers SDK unused**

- `@sentry/astro` in `astro.config.mjs`.
- `sentry.client.config.js` and `sentry.server.config.js` call `Sentry.init` with DSN and `tracesSampleRate: 1.0`.
- `@sentry/cloudflare` is a dependency but **not** used in Wrangler/handler wrapping. Worker-specific capture is incomplete compared to the package presence.
- DSN is hardcoded in repo (typical for public client DSNs; still worth env-driving).

### 4.5 Adjacent features already in production path

- Public landing: timeline, published QnA, question submit.
- Registration gate + WITA (`+08:00`) datetime parsing.
- Guidebook public proxy (`/api/guidebook`) streams PDF from B2.
- Pas foto: Cropper.js 4:6 + compression before presign.
- Multi-file follow/share (up to 5 images, keys joined by comma).

### 4.6 Cloudflare Images

**Not implemented.** Wrangler has no Images binding. Images are Astro assets (`astro:assets`) plus B2 object keys. Pas foto is a B2 file, not an Images variant URL.

---

## 5. Missing Pieces & Tech Debt

### 5.1 Document model vs guidebook (blocking for next epic)

Current model is a **fixed-width row** (~10 document slots + 1 `file_karya`). That cannot represent:

- **12 requirement files** (different mime/size rules, some multi-file).
- **Dynamic “Karya Peminatan”** (track-specific artifacts: essay PDF vs video vs poster vs debat materials, possibly many files).
- Per-file metadata (original name, size, mime, review status, uploaded_at).
- Replacing the wide table with more columns will keep exploding.

`cagens` has **no** file-upload columns (correct). The gap is `berkas_cagens` being too rigid, not a missing column on the user table.

### 5.2 Data integrity

- No `UNIQUE(cagen_id)` on `berkas_cagens` → duplicate rows possible; all queries use `limit 1`.
- Confirm insert defaults `peminatan: 'KTI/ESSAY'` even if the cagen already chose another track.
- Completeness check: 7 fields including `fileKarya`; does not require peminatan selected or optional certificates.
- Peminatan name **triplication**: `PEMINATAN_LIST` in schema, `PEMINATAN_OPTIONS` in academic constants, `peminatan.nama` in DB.
- `cagens.peminatan` is not an FK.
- Seed CREATE for `cagens` may omit `peminatan` on older DBs if ALTER never ran.

### 5.3 Auth / security

- Default JWT secret in `src/lib/auth.ts` if env missing.
- Password-reset JWT is not single-use (no `token_version` / jti store).
- `/api/upload/confirm` accepts any key under `cagen/` (`isCagenFolder` bypass).
- `/api/upload/presign` allows any authenticated role (including admin) and trusts body `nim`.
- Login has no public reset link; admin cannot self-reset.
- Resend failures do not fail registration (account exists, email may never arrive; no resend-verification endpoint).

### 5.4 Platform / ops

- Drizzle journal has a single stale migration; `db:push` / seed ALTERs are the real migrator.
- Presign endpoint duplicates S3 config instead of using `src/lib/s3.ts` (B2_ env aliases ignored there).
- Worker-generated types omit `RESEND_*` / `APP_URL` (present in `src/env.d.ts`).
- README is still the Astro starter template.
- Sentry sample rate 100% on both sides.

### 5.5 Product / UX

- Karya is a generic ZIP regardless of track.
- Admin peminatan is guidebook management, not full catalog CRUD.
- Search-applicants reads peminatan from `berkas_cagens`, not `cagens.peminatan`.

---

## 6. Recommended Next Steps (12 requirement files + dynamic Karya Peminatan)

Do **not** add twelve more columns to `cagens` or `berkas_cagens`. Introduce a **catalog + instance** model, keep B2 keys as the blob pointer, and treat peminatan as a real FK.

### 6.1 Target schema

```
peminatan (existing)
  id, nama, deskripsi, guidebook_url, is_active

document_types                          -- catalog of slots (admin-editable later)
  id
  slug                  UNIQUE          -- e.g. ktm, transkrip, karya_poster
  label
  description
  group                 'wajib' | 'opsional' | 'karya'
  peminatan_id          NULLABLE FK     -- NULL = applies to all tracks
  is_required           boolean
  accept_mime           text            -- e.g. application/pdf,image/jpeg
  max_size_bytes        integer
  max_files             integer         -- 1 or 5
  sort_order            integer
  is_active             boolean

cagen_documents                         -- one row per uploaded object
  id
  cagen_id              FK cagens ON DELETE CASCADE
  document_type_id      FK document_types
  s3_key                text NN
  original_filename     text
  content_type          text
  size_bytes            integer
  sort_index            integer         -- for multi-file slots
  uploaded_at           timestamp
  UNIQUE(cagen_id, document_type_id, sort_index)

cagens.peminatan_id     INTEGER NULL REFERENCES peminatan(id)
```

Keep `cagens.peminatan` temporarily as a denormalized label, then drop it after backfill.

**Why not keep the wide table:** 12 shared requirements × N tracks of karya would be dozens of nullable columns, comma-separated keys, and confirm-API whitelist churn. A type catalog makes the form **data-driven** (`GET /api/user/document-requirements?peminatanId=`).

### 6.2 Suggested seed of `document_types`

**Shared wajib (guidebook “12 files” — adjust slugs to the official list):** map each guidebook item to a `slug` with mime/size/`max_files`. Keep today’s seven as the first batch (`ktm`, `pas_foto`, `cv`, `transkrip_nilai`, `bukti_follow`, `bukti_share`, plus the remaining five guidebook items that are not yet columns).

**Shared opsional:** `sertifikat_prestasi`, `sertifikat_bahasa`, `sertifikat_organisasi` (and extras from guidebook).

**Karya (dynamic):** rows with `group='karya'` and `peminatan_id` set:

| Track | Example types |
| --- | --- |
| KTI / Essay | `karya_naskah` (PDF), maybe `karya_lampiran` |
| Business Plan | `karya_proposal` (PDF/PPT) |
| Debat | `karya_makalah` / case file |
| Poster | `karya_poster` (PDF/PNG) |
| Video Graph | `karya_video` (mp4) or ZIP if size > Worker limits |
| Riset | `karya_proposal_riset` |

UI on `/user/form-daftar`: render shared slots always; render karya slots **after** `cagens.peminatan_id` is set. Changing track should not delete shared files; orphan karya rows can be kept or soft-hidden.

### 6.3 Upload pipeline (reuse, don’t replace)

1. Client: `POST /api/upload/presign` with `documentTypeSlug` (not a free-form category).
2. Browser PUT to B2 (stay under Worker memory; large video/ZIP already uses this path).
3. `POST /api/upload/confirm` inserts/replaces `cagen_documents` and deletes previous S3 keys for that slot.
4. Completeness: count required `document_types` for `(peminatan_id IS NULL OR peminatan_id = chosen)` vs distinct uploaded types with `count >= 1` (or `max_files`). Then set `status_pendaftaran` to `Review Berkas`.

Add `UNIQUE(cagen_id)` only if you keep a summary row; otherwise drop `berkas_cagens` after migrating keys into `cagen_documents`.

### 6.4 Migration plan

1. Align peminatan names and add `cagens.peminatan_id`; generate a **new** Drizzle migration (do not trust `0000`).
2. Create `document_types` + `cagen_documents`; seed 12+karya types from guidebook.
3. One-off script: copy existing `berkas_cagens.*` keys into `cagen_documents`.
4. Switch form-daftar + admin peserta view to the new tables; keep confirm whitelist generated from `document_types.slug`.
5. Tighten confirm: key must match `cagen/{nim}/` for the JWT nim; remove the generic `cagen/` allow.
6. Add public forgot-password on login; optional `POST /api/auth/resend-verification`.
7. Wire `@sentry/cloudflare` or document that Astro server init is sufficient; drop unused dep if not.

### 6.5 Implementation order for the next sprint

1. Schema + migration + backfill (no UI change).  
2. Requirements API + rewrite form-daftar to consume it (shared 12 files).  
3. Karya slots filtered by selected peminatan.  
4. Admin review UI: list `cagen_documents` instead of hardcoded 10 keys.  
5. Cleanup: remove `berkas_cagens` wide columns, unify PEMINATAN constants with `peminatan` table.

---

## 7. Mental model (one paragraph)

OREC PERISAI UMI is an Astro 7 SSR app on Cloudflare Workers talking to Turso over HTTP and storing private files on Backblaze B2 via aws4fetch. Identity is split (`admins` vs `cagens`) with a jose JWT cookie and Resend for verify/reset. Most product surfaces (landing, auth, profile, admin ops, guidebook PDFs, a 10-slot upload form) already work. The next architectural move is to replace the wide `berkas_cagens` row with a document-type catalog and per-file rows so the official 12 requirement files and per-track karya uploads can grow without another schema rewrite.
