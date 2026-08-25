# Panduan Development TANIA dengan Claude Code
### Stack: Claude Code · Supabase (Free) · Netlify (Free) — Target MVP: Rp 0 biaya infrastruktur

**Versi 1.0 — Agustus 2026 | Chapter Product & Solution (DPS), Telkom Indonesia**

---

## 1. Arsitektur Zero-Cost

Prinsip utama: **frontend statis di Netlify, semua backend di Supabase**. Browser berkomunikasi langsung ke Supabase via `supabase-js` — tidak ada server/API layer sendiri. Ini bukan sekadar penghematan; ini kunci agar tetap $0:

```
┌─────────────────────┐        ┌──────────────────────────────┐
│  Netlify (Free)     │        │  Supabase (Free)             │
│  React SPA / Next   │◄──────►│  · PostgreSQL + RLS          │
│  static export      │  HTTPS │  · Auth (email / OAuth)      │
│  (HTML/JS/CSS saja) │        │  · Storage (lampiran)        │
└─────────────────────┘        │  · Edge Functions (opsional) │
                               └──────────────────────────────┘
```

**Kenapa tanpa API server sendiri?**
- Netlify Free sekarang memakai model **300 kredit/bulan (hard limit)**: 1x production deploy = 15 kredit, bandwidth = 20 kredit/GB, compute functions = 10 kredit/GB-jam. Kalau TANIA pakai SSR/API routes di Netlify, kredit habis dalam hitungan hari.
- Dengan situs murni statis, kredit hanya terpakai untuk **deploy + bandwidth** → cukup untuk MVP internal chapter (puluhan user).
- Keamanan data ditangani **Row Level Security (RLS)** di PostgreSQL, bukan di API layer. Ini wajib, bukan opsional (lihat Bagian 5).

**Catatan biaya yang jujur:** infrastruktur Rp 0, tetapi Claude Code sendiri berjalan di atas langganan Claude (Pro/Max) atau kredit API yang Anda miliki. Itu satu-satunya "biaya" dalam setup ini.

---

## 2. Batas Free Tier & Guardrail (per Agustus 2026)

| Layanan | Limit Free Tier | Risiko untuk TANIA | Mitigasi |
|---|---|---|---|
| Supabase DB | 500 MB storage | Aman — data talent/timesheet chapter jauh di bawah ini | Hindari simpan file di tabel; pakai Storage |
| Supabase Storage | 1 GB, max 50 MB/file | Lampiran feasibility case bisa menumpuk | Kompres PDF, batasi ukuran upload di UI |
| Supabase Auth | 50.000 MAU | Tidak akan tersentuh | — |
| Supabase egress | 5 GB/bulan | Aman untuk internal | Paginasi query, jangan `select *` tabel besar |
| **Supabase auto-pause** | **Project pause setelah 7 hari tidak ada aktivitas** | **Risiko terbesar** — portal internal bisa sepi saat libur | GitHub Actions cron ping tiap 3 hari (gratis, lihat 7.3) |
| Supabase project | Maks 2 project aktif, tanpa backup otomatis | Tidak ada backup! | `supabase db dump` mingguan via GitHub Actions, simpan di repo privat |
| Netlify kredit | 300 kredit/bulan, **hard stop** (situs di-pause, bukan ditagih) | Deploy 15 kredit → maks ±15–18 deploy/bulan setelah dikurangi bandwidth | Deploy hanya dari branch `main`, matikan deploy preview, batch rilis 2–3x/minggu |
| Netlify bandwidth | 20 kredit/GB (~15 GB efektif) | Aman untuk SPA kecil | Optimasi bundle, lazy-load, cache header |

Kabar baiknya: Netlify Free **tidak pernah menagih** — kalau kredit habis, situs berhenti sampai awal bulan. Tidak ada risiko tagihan kejutan.

---

## 3. Prasyarat & Setup Akun (semua gratis)

1. **GitHub** — repo privat gratis. Buat repo `tania-portal`.
2. **Supabase** — daftar di supabase.com dengan akun GitHub → New Project → region **Southeast Asia (Singapore)** (terdekat dari Indonesia). Catat `Project URL` dan `anon key` (Settings → API).
3. **Netlify** — daftar di netlify.com dengan akun GitHub yang sama.
4. **Claude Code** — install di MacBook:
   ```bash
   npm install -g @anthropic-ai/claude-code
   cd ~/Projects/tania-portal
   claude
   ```
   Login dengan akun Claude Anda saat diminta. Dokumentasi: https://docs.claude.com/en/docs/claude-code/overview
