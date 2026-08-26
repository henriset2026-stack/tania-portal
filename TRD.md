# TRD — Technical Requirements Document

| | |
|---|---|
| **Dokumen** | Technical Requirements Document |
| **Produk** | TANIA — Portal Digital Product & Solution |
| **Versi** | 1.0 (draft) |
| **Tanggal** | 26 Agustus 2026 |
| **Audiens** | Tim pengembang, QA, reviewer teknis |

---

## 1. Tujuan & Batas Dokumen

Dokumen ini adalah **kontrak implementasi**: spesifikasi teknis yang harus dipatuhi saat menulis kode, beserta rujukan yang biasanya dicari sambil mengetik.

Untuk menghindari duplikasi yang pasti berujung pada saling bertentangan, batas antar dokumen ditetapkan tegas:

| Pertanyaan | Dijawab oleh |
|---|---|
| Mengapa dibangun? | `BRD.md` |
| Apa yang dibangun dan untuk siapa? | `PRD.md` |
| Perilaku apa yang harus benar, dan bagaimana membuktikannya? | `SRS.md` |
| Mengapa arsitekturnya seperti ini? | `SAD.md` |
| Aturan kerja saat mengubah repo ini | `AGENTS.md` |
| **Bentuk konkret data, konfigurasi, kontrak, dan prosedur** | **TRD.md (dokumen ini)** |

> TRD **tidak** mengulang keputusan arsitektur (SAD), aturan perilaku (SRS), atau daftar requirement (PRD). Bila TRD dan skema di `supabase/migrations/` berbeda, **skema yang berlaku** dan TRD harus dikoreksi.

---

## 2. Platform & Versi

| Komponen | Versi / ketentuan | Catatan |
|---|---|---|
| Node.js | 20.x | Dipatok di `netlify.toml` (`NODE_VERSION`) |
| Next.js | App Router, `output: 'export'` | SSR, API route, route handler, server action, middleware **DILARANG** |
| TypeScript | strict | `database.types.ts` dihasilkan generator, tidak diedit tangan |
| Tailwind CSS + shadcn/ui | mengikuti template shadcn | Komponen UI di `src/components/ui` |
| `@supabase/supabase-js` | v2 | Satu-satunya jalur akses data |
| PostgreSQL | versi Supabase managed | Ekstensi di luar bawaan Supabase tidak dipakai |
| Deno | runtime Supabase Edge Functions | Hanya untuk `tania-assistant` |
| Supabase CLI | ≥ 2.x | Untuk `db push` dan `functions deploy` |

**Aturan dependensi.** Setiap penambahan dependensi HARUS dinilai dampaknya terhadap ukuran bundle. Library berat (`recharts`, `xlsx`) HARUS dimuat lewat `dynamic import`.

---

## 3. Konfigurasi & Inventaris Rahasia

Empat tempat berbeda menyimpan konfigurasi. Keliru menaruhnya adalah cara paling mudah membocorkan rahasia.

| Nama | Tempat | Sifat | Keterangan |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (lokal) + Netlify UI | **Publik** | Ikut terkirim ke browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` (lokal) + Netlify UI | **Publik** | Ikut terkirim ke browser; keamanan bergantung sepenuhnya pada RLS |
| `ANTHROPIC_API_KEY` | Supabase secret | **Rahasia** | Hanya di edge function; tidak pernah di browser |
| `ALLOWED_ORIGINS` | Supabase secret | Konfigurasi | Allowlist origin, pencocokan persis; kosong = hanya `http://localhost:3000` |
| `SUPABASE_URL` | GitHub secret | Konfigurasi | Untuk keep-alive |
| `SUPABASE_ANON_KEY` | GitHub secret | Publik | Untuk keep-alive |
| `SUPABASE_DB_URL` | GitHub secret | **Rahasia** | Connection string; hanya untuk backup |
| `BACKUP_PASSPHRASE` | GitHub secret | **Rahasia** | Kunci pemulihan backup; **simpan salinan di luar GitHub** |
| `service_role` key | **tidak dipakai di mana pun** | **Rahasia** | Tidak boleh dipakai maupun di-commit |

**Aturan mutlak:** hanya variabel berawalan `NEXT_PUBLIC_` yang boleh ada di kode frontend. Rahasia apa pun yang pernah masuk ke bundle harus dianggap bocor dan dirotasi.

---

## 4. Kamus Data

