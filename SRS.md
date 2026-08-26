# SRS — Software Requirements Specification

| | |
|---|---|
| **Dokumen** | Software Requirements Specification (Spesifikasi Kebutuhan Perangkat Lunak) |
| **Produk** | TANIA — Portal Digital Product & Solution |
| **Pemilik** | Chapter Product & Solution (DPS), Digital Product, PT Telkom Indonesia (Persero) Tbk |
| **Versi** | 1.0 (draft) |
| **Tanggal** | 26 Agustus 2026 |
| **Acuan format** | IEEE 830, disesuaikan |
| **Audiens** | Tim pengembang, QA, IT Governance, reviewer manajemen |

---

## 1. Pendahuluan

### 1.1 Tujuan

Dokumen ini menyatakan kebutuhan perangkat lunak TANIA MVP secara **formal dan dapat diuji**, serta menyediakan matriks keterlacakan (§7) dari sasaran bisnis sampai kriteria verifikasi.

### 1.2 Hubungan dengan dokumen lain

| Dokumen | Sifat terhadap SRS |
|---|---|
| `BRD.md` | Sumber sasaran bisnis (BO-x) dan keputusan yang diminta |
| `docs/TANIA_Requirement_Document_v1.0.pdf` | Sumber requirement resmi (TM/WA/TS/PF/BC/XM) |
| `PRD.md` | **Normatif** untuk daftar requirement, prioritas, cakupan MVP, dan formula bisnis (§6–§7). SRS tidak menyalinnya |
| `SAD.md` | Realisasi arsitektural; keputusan AD-1..AD-11 |
| `AGENTS.md` | Aturan operasional pengembangan |
| `supabase/migrations/` | Realisasi kebutuhan data dan otorisasi |

> **Prinsip anti-duplikasi.** Bila SRS dan PRD berbeda mengenai **isi** sebuah requirement, PRD yang berlaku. SRS menambahkan formalitas, kasus batas, dan kriteria verifikasi — bukan sumber kebenaran kedua. Requirement yang disalin ke dua tempat akan berbeda dalam beberapa minggu dan tidak ada yang tahu mana yang benar.
>
> Bila SRS dan **skema database** berbeda mengenai perilaku teknis, skema yang berlaku dan SRS harus dikoreksi.

### 1.3 Definisi

| Istilah | Arti |
|---|---|
| **Kapasitas** | Jam kerja tersedia seorang talent dalam satu bulan: hari kerja Senin–Jumat × 8 jam |
| **Utilisasi** | Jam timesheet berstatus `approved` dibagi kapasitas, dalam persen |
| **Alokasi** | Rencana penugasan (persen) per talent per proyek per bulan — berbeda dari utilisasi (aktual) |
| **Komitmen** | Belanja yang sudah diikat (feasibility case disetujui, PO, kontrak) tetapi belum terealisasi |
| **Realisasi** | Belanja yang sudah benar-benar terjadi |
| **Budget line** | Satu baris anggaran unik per (tahun fiskal, program, kategori) |
| **Feasibility case** | Kandidat proyek yang diajukan untuk keputusan go/no-go/hold |
| **RLS** | Row Level Security PostgreSQL — satu-satunya pagar otorisasi (SAD AD-3) |

### 1.4 Kata kunci normatif

**HARUS** = wajib, diverifikasi sebelum go-live. **SEBAIKNYA** = direkomendasikan, penyimpangan harus beralasan. **DAPAT** = opsional.

---

## 2. Deskripsi Umum

### 2.1 Perspektif produk

TANIA adalah aplikasi web statis yang berbicara langsung ke Supabase tanpa server aplikasi perantara. Konsekuensi yang mengikat seluruh dokumen ini: **browser tidak dipercaya**, dan setiap aturan yang benar-benar harus ditegakkan HARUS ditegakkan di basis data.

### 2.2 Karakteristik pengguna

