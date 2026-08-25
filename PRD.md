# PRD — TANIA (Portal Digital Product & Solution)

| | |
|---|---|
| **Produk** | TANIA — **T**alent · **A**nalytics · **I**nsight · **A**ction |
| **Pemilik** | Chapter Product & Solution (DPS), Digital Product, PT Telkom Indonesia (Persero) Tbk |
| **Versi** | 1.0 (draft) |
| **Tanggal** | 26 Agustus 2026 |
| **Status** | Draft — menunggu review Chapter Lead |
| **Referensi** | `docs/TANIA_Requirement_Document_v1.0.pdf` (sumber ID requirement), `docs/TANIA_Avatar_Addendum.md`, `CLAUDE.md` |

> Dokumen ini menerjemahkan Requirement Document v1.0 menjadi keputusan produk yang bisa dieksekusi. Bila terjadi perbedaan angka atau aturan, **skema database di `supabase/migrations/` adalah sumber kebenaran** — dokumen ini mengikuti, bukan sebaliknya.

---

## 1. Latar Belakang & Problem Statement

Chapter Product & Solution mengelola puluhan talent lintas squad dan sejumlah proyek delivery serta presales secara paralel. Hari ini data pendukung keputusan tersebar: profil kompetensi ada di spreadsheet personal, alokasi orang disepakati lewat chat, jam kerja dilaporkan tidak seragam, kelayakan proyek diputuskan tanpa jejak tertulis, dan posisi anggaran baru diketahui saat rekonsiliasi akhir bulan.

Akibatnya muncul empat masalah berulang:

| # | Masalah | Dampak |
|---|---|---|
| P1 | Tidak ada gambaran utilisasi yang tepercaya | Overload tidak terdeteksi sampai orang mengeluh; idle capacity tidak termanfaatkan |
| P2 | Kompetensi talent tidak terdata terstruktur | Staffing proyek baru mengandalkan ingatan, bukan data |
| P3 | Keputusan go/no-go proyek tidak terstandar dan tidak terekam | Sulit diaudit, sulit dibandingkan antar kandidat proyek |
| P4 | Posisi anggaran chapter tidak real-time | Komitmen melampaui plan baru ketahuan terlambat |

**Problem statement.** Manajemen chapter membutuhkan satu sumber data tunggal yang menghubungkan *siapa mengerjakan apa*, *berapa jam*, *proyek mana yang layak diambil*, dan *berapa anggaran tersisa* — tersedia tanpa menunggu rekap manual dan tanpa biaya infrastruktur baru.

---

## 2. Objective & Success Metrics

**Objective.** Menyediakan portal internal berbasis data untuk mendukung keputusan manajemen chapter pada lima domain: talent, workload, timesheet, kelayakan proyek, dan anggaran.

| # | Success Metric | Baseline | Target (3 bulan pasca go-live) |
|---|---|---|---|
| M1 | Compliance pengisian timesheet mingguan | belum terukur | ≥ 90% talent aktif per minggu |
| M2 | Waktu menyusun rekap utilisasi bulanan | ± 2 hari kerja manual | < 5 menit (dashboard) |
| M3 | Kandidat proyek yang diputuskan lewat scoring terekam | 0% | 100% kasus baru |
| M4 | Selisih posisi anggaran portal vs pembukuan | belum terukur | ≤ 5% pada review bulanan |
| M5 | Profil talent dengan competency matrix terisi | 0% | ≥ 95% talent aktif |
| M6 | Biaya infrastruktur MVP | — | Rp 0 (free tier Supabase + Netlify) |

**Definisi selesai MVP.** Lima modul berfungsi end-to-end dengan data riil satu bulan berjalan, RLS terbukti menutup akses lintas peran, dan `npm run build` menghasilkan static export tanpa error.

---

## 3. Positioning & Non-Goals

**Positioning.** TANIA adalah *decision support portal* untuk internal chapter — bukan aplikasi HR resmi, bukan sistem keuangan korporat, dan bukan pengganti tools delivery yang sudah dipakai squad.

**Non-goals (di luar scope, MVP maupun v1.x):**