> Rancangan dan alasannya — ERD, kardinalitas, kebijakan ON DELETE, strategi indeks, pola RLS — ada di `DDD.md`. Bagian ini hanya bentuk konkretnya.

### 4.1 Enum

| Enum | Nilai |
|---|---|
| `user_role` | `executive`, `chapter_lead`, `manager`, `pm`, `talent`, `admin` |
| `project_status` | `candidate`, `active`, `on_hold`, `completed`, `cancelled` |
| `activity_category` | `delivery`, `presales`, `internal`, `leave`, `training` |
| `timesheet_status` | `draft`, `submitted`, `approved`, `rejected` |
| `feasibility_decision` | `go`, `no_go`, `hold` |
| `budget_entry_type` | `commitment`, `realization` |
| `chat_role` | `user`, `assistant` |

### 4.2 Tabel

Kolom `created_at` dan `updated_at` bertipe `timestamptz not null default now()` dan tidak diulang di bawah. Tabel bertanda ⚑ memiliki trigger audit.

**`profiles`** ⚑ — TM-01. PK `id` → `auth.users(id)` ON DELETE CASCADE.

| Kolom | Tipe | Ketentuan |
|---|---|---|
| `full_name`, `email` | text | not null, default `''` |
| `role` | `user_role` | not null, default `talent` |
| `squad`, `grade`, `location` | text | nullable |
| `manager_id` | uuid → `profiles(id)` | ON DELETE SET NULL. **Tidak ada constraint anti self-reference — lihat SRS DR-9** |
| `is_active` | boolean | not null, default true |

**`skills`** — TM-02. `name` unik. `category` nullable.

**`profile_skills`** — TM-02. PK gabungan (`profile_id`, `skill_id`); `level` smallint 1–5; `is_certified` boolean.

**`projects`** — master. `code` unik; `status` default `active`; `pm_id` → `profiles`; `start_date`, `end_date` nullable.

**`activities`** — TS-03. `code` unik; `category` `activity_category`; `is_billable`, `is_active` boolean.

**`allocations`** — WA-01. Unik (`profile_id`, `project_id`, `period_month`).

| Kolom | Tipe | Ketentuan |
|---|---|---|
| `period_month` | date | HARUS tanggal 1 — dijamin `check (period_month = date_trunc('month', period_month))` |
| `percent` | numeric(5,2) | `> 0` dan `<= 150` |

**`timesheets`** ⚑ — TS-01/02. Unik (`profile_id`, `project_id`, `activity_id`, `work_date`).

| Kolom | Tipe | Ketentuan |
|---|---|---|
| `hours` | numeric(4,2) | `> 0` dan `<= 24` |
| `status` | `timesheet_status` | default `draft` |
| `submitted_at`, `approved_by` | timestamptz, uuid | **Distempel trigger** — jangan ditulis klien |
| `approval_note` | text | Wajib diisi saat reject (aturan aplikasi) |

**`feasibility_cases`** ⚑ — PF-01..05.

| Kolom | Tipe | Ketentuan |
|---|---|---|
| `estimated_revenue` | numeric(16,2) | nullable |
| `estimated_effort_md` | numeric(8,1) | man-days |
| `estimated_duration_mo` | numeric(4,1) | bulan |
| `required_competencies` | text[] | not null, default `{}` |
| `score_*` (5 kolom) | smallint | masing-masing 0–5 |
| `total_score` | numeric(5,1) | **GENERATED STORED** — tidak dapat ditulis |
| `decision`, `decision_rationale` | enum, text | rationale wajib saat decision diisi (trigger) |
| `decided_by`, `decided_at` | uuid, timestamptz | **Distempel trigger** |
| `submitted_by` | uuid | not null, ON DELETE RESTRICT |

**`budget_lines`** ⚑ — BC-01. Unik (`fiscal_year`, `program`, `category`); `plan_amount` numeric(16,2) `>= 0`; `owner_id` → `profiles`.

**`budget_entries`** ⚑ — BC-02/03. `entry_type` enum; `amount` numeric(16,2) `<> 0` (**boleh negatif** untuk koreksi); `entry_date` date default hari ini; `feasibility_case_id` nullable → jejak XM-02; `created_by` not null.

**`audit_log`** — XM-05. `id` bigint identity; `table_name`, `record_id` (text), `action` (`INSERT`/`UPDATE`/`DELETE`), `actor` uuid, `before_data`/`after_data` jsonb. Ditulis **hanya** oleh `audit_trigger()`.

