# BRD — Business Requirements Document

| | |
|---|---|
| **Dokumen** | Business Requirements Document |
| **Produk** | TANIA — Portal Digital Product & Solution |
| **Pemilik** | Chapter Product & Solution (DPS), Digital Product, PT Telkom Indonesia (Persero) Tbk |
| **Versi** | 1.0 (draft) |
| **Tanggal** | 26 Agustus 2026 |
| **Audiens** | Sponsor, Chapter Lead, Finance, IT Security & Governance |
| **Hubungan dengan PRD** | BRD menjawab *mengapa inisiatif ini layak dijalankan*. PRD menjawab *apa yang dibangun*. Bila keduanya berbeda, BRD yang mengikat keputusan investasi |

---

## 1. Ringkasan Eksekutif

Chapter Product & Solution mengelola puluhan talent lintas squad dan sejumlah proyek delivery serta presales secara paralel. Data pendukung keputusannya tersebar: profil kompetensi di spreadsheet personal, alokasi orang disepakati lewat chat, jam kerja dilaporkan tidak seragam, keputusan ambil-proyek tidak terekam, dan posisi anggaran baru diketahui saat rekonsiliasi akhir bulan.

Dokumen ini mengusulkan pembangunan **TANIA**, portal internal sebagai satu sumber data untuk lima domain keputusan chapter: talent, workload, timesheet, kelayakan proyek, dan anggaran.

| | |
|---|---|
| **Yang diusulkan** | Portal internal, MVP 5 modul (26 requirement Must dari 38 requirement v1.0) |
| **Durasi MVP** | 6 minggu — 5 minggu pengembangan + 1 minggu UAT & go-live |
| **Biaya infrastruktur** | **Rp 0** — free tier Supabase + Netlify + GitHub Actions |
| **Satu-satunya komponen berbayar** | Modul Avatar AI, pay-per-use, **di luar MVP** dan butuh persetujuan terpisah |
| **Manfaat utama** | Rekap utilisasi bulanan dari proses manual berhari-hari menjadi tampilan yang selalu tersedia; keputusan go/no-go proyek terekam dan dapat diaudit |
| **Keputusan yang diminta** | Delapan keputusan kebijakan di §12 — tidak satu pun berupa permintaan anggaran infrastruktur |

**Yang membedakan usulan ini:** yang diminta bukan anggaran, melainkan **waktu tim dan komitmen proses**. Arsitekturnya sengaja dipilih agar biaya infrastruktur nol (lihat SAD AD-1..AD-3), sehingga keputusan investasi tidak bergantung pada siklus anggaran.

---

## 2. Konteks Bisnis

### 2.1 Kondisi saat ini

| Aspek | Kondisi | Baseline |
|---|---|---|
| Utilisasi talent | Tidak ada angka yang disepakati bersama; estimasi berbeda antar manager | **belum terukur** |
| Pengisian timesheet | Tidak seragam antar squad; sebagian tidak mengisi | **belum terukur** |
| Kompetensi talent | Spreadsheet personal, tidak seragam, sering usang | **belum terukur** |
| Keputusan ambil-proyek | Dibahas lisan; alasan tidak tercatat | 0% terekam |
| Posisi anggaran | Diketahui saat rekonsiliasi bulanan | jeda ± 1 bulan |
| Rekap manual | Disusun ulang tiap kali diminta management | **belum terukur** |

> **Baseline harus diisi sebelum dokumen ini diajukan untuk persetujuan.** Empat sel bertanda "belum terukur" adalah dasar seluruh klaim manfaat di §7. Cara paling murah mengisinya: satu bulan pengamatan berjalan sebelum atau bersamaan dengan pengembangan fase 1.

### 2.2 Dampak bila tidak melakukan apa-apa