| Peran | Jumlah perkiraan | Frekuensi pakai | Kompetensi teknis |
|---|---|---|---|
| `talent` | puluhan | mingguan (timesheet) | umum |
| `manager` | beberapa | mingguan (approval) | umum |
| `pm` | beberapa | mingguan–bulanan | umum |
| `chapter_lead` | 1–2 | mingguan | umum |
| `executive` | 1–2 | bulanan | umum |
| `admin` | 1–2 | sesuai kebutuhan | mahir |

### 2.3 Batasan

| ID | Batasan |
|---|---|
| C-1 | Frontend HARUS berupa static export Next.js; SSR, API route, route handler, server action, dan middleware DILARANG |
| C-2 | Tidak boleh ada lapisan API buatan sendiri; seluruh akses data lewat `supabase-js` |
| C-3 | Biaya infrastruktur MVP HARUS Rp 0 (free tier Supabase + Netlify); Avatar adalah satu-satunya komponen berbayar dan berada di luar MVP |
| C-4 | Bahasa antarmuka HARUS Bahasa Indonesia; kode, komentar, dan commit message dalam Bahasa Inggris |
| C-5 | Autentikasi HARUS invite-only; self-signup dimatikan |
| C-6 | Repositori bersifat publik; data riil, dump, dan berkas `.env` TIDAK BOLEH di-commit |

### 2.4 Asumsi & ketergantungan

| ID | Asumsi |
|---|---|
| A-1 | Kapasitas MVP = 8 jam × Senin–Jumat; **libur nasional belum dikecualikan** |
| A-2 | Data master pegawai dimasukkan manual; sinkronisasi HR (TM-07) di luar MVP |
| A-3 | Angka anggaran bersifat kontrol manajerial, bukan pembukuan resmi; rekonsiliasi bulanan tetap dilakukan |
| A-4 | Jumlah pengguna puluhan, bukan ribuan — skala bukan pendorong rancangan |
| A-5 | Supabase dan Netlify free tier tersedia dengan kuota sebagaimana diverifikasi Agustus 2026 |

---

## 3. Kebutuhan Antarmuka Eksternal

| Antarmuka | Arah | Protokol | Kebutuhan |
|---|---|---|---|
| Supabase PostgREST | keluar | HTTPS + JWT | Seluruh operasi data; setiap query HARUS dipaginasi |
| Supabase Auth | keluar | HTTPS | Email + password; self-signup mati |
| Supabase Storage | keluar | HTTPS + JWT | Bucket `attachments`, maks 10 MB per berkas |
| Supabase Edge Function `tania-assistant` | keluar | HTTPS + JWT | Hanya untuk Avatar; asal browser dibatasi allowlist `ALLOWED_ORIGINS` |
| Anthropic Messages API | keluar (dari edge function) | HTTPS | Kunci API HANYA di edge function |
| GitHub Actions | terjadwal | HTTPS | Keep-alive tiap 3 hari; backup mingguan terenkripsi |
| Netlify | build & hosting | — | Build dari `main` saja; deploy preview mati |

---

## 4. Kebutuhan Fungsional Formal

Daftar lengkap requirement ada di `PRD.md` §6. Bagian ini memformalkan **perilaku yang kompleks, ambigu, atau berisiko salah implementasi** — yaitu bagian yang bila keliru menghasilkan **laporan yang salah, bukan pesan error**.

### SF-1 — Perhitungan Utilisasi

| | |
|---|---|
| **Sumber** | WA-02, WA-03; formula PRD §7.1 |
| **Realisasi** | View `utilization_monthly` |
| **Pemicu** | Pembacaan halaman Workload dan Dashboard |

**Perilaku:**