**`chat_conversations` / `chat_messages`** — AV. `chat_messages` menyimpan `input_tokens`, `output_tokens` untuk AV-06. Keduanya privat per pemilik.

### 4.3 View

| View | Kolom keluaran | Catatan |
|---|---|---|
| `utilization_monthly` | `profile_id`, `full_name`, `squad`, `period_month`, `approved_hours`, `capacity_hours`, `utilization_pct` | `security_invoker = true`. Rentang: −1 tahun s.d. +2 tahun. **Hanya memuat profil yang punya baris timesheet** (SRS SF-1.5) |
| `budget_summary` | `id`, `fiscal_year`, `program`, `category`, `description`, `plan_amount`, `committed_amount`, `realized_amount`, `remaining_amount` | `security_invoker = true`. `remaining = plan − realized` (komitmen tidak mengurangi) |

### 4.4 Indeks

```
profiles(manager_id) · profiles(squad) · projects(pm_id)
allocations(period_month) · allocations(profile_id)
timesheets(profile_id, work_date) · timesheets(status) · timesheets(project_id)
feasibility_cases(decision) · feasibility_cases(submitted_by)
budget_entries(budget_line_id) · audit_log(table_name, record_id)
```

Query daftar SEBAIKNYA disusun agar memakai indeks di atas. Filter utama timesheet adalah (`profile_id`, `work_date`) — pertahankan urutan itu.

### 4.5 Storage

| Bucket | Publik | Batas | Policy |
|---|---|---|---|
| `attachments` | tidak | 10 MB per berkas (10485760 bytes) | Baca: seluruh user login. Unggah: pm ke atas. Hapus: pemilik atau admin |

---

## 5. Kontrak Akses Data

Seluruh akses lewat `supabase-js` dengan JWT pengguna. Tidak ada lapisan API buatan sendiri.

### 5.1 Aturan wajib

| # | Aturan |
|---|---|
| DA-1 | Setiap query daftar HARUS memakai `.range(from, to)`. Tanpa pagination = penolakan review |
| DA-2 | `select('*')` DILARANG pada `timesheets` dan `audit_log`; sebutkan kolom secara eksplisit |
| DA-3 | Angka dashboard HARUS diambil dari view (`utilization_monthly`, `budget_summary`), tidak diagregasi ulang di klien |
| DA-4 | Klien TIDAK BOLEH mengirim `submitted_at`, `approved_by`, `decided_by`, `decided_at`, `total_score` |
| DA-5 | Error dari Supabase HARUS ditangani eksplisit; baris kosong akibat RLS **bukan** error dan HARUS ditampilkan sebagai "tidak ada data yang dapat Anda lihat" |
| DA-6 | Klien Supabase adalah singleton dari `src/lib/supabase.ts`; jangan membuat instance baru per komponen |

### 5.2 Pola query rujukan

```ts
// Daftar timesheet mingguan milik sendiri — kolom eksplisit + pagination
const { data, error } = await supabase
  .from('timesheets')
  .select('id, work_date, hours, status, project_id, activity_id, approval_note')
  .gte('work_date', weekStart)
  .lte('work_date', weekEnd)
  .order('work_date')
  .range(0, 49)

// Utilisasi — baca view, jangan hitung ulang
const { data } = await supabase
  .from('utilization_monthly')
  .select('profile_id, full_name, squad, approved_hours, capacity_hours, utilization_pct')
  .eq('period_month', '2026-08-01')
  .range(0, 99)

// Submit timesheet — hanya kirim status; stempel waktu urusan trigger
await supabase.from('timesheets').update({ status: 'submitted' }).eq('id', id)
```

---

## 6. Kontrak Edge Function `tania-assistant`

Berlaku hanya untuk modul Avatar (di luar MVP).

| | |
|---|---|
| **Endpoint** | `POST {SUPABASE_URL}/functions/v1/tania-assistant` |
| **Autentikasi** | Header `Authorization: Bearer <JWT user>` — wajib |
| **Body** | `{ "conversation_id"?: string, "message": string }` |
| **Batas pesan** | `message` maksimal 2.000 karakter |
| **Respons sukses** | `200 { "conversation_id": string, "reply": string }` |
| **Respons gagal** | `401 Unauthorized` · `400 Invalid message` · `403 Origin not allowed` · `500 Internal error` |
| **CORS** | Origin di-echo hanya bila cocok persis dengan `ALLOWED_ORIGINS`; header `Vary: Origin`; preflight `POST, OPTIONS` |

