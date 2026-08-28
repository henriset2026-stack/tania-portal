# UI/UX Specification — TANIA

| | |
|---|---|
| **Produk** | TANIA — Portal Digital Product & Solution |
| **Versi** | 1.0 (draft) |
| **Tanggal** | 27 Agustus 2026 |
| **Scope** | Halaman MVP (5 modul + dashboard + admin) |
| **Referensi** | `PRD.md` §8 (RBAC) · `SRS.md` (SF-1..SF-8) · `TRD.md` §7 (peta rute) · `AGENTS.md` |

---

## 1. Prinsip Desain

| # | Prinsip | Penerapan |
|---|---|---|
| 1 | **Isi timesheet mingguan ≤ 3 menit** | Grid satu layar, tanpa pindah halaman, tanpa dialog per baris. Ini guardrail metrik M1 — bila desain melanggarnya, desainnya yang salah, bukan penggunanya |
| 2 | **Talent mendapat sesuatu dari data yang ia masukkan** | Utilisasi pribadi tampil di halaman timesheet. Tanpa ini, pengisian murni beban (BRD CM-3) |
| 3 | **Setiap angka dapat ditelusuri** | Utilisasi dapat diklik sampai ke baris timesheet penyusunnya; posisi anggaran sampai ke entry-nya |
| 4 | **Asumsi perhitungan selalu terlihat** | Setiap layar utilisasi mencantumkan "kapasitas = 8 jam × Sen–Jum, libur nasional belum dikecualikan" (SRS SF-1.8) |
| 5 | **Yang tidak mengisi harus paling terlihat** | View `utilization_monthly` menghilangkan talent tanpa timesheet. UI **wajib** menambahkannya kembali sebagai 0% (SRS SF-1.5) |
| 6 | **Field tanpa hak tidak ditampilkan** | Bukan disamarkan, bukan disabled — tidak ada di DOM. `talent` tidak pernah melihat menu maupun angka anggaran |
| 7 | **Alasan diminta saat kejadian** | Dialog alasan muncul di titik aksi reject dan keputusan go/no-go, bukan sebagai form susulan |
| 8 | **Warna bukan satu-satunya penanda** | Heatmap dan status anggaran selalu disertai angka dan label teks |
| 9 | **Nol baris bukan error** | RLS mengembalikan nol baris untuk data yang tidak boleh dilihat. Tampilkan "tidak ada data yang dapat Anda lihat", bukan layar kosong atau pesan galat (TRD DA-5) |
| 10 | **Desktop dulu** | Persona utama bekerja di laptop. Responsif sampai 768 px; di bawah itu layar baca saja |

---

## 2. Kerangka Aplikasi

```text
┌───────────────────────────────────────────────────────────────────────┐
│ ▣ TANIA          Agustus 2026 ▾                    Henri (talent) ▾   │  Top bar
├───────────┬───────────────────────────────────────────────────────────┤
│           │                                                           │
│ Dashboard │                                                           │
│ Timesheet │                                                           │
│ Talent    │                   AREA KONTEN                             │
│ Workload  │                                                           │
│ Feasibility│                                                          │
│ Budget    │   ← disembunyikan untuk role talent                       │
│ ──────────│                                                           │
│ Admin     │   ← hanya admin                                           │
│           │                                                           │
└───────────┴───────────────────────────────────────────────────────────┘
   Sidebar 220px                       maks 1440px, tengah
```

Pemilih periode di top bar bersifat global untuk modul Workload dan Budget; modul Timesheet memakai pemilih minggu sendiri.

---

## 3. Navigasi per Peran

| Menu | executive | chapter_lead | manager | pm | talent | admin |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Timesheet (milik sendiri) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Timesheet › Approval | — | ✓ | ✓ | — | — | ✓ |
| Talent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workload | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Feasibility | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Budget | ✓ | ✓ | ✓ | ✓ | **—** | ✓ |
| Admin | — | — | — | — | — | ✓ |

Dashboard menampilkan kartu yang berbeda per peran; talent melihat versi ringkas berisi utilisasi dan compliance dirinya sendiri.

---

## 4. Inventaris Halaman

> Detail talent dan feasibility memakai query string (`?id=`), bukan segmen dinamis `[id]`: static export menuntut `generateStaticParams()` dan id-nya baru diketahui saat runtime.