- SF-1.1 — Sistem HARUS menghitung `capacity_hours` = jumlah hari Senin–Jumat dalam bulan tersebut × 8.
- SF-1.2 — Sistem HARUS menjumlahkan **hanya** jam ber-status `approved`. Baris `draft`, `submitted`, dan `rejected` TIDAK BOLEH ikut dihitung.
- SF-1.3 — Sistem HARUS menghitung `utilization_pct` = `approved_hours` ÷ `capacity_hours` × 100, dibulatkan ke 1 angka desimal.
- SF-1.4 — Bila `capacity_hours` = 0, sistem HARUS menghasilkan NULL **tanpa** kesalahan pembagian nol.
- SF-1.5 — Talent yang **tidak memiliki satu pun baris timesheet** pada suatu bulan tidak muncul di view. Antarmuka HARUS menampilkannya sebagai utilisasi 0%, bukan menghilangkannya dari daftar. *(Kegagalan memenuhi butir ini menyembunyikan justru orang yang paling perlu terlihat: yang tidak mengisi timesheet sama sekali.)*
- SF-1.6 — Alokasi (rencana) dan utilisasi (aktual) HARUS ditampilkan sebagai dua angka terpisah; salah satunya TIDAK BOLEH dipakai menggantikan yang lain.
- SF-1.7 — Perhitungan HARUS idempoten: pembacaan berulang atas data yang sama menghasilkan nilai identik.
- SF-1.8 — Antarmuka HARUS menyatakan asumsi A-1 (libur nasional belum dikecualikan) pada setiap tampilan utilisasi.

**Verifikasi:** bulan dengan 22 hari kerja → kapasitas 176 jam; 132 jam approved → 75,0%. Kasus batas SF-1.4 dan SF-1.5 diuji terpisah.

### SF-2 — Siklus Hidup Timesheet

| | |
|---|---|
| **Sumber** | TS-01, TS-02 |
| **Realisasi** | Tabel `timesheets`, policy RLS, trigger `stamp_timesheet_transitions()` |

**Transisi status yang sah:**

```
draft ──submit──► submitted ──approve──► approved
  ▲                    │
  │                    └──reject──► rejected ──submit──► submitted
  └──(edit oleh pemilik)───────────────────┘
```

- SF-2.1 — Pemilik baris HARUS dapat membuat, mengubah, dan menghapus barisnya sendiri **hanya** selama status `draft` atau `rejected`.
- SF-2.2 — Pemilik HARUS dapat mengubah status barisnya sendiri **hanya** menjadi `draft` atau `submitted`. Pemilik TIDAK BOLEH dapat menetapkan `approved` atau `rejected` atas barisnya sendiri.
- SF-2.3 — Hanya manager dari pemilik baris, `chapter_lead`, atau `admin` yang HARUS dapat mengubah status dari `submitted` menjadi `approved` atau `rejected`.
- SF-2.4 — `submitted_at` HARUS distempel server saat transisi ke `submitted`; `approved_by` HARUS distempel server saat transisi ke `approved` atau `rejected`. Nilai dari klien atas kedua kolom ini TIDAK BOLEH dipercaya.
- SF-2.5 — Satu baris timesheet HARUS unik per kombinasi (talent, proyek, aktivitas, tanggal).
- SF-2.6 — `hours` HARUS lebih besar dari 0 dan tidak lebih dari 24.
- SF-2.7 — Penolakan HARUS menyertakan `approval_note` agar pemilik mengetahui alasan revisi.
- SF-2.8 — Sistem HARUS mencegah seseorang menyetujui timesheet miliknya sendiri. **Lihat DR-9** — pemisahan tugas ini belum sepenuhnya terjamin oleh skema saat ini.

**Verifikasi:** untuk tiap peran, satu skenario ALLOW dan satu DENY per transisi. Uji khusus: `talent` mencoba `update ... set status='approved'` atas barisnya sendiri HARUS ditolak oleh basis data, bukan oleh frontend.

### SF-3 — Scoring & Gerbang Keputusan Feasibility

| | |
|---|---|
| **Sumber** | PF-02, PF-04 |
| **Realisasi** | Generated column `total_score`, trigger `stamp_feasibility_decision()` |