| # | Dampak | Sifat |
|---|---|---|
| I-1 | Overload talent baru diketahui setelah orangnya mengeluh atau keluar | Risiko retensi |
| I-2 | Kapasitas menganggur tidak termanfaatkan karena tidak terlihat | Kehilangan peluang |
| I-3 | Staffing proyek baru mengandalkan ingatan, bukan data kompetensi | Kualitas delivery |
| I-4 | Keputusan ambil-proyek tidak dapat dipertanggungjawabkan saat ditanya kemudian | Tata kelola |
| I-5 | Komitmen anggaran melampaui plan baru ketahuan terlambat | Kendali keuangan |
| I-6 | Setiap permintaan data dari management memicu kerja rekap manual baru | Beban berulang |

Empat dari enam dampak di atas bersifat *diam* — tidak menimbulkan insiden yang terlihat, melainkan keputusan yang pelan-pelan memburuk. Inilah alasan inisiatif seperti ini mudah ditunda dan mahal saat ditunda.

---

## 3. Sasaran Bisnis

| ID | Sasaran bisnis | Ukuran keberhasilan | Terhubung ke |
|---|---|---|---|
| BO-1 | Utilisasi chapter terukur dan tepercaya | Angka utilisasi tersedia < 5 menit kapan pun diminta | PRD M2 |
| BO-2 | Disiplin pelaporan effort | ≥ 90% talent aktif mengisi timesheet tiap minggu | PRD M1 |
| BO-3 | Keputusan ambil-proyek terstandar dan dapat diaudit | 100% kandidat proyek baru diputuskan lewat scoring yang terekam | PRD M3 |
| BO-4 | Kendali anggaran chapter mendekati real-time | Selisih posisi portal vs pembukuan ≤ 5% pada review bulanan | PRD M4 |
| BO-5 | Data kompetensi sebagai dasar staffing | ≥ 95% talent aktif memiliki competency matrix terisi | PRD M5 |
| BO-6 | Menghapus rekap manual berganda | 0 rekap utilisasi/anggaran manual yang masih beredar +1 bulan setelah go-live | PRD M2, §10 |
| BO-7 | Fondasi data historis untuk analitik lanjutan | Data timesheet dan keputusan terkumpul sejak hari pertama | Roadmap v1.1+ |

BO-7 layak disebut meski manfaatnya belum terasa di MVP: jejak audit dan timesheet ditulis sejak hari pertama justru agar analitik dan asisten berbasis data punya bahan. Menundanya berarti menunda kapabilitas itu sebanyak durasi pengumpulan data.

---

## 4. Ruang Lingkup Bisnis

### 4.1 Dalam lingkup

- Lima modul: Talent Management, Workload Analysis, Project Timesheet, Project Feasibility, Budget Control.
- Seluruh 26 requirement berprioritas **Must** pada Requirement Document v1.0 (delapan di antaranya sebagian — lihat PRD §6).
- Enam peran pengguna internal chapter dengan pembatasan akses per peran.
- Dashboard eksekutif dan export Excel.

### 4.2 Di luar lingkup

| # | Di luar lingkup | Alasan |
|---|---|---|
| N-1 | Payroll, absensi resmi, cuti resmi | Domain HR korporat; timesheet TANIA murni untuk analitik |
| N-2 | Sistem akuntansi / jurnal keuangan | Angka anggaran bersifat kontrol manajerial, bukan pembukuan |
| N-3 | Manajemen tugas harian squad | Squad memakai tools masing-masing |
| N-4 | Portal untuk pihak eksternal | Internal, invite-only |
| N-5 | Integrasi otomatis ke HRIS, SAP, atau SSO korporat | Butuh persetujuan dan sumber daya IT korporat; direncanakan pasca-MVP |
| N-6 | Modul Avatar AI | Satu-satunya komponen berbiaya; butuh persetujuan terpisah (§12 D2) |
| N-7 | 12 requirement berprioritas Should dan Could | Ditunda ke v1.1+ |

---

## 5. Pemangku Kepentingan

