# SAD — Software Architecture Document

| | |
|---|---|
| **Sistem** | TANIA — Portal Digital Product & Solution |
| **Pemilik** | Chapter Product & Solution (DPS), Digital Product, PT Telkom Indonesia (Persero) Tbk |
| **Versi** | 1.0 (draft) |
| **Tanggal** | 26 Agustus 2026 |
| **Status** | Draft — menunggu review Chapter Lead |
| **Terkait** | `PRD.md` (apa & mengapa) · `AGENTS.md` (aturan operasional untuk agent) · `docs/TANIA_Avatar_Addendum.md` |

> Dokumen ini menjelaskan **bagaimana** TANIA dibangun. Semua struktur di sini diverifikasi terhadap migrasi di `supabase/migrations/` — bila dokumen dan skema berbeda, skema yang benar.

---

## 1. Architecture Drivers

| # | Driver | Konsekuensi arsitektur |
|---|---|---|
| D1 | **Biaya infrastruktur Rp 0** | Free tier Supabase + Netlify; tidak boleh ada server yang harus dibayar per jam |
| D2 | **Tim pengembang sangat kecil** | Menghindari komponen yang perlu dirawat sendiri (API server, container, queue) |
| D3 | **Data sensitif lintas peran** | Otorisasi harus ditegakkan di lapisan data, bukan di aplikasi |
| D4 | **Keputusan manajemen harus bisa diaudit** | Jejak perubahan dan stempel keputusan dibuat oleh database, bukan klien |
| D5 | **Kuota free tier bersifat keras** | Deploy dan egress diperlakukan sebagai sumber daya langka |
| D6 | **Portal internal, jumlah pengguna puluhan** | Skala bukan driver; kesederhanaan lebih penting daripada elastisitas |

Driver D1–D3 saling menekan ke satu arah yang sama: **hilangkan lapisan aplikasi server, pindahkan keamanan ke database.**

---

## 2. Keputusan Arsitektur

| ID | Keputusan | Alasan | Konsekuensi / trade-off |
|---|---|---|---|
| AD-1 | **Tanpa API server sendiri.** Browser berbicara langsung ke Supabase via `supabase-js` | D1, D2 — tidak ada yang perlu di-host atau dirawat | Semua otorisasi wajib di RLS; tidak ada tempat menyembunyikan secret di sisi server (kecuali edge function) |
| AD-2 | **Next.js `output: 'export'`** — static export murni | D1 — hosting statis gratis di Netlify | Dilarang: SSR, API routes, route handlers, server actions, middleware, `next/image` loader default |
| AD-3 | **RLS PostgreSQL sebagai satu-satunya pagar keamanan** | D3 — browser memegang `anon key`, jadi klien tidak bisa dipercaya | Setiap tabel baru wajib RLS + policy eksplisit **di migrasi yang sama** |
| AD-4 | **Peran disimpan di `profiles.role`**, dibaca policy lewat `get_my_role()` (SECURITY DEFINER) | Menghindari rekursi RLS saat policy membaca tabel `profiles` sendiri | Fungsi helper harus `stable`, `set search_path`, dan dicabut aksesnya dari `anon` |
| AD-5 | **Angka turunan dihitung di database** (generated column & view), bukan di klien | D4 — konsistensi angka lintas halaman dan lintas peran | Perubahan formula = migrasi baru, tidak bisa hotfix dari frontend |
| AD-6 | **Field keputusan di-stamp trigger**, bukan dikirim klien | D3, D4 — nilai dari klien tidak dipercaya | UI tidak boleh menulis `submitted_at`, `approved_by`, `decided_by`, `decided_at` |
| AD-7 | **Skema hanya lewat file migrasi**, tidak pernah lewat dashboard | D4 — riwayat skema harus bisa direview | Migrasi yang sudah ter-apply tidak boleh diedit; perbaikan = migrasi baru |
| AD-8 | **Avatar AI di Supabase Edge Function**, bukan di browser | Melindungi API key Anthropic; menegakkan RLS lewat JWT pemanggil | Satu-satunya komponen berbiaya; satu-satunya kode yang berjalan di server |
| AD-9 | **Deploy produksi hanya dari `main`, deploy preview dimatikan** | D5 — 1 deploy = 15 dari 300 kredit/bulan | Kerja harian di `dev`; merge ke `main` maks 2–3×/minggu |

---

## 3. Konteks Sistem