- SF-3.1 — Setiap skor dimensi HARUS bilangan bulat 0–5.
- SF-3.2 — `total_score` HARUS dihitung basis data sebagai (strategic×0,25 + financial×0,25 + risk×0,20 + resource×0,15 + technical×0,15) × 20, menghasilkan skala 0–100. Nilai ini TIDAK BOLEH dihitung atau dikirim frontend.
- SF-3.3 — Dimensi yang belum diisi HARUS diperlakukan sebagai 0, bukan membatalkan perhitungan.
- SF-3.4 — Skor TIDAK BOLEH menentukan keputusan secara otomatis. `decision` HARUS ditetapkan manusia (`chapter_lead` atau `admin`).
- SF-3.5 — Keputusan HARUS ditolak bila `decision_rationale` kosong.
- SF-3.6 — `decided_by` dan `decided_at` HARUS distempel server pada saat keputusan dicatat.
- SF-3.7 — Setelah `decision` terisi, pengaju TIDAK BOLEH lagi mengubah case tersebut.
- SF-3.8 — Perubahan bobot HARUS lewat migrasi baru dan persetujuan management; bobot TIDAK BOLEH dapat diubah dari antarmuka. *(Divergensi sadar terhadap PF-02 yang meminta bobot configurable — lihat PRD §6.)*

**Verifikasi:** skor 5/4/3/4/3 → (1,25+1,00+0,60+0,60+0,45)×20 = 78,0. Keputusan tanpa rationale HARUS gagal di tingkat basis data.

### SF-4 — Agregasi Anggaran & Ambang Peringatan

| | |
|---|---|
| **Sumber** | BC-02, BC-03, BC-04, BC-05 |
| **Realisasi** | View `budget_summary` |

- SF-4.1 — `committed_amount` dan `realized_amount` HARUS diturunkan dari `budget_entries`; keduanya TIDAK BOLEH disimpan pada `budget_lines`.
- SF-4.2 — `remaining_amount` HARUS = `plan_amount` − `realized_amount`. Komitmen TIDAK mengurangi sisa anggaran; antarmuka HARUS menyajikan komitmen sebagai kolom tersendiri agar tidak disalahartikan.
- SF-4.3 — `amount` pada `budget_entries` HARUS bukan nol dan DAPAT bernilai negatif; entry negatif adalah mekanisme koreksi. Agregasi HARUS menjumlahkannya apa adanya.
- SF-4.4 — Peringatan HARUS muncul saat serapan (`realized` ÷ `plan`) mencapai 80% (kuning) dan 100% (merah).
- SF-4.5 — Bila `plan_amount` = 0, sistem HARUS menampilkan serapan sebagai "—" tanpa kesalahan pembagian nol.
- SF-4.6 — Peran `talent` TIDAK BOLEH memperoleh baris apa pun dari tabel maupun view anggaran.
- SF-4.7 — Nilai uang HARUS `NUMERIC(16,2)`; floating point DILARANG.

**Verifikasi:** plan 100 jt, komitmen 60 jt, realisasi 85 jt → sisa 15 jt, serapan 85% (kuning). Entry koreksi −5 jt → realisasi 80 jt, serapan 80% (tepat di ambang, kuning).

### SF-5 — Otorisasi

| | |
|---|---|
| **Sumber** | Seluruh modul; RBAC PRD §8 |
| **Realisasi** | RLS + `get_my_role()` + `is_manager_of()` + `guard_profile_privileges()` |

- SF-5.1 — Otorisasi HARUS ditegakkan RLS. Pemeriksaan peran di frontend adalah kenyamanan tampilan dan TIDAK BOLEH menjadi satu-satunya penghalang.
- SF-5.2 — Setiap tabel baru HARUS mengaktifkan RLS dan mendefinisikan policy eksplisit **dalam migrasi yang sama**.
- SF-5.3 — Peran HARUS bersumber dari `profiles.role`, dibaca lewat `get_my_role()`.
- SF-5.4 — Pengguna non-`admin` TIDAK BOLEH mengubah `role`, `is_active`, atau `manager_id` — termasuk pada barisnya sendiri.
- SF-5.5 — Fungsi helper untuk policy HARUS `stable`, `security definer`, dengan `search_path` tetap, dan dicabut aksesnya dari `anon`.
- SF-5.6 — Kunci `service_role` TIDAK BOLEH dipakai frontend maupun disimpan di repositori.

