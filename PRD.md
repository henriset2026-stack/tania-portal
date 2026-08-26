# PRD — TANIA (Portal Digital Product & Solution)

| | |
|---|---|
| **Produk** | TANIA — **T**alent · **A**nalytics · **I**nsight · **A**ction |
| **Pemilik** | Chapter Product & Solution (DPS), Digital Product, PT Telkom Indonesia (Persero) Tbk |
| **Versi** | 1.0 (draft) |
| **Tanggal** | 26 Agustus 2026 |
| **Status** | Draft — menunggu review Chapter Lead |
| **Referensi** | `BRD.md` (sasaran bisnis & keputusan), `docs/TANIA_Requirement_Document_v1.0.pdf` (sumber ID requirement), `SRS.md` (formalisasi & kriteria uji), `SAD.md`, `TRD.md`, `docs/TANIA_Avatar_Addendum.md`, `AGENTS.md` |

> Dokumen ini menerjemahkan Requirement Document v1.0 menjadi keputusan produk yang bisa dieksekusi. Bagian 6 (Functional Requirements) **diverifikasi langsung terhadap PDF v1.0** — seluruh 38 requirement beserta prioritasnya disalin dari Bagian 6 dokumen tersebut.
>
> Bila terjadi perbedaan **angka atau aturan implementasi**, **skema database di `supabase/migrations/` adalah sumber kebenaran**. Bila terjadi perbedaan **cakupan requirement**, Requirement Document v1.0 yang berlaku dan divergensi harus dicatat eksplisit (lihat penanda ◐ di Bagian 6).

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
- **Seluruh requirement berprioritas Should dan Could** (12 dari 38): TM-05..TM-07, WA-05, WA-06, TS-05, TS-06, PF-06, PF-07, BC-06, BC-07, XM-04.
- Pengingat otomatis timesheet (bagian dari TS-04) — bergantung pada XM-04 Notifications.
- Export PDF (bagian dari XM-03) — MVP hanya Excel.
- Burn rate & proyeksi akhir tahun (bagian dari BC-05).
- Ambang alert yang dapat dikonfigurasi (WA-03, BC-04) — MVP memakai nilai tetap.
- Libur nasional pada perhitungan kapasitas utilisasi (asumsi MVP: 8 jam × Senin–Jumat).
- SSO Azure/Entra ID (MVP: email + password, self-signup dimatikan).

### 5.3 Catatan urutan pengerjaan

Timesheet (TS) dikerjakan **sebelum** Workload (WA) karena utilisasi dihitung dari jam ber-status `approved` — tanpa data timesheet, modul WA tidak punya masukan.

---

## 6. Functional Requirements

Daftar ini disalin dari **Requirement Document v1.0 Bagian 6** (TM 7, WA 6, TS 6, PF 7, BC 7, XM 5 — total 38 requirement). Prioritas **Must / Should / Could** mengikuti dokumen tersebut.

Kolom **MVP** menyatakan cakupan rilis pertama: ✅ penuh · ◐ sebagian (lihat catatan) · ⬜ ditunda.

### TM — Talent Management

*Tujuan: satu profil talent chapter yang selalu mutakhir sebagai dasar keputusan staffing, pengembangan, dan workload.*

| ID | Requirement | Deskripsi | Prio | MVP |
|---|---|---|---|---|
| TM-01 | Talent profile | Profil per talent: identitas (sinkron dari HR/Entra ID), role, grade/level, squad, lokasi, status kepegawaian | Must | ◐ |
| TM-02 | Competency matrix | Skill & sertifikasi per talent dengan level kemahiran; dapat dicari dan difilter se-chapter | Must | ✅ |
| TM-03 | Assignment history | Riwayat penugasan proyek berjalan dan lampau beserta peran dan persentase alokasi | Must | ✅ |
| TM-04 | Talent search & staffing | Cari talent yang tersedia berdasarkan kompetensi, ketersediaan, dan peran | Must | ✅ |
| TM-05 | Development plan | Rencana pengembangan individu & target sertifikasi, dapat direview manager dan chapter lead | Should | ⬜ |
| TM-06 | Talent analytics | Tampilan level chapter: cakupan kompetensi, gap sertifikasi, komposisi bench | Should | ⬜ |
| TM-07 | HR data sync | Sinkronisasi berkala data master pegawai dari sistem HR korporat; override manual ber-audit | Should | ⬜ |

◐ **TM-01** — MVP membuat profil manual (invite-only) tanpa sinkronisasi HR/Entra ID; sinkronisasi adalah TM-07 (Should).

### WA — Workload Analysis

*Tujuan: utilisasi yang terukur dan mutakhir di level individu, squad, dan chapter, dihitung dari alokasi dan timesheet aktual.*