```
                        ┌──────────────────────────────┐
                        │  Pengguna internal DPS       │
                        │  executive · chapter_lead    │
                        │  manager · pm · talent · admin│
                        └──────────────┬───────────────┘
                                       │ HTTPS (browser)
                                       ▼
                        ┌──────────────────────────────┐
                        │  Netlify (Free)              │
                        │  static assets: HTML/JS/CSS  │
                        └──────────────┬───────────────┘
                                       │ supabase-js + JWT user
                     ┌─────────────────┼──────────────────┐
                     ▼                 ▼                  ▼
          ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
          │ Supabase Auth    │ │ PostgREST    │ │ Supabase Storage │
          │ email+password   │ │ + PostgreSQL │ │ bucket attachments│
          │ invite-only      │ │ RLS aktif    │ │ RLS aktif        │
          └──────────────────┘ └──────┬───────┘ └──────────────────┘
                                      │
                                      │ (opsional, modul 6)
                                      ▼
                        ┌──────────────────────────────┐
                        │ Edge Function tania-assistant│──► Anthropic API
                        │ ANTHROPIC_API_KEY hanya di sini│   (Claude Haiku)
                        └──────────────────────────────┘

     GitHub Actions ──► keep-alive ping (3 hari) + db dump mingguan
```

**Batas kepercayaan.** Segala sesuatu di atas garis PostgREST berjalan di perangkat pengguna dan **tidak dipercaya**. Satu-satunya penegak aturan adalah PostgreSQL.

---

## 4. Struktur Container

| Container | Teknologi | Tanggung jawab | Tidak bertanggung jawab atas |
|---|---|---|---|
| **Web app** | Next.js App Router, TypeScript, Tailwind, shadcn/ui | Rendering, navigasi, validasi input, format tampilan, export Excel | Otorisasi, perhitungan angka turunan |
| **PostgreSQL** | Supabase Postgres | Penyimpanan, otorisasi (RLS), perhitungan turunan (view & generated column), audit, stempel keputusan | Presentasi |
| **Auth** | Supabase Auth | Identitas, sesi, JWT | Peran (peran ada di `profiles.role`) |
| **Storage** | Supabase Storage, bucket `attachments` | Lampiran dokumen, maks 10 MB/file | Validasi bisnis |
| **Edge Function** | Deno, `tania-assistant` | Orkestrasi Avatar AI + penyimpanan API key | Bypass RLS (justru sebaliknya — memakai JWT pemanggil) |
| **CI otomasi** | GitHub Actions | Keep-alive Supabase, backup mingguan | Deploy (deploy dilakukan Netlify dari `main`) |

### Struktur kode

```
src/
  app/                # halaman per modul: /login /dashboard /talent /timesheet
                      # /workload /feasibility /budget /admin
  components/         # komponen bersama (shadcn/ui di components/ui)
  lib/
    supabase.ts       # browser client bertipe (singleton)
    database.types.ts # HASIL GENERATE — jangan diedit manual
supabase/
  migrations/         # SQL append-only
  functions/
    tania-assistant/  # edge function Avatar
docs/                 # requirement, panduan, addendum
```

---

## 5. Modul Domain & Pemetaan Tabel

| Modul | Tabel utama | View / kolom turunan | Trigger khusus |
|---|---|---|---|
| **TM** Talent | `profiles`, `skills`, `profile_skills` | — | `handle_new_user()` (auto-create profil dari `auth.users`), `guard_profile_privileges()` |
| **WA** Workload | `allocations` | `utilization_monthly` | — |
| **TS** Timesheet | `timesheets` | (sumber `utilization_monthly`) | `stamp_timesheet_transitions()` |
| **PF** Feasibility | `feasibility_cases` | kolom generated `total_score` | `stamp_feasibility_decision()` |
| **BC** Budget | `budget_lines`, `budget_entries` | `budget_summary` | — |
| **XM** Lintas modul | `projects`, `activities`, `audit_log` | — | `audit_trigger()` pada 5 tabel |
| **AV** Avatar | `chat_conversations`, `chat_messages` | — | — |

**Enum domain:** `user_role`, `project_status`, `activity_category`, `timesheet_status`, `feasibility_decision`, `budget_entry_type`, `chat_role`.

**Invarian yang dijaga database:**

- `timesheets`: unik per (`profile_id`, `project_id`, `activity_id`, `work_date`); `hours` > 0 dan ≤ 24.
- `allocations`: unik per (`profile_id`, `project_id`, `period_month`); `percent` > 0 dan ≤ 150; `period_month` wajib tanggal 1.
- `budget_lines`: unik per (`fiscal_year`, `program`, `category`).
- `profile_skills`: `level` antara 1–5.
- `feasibility_cases`: setiap skor dimensi antara 0–5.

---

## 6. Alur Perhitungan