**Verifikasi:** matriks §7.2 — minimal satu ALLOW dan satu DENY per (peran × tabel), dijalankan sebagai SQL langsung dengan JWT tiap peran.

### SF-6 — Jejak Audit

| | |
|---|---|
| **Sumber** | XM-05 |
| **Realisasi** | `audit_log` + trigger `audit_trigger()` |

- SF-6.1 — Setiap INSERT, UPDATE, dan DELETE pada `profiles`, `timesheets`, `feasibility_cases`, `budget_lines`, dan `budget_entries` HARUS tercatat dengan `table_name`, `record_id`, `action`, `actor`, `before_data`, `after_data`, dan waktu.
- SF-6.2 — `audit_log` HARUS bersifat append-only dari sudut pandang aplikasi: tidak ada policy INSERT, UPDATE, atau DELETE bagi pengguna.
- SF-6.3 — Hanya `admin` dan `chapter_lead` yang HARUS dapat membaca `audit_log`.
- SF-6.4 — Pembacaan `audit_log` HARUS selalu terfilter dan dipaginasi.

### SF-7 — Alur Data Terintegrasi

| | |
|---|---|
| **Sumber** | XM-02 |

- SF-7.1 — Timesheet berstatus `approved` HARUS menjadi satu-satunya masukan perhitungan utilisasi (SF-1).
- SF-7.2 — Resource check feasibility (PF-03) HARUS membaca data alokasi dan competency matrix, bukan angka yang diketik ulang.
- SF-7.3 — Komitmen anggaran yang lahir dari feasibility case yang disetujui HARUS menyimpan `feasibility_case_id` agar dapat ditelusuri balik.
- SF-7.4 — Antarmuka TIDAK BOLEH mengagregasi ulang angka yang sudah disediakan view `utilization_monthly` atau `budget_summary`.

### SF-8 — Avatar (di luar MVP)

| | |
|---|---|
| **Sumber** | AV-01..AV-07 |
| **Realisasi** | Edge function `tania-assistant`, tabel `chat_*` |

- SF-8.1 — Seluruh query data bot HARUS dijalankan memakai JWT penanya sehingga RLS berlaku. Pembatasan akses TIDAK BOLEH bergantung pada instruksi prompt.
- SF-8.2 — Bot HARUS bersifat read-only; untuk aksi, bot mengarahkan ke halaman modul.
- SF-8.3 — Riwayat percakapan HARUS privat per pengguna; tidak ada jalur baca bagi peran mana pun, termasuk `admin`.
- SF-8.4 — Jumlah token masukan dan keluaran HARUS dicatat per pesan.
- SF-8.5 — Asal permintaan browser HARUS dibatasi allowlist `ALLOWED_ORIGINS` dengan pencocokan persis; tanpa konfigurasi, sistem HARUS gagal tertutup.
- SF-8.6 — Bot HARUS menjawab dalam Bahasa Indonesia.
- SF-8.7 — Aktivasi produksi HARUS didahului plafon biaya bulanan yang disetujui.

---

## 5. Kebutuhan Data