5. **Supabase CLI** (untuk migrasi & dump):
   ```bash
   brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref <project-ref-anda>
   ```

---

## 4. Inisialisasi Project & CLAUDE.md

Langkah pertama di Claude Code bukan menulis kode, tapi **memberi konteks**. Buat file `CLAUDE.md` di root repo — Claude Code membacanya otomatis setiap sesi.

**Template `CLAUDE.md` (siap pakai):**

```markdown
# TANIA — Portal Digital Product & Solution
Portal internal Chapter Product & Solution (DPS), Telkom Indonesia.
5 modul: Talent Management, Workload Analysis, Project Timesheet,
Project Feasibility, Budget Control.

## Stack (JANGAN diubah tanpa persetujuan)
- Frontend: Next.js (App Router) dengan `output: 'export'` — STATIS MURNI.
  Dilarang: SSR, API routes, server actions, middleware yang butuh server.
- UI: Tailwind CSS + shadcn/ui
- Backend: Supabase (PostgreSQL, Auth, Storage) via @supabase/supabase-js
- Hosting: Netlify Free tier — hemat deploy (15 kredit/deploy)

## Aturan wajib
1. SEMUA akses data lewat Supabase client + RLS. Tidak ada endpoint custom.
2. Setiap tabel baru WAJIB punya RLS policy sebelum dipakai. Tanpa
   pengecualian — anon key ter-expose di browser.
3. Skema DB hanya diubah lewat file migrasi di supabase/migrations/,
   tidak pernah langsung di dashboard.
4. Role user (executive, chapter_lead, manager, pm, talent, admin)
   disimpan di tabel profiles, di-enforce via RLS — bukan di frontend.
5. Bahasa UI: Indonesia. Kode & komentar: Inggris.
6. Jaga bundle kecil: dynamic import untuk chart/library berat.

## Perintah
- npm run dev — development lokal
- npm run build — static export (folder out/)
- supabase db push — apply migrasi ke Supabase
- supabase gen types typescript --linked > src/lib/database.types.ts

## Struktur modul (prefix ID requirement)
- TM = Talent Management, WA = Workload Analysis, TS = Timesheet,
  PF = Project Feasibility, BC = Budget Control
  (mengacu ke TANIA Requirement Document v1.0)
```

**Prompt pertama untuk Claude Code:**

> Baca CLAUDE.md. Inisialisasi project Next.js (App Router, TypeScript, Tailwind) dengan `output: 'export'` di next.config, pasang shadcn/ui dan @supabase/supabase-js, buat layout dasar dengan sidebar 5 modul TANIA + halaman login placeholder. Env vars: NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY. Pastikan `npm run build` menghasilkan static export tanpa error.

---

## 5. Setup Supabase: Skema, Auth, dan RLS

### 5.1 Skema inti (via migrasi)

Minta Claude Code membuat migrasi awal:

> Buat migrasi Supabase di supabase/migrations/ untuk skema inti TANIA:
> - `profiles` (id → auth.users, full_name, role enum: executive/chapter_lead/manager/pm/talent/admin, squad, grade, is_active)
> - `skills` + `profile_skills` (kompetensi + level 1–5) — modul TM
> - `projects` (code, name, status, customer, pm_id) dan `activities` (delivery/presales/internal/leave/training)
> - `allocations` (profile_id, project_id, period, percent) — modul WA
> - `timesheets` (profile_id, project_id, activity_id, work_date, hours, status draft/submitted/approved/rejected, approved_by) — modul TS
> - `feasibility_cases` (project info, skor per dimensi, total_score, decision, decided_by, rationale) — modul PF
> - `budget_lines` (program, category, plan_amount, committed_amount, realized_amount) — modul BC
> - `audit_log` (table_name, record_id, action, actor, before, after)
> Semua tabel: created_at/updated_at + trigger. Lalu jalankan `supabase db push`.

### 5.2 RLS — bagian paling kritis

Karena browser memegang `anon key`, **RLS adalah satu-satunya pagar keamanan**. Prompt:

> Aktifkan RLS di semua tabel dan buat policy:
> - `profiles`: semua user login bisa SELECT; user hanya bisa UPDATE baris miliknya; admin bisa semua.
> - `timesheets`: talent hanya CRUD miliknya selama status draft/rejected; manager bisa SELECT + UPDATE status untuk squad-nya; executive/chapter_lead SELECT semua.
> - `feasibility_cases`: pm bisa INSERT/UPDATE miliknya selama belum decided; chapter_lead bisa UPDATE decision; lainnya SELECT.
> - `budget_lines`: SELECT untuk manager ke atas; INSERT/UPDATE hanya chapter_lead & admin.
> - `audit_log`: INSERT via trigger, SELECT hanya admin & chapter_lead.
> Buat helper function `get_my_role()` (SECURITY DEFINER) supaya policy tidak rekursif. Tulis juga test SQL sederhana untuk membuktikan talent tidak bisa membaca timesheet orang lain.

### 5.3 Auth

- MVP: **email + password** dengan pendaftaran dimatikan (invite-only via dashboard atau admin page) — cukup dan gratis.
- Fase berikutnya: Azure/Entra ID OAuth di Supabase Auth (masih gratis di sisi Supabase; butuh app registration dari IT korporat).

---

## 6. Tahapan MVP (mapping ke Requirement Document v1.0)

Kerjakan **satu fase per sesi Claude Code**, commit per fase, dan gunakan `/clear` di antara fase agar konteks tetap fokus. Setiap prompt di bawah mengacu ke ID requirement.

| Fase | Scope | Requirement | Contoh prompt ke Claude Code |
|---|---|---|---|
| **1. Fondasi** (minggu 1) | Auth, layout, profil dasar, master data | TM-01, XM-05 | "Implementasikan login Supabase Auth, halaman profil (TM-01), dan halaman admin master data projects & activities. Enforce role dari tabel profiles." |
| **2. Timesheet** (minggu 2) | Entry mingguan + approval | TS-01..TS-04 | "Buat halaman timesheet mingguan: grid hari × project/activity, simpan draft, submit, lalu halaman approval untuk manager dengan komentar reject (TS-02). Tambah indikator compliance per squad (TS-04)." |
| **3. Talent & Workload** (minggu 3) | Kompetensi, alokasi, utilisasi | TM-02..TM-04, WA-01..WA-04 | "Buat competency matrix yang searchable (TM-02/04), register alokasi (WA-01), lalu hitung utilisasi = jam approved vs kapasitas (WA-02) dan tampilkan heatmap squad (WA-04) dengan alert >100% (WA-03). Pakai dynamic import untuk library chart." |
| **4. Feasibility & Budget** (minggu 4) | Scoring, decision, budget tracking | PF-01..PF-05, BC-01..BC-05 | "Buat form feasibility case dengan scoring berbobot 5 dimensi (PF-02), resource check ke data alokasi (PF-03), workflow keputusan chapter_lead dengan audit trail (PF-04), pipeline kanban (PF-05). Lalu modul budget: plan vs commitment vs realisasi + alert 80%/100% (BC-01..05)." |
| **5. Dashboard & polish** (minggu 5) | Executive dashboard, export | XM-01, XM-03 | "Buat dashboard eksekutif: ringkasan utilisasi, compliance timesheet, pipeline feasibility, posisi budget (XM-01). Tambah export Excel (library xlsx, dynamic import) di setiap tabel (XM-03)." |

Tips memakai Claude Code secara efektif:
- **Rencana dulu, kode kemudian**: awali fitur besar dengan "Buat rencana implementasi dulu, jangan menulis kode" → review → baru "lanjutkan".
- Minta Claude Code **menjalankan `npm run build` setelah setiap fitur** — static export Next.js gampang rusak oleh kode yang diam-diam butuh server.
- Setelah skema berubah: "Regenerate database.types.ts dan perbaiki semua type error."
- Simpan keputusan penting (misalnya bobot scoring PF) ke `CLAUDE.md` agar konsisten antar sesi.

---

## 7. Deploy ke Netlify (hemat kredit)

### 7.1 Konfigurasi

Buat `netlify.toml` di root:

```toml
[build]
  command = "npm run build"
  publish = "out"

[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

Di Netlify: **Add new site → Import from GitHub → pilih repo** → set env vars `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Site settings → Environment variables).