| # | Bukan bagian dari TANIA | Alasan |
|---|---|---|
| N1 | Payroll, absensi resmi, cuti resmi | Domain HR korporat; timesheet TANIA murni untuk analitik utilisasi |
| N2 | Sistem akuntansi / jurnal keuangan | Angka anggaran di TANIA bersifat kontrol manajerial, bukan pembukuan |
| N3 | Manajemen tugas harian (task/board delivery) | Squad sudah memakai tools masing-masing |
| N4 | Portal eksternal untuk customer | Portal internal, invite-only |
| N5 | Mobile native app | Web responsif dianggap cukup untuk MVP |
| N6 | Integrasi otomatis ke sistem korporat (SSO, ERP) | Butuh app registration & approval IT; direncanakan pasca-MVP |

---

## 4. Persona & Primary Job

| Peran (`profiles.role`) | Persona | Primary job |
|---|---|---|
| `executive` | VP / GM Digital Product | "Tunjukkan kondisi chapter dalam satu layar: utilisasi, compliance, pipeline, anggaran." |
| `chapter_lead` | Chapter Lead Product & Solution | "Putuskan proyek mana yang diambil dan pastikan anggaran tidak jebol." |
| `manager` | Manager / Squad Lead | "Setujui timesheet tim saya dan cegah anggota saya overload." |
| `pm` | Project Manager | "Ajukan kandidat proyek dengan angka yang bisa dipertanggungjawabkan." |
| `talent` | Engineer / Designer / Analyst | "Isi timesheet mingguan dengan cepat dan jaga profil kompetensi saya tetap akurat." |
| `admin` | Admin portal | "Kelola master data dan akun pengguna." |

---

## 5. Scope MVP

### 5.1 In scope

Lima modul inti (TM, WA, TS, PF, BC) plus fungsi lintas modul (XM): auth berbasis peran, dashboard eksekutif, dan export Excel.

### 5.2 Out of scope MVP (kandidat v1.1)

- **Modul 6 — Avatar AI (AV-01..AV-07)**: sudah dirancang di `docs/TANIA_Avatar_Addendum.md` dan migrasinya sudah disiapkan, tetapi **menunggu persetujuan management** karena satu-satunya komponen berbiaya (Anthropic API). Lihat §9.
- Libur nasional pada perhitungan kapasitas utilisasi (asumsi MVP: 8 jam × Senin–Jumat).
- Notifikasi email/push untuk approval dan alert.
- SSO Azure/Entra ID (MVP: email + password, self-signup dimatikan).

### 5.3 Catatan urutan pengerjaan

Timesheet (TS) dikerjakan **sebelum** Workload (WA) karena utilisasi dihitung dari jam ber-status `approved` — tanpa data timesheet, modul WA tidak punya masukan.

---

## 6. Functional Requirements

Prioritas: **M** = Must (wajib MVP), **S** = Should (MVP bila waktu cukup), **C** = Could (pasca-MVP).

### TM — Talent Management

| ID | Requirement | Deskripsi | Prio |
|---|---|---|---|
| TM-01 | Profil talent | Data diri, squad, grade, lokasi, manager, status aktif. Profil dibuat otomatis saat user dibuat di Supabase Auth | M |
| TM-02 | Competency matrix | Skill per talent dengan level 1–5 dan penanda sertifikasi | M |
| TM-03 | Riwayat penugasan | Daftar proyek yang pernah/sedang dikerjakan, diturunkan dari alokasi & timesheet | S |
| TM-04 | Pencarian staffing | Cari talent berdasarkan kombinasi skill + level minimum + ketersediaan | M |

### WA — Workload Analysis

| ID | Requirement | Deskripsi | Prio |
|---|---|---|---|
| WA-01 | Registrasi alokasi | Alokasi persen per talent per proyek per bulan (maks 150%) | M |
| WA-02 | Utilisasi aktual | Jam approved vs kapasitas bulanan, per orang dan per squad — sumber: view `utilization_monthly` | M |
| WA-03 | Alert overload | Tanda peringatan saat alokasi atau utilisasi > 100% | M |
| WA-04 | Heatmap squad | Visual utilisasi per squad per bulan | S |