Semua angka turunan dihitung di database (AD-5). Frontend **membaca view**, tidak pernah mengagregasi ulang.

### 6.1 Utilisasi — `utilization_monthly` (WA-02)

```
kapasitas = hari_kerja(Sen–Jum dalam bulan) × 8 jam
utilisasi_% = Σ hours (status='approved') / kapasitas × 100
```

- Hanya jam **approved** yang masuk hitungan — draft/submitted/rejected diabaikan by design.
- Rentang bulan yang dihasilkan view: 1 tahun ke belakang sampai 2 tahun ke depan.
- Asumsi MVP: libur nasional belum dikecualikan (tercatat sebagai keputusan di `AGENTS.md`).
- View memakai `security_invoker = true` → RLS pemanggil tetap berlaku saat membaca view.

### 6.2 Skor kelayakan — kolom generated `total_score` (PF-02)

```
total_score = (strategic×0.25 + financial×0.25 + risk×0.20
             + resource×0.15 + technical×0.15) × 20        → 0–100
```

Karena `generated always as ... stored`, nilainya **tidak bisa ditulis klien**. Mengubah bobot berarti migrasi baru dan butuh persetujuan management.

### 6.3 Anggaran — `budget_summary` (BC-05)

```
committed = Σ amount (entry_type='commitment')
realized  = Σ amount (entry_type='realization')
remaining = plan_amount − realized
```

Nilai komitmen/realisasi **tidak pernah disimpan** di `budget_lines` — selalu diturunkan dari `budget_entries`. Ini mencegah angka basi saat entry dikoreksi.

---

## 7. Penegakan Otorisasi

### 7.1 Mekanisme

```
JWT user ──► PostgREST ──► auth.uid() ──► get_my_role() ──► policy USING/WITH CHECK
```

Dua fungsi helper, keduanya `stable` + `security definer` + `set search_path = public`, dan dicabut dari `anon`:

| Fungsi | Guna | Kenapa SECURITY DEFINER |
|---|---|---|
| `get_my_role()` | Peran pemanggil | Policy di `profiles` yang membaca `profiles` akan rekursif tanpa ini |
| `is_manager_of(target)` | Apakah pemanggil manager dari `target` | Sama — dipakai policy `timesheets` untuk approval per tim |

### 7.2 Pola policy per tabel

| Tabel | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `profiles` | semua user login | ubah baris sendiri; `guard_profile_privileges()` memblokir perubahan `role`, `is_active`, `manager_id` oleh non-admin |
| `skills`, `projects`, `activities` | semua user login | tulis: chapter_lead/admin (PM boleh ubah proyek yang dipimpinnya) |
| `allocations` | semua user login | tulis: manager/pm ke atas |
| `timesheets` | milik sendiri, tim (via `is_manager_of`), atau leads | insert/update/delete milik sendiri **hanya saat draft/rejected**; approve terpisah untuk manager/leads |
| `feasibility_cases` | semua user login (pipeline PF-05) | insert pm ke atas; ubah milik sendiri **selama `decision is null`**; keputusan hanya chapter_lead/admin |
| `budget_lines`, `budget_entries` | manager ke atas — **`talent` nol akses** | tulis: chapter_lead/admin; entry boleh dicatat pm ke atas |
| `audit_log` | admin & chapter_lead | tanpa policy INSERT — hanya ditulis `audit_trigger()` yang SECURITY DEFINER |
| `chat_conversations`, `chat_messages` | hanya milik sendiri | hanya milik sendiri — admin pun tidak bisa membaca chat orang lain (AV-05) |
| `storage.objects` (attachments) | semua user login | upload pm ke atas; hapus pemilik atau admin |

### 7.3 Field yang di-stamp server

| Trigger | Menstempel | Aturan tambahan |
|---|---|---|
| `stamp_timesheet_transitions()` | `submitted_at` saat status → `submitted`; `approved_by` saat → `approved`/`rejected` | — |
| `stamp_feasibility_decision()` | `decided_by`, `decided_at` saat `decision` diisi | **menolak** keputusan tanpa `decision_rationale` |

Frontend tidak boleh menulis field-field ini (AD-6).

### 7.4 Jejak audit

`audit_trigger()` (SECURITY DEFINER) mencatat INSERT/UPDATE/DELETE beserta `before_data`/`after_data` JSONB ke `audit_log`, terpasang pada: `profiles`, `timesheets`, `feasibility_cases`, `budget_lines`, `budget_entries`.

---

## 8. Alur Kritis

### 8.1 Approval timesheet (TS-02)