| ID | Requirement | Deskripsi | Prio | MVP |
|---|---|---|---|---|
| WA-01 | Allocation register | Alokasi rencana per talent per proyek per periode (persen atau jam), dikelola manager/PM | Must | ✅ |
| WA-02 | Utilization calculation | Utilisasi = jam aktual (dari timesheet) vs kapasitas tersedia per periode; perbandingan rencana vs aktual | Must | ✅ |
| WA-03 | Overload/underload alerts | Tandai talent di atas ambang yang **dapat dikonfigurasi** (mis. > 100% teralokasi) atau idle di bawah ambang | Must | ◐ |
| WA-04 | Squad & chapter heatmap | Heatmap utilisasi per squad dan peran lintas minggu/bulan | Must | ✅ |
| WA-05 | Capacity forecast | Proyeksi alokasi terkomitmen vs kapasitas 1–3 bulan ke depan untuk mendukung keputusan intake | Should | ⬜ |
| WA-06 | What-if simulation | Simulasi dampak workload bila kandidat proyek ditugaskan ke talent tertentu | Could | ⬜ |

◐ **WA-03** — ambang MVP dipatok 100% (dan idle < 50%) di aplikasi; belum ada tabel konfigurasi ambang seperti diminta dokumen.

### TS — Project Timesheet

*Tujuan: pencatatan effort aktual per proyek dan aktivitas dengan friksi rendah, sebagai tulang punggung data utilisasi dan biaya.*

| ID | Requirement | Deskripsi | Prio | MVP |
|---|---|---|---|---|
| TS-01 | Weekly timesheet entry | Talent mencatat jam per proyek dan jenis aktivitas per hari; siklus submit mingguan | Must | ✅ |
| TS-02 | Approval workflow | Manager (atau PM) mereview dan approve/reject timesheet dengan komentar; entry rejected dikembalikan untuk revisi | Must | ✅ |
| TS-03 | Project/activity master | Entry mengacu ke daftar terkendali proyek aktif dan jenis aktivitas (delivery, presales, internal, leave, training) | Must | ✅ |
| TS-04 | Reminders & compliance | Pengingat otomatis untuk timesheet yang belum disubmit; laporan compliance per squad untuk manager | Must | ◐ |
| TS-05 | Effort-to-cost view | Konversi jam approved menjadi biaya indikatif memakai standard rate per peran, memberi masukan ke tampilan biaya proyek dan anggaran | Should | ⬜ |
| TS-06 | Copy last week / templates | Isi cepat dari minggu sebelumnya atau template pribadi untuk menekan effort input | Could | ⬜ |

◐ **TS-04** — laporan compliance per squad masuk MVP; **pengingat otomatis tidak**, karena bergantung pada XM-04 (Notifications, prioritas Should). Ini satu-satunya requirement Must yang sengaja dipecah.

### PF — Project Feasibility

*Tujuan: gerbang keputusan yang terstandar dan dapat diaudit untuk menentukan proyek mana yang diambil chapter.*

| ID | Requirement | Deskripsi | Prio | MVP |
|---|---|---|---|---|
| PF-01 | Feasibility case intake | PM mengajukan kandidat proyek: deskripsi, customer/sponsor, estimasi revenue/benefit, kompetensi yang dibutuhkan, estimasi effort dan durasi | Must | ✅ |
| PF-02 | Scoring framework | Scoring **yang dapat dikonfigurasi** lintas dimensi: strategic fit, financial attractiveness, delivery risk, resource availability, technical feasibility; total skor berbobot | Must | ◐ |
| PF-03 | Resource check | Cek otomatis ke Workload Analysis: apakah kompetensi dan kapasitas yang dibutuhkan tersedia pada periode yang diminta? | Must | ✅ |
| PF-04 | Decision workflow | Review dan keputusan go/no-go/hold oleh Chapter Lead dengan rationale tercatat; jejak audit penuh atas skor dan keputusan | Must | ✅ |
| PF-05 | Pipeline dashboard | Tampilan kanban/pipeline seluruh kandidat proyek per tahap dan skor untuk review manajemen | Must | ✅ |
| PF-06 | Business case attachment | Lampirkan dokumen pendukung (proposal, cost model) ke tiap feasibility case | Should | ◐ |
| PF-07 | Post-delivery review | Bandingkan effort/biaya/hasil aktual vs estimasi feasibility untuk mengkalibrasi scoring berikutnya | Could | ⬜ |

◐ **PF-02** — dokumen meminta bobot yang dapat dikonfigurasi; implementasi MVP **mengunci** bobot 25/25/20/15/15 di generated column `total_score` demi konsistensi angka dan auditability. Perubahan bobot = migrasi baru + persetujuan management. **Divergensi sadar — perlu ditegaskan saat review.**

◐ **PF-06** — bucket `attachments` (maks 10 MB/file) beserta policy-nya sudah ada di skema; UI unggah belum masuk MVP.

### BC — Budget Control

*Tujuan: visibilitas berkelanjutan atas plan, komitmen, dan realisasi anggaran di level chapter dan proyek, selaras dengan perencanaan RKAP.*