| Rute | Tujuan | Aksi utama | Sumber data |
|---|---|---|---|
| `/login` | Masuk | Email + kata sandi | Supabase Auth |
| `/dashboard` | Ringkasan sesuai peran | Menelusuri ke modul | `utilization_monthly`, `budget_summary`, `feasibility_cases`, `timesheets` |
| `/timesheet` | Isi jam mingguan | Simpan draft → Submit | `timesheets`, `projects`, `activities` |
| `/timesheet/approval` | Antrean approval | Approve / Reject + catatan | `timesheets` status `submitted` |
| `/talent` | Direktori & competency matrix | Cari talent per skill | `profiles`, `skills`, `profile_skills` |
| `/talent/?id=` | Profil & riwayat penugasan | Ubah skill sendiri | `profile_skills`, `allocations`, `utilization_monthly` |
| `/workload` | Utilisasi & alokasi | Ubah alokasi | `allocations`, `utilization_monthly` |
| `/feasibility` | Pipeline kandidat proyek | Ajukan case | `feasibility_cases` |
| `/feasibility/[id]` | Scoring & keputusan | Isi skor; go/no-go/hold | `feasibility_cases` |
| `/budget` | Plan vs komitmen vs realisasi | Catat entry | `budget_summary`, `budget_entries` |
| `/admin` | Master data & audit | Kelola projects, activities, skills, akun | master data, `audit_log` |

---

## 5. Layar Kunci

### 5.1 Timesheet mingguan — layar terpenting

Prinsip 1 dan 2 bertemu di sini. Modul ini menentukan keberhasilan seluruh portal.

```text
Timesheet                                    ‹ Minggu 24–30 Agu 2026 ›

Utilisasi Anda bulan ini  71,4%   ████████████░░░░   120 / 168 jam
kapasitas 8 jam × Sen–Jum · libur nasional belum dikecualikan

┌────────────────────┬─────┬─────┬─────┬─────┬─────┬───────┐
│ Proyek / Aktivitas │ Sen │ Sel │ Rab │ Kam │ Jum │ Total │
├────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┤
│ P1 · Delivery      │  6  │  6  │  6  │  6  │  4  │  28   │
│ P2 · Presales      │  2  │  2  │  –  │  2  │  2  │   8   │
│ Internal           │  –  │  –  │  2  │  –  │  2  │   4   │
├────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┤
│ Total              │  8  │  8  │  8  │  8  │  8  │  40   │
└────────────────────┴─────┴─────┴─────┴─────┴─────┴───────┘
                       [+ Tambah baris]

Status: Draft · terakhir disimpan 14:32        [Simpan]  [Submit]
```

- Fokus berpindah antar sel dengan Tab dan panah; angka diketik langsung tanpa dialog.
- Total per hari berubah seketika; melebihi 24 jam ditolak sebelum kirim (SF-2.6).
- Baris `rejected` tampil merah dengan catatan penolakan di atas grid, dapat langsung diperbaiki.
- Setelah `submitted`, grid menjadi baca-saja — tombol berubah menjadi "Menunggu approval".

### 5.2 Antrean approval

```text
Approval Timesheet                Squad: Platform ▾    Minggu 24–30 Agu ▾

  Nama            Total  Delivery  Presales  Internal   Aksi
  ─────────────────────────────────────────────────────────────
  Andi              40      28         8         4      [Setujui] [Tolak]
  Budi              36      36         –         –      [Setujui] [Tolak]
  Citra             44 ⚠    40         4         –      [Setujui] [Tolak]
                    └─ melebihi 40 jam
  ─────────────────────────────────────────────────────────────
  [Setujui semua yang dipilih]                    3 menunggu

Belum submit: Dewi, Eka          ← selalu ditampilkan (prinsip 5)
```

Tombol "Tolak" membuka dialog alasan; alasan wajib diisi.

### 5.3 Workload — heatmap squad

```text
Workload                                     Periode: Agustus 2026 ▾

              Alokasi   Utilisasi
  Andi         100%      71,4%   ███████░░░  ok
  Budi         120% ⚠     95,2%   █████████░  overload (alokasi >100%)
  Citra         80%      88,1%   ████████░░  ok
  Dewi         100%       0,0%   ░░░░░░░░░░  belum ada timesheet ⚠
  ────────────────────────────────────────────────────────────
  Rata-rata squad          63,7%

  ⚠ = perlu perhatian    kapasitas 8 jam × Sen–Jum · libur nasional belum dikecualikan
```

Alokasi (rencana) dan utilisasi (aktual) selalu berdampingan dan tidak pernah saling menggantikan (SF-1.6). Dewi muncul meski view tidak memuatnya (SF-1.5).