| Stakeholder | Peran dalam inisiatif | Kepentingan utama |
|---|---|---|
| Sponsor (VP/GM Digital Product) | Pemilik keputusan | Kondisi chapter terlihat dalam satu layar |
| Chapter Lead Product & Solution | Pengguna kunci & pemilik proses | Kendali keputusan proyek dan anggaran |
| Manager / Squad Lead | Pengguna kunci, **penjaga kualitas data** | Approval cepat; timnya tidak overload |
| Project Manager | Pengguna, produsen data feasibility | Pengajuan proyek yang dinilai adil dan cepat |
| Talent | **Produsen data utama** | Beban input minimal |
| Admin portal | Pengelola master data & akun | Prosedur jelas |
| IT Security & Governance | Pemberi persetujuan | Kepatuhan keamanan & klasifikasi data |
| Finance | Pemangku kepentingan angka anggaran | Konsistensi dengan pembukuan |

**Catatan risiko pemangku kepentingan.** Peran yang paling menentukan keberhasilan adalah `talent` — merekalah produsen data utama, sekaligus pihak yang paling sedikit memperoleh manfaat langsung. Seluruh strategi adopsi (§10) bertumpu pada kenyataan ini.

### RACI keputusan utama

| Keputusan | Sponsor | Chapter Lead | Manager | IT Sec | Finance |
|---|---|---|---|---|---|
| Persetujuan inisiatif & alokasi waktu tim | **A** | R | C | I | I |
| Scope MVP | A | **R** | C | I | I |
| Bobot scoring kelayakan proyek | A | **R** | C | — | C |
| Plafon biaya Avatar | **A** | R | I | I | C |
| Visibilitas repositori & klasifikasi data | A | C | I | **R** | I |
| Kebijakan retensi data | I | A | I | **R** | — |
| Komitmen penghentian rekap manual | **A** | R | C | — | I |
| Go/no-go go-live | **A** | R | C | C | I |

---

## 6. Proses Bisnis

### 6.1 As-Is — rekap utilisasi bulanan

```
Management minta data
   └─► Chapter Lead minta rekap ke tiap manager
         └─► Manager tanya anggota squad satu per satu (chat)
               └─► Angka dikumpulkan di spreadsheet berbeda-beda formatnya
                     └─► Chapter Lead menyatukan & merapikan
                           └─► Presentasi — angka sudah berumur beberapa hari
```

Titik lemah: setiap permintaan memicu ulang seluruh rantai; tidak ada angka yang bertahan; definisi utilisasi berbeda antar manager.

### 6.2 To-Be

```
Talent isi timesheet mingguan ──► Manager approve
                                      └─► Utilisasi terhitung otomatis
Management buka dashboard ──────────────► angka tersedia, definisi tunggal
```

Perubahan proses yang sesungguhnya bukan pada management, melainkan pada talent dan manager: **pengisian dan approval mingguan menjadi rutinitas wajib.** Tanpa itu, dashboard menampilkan angka kosong dengan sangat rapi.

### 6.3 To-Be — keputusan ambil-proyek

```
PM ajukan feasibility case (revenue, effort, kompetensi)
   └─► Sistem hitung skor berbobot 5 dimensi (0–100)
         └─► Resource check otomatis ke data alokasi & kompetensi
               └─► Chapter Lead putuskan go / no-go / hold + alasan wajib
                     └─► Keputusan, skor, dan alasan terekam permanen
```

Skor **tidak** memutuskan; skor membuat dasar keputusan terlihat dan dapat dibandingkan antar kandidat.

---

## 7. Model Manfaat

Kerangka berikut memakai **variabel, bukan angka**. Nilai DPS yang sebenarnya diisi bersama Chapter Lead dan Finance setelah baseline §2.1 tersedia.

### 7.1 Efisiensi waktu rekap

```text
Penghematan/tahun = (J_cl + J_mgr × N_mgr) × F × 12 × Rp_jam

J_cl    = jam per siklus rekap untuk Chapter Lead
J_mgr   = jam per siklus rekap untuk tiap manager
N_mgr   = jumlah manager
F       = frekuensi siklus rekap per bulan
Rp_jam  = biaya beban per jam
```