```
talent  : insert baris draft ──► update status='submitted'
          └─ trigger stamp submitted_at
manager : policy timesheets_approve_by_manager_or_leads
          update status='approved'|'rejected' (+ approval_note)
          └─ trigger stamp approved_by = auth.uid()
          └─ audit_trigger mencatat before/after
efek    : baris approved masuk ke utilization_monthly
```

### 8.2 Keputusan kelayakan (PF-04)

```
pm          : insert case (submitted_by = auth.uid(), decision null)
              edit bebas selama decision masih null
chapter_lead: update decision + decision_rationale
              └─ trigger menolak bila rationale kosong
              └─ trigger stamp decided_by + decided_at
              └─ audit_trigger mencatat perubahan
efek        : case terkunci dari edit pm (policy own_undecided gugur)
```

### 8.3 Pertanyaan ke Avatar (AV-02, AV-03)

```
browser ──(JWT user + pertanyaan)──► edge function tania-assistant
   │  membuat supabase client dengan Authorization header pemanggil
   │  Claude (Haiku) memilih tool: get_my_profile · get_my_timesheet_week
   │    get_utilization · search_talent_by_skill
   │    get_feasibility_pipeline · get_budget_summary
   │  setiap tool query berjalan DI BAWAH RLS pemanggil
   │  maks 5 putaran tool, riwayat 12 pesan terakhir
   └──► jawaban + input_tokens/output_tokens disimpan ke chat_messages
```

Konsekuensi penting: `talent` yang bertanya "berapa sisa budget?" mendapat **nol baris** dari tool — bukan karena prompt melarang, tetapi karena RLS menolak. Keamanan tidak bergantung pada instruksi model.

---

## 9. Scheduled Jobs

| Job | Jadwal | Mekanisme | Alasan |
|---|---|---|---|
| Keep-alive Supabase | tiap 3 hari | GitHub Actions → `curl` REST endpoint | Free tier auto-pause setelah 7 hari tanpa aktivitas |
| Backup database | mingguan | GitHub Actions → `supabase db dump` → artifact | Free tier tidak menyediakan backup otomatis |

---

## 10. Arsitektur Keamanan

| Lapisan | Kontrol |
|---|---|
| Identitas | Supabase Auth email+password; **self-signup dimatikan** (invite-only); profil dibuat otomatis oleh `handle_new_user()` |
| Otorisasi | RLS pada seluruh tabel; peran dari `profiles.role`; cek peran di frontend hanya kosmetik |
| Eskalasi privilege | `guard_profile_privileges()` memblokir non-admin mengubah `role`/`is_active`/`manager_id` — termasuk pada baris miliknya sendiri |
| Rahasia | Browser hanya boleh memegang `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `service_role` key tidak pernah dipakai maupun di-commit. `ANTHROPIC_API_KEY` hanya di secret edge function |
| Integritas data | Nilai keputusan di-stamp trigger; angka turunan generated/view; constraint unik & range di level tabel |
| Auditability | `audit_log` append-only lewat trigger SECURITY DEFINER; hanya leads yang bisa membaca |
| Privasi chat | `chat_*` hanya bisa dibaca pemiliknya — tidak ada jalur admin (AV-05) |
| CORS | Edge function memakai allowlist origin dari secret `ALLOWED_ORIGINS` (pencocokan persis, origin di-echo hanya bila cocok, header `Vary: Origin`). Tanpa secret: hanya `http://localhost:3000` — gagal tertutup, bukan terbuka |
| Repo publik | Repositori `tania-portal` bersifat **publik**: jangan pernah commit dump, `.env`, atau data riil; artifact backup GitHub Actions pada repo publik dapat diunduh siapa pun — lihat §15 Q3 |

---

## 11. Deployment & Environment

| Environment | Sumber | Catatan |
|---|---|---|
| Lokal | `npm run dev` | `.env.local` berisi URL + anon key; tidak pernah di-commit |
| Produksi | Netlify, build dari branch `main` | `command: npm run build`, `publish: out`; env var di-set di Netlify UI, bukan di repo |

**Disiplin kredit (AD-9).** Netlify Free = 300 kredit/bulan, 1 production deploy = 15 kredit. Deploy preview **dimatikan**. Kerja harian di `dev`, merge ke `main` maks 2–3×/minggu. Bila kredit habis, situs pause sampai awal bulan berikutnya — tidak ada tagihan, tetapi portal mati.

**Alur perubahan skema:**

```
tulis migrasi baru → supabase db push
  → supabase gen types typescript --linked > src/lib/database.types.ts
  → perbaiki semua type error → npm run build → commit
```

---

## 12. Observability