### TS — Project Timesheet

| ID | Requirement | Deskripsi | Prio |
|---|---|---|---|
| TS-01 | Entry mingguan | Grid hari × proyek/aktivitas; simpan draft; maks 24 jam per baris; satu baris unik per (talent, proyek, aktivitas, tanggal) | M |
| TS-02 | Workflow approval | Submit → approve/reject oleh manager dengan catatan; baris rejected bisa diperbaiki talent | M |
| TS-03 | Kategori aktivitas | delivery / presales / internal / leave / training, dengan penanda billable | M |
| TS-04 | Indikator compliance | Persentase pengisian per squad per minggu | M |

### PF — Project Feasibility

| ID | Requirement | Deskripsi | Prio |
|---|---|---|---|
| PF-01 | Intake kandidat proyek | Judul, customer, estimasi revenue, effort (man-days), durasi, kompetensi yang dibutuhkan | M |
| PF-02 | Scoring berbobot | Lima dimensi, skor 0–5, bobot tetap (lihat §7.2) | M |
| PF-03 | Resource check | Cek ketersediaan kompetensi yang dibutuhkan terhadap data alokasi & competency matrix | M |
| PF-04 | Workflow keputusan | `go` / `no_go` / `hold` oleh chapter_lead dengan rationale wajib dan jejak audit | M |
| PF-05 | Pipeline kanban | Papan kandidat proyek per status keputusan | S |

### BC — Budget Control

| ID | Requirement | Deskripsi | Prio |
|---|---|---|---|
| BC-01 | Budget line | Plan anggaran per fiscal year × program × kategori (unik) | M |
| BC-02 | Pencatatan komitmen | Entry bertipe `commitment`, opsional tertaut ke feasibility case | M |
| BC-03 | Pencatatan realisasi | Entry bertipe `realization` | M |
| BC-04 | Alert threshold | Peringatan saat serapan mencapai 80% dan 100% dari plan | M |
| BC-05 | Ringkasan plan vs komitmen vs realisasi | Sumber: view `budget_summary` | M |

### XM — Cross-module

| ID | Requirement | Deskripsi | Prio |
|---|---|---|---|
| XM-01 | Dashboard eksekutif | Ringkasan utilisasi, compliance timesheet, pipeline feasibility, posisi anggaran | M |
| XM-03 | Export Excel | Export pada setiap tabel utama (library `xlsx`, dynamic import) | S |
| XM-05 | Admin master data | Kelola projects, activities, skills, dan akun pengguna | M |
| XM-06 ⚠️ | Audit trail | Perubahan tercatat di `audit_log`; hanya admin & chapter_lead yang bisa membaca | M |
| XM-07 ⚠️ | Lampiran | Upload dokumen pendukung ke bucket `attachments`, maks 10 MB per file | C |

⚠️ **XM-06 dan XM-07 adalah usulan ID baru** — keduanya sudah ada di skema database (`audit_log`, bucket `attachments`) tetapi belum tercantum di Requirement Document v1.0. Perlu dikonfirmasi saat review, atau dimasukkan sebagai tambahan di v1.1.

---

## 7. Business Rules & Formula

### 7.1 Utilisasi (WA-02)

```
kapasitas_bulan = jumlah_hari_kerja(Senin–Jumat) × 8 jam
utilisasi_%     = (Σ jam ber-status 'approved' / kapasitas_bulan) × 100
```

- Hanya jam **approved** yang dihitung — draft/submitted/rejected diabaikan.
- Asumsi MVP: libur nasional **belum** dikecualikan (tercatat sebagai keputusan di `CLAUDE.md`).
- Alokasi (rencana) dan utilisasi (aktual) adalah dua angka berbeda dan ditampilkan berdampingan, tidak saling menggantikan.

### 7.2 Scoring kelayakan proyek (PF-02)