**Parameter model** (dibaca dari implementasi, ubah hanya dengan alasan tercatat):

| Parameter | Nilai |
|---|---|
| Endpoint hulu | `https://api.anthropic.com/v1/messages` |
| Model | `claude-haiku-4-5-20251001` |
| `max_tokens` | 1024 |
| Putaran tool maksimum | 5 |
| Riwayat yang dikirim | 12 pesan terakhir |

**Tool yang tersedia** — seluruhnya dijalankan memakai JWT pemanggil sehingga RLS berlaku:

| Tool | Masukan |
|---|---|
| `get_my_profile` | — |
| `get_my_timesheet_week` | `start_date`, `end_date` (YYYY-MM-DD) |
| `get_utilization` | `period_month` (YYYY-MM-01), `squad` opsional |
| `search_talent_by_skill` | `skill_name`, `min_level` (1–5) |
| `get_feasibility_pipeline` | `undecided_only` boolean |
| `get_budget_summary` | `fiscal_year` integer |

Menambah tool HARUS mengikuti pola yang sama: query lewat klien ber-JWT pemanggil, tidak pernah `service_role`.

---

## 7. Peta Rute Frontend

| Rute | Modul | Peran yang melihat menu | Sumber data utama |
|---|---|---|---|
| `/login` | — | publik | Supabase Auth |
| `/dashboard` | XM-01 | semua | `utilization_monthly`, `budget_summary`, `feasibility_cases`, `timesheets` |
| `/timesheet` | TS | semua (isi milik sendiri) | `timesheets`, `projects`, `activities` |
| `/timesheet/approval` | TS-02 | manager, chapter_lead, admin | `timesheets` status `submitted` |
| `/talent` | TM | semua | `profiles`, `skills`, `profile_skills` |
| `/workload` | WA | manager ke atas | `allocations`, `utilization_monthly` |
| `/feasibility` | PF | semua (ajukan: pm ke atas) | `feasibility_cases` |
| `/budget` | BC | manager ke atas — **`talent` tidak** | `budget_lines`, `budget_summary`, `budget_entries` |
| `/admin` | XM-05 | admin | master data, `audit_log` |

Menyembunyikan menu adalah kenyamanan tampilan. Rute yang diakses langsung tetap aman karena RLS mengembalikan nol baris — halaman HARUS menangani kondisi itu dengan pesan yang jelas, bukan layar kosong atau error.

---

## 8. Standar Kode

| # | Standar |
|---|---|
| S-1 | Bahasa UI: Indonesia. Kode, komentar, commit message: Inggris |
| S-2 | Nama tabel & kolom: `snake_case`; komponen React: `PascalCase`; fungsi & variabel: `camelCase` |
| S-3 | `src/lib/database.types.ts` dihasilkan generator — **tidak pernah diedit tangan** |
| S-4 | Tidak ada `any` pada kode akses data; pakai tipe hasil generate |
| S-5 | Library berat lewat `dynamic import` |
| S-6 | Format uang dan tanggal terpusat di satu util, tidak diulang per halaman |
| S-7 | Tidak ada logika otorisasi yang hanya ada di frontend |
| S-8 | Commit message mengikuti Conventional Commits |

---

## 9. Prosedur Perubahan Skema

```bash
# 1. Tulis migrasi baru — JANGAN edit migrasi yang sudah ter-apply
#    Penamaan: YYYYMMDDHHMMSS_short_name.sql
#    Tabel baru WAJIB: enable RLS + policy eksplisit di file yang sama

# 2. Terapkan
supabase db push

# 3. Regenerate tipe
supabase gen types typescript --linked > src/lib/database.types.ts

# 4. Perbaiki seluruh type error, lalu
npm run build
```

Migrasi di repositori: `20260825000001_init_schema`, `20260825000002_rls_policies`, `20260825000003_seed_master_data`, `20260826000001_avatar_chat`, `20260826000002_profile_manager_not_self`, `20260827000001_approval_separation_of_duties`.

Seluruhnya terverifikasi dapat diterapkan berurutan pada PostgreSQL 16 bersih. **Belum ada bukti pernah diterapkan ke project Supabase.**