| ID | Kebutuhan |
|---|---|
| DR-1 | Model data HARUS sesuai migrasi di `supabase/migrations/`; perubahan hanya lewat migrasi baru |
| DR-2 | Nilai uang HARUS `NUMERIC(16,2)`; floating point DILARANG |
| DR-3 | Waktu HARUS `TIMESTAMPTZ`; tanggal kerja dan periode HARUS `DATE` |
| DR-4 | `allocations.period_month` HARUS tanggal 1 bulan tersebut, dijamin constraint |
| DR-5 | Angka turunan (`total_score`, agregasi anggaran, utilisasi) HARUS dihitung basis data, tidak disimpan ganda |
| DR-6 | Lampiran HARUS disimpan di object storage, bukan di basis data; maks 10 MB per berkas |
| DR-7 | Setiap query daftar HARUS dipaginasi; `select('*')` tanpa filter pada `timesheets` dan `audit_log` DILARANG (kuota egress 5 GB/bulan) |
| DR-8 | Backup mingguan HARUS terenkripsi sebelum menjadi artifact, dan HARUS diverifikasi dapat didekripsi pada proses yang sama |
| DR-9 | **Belum terpenuhi.** Skema TIDAK memiliki constraint yang mencegah `profiles.manager_id = profiles.id`. Bila seseorang tercatat sebagai manager bagi dirinya sendiri, `is_manager_of()` bernilai benar dan orang tersebut dapat menyetujui timesheet miliknya sendiri — melanggar SF-2.8. Perbaikan HARUS berupa migrasi baru: `check (manager_id is null or manager_id <> id)` |
| DR-10 | Strategi retensi `audit_log` dan `timesheets` HARUS ditetapkan sebelum kuota basis data 500 MB terlampaui (lihat SAD §15) |

---

## 6. Kebutuhan Non-Fungsional

Setiap butir dinyatakan dalam bentuk yang dapat diukur; yang tidak dapat diukur tidak dicantumkan.

| ID | Kebutuhan | Ambang |
|---|---|---|
| NFR-1 | Waktu muat halaman daftar pada jaringan kantor | ≤ 2 detik untuk 50 baris pertama |
| NFR-2 | Waktu muat dashboard eksekutif | ≤ 3 detik |
| NFR-3 | Ukuran bundle JavaScript awal | ≤ 300 KB terkompresi; chart dan `xlsx` HARUS dynamic import |
| NFR-4 | Konsumsi egress Supabase | < 5 GB/bulan |
| NFR-5 | Konsumsi kredit Netlify | ≤ 45 kredit/bulan (≤ 3 deploy produksi) |
| NFR-6 | Ketersediaan | Best-effort free tier; auto-pause dicegah keep-alive tiap 3 hari |
| NFR-7 | Backup | Mingguan, terenkripsi AES-256, retensi 30 hari, pemulihan teruji minimal sekali sebelum go-live |
| NFR-8 | Build | `npm run build` HARUS menghasilkan static export tanpa error sebelum setiap commit |
| NFR-9 | Browser | Chrome/Edge versi terkini; responsif hingga lebar tablet (≥ 768 px) |
| NFR-10 | Bahasa antarmuka | 100% Bahasa Indonesia |
| NFR-11 | Keamanan | Tidak ada temuan terbuka kategori tinggi; tidak ada rahasia di repositori |
| NFR-12 | Auditability | 100% aksi create/update/approve pada lima tabel inti tercatat |

---

## 7. Matriks Keterlacakan

### 7.1 Sasaran → requirement → formalisasi → verifikasi

| BO (BRD §3) | Metrik (PRD §2) | Sasaran | Requirement | SF | Realisasi | Verifikasi |
|---|---|---|---|---|---|---|
| BO-2 | M1 | Compliance timesheet ≥ 90% | TS-01, TS-02, TS-04 | SF-2 | `timesheets`, trigger stempel | Uji transisi status tiap peran |
| BO-1, BO-6 | M2 | Rekap utilisasi < 5 menit | WA-02, WA-04, XM-01 | SF-1, SF-7 | View `utilization_monthly` | Uji formula + kasus batas SF-1.4/1.5 |
| BO-3 | M3 | 100% keputusan ber-scoring | PF-01..PF-05 | SF-3 | `total_score`, trigger keputusan | Uji rationale wajib; uji kunci setelah decided |
| BO-4 | M4 | Selisih anggaran ≤ 5% | BC-01..BC-05 | SF-4 | View `budget_summary` | Uji agregasi termasuk entry negatif |
| BO-5 | M5 | Competency matrix ≥ 95% | TM-02, TM-04 | — | `skills`, `profile_skills` | Uji pencarian & filter |
| — | M6 | Biaya infrastruktur Rp 0 | C-3 | SF-8.7 | Free tier; Avatar di luar MVP | Pantau Netlify Usage & Supabase quota |
| BO-7 | — | Fondasi data historis | XM-05 | SF-6 | `audit_log`, `timesheets` | Uji kelengkapan jejak sejak hari pertama |