| Dimensi | Bobot | Skala |
|---|---|---|
| Strategic fit | 25% | 0–5 |
| Financial | 25% | 0–5 |
| Delivery risk | 20% | 0–5 |
| Resource availability | 15% | 0–5 |
| Technical | 15% | 0–5 |

```
total_score = (strategic×0.25 + financial×0.25 + risk×0.20
             + resource×0.15 + technical×0.15) × 20      → skala 0–100
```

- `total_score` adalah **generated column** di database — tidak pernah dihitung atau ditulis dari frontend.
- Skor bukan keputusan otomatis: `decision` tetap dibuat manusia (chapter_lead) dan wajib disertai `decision_rationale`.
- **Mengubah bobot = migrasi baru + persetujuan management.** Tidak boleh diubah sepihak dalam sesi development.

### 7.3 Anggaran (BC-04, BC-05)

```
committed_amount = Σ entries bertipe 'commitment'
realized_amount  = Σ entries bertipe 'realization'
remaining_amount = plan_amount − realized_amount
serapan_%        = realized_amount / plan_amount × 100
```

- Nilai komitmen dan realisasi **tidak pernah disimpan** di `budget_lines` — selalu diturunkan dari `budget_entries` lewat view `budget_summary`.
- Alert: kuning pada serapan ≥ 80%, merah pada ≥ 100%.

### 7.4 Field yang di-stamp sistem

`submitted_at`, `approved_by`, `decided_by`, `decided_at` di-stamp oleh trigger database dan **tidak boleh** ditulis dari frontend — nilai dari klien tidak dipercaya.

---

## 8. RBAC Matrix

Peran disimpan di `profiles.role` dan ditegakkan oleh **RLS PostgreSQL** melalui `get_my_role()`. Pengecekan peran di frontend hanya untuk kenyamanan tampilan, bukan pengaman.

| Data | executive | chapter_lead | manager | pm | talent | admin |
|---|---|---|---|---|---|---|
| Profil & competency matrix | baca | baca | baca | baca | baca semua, ubah milik sendiri | penuh |
| Master data (projects, activities, skills) | baca | kelola | baca | ubah proyek yang dipimpin | baca | penuh |
| Alokasi (WA) | baca | kelola | kelola tim | kelola proyeknya | baca | penuh |
| Timesheet — miliknya | — | — | — | — | CRUD saat draft/rejected | — |
| Timesheet — tim | baca semua | baca semua | baca + approve tim | — | — | penuh |
| Feasibility case | baca | baca + **decision** | baca | buat & ubah miliknya selama belum diputuskan | baca | penuh |
| Budget (lines & entries) | baca | kelola | baca | catat entry | **tidak ada akses** | penuh |
| Audit log | — | baca | — | — | — | baca |

---

## 9. Modul 6 — Avatar AI (menunggu persetujuan)

Asisten percakapan yang menjawab pertanyaan manajemen dari data live lima modul (AV-01..AV-07). Sudah tersedia di repo: migrasi `20260826000001_avatar_chat.sql` dan edge function `supabase/functions/tania-assistant/`.

Prinsip yang tidak bisa ditawar:

- **AV-03** — bot hanya membaca data yang boleh dibaca si penanya. Ditegakkan RLS memakai JWT user, **bukan** lewat instruksi prompt.
- **AV-04** — read-only. Untuk aksi, bot mengarahkan ke halaman modul.
- **AV-05** — riwayat percakapan privat per user; admin pun tidak bisa membaca chat orang lain.
- **AV-06** — token usage dicatat per pesan untuk memantau biaya.
- API key Anthropic hanya ada di edge function, tidak pernah di browser.

**Keputusan yang dibutuhkan:** ini satu-satunya komponen yang membuat biaya tidak lagi Rp 0. Perlu persetujuan management atas plafon biaya bulanan sebelum diaktifkan di produksi.

---

## 10. Batasan Teknis & Non-Functional