*Ilustrasi mekanisme — bukan angka DPS:* bila J_cl = 6, J_mgr = 2, N_mgr = 5, F = 1, Rp_jam = Rp150.000 → ≈ Rp28,8 juta/tahun. **Angka ini hanya menunjukkan cara hitungnya**; ganti seluruh variabel dengan data nyata sebelum dikutip di mana pun.

### 7.2 Manfaat dari utilisasi yang terlihat

```text
Nilai = Kapasitas_idle_terdeteksi × Proporsi_yang_dapat_dialihkan × Rp_jam
```

Manfaat ini biasanya lebih besar daripada §7.1, tetapi baru dapat dibuktikan setelah sistem berjalan — karena besaran idle-nya justru itulah yang belum terukur hari ini. **Rekomendasi: jangan menjadikannya dasar utama pembenaran.** Catat sebagai manfaat yang akan diukur pada kuartal pertama setelah go-live.

### 7.3 Manfaat tata kelola

Tidak dikuantifikasi. Nilainya muncul saat ada pertanyaan audit atau saat keputusan proyek dipersoalkan kemudian — jarang, tetapi mahal ketika terjadi dan tidak dapat direkonstruksi setelah faktanya.

### 7.4 Manfaat kualitatif

- Definisi utilisasi tunggal, dipakai semua pihak.
- Keputusan proyek dapat dibandingkan antar kandidat, bukan dinilai satu per satu.
- Talent melihat beban kerjanya sendiri terdokumentasi — berguna saat pembicaraan alokasi dan pengembangan karier.

---

## 8. Struktur Biaya

| Komponen | Sifat | Perkiraan | Catatan |
|---|---|---|---|
| Infrastruktur (hosting, database, storage, backup) | Berulang | **Rp 0** | Free tier Supabase + Netlify + GitHub Actions |
| Waktu tim pengembangan MVP | Satu kali | 6 minggu | Komponen biaya terbesar; berupa waktu, bukan pengeluaran |
| Waktu pengguna kunci untuk UAT | Satu kali | 1 minggu | Tiap peran perlu menguji alurnya |
| Pelatihan & change management | Satu kali | — | Kritikal untuk adopsi; lihat §10 |
| Pemeliharaan & enhancement | Berulang | — | Perlu pemilik yang ditunjuk, bukan sukarelawan |
| **Avatar AI (di luar MVP)** | Berulang, pay-per-use | ± Rp 25–75 ribu/bulan pada 500 pertanyaan | Satu-satunya pengeluaran nyata; butuh plafon disetujui (§12 D2) |

### 8.1 Pemicu kenaikan biaya

Biaya Rp 0 berlaku selama pemakaian berada dalam free tier. Ambang yang perlu dipantau:

| Kuota | Batas | Bila terlampaui |
|---|---|---|
| Egress Supabase | 5 GB/bulan | Upgrade Supabase Pro (± USD 25/bulan) |
| Basis data Supabase | 500 MB | Upgrade, atau terapkan kebijakan retensi (§12 D7) |
| Kredit Netlify | 300/bulan (15 per deploy produksi) | Situs pause sampai awal bulan; tanpa tagihan |
| GitHub Actions | gratis tanpa batas untuk repo publik | — |

**Rekomendasi:** setujui MVP saja sekarang. Meminta persetujuan Avatar bersamaan akan menambahkan satu-satunya komponen berbiaya ke keputusan yang selain itu tidak berbiaya sama sekali — dan itu memperlambat keduanya.

---

## 9. Kriteria Keberhasilan

### 9.1 Go-live (akhir minggu 6)

- [ ] Lima modul berfungsi end-to-end dengan data riil satu bulan berjalan
- [ ] Seluruh peran diuji: tiap peran hanya melihat data yang boleh dilihatnya
- [ ] Kriteria penerimaan rilis di SRS §8.2 terpenuhi
- [ ] Pengguna kunci tiap peran menandatangani hasil UAT

### 9.2 Realisasi manfaat (+3 bulan)