| ID | Requirement | Deskripsi | Prio | MVP |
|---|---|---|---|---|
| BC-01 | Budget plan register | Struktur anggaran tahunan per program/proyek/kategori biaya, selaras alokasi RKAP yang disetujui | Must | ✅ |
| BC-02 | Commitment tracking | Catat komitmen belanja (feasibility case yang disetujui, PO, kontrak) terhadap budget line | Must | ✅ |
| BC-03 | Realization tracking | Catat realisasi per budget line (entry manual atau impor pada Release 1); tampilan plan vs komitmen vs realisasi | Must | ✅ |
| BC-04 | Threshold alerts | Peringatkan owner saat budget line melewati ambang **yang dapat dikonfigurasi** (mis. 80%, 100% dari plan) | Must | ◐ |
| BC-05 | Budget dashboard | Dashboard manajemen: burn rate, sisa anggaran, proyeksi sampai akhir tahun, per program dan kategori | Must | ◐ |
| BC-06 | Reallocation workflow | Ajukan dan setujui pemindahan anggaran antar line dengan jejak audit | Should | ⬜ |
| BC-07 | SAP import | Impor/rekonsiliasi berkala data realisasi dari SAP | Could | ⬜ |

◐ **BC-04** — ambang MVP dipatok 80%/100% di aplikasi; belum dapat dikonfigurasi per budget line.

◐ **BC-05** — view `budget_summary` menyediakan plan, komitmen, realisasi, dan sisa. **Burn rate dan proyeksi akhir tahun belum ada** — perlu tambahan view atau kolom periode pada `budget_entries`.

### XM — Cross-Module & Dashboard

| ID | Requirement | Deskripsi | Prio | MVP |
|---|---|---|---|---|
| XM-01 | Executive dashboard | Satu halaman utama untuk manajemen: ringkasan utilisasi, compliance timesheet, pipeline feasibility, posisi anggaran | Must | ✅ |
| XM-02 | Integrated data flow | Timesheet memberi masukan ke Workload Analysis; Workload ke resource check Feasibility; keputusan Feasibility membentuk komitmen Budget | Must | ✅ |
| XM-03 | Export & reporting | Export tabel/dashboard apa pun ke **Excel dan PDF** untuk pelaporan manajemen | Must | ◐ |
| XM-04 | Notifications | Notifikasi in-portal dan email untuk approval, pengingat, dan alert | Should | ⬜ |
| XM-05 | Audit log | Seluruh aksi create/update/approve tercatat beserta user, timestamp, dan nilai before/after | Must | ✅ |

◐ **XM-03** — MVP hanya export Excel (library `xlsx`). Export PDF belum ada; pada arsitektur static export, PDF harus dibuat di sisi browser.

**Catatan penting soal XM-05.** Di dokumen v1.0, XM-05 adalah **Audit log** — dan itulah yang dipakai di komentar skema (`-- XM-05: audit log`). Tabel fase pada `docs/Panduan_Development_TANIA_ClaudeCode.md` sempat memakai XM-05 untuk "admin master data"; itu keliru. Fungsi admin master data adalah bagian dari TS-03 (daftar terkendali proyek & aktivitas), bukan requirement XM tersendiri.

### Ringkasan cakupan MVP

| Modul | Must | Should | Could | Total | Must masuk MVP |
|---|---|---|---|---|---|
| TM | 4 | 3 | 0 | 7 | 4 (TM-01 sebagian) |
| WA | 4 | 1 | 1 | 6 | 4 (WA-03 sebagian) |
| TS | 4 | 1 | 1 | 6 | 4 (TS-04 sebagian) |
| PF | 5 | 1 | 1 | 7 | 5 (PF-02 divergen) |
| BC | 5 | 1 | 1 | 7 | 5 (BC-04, BC-05 sebagian) |
| XM | 4 | 1 | 0 | 5 | 4 (XM-03 sebagian) |
| **Total** | **26** | **8** | **4** | **38** | **26 — 8 di antaranya sebagian** |

Seluruh requirement **Must** tercakup di MVP, delapan di antaranya sebagian sebagaimana dicatat di atas. Seluruh **Should** dan **Could** ditunda ke v1.1+.

---

## 7. Business Rules & Formula

### 7.1 Utilisasi (WA-02)

```
kapasitas_bulan = jumlah_hari_kerja(Senin–Jumat) × 8 jam
utilisasi_%     = (Σ jam ber-status 'approved' / kapasitas_bulan) × 100
```

- Hanya jam **approved** yang dihitung — draft/submitted/rejected diabaikan.
- Asumsi MVP: libur nasional **belum** dikecualikan (tercatat sebagai keputusan di `AGENTS.md`).
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
| 1. Fondasi | 1 | Auth, layout, profil, master data proyek & aktivitas | TM-01, TS-03, XM-05 |
| 2. Timesheet | 2 | Entry mingguan, approval, compliance (tanpa pengingat otomatis) | TS-01, TS-02, TS-04 |
| 3. Talent & Workload | 3 | Competency matrix, riwayat penugasan, alokasi, utilisasi, heatmap | TM-02..TM-04, WA-01..WA-04 |
| 4. Feasibility & Budget | 4 | Scoring, keputusan, plan vs realisasi, alert | PF-01..PF-05, BC-01..BC-05 |
| 5. Dashboard & polish | 5 | Dashboard eksekutif, alur data terintegrasi, export Excel | XM-01, XM-02, XM-03 |
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