| Aspek | Ketentuan |
|---|---|
| Arsitektur | Next.js static export → Netlify; frontend berbicara langsung ke Supabase. Tanpa API server sendiri |
| Keamanan | RLS adalah satu-satunya pagar keamanan; setiap tabel baru wajib RLS + policy eksplisit di migrasi yang sama |
| Auth | Email + password, **invite-only** (self-signup dimatikan) |
| Bahasa | UI Bahasa Indonesia; kode, komentar, dan commit message dalam Bahasa Inggris |
| Performa | Semua list query dipaginasi (`.range()`); library berat (chart, xlsx) via dynamic import |
| Kuota Supabase Free | Egress 5 GB/bulan; auto-pause setelah 7 hari tanpa aktivitas → keep-alive ping tiap 3 hari via GitHub Actions |
| Kuota Netlify Free | 300 kredit/bulan, 1 production deploy = 15 kredit → deploy hanya dari `main`, maks 2–3×/minggu, deploy preview dimatikan |
| Backup | `supabase db dump` mingguan via GitHub Actions (free tier tidak menyediakan backup otomatis) |
| Browser | Chrome/Edge versi terkini, layar ≥ 1280px; responsif hingga tablet |
| Kepemilikan data | Internal Telkom Group, tidak untuk distribusi eksternal |

---

## 11. Rencana Rilis

| Fase | Minggu | Scope | Requirement |
|---|---|---|---|
| 1. Fondasi | 1 | Auth, layout, profil, admin master data | TM-01, XM-05 |
| 2. Timesheet | 2 | Entry mingguan, approval, compliance | TS-01..TS-04 |
| 3. Talent & Workload | 3 | Competency matrix, alokasi, utilisasi, heatmap | TM-02..TM-04, WA-01..WA-04 |
| 4. Feasibility & Budget | 4 | Scoring, keputusan, plan vs realisasi, alert | PF-01..PF-05, BC-01..BC-05 |
| 5. Dashboard & polish | 5 | Dashboard eksekutif, export Excel | XM-01, XM-03 |
| 6. UAT & Go-live | 6 | Uji peran, data riil satu bulan, go-live | — |

---

## 12. Risiko & Mitigasi

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | Adopsi timesheet rendah | Utilisasi tidak tepercaya; M1–M2 gagal | Entry mingguan dibuat cepat (grid, bukan form per baris); indikator compliance per squad terlihat manajer |
| R2 | Salah konfigurasi RLS membocorkan data lintas peran | Insiden keamanan | Policy wajib satu migrasi dengan tabelnya; uji SQL per peran sebelum go-live |
| R3 | Kredit Netlify habis di tengah bulan | Portal mati sampai awal bulan | Deploy hanya dari `main`, maks 2–3×/minggu; pantau Team → Usage |
| R4 | Supabase auto-pause karena sepi | Portal tidak bisa diakses | Keep-alive ping tiap 3 hari |
| R5 | Angka anggaran berbeda dengan pembukuan resmi | Kepercayaan manajemen turun | Posisi TANIA sebagai kontrol manajerial (N2) dinyatakan eksplisit di UI; rekonsiliasi bulanan |
| R6 | Bobot scoring dipersepsikan sepihak | Keputusan go/no-go dipertanyakan | Bobot disetujui management, terkunci di migrasi, perubahan butuh approval |
| R7 | Biaya API Avatar tidak terkendali | Anggaran terlampaui | Token usage tercatat per pesan (AV-06); aktivasi menunggu plafon disetujui |

---

## 13. Open Questions

| # | Pertanyaan | Pemilik keputusan | Dibutuhkan sebelum |
|---|---|---|---|
| Q1 | Apakah libur nasional perlu dikecualikan dari kapasitas utilisasi sejak MVP? | Chapter Lead | Fase 3 |
| Q2 | Berapa plafon biaya bulanan Anthropic API untuk modul Avatar? | Management | Aktivasi modul 6 |
| Q3 | Apakah bobot scoring PF-02 (25/25/20/15/15) sudah final? | Chapter Lead | Fase 4 |
| Q4 | Siapa pemilik data anggaran (`budget_lines.owner_id`) per program? | Chapter Lead | Fase 4 |
| Q5 | Kapan SSO Entra ID diajukan ke IT korporat? | Chapter Lead | Pasca-MVP |