| Metrik | Target | Sumber ukur |
|---|---|---|
| Compliance timesheet mingguan | ≥ 90% talent aktif | TS-04 |
| Waktu menyusun rekap utilisasi | < 5 menit | Pengamatan |
| Keputusan proyek ber-scoring terekam | 100% kasus baru | PF-04 |
| Selisih anggaran portal vs pembukuan | ≤ 5% | Review bulanan bersama Finance |
| Competency matrix terisi | ≥ 95% talent aktif | TM-02 |
| Rekap manual yang masih beredar | 0 | Konfirmasi Chapter Lead |

---

## 10. Change Management & Adopsi

Risiko terbesar inisiatif ini bukan teknis, melainkan adopsi. Portal ini meminta **talent** memasukkan data mingguan, sementara manfaat terbesarnya dinikmati **management**. Ketimpangan itu harus ditangani secara eksplisit:

| # | Langkah | Pemilik |
|---|---|---|
| CM-1 | Entry timesheet dibuat cepat — grid mingguan, bukan form per baris | Tim pengembang |
| CM-2 | Compliance per squad terlihat manager, bukan dikirim sebagai teguran individual | Chapter Lead |
| CM-3 | Talent dapat melihat utilisasinya sendiri — data yang mereka masukkan memberi mereka sesuatu | Tim pengembang |
| CM-4 | Rekap manual **dihentikan** paling lambat +1 bulan setelah go-live | Sponsor (§12 D6) |
| CM-5 | Pengisian timesheet dinyatakan sebagai rutinitas wajib chapter, bukan inisiatif sukarela | Chapter Lead |
| CM-6 | Satu orang ditunjuk sebagai pemilik portal pasca-go-live | Sponsor |

CM-4 adalah yang paling menentukan. Selama rekap manual masih berjalan berdampingan, portal menjadi pekerjaan tambahan — dan pekerjaan tambahan selalu kalah.

---

## 11. Risiko Bisnis

| # | Risiko | Dampak | Mitigasi | Pemilik |
|---|---|---|---|---|
| R-B1 | Adopsi timesheet rendah | BO-1, BO-2 gagal; dashboard kosong | CM-1..CM-5 | Chapter Lead |
| R-B2 | Angka anggaran berbeda dengan pembukuan resmi | Kepercayaan management turun | Posisi sebagai kontrol manajerial dinyatakan di UI; rekonsiliasi bulanan | Finance |
| R-B3 | Bobot scoring dipersepsikan sepihak | Keputusan go/no-go dipertanyakan | Bobot disetujui management, terkunci, perubahan butuh approval (§12 D1) | Chapter Lead |
| R-B4 | Ketergantungan pada satu orang pengembang | Portal tidak terawat setelah go-live | Dokumentasi lengkap di repo; pemilik ditunjuk (CM-6) | Sponsor |
| R-B5 | Free tier terlampaui atau layanan pause | Portal mati sementara | Keep-alive, disiplin deploy, pemantauan kuota (§8.1) | Tim pengembang |
| R-B6 | Data internal berada di repositori publik | Paparan informasi internal | Keputusan visibilitas repositori (§12 D5) | IT Security |
| R-B7 | Baseline tidak pernah diisi | Manfaat tidak dapat dibuktikan; inisiatif berikutnya lebih sulit disetujui | Ukur satu bulan sebelum atau bersamaan fase 1 | Chapter Lead |

---

## 12. Keputusan yang Diminta