---

## 10. CI/CD & Deployment

### 10.1 Workflow GitHub Actions

| Workflow | Jadwal | Fungsi | Secret |
|---|---|---|---|
| `keepalive.yml` | tiap 3 hari, 01:00 UTC | Ping REST; gagal keras bila bukan 200 | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `backup.yml` | Minggu 02:00 UTC | Dump schema + data → GPG AES-256 → artifact 30 hari | `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` |

`backup.yml` menolak berjalan tanpa passphrase, memverifikasi hasil enkripsinya sendiri dengan dekripsi dan pembandingan byte, lalu menolak mengunggah bila masih ada berkas plaintext tersisa.

Pemulihan:

```bash
gpg --batch --yes --passphrase "<BACKUP_PASSPHRASE>" \
    --decrypt tania-backup-YYYY-MM-DD.sql.gpg > restore.tar.gz
tar xzf restore.tar.gz            # schema.sql + data.sql
psql "<connection-string>" -f schema.sql
```

### 10.2 Netlify

Konfigurasi di `netlify.toml`: `npm run build` → `out/`, Node 20, cache `immutable` untuk `/_next/static/*`, plus header `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

**Wajib disetel di UI Netlify** (tidak dapat diatur dari `netlify.toml`): production branch = `main`, Deploy Previews **mati**, branch deploys **mati**. Satu deploy produksi = 15 dari 300 kredit per bulan.

### 10.3 Edge function

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGINS="https://<site>.netlify.app"
supabase functions deploy tania-assistant
```

Secret saja tidak berlaku sampai function di-deploy ulang.

---

## 11. Pengujian Teknis

| Jenis | Cara | Kriteria lulus |
|---|---|---|
| Otorisasi | SQL langsung dengan JWT tiap peran | Minimal satu ALLOW dan satu DENY per (peran × tabel) |
| Perhitungan | Bandingkan view terhadap hitungan manual | SRS §8.3 — tiga angka dicocokkan |
| Transisi status | Coba transisi tidak sah dari klien | Ditolak **basis data**, bukan frontend |
| Build | `npm run build` | Static export tanpa error |
| Backup | Jalankan `backup.yml` manual | Artifact terenkripsi dapat didekripsi dan diekstrak |
| CORS | `curl` dengan header `Origin` asing | Tidak ada header `Access-Control-Allow-Origin` pada respons |

Contoh uji RLS negatif yang wajib ada:

```sql
-- Sebagai talent: harus mengembalikan 0 baris, bukan error
select * from budget_lines;
-- Sebagai talent: harus GAGAL
update timesheets set status = 'approved' where profile_id = auth.uid();
```

---

## 12. Daftar Periksa Teknis Pra-Go-Live

- [ ] Seluruh tabel memiliki RLS aktif dan policy eksplisit
- [ ] Uji RLS negatif di §11 lulus untuk setiap peran
- [ ] `npm run build` lolos; tidak ada API server-only yang menyusup
- [ ] `database.types.ts` sinkron dengan skema terakhir
- [ ] Tidak ada `select('*')` tanpa filter dan tidak ada query daftar tanpa `.range()`
- [ ] Seluruh secret pada §3 tersetel di tempat yang benar; tidak ada rahasia di bundle
- [ ] `ALLOWED_ORIGINS` disetel dan function di-deploy ulang
- [ ] Deploy Preview dan branch deploy dimatikan di Netlify
- [ ] Backup terenkripsi berhasil dipulihkan minimal satu kali
- [x] Migrasi constraint self-manager (SRS DR-9) ada di repo — masih perlu `supabase db push` ke project sungguhan

---

## 13. Referensi

- `DDD.md` — rancangan basis data: ERD, integritas referensial, strategi indeks, pola RLS, pertumbuhan data
- `UIUX.md` — peta halaman, layar kunci, state wajib, format tampilan
- `SRS.md` — perilaku formal (SF-1..SF-8), kebutuhan data (DR-1..DR-10), NFR, kriteria penerimaan
- `SAD.md` — keputusan arsitektur AD-1..AD-11, mode kegagalan, jalur evolusi
- `PRD.md` — requirement dan cakupan MVP
- `BRD.md` — sasaran bisnis dan keputusan yang diminta
- `AGENTS.md` — aturan kerja pengembangan
- `supabase/migrations/` — sumber kebenaran skema