### 5.4 Feasibility — scoring & keputusan

```text
Kandidat: Migrasi Data Warehouse Bank X            Skor  78,0 / 100

  Dimensi                    Bobot   Skor (0–5)
  ─────────────────────────────────────────────
  Strategic fit               25%    ●●●●●  5
  Financial attractiveness    25%    ●●●●○  4
  Delivery risk               20%    ●●●○○  3
  Resource availability       15%    ●●●●○  4
  Technical feasibility       15%    ●●●○○  3

  Resource check   kompetensi diminta: ETL, Data Modeling
                   ETL ≥3          4 talent tersedia   ✓
                   Data Modeling ≥3  1 talent tersedia  ⚠ tipis

  Keputusan   ( ) Go   ( ) No-Go   ( ) Hold
  Alasan      [wajib diisi ______________________________]
                                              [Simpan keputusan]
```

Skor bersifat informatif, bukan penentu (SF-3.4) — teks di bawah skor menyatakan itu secara eksplisit. Setelah keputusan tersimpan, seluruh form terkunci dan menampilkan siapa yang memutuskan beserta waktunya.

### 5.5 Budget

```text
Budget Control                                    Tahun fiskal 2026 ▾

  Program    Kategori   Plan       Komitmen   Realisasi  Sisa       Serapan
  ──────────────────────────────────────────────────────────────────────────
  Platform   Tools      100,0 jt    60,0 jt    80,0 jt   20,0 jt   80% ⚠ kuning
  Platform   Training    50,0 jt     5,0 jt    12,5 jt   37,5 jt   25%   normal
  Delivery   Subcon     200,0 jt   180,0 jt   210,0 jt  −10,0 jt  105% ⛔ merah
  ──────────────────────────────────────────────────────────────────────────

  Sisa = Plan − Realisasi. Komitmen tidak mengurangi sisa.
```

Kalimat penjelas di bawah tabel wajib ada: tanpa itu kolom Komitmen dan Sisa hampir pasti disalahartikan (SF-4.2).

### 5.6 Dashboard eksekutif

**Ringkasan Eksekutif** berada paling atas: satu paragraf kondisi chapter, pergerakan terhadap periode sebelumnya, lalu daftar "Perlu tindakan" terurut dari yang paling berkonsekuensi.

- Status **Kritis** bila ada issue kritikal melewati 3 hari, proyek critical, budget line di atas 100%, atau compliance di bawah 70%. **Perlu perhatian** bila ada overload, compliance di bawah 90%, proyek at risk, budget line di atas 80%, atau keputusan menunggu. Aturannya ditulis di layar, sehingga banner merah selalu dapat ditelusuri sebabnya.
- Perbandingan periode memakai bulan dan minggu sebelumnya — keduanya query nyata, bukan ekstrapolasi. Bila periode pembanding tidak punya data, delta ditulis **&quot;—&quot;**, bukan 0%: *tidak berubah* dan *tidak diketahui* adalah dua klaim berbeda.
- Ringkasan dihitung ulang setiap halaman dibuka dan mencantumkan waktu hitungnya.



Empat kartu, masing-masing dapat diklik menuju modulnya: **Utilisasi chapter** (rata-rata + jumlah overload), **Compliance timesheet** (persen submit minggu berjalan + daftar yang belum), **Pipeline feasibility** (jumlah per keputusan + skor tertinggi menunggu), **Posisi anggaran** (serapan + jumlah line melewati ambang).

Tidak ada kartu tanpa tautan. Angka buntu memicu pertanyaan "dari mana ini?" yang berujung kembali ke spreadsheet.

---

## 6. Pola Interaksi

### 6.1 Dialog alasan

Dipakai pada dua aksi: **Tolak timesheet** dan **Keputusan feasibility**. Tombol simpan nonaktif selama alasan kosong. Basis data juga menolak keputusan tanpa alasan (SF-3.5), jadi validasi ini mencegah pesan galat, bukan menggantikan pengaman.

### 6.2 State wajib per layar

Setiap layar data HARUS mendefinisikan lima keadaan:

| State | Tampilan |
|---|---|
| Memuat | Skeleton seukuran konten, bukan spinner di tengah layar |
| Kosong (belum ada data) | Ajakan aksi: "Belum ada entry minggu ini — mulai isi" |
| Kosong karena hak akses | "Tidak ada data yang dapat Anda lihat" — bukan galat |
| Galat | Pesan singkat + tombol coba lagi; detail teknis di console |
| Sebagian | Tabel tetap tampil; baris yang gagal dimuat ditandai |