| # | Keputusan | Pemutus | Batas waktu | Dampak bila tertunda |
|---|---|---|---|---|
| **D1** | Bobot scoring kelayakan (25/25/20/15/15) final? Dan apakah bobot perlu dapat dikonfigurasi sebagaimana diminta PF-02? | Chapter Lead | Sebelum fase 4 | Modul feasibility dibangun di atas bobot yang mungkin berubah |
| **D2** | Plafon biaya bulanan Anthropic API untuk modul Avatar | Sponsor + Finance | Sebelum aktivasi modul 6 | Avatar tidak dapat diaktifkan di produksi |
| **D3** | Apakah libur nasional dikecualikan dari kapasitas utilisasi sejak MVP? | Chapter Lead | Sebelum fase 3 | Angka utilisasi sedikit lebih rendah dari seharusnya pada bulan berlibur |
| **D4** | Pemilik anggaran per program (`budget_lines.owner_id`) | Chapter Lead | Sebelum fase 4 | Alert ambang tidak punya tujuan yang jelas |
| **D5** | Visibilitas repositori: publik atau privat | IT Security + Sponsor | **Segera** | Dokumen bertanda internal dan rancangan otorisasi berada di repositori publik |
| **D6** | Komitmen menghentikan rekap manual paling lambat +1 bulan setelah go-live | Sponsor | Sebelum go-live | Adopsi gagal; manfaat §7.1 tidak terwujud |
| **D7** | Kebijakan retensi `timesheets` dan `audit_log` terhadap kuota 500 MB | Chapter Lead + IT | Sebelum akhir tahun pertama | Kuota basis data habis tanpa rencana |
| **D8** | SSO Entra ID wajib di MVP, atau email + password cukup untuk pilot? | IT Security | Sebelum fase 1 | Mengganti seluruh modul autentikasi setelah dibangun |

D5 dan D8 sebaiknya diputuskan lebih dulu: keduanya berdampak pada pekerjaan yang sudah berjalan, bukan pada fase yang belum dimulai.

---

## 13. Asumsi & Batasan

**Asumsi**

- A-1 — Talent bersedia dan diminta mengisi timesheet mingguan sebagai rutinitas wajib.
- A-2 — Manager tersedia melakukan approval mingguan.
- A-3 — Data master talent, proyek, dan aktivitas dapat disiapkan pada awal implementasi.
- A-4 — Pengguna kunci tiap peran tersedia untuk UAT pada minggu ke-6.
- A-5 — Kuota free tier Supabase dan Netlify sebagaimana diverifikasi Agustus 2026 tetap berlaku.
- A-6 — Kapasitas = 8 jam × Senin–Jumat; libur nasional belum dikecualikan (lihat D3).

**Batasan**

- B-1 — Mematuhi kebijakan keamanan dan klasifikasi data korporat.
- B-2 — Tidak menggantikan sistem korporat yang sudah berjalan (HRIS, SAP).
- B-3 — Bahasa antarmuka Bahasa Indonesia.
- B-4 — Biaya infrastruktur MVP harus Rp 0.
- B-5 — Autentikasi invite-only; tidak ada pendaftaran mandiri.

---

## 14. Persetujuan

| Peran | Nama | Tanda tangan | Tanggal |
|---|---|---|---|
| Sponsor (VP/GM Digital Product) | | | |
| Chapter Lead Product & Solution | | | |
| Finance | | | |
| IT Security & Governance | | | |

> **Dokumen ini belum siap diajukan untuk persetujuan.** Dua hal harus dilengkapi lebih dulu: **baseline §2.1** (empat sel bertanda "belum terukur") dan **angka model manfaat §7**. Tanpa keduanya, yang tersedia baru kerangka argumen — bukan business case.
>
> Kabar baiknya: karena biaya infrastruktur nol, keputusan yang diminta bukan persetujuan anggaran melainkan persetujuan **waktu dan proses**. Ambang pembuktiannya lebih rendah, tetapi baseline tetap dibutuhkan untuk membuktikan manfaatnya kemudian.

---

## 15. Referensi

- `PRD.md` — kebutuhan produk, requirement, cakupan MVP, metrik M1–M6
- `SRS.md` — spesifikasi formal, kriteria penerimaan rilis
- `SAD.md` — arsitektur, keputusan AD-1..AD-11, struktur biaya teknis
- `AGENTS.md` — aturan operasional pengembangan
- `docs/TANIA_Requirement_Document_v1.0.pdf` — requirement resmi
- `docs/TANIA_Avatar_Addendum.md` — rancangan & biaya modul Avatar