### 7.2 Disiplin kredit (penting!)

Dengan 300 kredit dan 15 kredit/deploy:

1. **Site settings → Build & deploy → Branches**: deploy hanya branch `main`.
2. **Matikan Deploy Previews** untuk pull request — ini pemakan kredit tersembunyi terbesar.
3. Kerja harian di branch `dev`, merge ke `main` **maksimal 2–3x/minggu** → ±10 deploy/bulan = 150 kredit, sisanya untuk bandwidth.
4. Pantau **Team → Usage**; Netlify memberi notifikasi di 50/75/90/100%.

### 7.3 Anti-pause Supabase + backup (GitHub Actions, gratis)

Buat `.github/workflows/keepalive.yml`:

```yaml
name: Supabase keep-alive & backup
on:
  schedule:
    - cron: "0 1 */3 * *"   # tiap 3 hari
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -s "${{ secrets.SUPABASE_URL }}/rest/v1/profiles?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" > /dev/null
```

Backup mingguan ada di `.github/workflows/backup.yml`. **Penting:** repo `tania-portal` bersifat publik, dan artifact GitHub Actions pada repo publik dapat diunduh siapa pun — karena itu dump dienkripsi GPG AES-256 memakai secret `BACKUP_PASSPHRASE` sebelum diunggah, dan workflow menolak berjalan bila secret itu belum di-set. (Repo publik memakai runner GitHub Actions gratis tanpa batas menit; repo privat mendapat kuota 2.000 menit/bulan.)

Secret yang dibutuhkan di **Settings → Secrets and variables → Actions**:

| Secret | Dipakai oleh | Isi |
|---|---|---|
| `SUPABASE_URL` | keepalive | URL project Supabase |
| `SUPABASE_ANON_KEY` | keepalive | anon key |
| `SUPABASE_DB_URL` | backup | connection string PostgreSQL |
| `BACKUP_PASSPHRASE` | backup | passphrase enkripsi — **simpan di luar GitHub**; tanpa ini backup tidak bisa dipulihkan |

Pulihkan backup dengan:

```bash
gpg --batch --yes --passphrase "<BACKUP_PASSPHRASE>" \
    --decrypt tania-backup-YYYY-MM-DD.sql.gpg > restore.tar.gz
tar xzf restore.tar.gz   # schema.sql + data.sql
```

---

## 8. Definisi Selesai MVP & Trigger Upgrade

**MVP dinyatakan selesai bila:** 5 modul berjalan sesuai requirement "Must", siklus timesheet mingguan hidup untuk seluruh chapter, dashboard eksekutif tampil dengan data riil, dan semua tabel terbukti terkunci RLS (uji dengan akun role talent).

**Kapan mulai bayar (dan berapa):**

| Trigger | Aksi | Biaya |
|---|---|---|
| Portal dipakai harian sebagai sistem resmi chapter | Supabase Pro (backup harian, tanpa auto-pause) | $25/bulan |
| Kredit Netlify sering habis / butuh deploy preview | Netlify Personal atau Pro | $9–20/bulan |
| Integrasi HR/SAP & SSO Entra ID penuh | Tetap bisa di tier yang sama; effort di sisi IT korporat | — |

Urutan upgrade yang disarankan: **Supabase dulu** (data chapter tidak boleh hilang dan tidak boleh ter-pause), Netlify belakangan.

---

## 9. Checklist Mulai Hari Ini

- [ ] Buat repo GitHub `tania-portal` (privat)
- [ ] Buat project Supabase (region Singapore), catat URL + anon key
- [ ] Hubungkan repo ke Netlify, set env vars, matikan deploy preview
- [ ] Install Claude Code + Supabase CLI di MacBook
- [ ] Commit `CLAUDE.md` (template Bagian 4)
- [ ] Sesi Claude Code #1: inisialisasi project (prompt Bagian 4)
- [ ] Sesi Claude Code #2: migrasi skema + RLS (prompt Bagian 5)
- [ ] Pasang GitHub Actions keep-alive (Bagian 7.3)
- [ ] Mulai Fase 1 (Bagian 6)

---
*Limit free tier diverifikasi per Agustus 2026 dan bisa berubah — cek supabase.com/pricing dan netlify.com/pricing sebelum memulai.*