Free tier tidak menyediakan APM. Yang tersedia:

| Sinyal | Sumber |
|---|---|
| Error runtime frontend | Console browser + laporan pengguna (belum ada error tracking) |
| Query & error database | Supabase Dashboard → Logs |
| Invocation & error edge function | Supabase Dashboard → Edge Function logs |
| Biaya Avatar | `select sum(input_tokens), sum(output_tokens) from chat_messages group by bulan` (AV-06) |
| Kuota deploy | Netlify → Team → Usage (dipantau manual) |
| Perubahan data sensitif | `audit_log` |

**Diakui sebagai celah:** belum ada error tracking terpusat dan belum ada alert otomatis untuk kuota. Dipantau manual selama MVP.

---

## 13. Mode Kegagalan

| Mode | Gejala | Dampak | Penanganan |
|---|---|---|---|
| Kredit Netlify habis | Situs pause | Portal tidak bisa diakses sampai awal bulan | Disiplin merge; pantau Usage |
| Supabase auto-pause | Semua query gagal | Portal mati total | Keep-alive tiap 3 hari; restore manual dari dashboard |
| Egress 5 GB terlampaui | Query ditolak | Halaman list kosong | Semua query wajib dipaginasi; hindari `select('*')` pada `timesheets`/`audit_log` |
| Policy RLS salah tulis | Data bocor lintas peran atau user terkunci | Insiden keamanan / blokir kerja | Uji SQL per peran sebelum go-live; policy wajib satu migrasi dengan tabelnya |
| Kode server-only masuk build | `npm run build` gagal atau halaman rusak senyap | Deploy gagal / fitur mati | Wajib `npm run build` setelah tiap fitur |
| API key Anthropic bocor | Biaya tak terkendali | Tagihan | Key hanya di edge function; set spend limit di console Anthropic |
| Migrasi ter-apply diedit | Drift skema antara lokal dan produksi | Sulit dilacak | Migrasi append-only; perbaikan = migrasi baru |

---

## 14. Jalur Evolusi

| Pemicu | Perubahan arsitektur |
|---|---|
| Butuh SSO korporat | Tambah provider Azure/Entra ID di Supabase Auth (gratis di sisi Supabase; butuh app registration IT) |
| Butuh notifikasi approval | Supabase Database Webhook → edge function → email; tetap tanpa API server |
| Perhitungan makin berat | Materialized view + refresh terjadwal, bukan agregasi di klien |
| Pengguna tumbuh melewati free tier | Upgrade Supabase Pro; arsitektur tidak berubah, hanya kuota |
| Butuh logika yang tidak muat di RLS | Tambah edge function spesifik — **jangan** bangun API server monolitik |
| Libur nasional perlu dihitung | Tabel `holidays` + ubah view `utilization_monthly` lewat migrasi baru |

---

## 15. Open Architecture Questions

| # | Pertanyaan | Dampak bila salah | Dibutuhkan sebelum |
|---|---|---|---|
| Q1 | Apakah `security_invoker` pada kedua view sudah diuji per peran? | Kebocoran data lintas peran lewat view | Go-live |
| Q2 | Berapa origin produksi final yang harus masuk `ALLOWED_ORIGINS` (domain Netlify saja, atau nanti domain kustom Telkom)? | Widget Avatar gagal dengan error CORS | Aktivasi modul 6 |
| Q3 | Repo publik — apakah artifact backup GitHub Actions perlu dipindah ke repo privat atau storage terkontrol? | Dump database dapat diunduh publik | Sebelum backup pertama berjalan |
| Q4 | Perlukah rate limit per user pada edge function Avatar? | Biaya API tidak terkendali oleh satu pengguna | Aktivasi modul 6 |
| Q5 | Bagaimana strategi retensi `audit_log` dan `timesheets` terhadap kuota DB 500 MB? | Kuota habis di tahun ke-2 | Review pasca-MVP |

---

## 16. Referensi

- `PRD.md` — kebutuhan produk, requirement ID, business rules
- `AGENTS.md` — aturan stack, keamanan, dan konvensi untuk sesi development (`CLAUDE.md` hanya mengimpornya)
- `supabase/migrations/` — sumber kebenaran skema, RLS, dan trigger
- `docs/TANIA_Requirement_Document_v1.0.pdf` — dokumen requirement resmi
- `docs/TANIA_Avatar_Addendum.md` — rancangan & biaya modul Avatar
- `docs/Panduan_Development_TANIA_ClaudeCode.md` — panduan zero-cost & guardrail free tier
- `docs/README_MIGRASI.md` — prosedur apply migrasi