### 6.3 Angka turunan & kesegaran

Nilai dari view (utilisasi, posisi anggaran) selalu disertai konteks perhitungannya. Untuk utilisasi: rumus kapasitas dan catatan libur nasional. Untuk anggaran: definisi Sisa.

### 6.4 Format

| Jenis | Format | Contoh |
|---|---|---|
| Uang | `Rp` + pemisah ribuan titik, ringkas di tabel | `Rp 100.000.000` · `100,0 jt` |
| Persen | satu angka desimal | `71,4%` |
| Jam | maksimal dua desimal, nol ditulis `–` | `6` · `7,5` · `–` |
| Tanggal | `d MMM yyyy` Bahasa Indonesia | `24 Agu 2026` |
| Periode bulan | `MMMM yyyy` | `Agustus 2026` |

### 6.5 Ambang & warna

| Konteks | Normal | Perhatian | Kritis |
|---|---|---|---|
| Utilisasi | 60–100% | < 60% (idle) | > 100% |
| Alokasi | ≤ 100% | — | > 100% |
| Serapan anggaran | < 80% | ≥ 80% | ≥ 100% |

Setiap tanda warna disertai simbol (`⚠`, `⛔`) dan teks. Ambang MVP bersifat tetap (DDD G-3).

---

## 7. Aksesibilitas & Responsif

| # | Ketentuan |
|---|---|
| A-1 | Kontras teks minimal 4.5:1; status tidak pernah hanya dibedakan warna |
| A-2 | Seluruh aksi dapat dijangkau keyboard; grid timesheet mendukung Tab dan panah |
| A-3 | Fokus terlihat jelas pada seluruh elemen interaktif |
| A-4 | Label form eksplisit, bukan hanya placeholder |
| A-5 | ≥ 1280 px: layout penuh. 768–1279 px: sidebar menjadi menu ringkas, tabel dapat digulir horizontal dalam wadahnya. < 768 px: layar baca saja |
| A-6 | Tabel lebar digulir di dalam wadahnya sendiri — halaman tidak pernah bergulir horizontal |

---

## 8. Komponen Bersama

| Komponen | Fungsi | Dipakai di |
|---|---|---|
| `AppShell` | Sidebar + top bar + pemilih periode | seluruh halaman |
| `DataTable` | Tabel terpaginasi + export Excel | seluruh modul daftar |
| `StateBoundary` | Membungkus lima state §6.2 | seluruh halaman data |
| `PeriodPicker` | Pemilih bulan / minggu | Timesheet, Workload, Budget |
| `UtilizationBar` | Bar + persen + catatan asumsi | Timesheet, Workload, Dashboard |
| `ReasonDialog` | Dialog alasan wajib | Approval, Feasibility |
| `ScoreInput` | Input skor 0–5 dengan bobot | Feasibility |
| `MoneyCell` | Format uang konsisten | Budget, Feasibility |
| `RoleGate` | Menyembunyikan elemen tanpa hak (kenyamanan, bukan keamanan) | sidebar, aksi |

`RoleGate` hanya mengatur tampilan. Pengaman sesungguhnya adalah RLS — halaman tetap harus menangani nol baris (prinsip 9).

---

## 9. Alur Utama

| # | Alur | Langkah |
|---|---|---|
| F-1 | Talent mengisi timesheet | `/timesheet` → isi grid → Simpan → Submit → status menunggu |
| F-2 | Manager menyetujui | `/timesheet/approval` → pilih baris → Setujui, atau Tolak + alasan |
| F-3 | Manajemen membaca utilisasi | `/dashboard` → kartu Utilisasi → `/workload` → klik orang → baris timesheet |
| F-4 | PM mengajukan proyek | `/feasibility` → Ajukan → isi intake → isi skor → menunggu keputusan |
| F-5 | Chapter lead memutuskan | `/feasibility/[id]` → baca skor & resource check → pilih keputusan + alasan |
| F-6 | Chapter lead mencatat anggaran | `/budget` → pilih line → tambah entry komitmen/realisasi |

---

## 10. Referensi

- `PRD.md` §8 — matriks RBAC dan catatan pemisahan tugas approval
- `SRS.md` — SF-1 (utilisasi), SF-2 (siklus timesheet), SF-3 (scoring), SF-4 (anggaran)
- `TRD.md` §7 — peta rute dan sumber data
- `DDD.md` §14 — celah G-3 (ambang belum dapat dikonfigurasi)
- `AGENTS.md` — aturan stack dan bahasa