### 7.2 Kebutuhan lintas fungsi

| Kebutuhan | Requirement | SF | Realisasi | Verifikasi |
|---|---|---|---|---|
| Otorisasi | seluruh modul | SF-5 | RLS + helper + guard trigger | ALLOW/DENY per (peran × tabel) |
| Jejak audit | XM-05 | SF-6 | `audit_log` + trigger | Uji kelengkapan before/after |
| Alur data antar modul | XM-02 | SF-7 | View + `feasibility_case_id` | Uji rantai TS → WA → PF → BC |
| Perlindungan rahasia | C-6 | SF-5.6, DR-8 | `.gitignore`, secret CI, enkripsi backup | Pemindaian rahasia sebelum go-live |

### 7.3 Cakupan terbalik

Setiap SF di §4 tertaut ke minimal satu requirement PRD, dan setiap requirement **Must** PRD tertaut ke minimal satu baris verifikasi di §8 — kecuali delapan requirement Must yang cakupannya sebagian, yang penandanya sudah dicatat di PRD §6 dan HARUS ditutup sebelum v1.1.

---

## 8. Verifikasi & Validasi

### 8.1 Tingkatan pengujian

| Tingkat | Cakupan | Kriteria lulus |
|---|---|---|
| **Otorisasi** | Seluruh tabel dan view | Minimal satu ALLOW dan satu DENY per (peran × tabel), dijalankan sebagai SQL dengan JWT tiap peran |
| Perhitungan | SF-1, SF-3, SF-4 | Seluruh kasus batas terbukti, termasuk pembagian nol dan entry negatif |
| Transisi status | SF-2 | Setiap transisi tidak sah ditolak **oleh basis data** |
| Trigger | SF-2.4, SF-3.5, SF-3.6, SF-6 | Nilai dari klien atas kolom stempel diabaikan |
| Build | NFR-8 | Static export lolos tanpa error |
| Job terjadwal | keep-alive, backup | Backup terbukti dapat didekripsi dan diekstrak |
| Beban ringan | NFR-1..NFR-4 | Diukur pada data satu bulan riil |
| UAT | Alur tiap peran | Ditandatangani pengguna kunci per peran |

### 8.2 Kriteria penerimaan rilis

- [ ] Seluruh butir bertanda HARUS terverifikasi
- [ ] Uji otorisasi lengkap: tidak ada kombinasi (peran × tabel) tanpa hasil ALLOW dan DENY
- [ ] `talent` terbukti tidak memperoleh baris apa pun dari tabel dan view anggaran
- [ ] `talent` terbukti tidak dapat menyetujui timesheet miliknya sendiri
- [ ] DR-9 tertutup oleh migrasi constraint self-manager
- [ ] Pemulihan backup terenkripsi berhasil minimal satu kali
- [ ] `npm run build` lolos dan situs terdeploy dari `main`
- [ ] Tidak ada rahasia atau data riil di repositori publik
- [ ] Data master (skills, activities, projects) termuat dan tervalidasi

### 8.3 Verifikasi silang perhitungan

Sebelum go-live, tiga angka HARUS dicocokkan manual terhadap perhitungan spreadsheet atas data satu bulan riil: utilisasi satu squad (SF-1), satu `total_score` feasibility (SF-3), dan satu posisi budget line (SF-4). Selisih apa pun HARUS dijelaskan sebelum rilis.
