# TANIA — Panduan Step-by-Step Development dengan Claude Code
### Runbook lengkap: dari laptop kosong sampai portal live (MVP Rp 0)

Panduan ini adalah urutan eksekusi yang mengikat semua artefak yang sudah dibuat:
`TANIA_Requirement_Document_v1.0` · `CLAUDE.md` · `README.md` · 4 file migrasi SQL · `tania-assistant` Edge Function · `TANIA_Avatar_Addendum.md`.

Estimasi total: **5–6 minggu** kalender (1 fase/minggu), ±1–2 jam sesi Claude Code per hari kerja.

Legenda: `$` = jalankan di Terminal · 💬 = prompt copy-paste ke Claude Code · ✅ = kriteria lulus sebelum lanjut.

---

## STEP 0 — Prasyarat (±45 menit, sekali saja)

1. Install tools di MacBook:
   ```bash
   $ node -v        # butuh v20+; kalau belum: brew install node
   $ npm install -g @anthropic-ai/claude-code
   $ brew install supabase/tap/supabase
   $ claude --version && supabase --version
   ```
2. Buat/siapkan akun (semua gratis): **GitHub**, **Supabase** (login pakai GitHub), **Netlify** (login pakai GitHub).
3. Jalankan `claude` sekali di folder mana pun → login dengan akun Claude Anda.

✅ Ketiga perintah versi di atas mengeluarkan angka versi tanpa error.

---

## STEP 1 — Setup Repo & Susun Artefak (±30 menit)

1. Buat repo **privat** `tania-portal` di GitHub, clone ke lokal:
   ```bash
   $ git clone git@github.com:<username>/tania-portal.git && cd tania-portal
   ```
2. Susun file yang sudah Anda miliki ke struktur ini:
   ```
   tania-portal/
   ├── CLAUDE.md                      ← file yang sudah dibuat
   ├── README.md                      ← file yang sudah dibuat
   ├── docs/
   │   ├── TANIA_Requirement_Document_v1.0.pdf
   │   ├── Panduan_Development_TANIA_ClaudeCode.md
   │   ├── README_MIGRASI.md
   │   └── TANIA_Avatar_Addendum.md
   └── supabase/
       ├── migrations/
       │   ├── 20260825000001_init_schema.sql
       │   ├── 20260825000002_rls_policies.sql
       │   ├── 20260825000003_seed_master_data.sql
       │   └── 20260826000001_avatar_chat.sql
       └── functions/
           └── tania-assistant/index.ts
   ```
3. Tambahkan CLAUDE.md bagian "Avatar rules" (salin dari Bagian 7 `TANIA_Avatar_Addendum.md`).
4. Commit awal:
   ```bash
   $ git add -A && git commit -m "chore: project docs, migrations, and Claude Code context" && git push
   ```

✅ Repo di GitHub berisi struktur di atas.

---

## STEP 2 — Database Supabase (±45 menit)

1. Di supabase.com: **New Project** → nama `tania`, region **Southeast Asia (Singapore)**, generate password DB (simpan di password manager).
2. Catat dari **Settings → API**: `Project URL`, `anon public key`, dan `Project ref`.
3. Link & push migrasi:
   ```bash
   $ supabase login
   $ supabase link --project-ref <project-ref>
   $ supabase db push        # meng-apply 4 migrasi berurutan
   ```
   > Kalau ada statement ditolak, jangan panik — jalankan `claude` lalu 💬 *"supabase db push gagal dengan error berikut: [tempel error]. Perbaiki file migrasi terkait tanpa mengubah desain RLS."*
4. Buat user pertama: Dashboard → **Authentication → Add user** (email Telkom Anda) → profil terbentuk otomatis.
5. Jadikan admin — SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'email-anda@telkom.co.id';
   ```
6. **Matikan self-signup**: Authentication → Sign In / Providers → Email → nonaktifkan *Allow new users to sign up*.
7. Uji RLS 5 menit: buat 1 user kedua (role default `talent`), lalu jalankan skrip smoke-test di komentar file migrasi ke-3.

✅ `supabase db push` selesai tanpa error; user talent TIDAK bisa membaca `budget_lines`.

---

## STEP 3 — Sesi Claude Code #1: Fondasi Aplikasi (Minggu 1)

```bash
$ cd tania-portal && claude
```

💬 **Prompt 1 (init):**
> Baca CLAUDE.md. Inisialisasi Next.js (App Router, TypeScript, Tailwind) di repo ini dengan `output: 'export'` dan `images.unoptimized: true`. Pasang shadcn/ui dan @supabase/supabase-js. Buat `.env.example` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY), pastikan `.env.local` di .gitignore. Buat `src/lib/supabase.ts` (client singleton). Verifikasi `npm run build` menghasilkan folder `out/` tanpa error.

Lalu isi `.env.local` dengan URL + anon key dari Step 2, dan generate types:
```bash
$ supabase gen types typescript --linked > src/lib/database.types.ts
```

💬 **Prompt 2 (auth + shell):**
> Buat halaman /login (email+password Supabase Auth, tanpa signup), proteksi semua route lain untuk user login, layout dengan sidebar 6 menu: Dashboard, Talent, Timesheet, Workload, Feasibility, Budget (+ Admin khusus role admin dari profiles.role — ingat: cek role di frontend hanya UX, keamanan tetap RLS). Header menampilkan nama & role user, tombol logout. UI Bahasa Indonesia.

💬 **Prompt 3 (profil & admin master data, TM-01):**
> Implementasikan halaman profil: lihat/edit data diri (full_name, squad, grade, location) dan kelola skill sendiri dari tabel profile_skills. Lalu halaman Admin: kelola projects & activities, dan ubah role/manager user lain (hanya akan berhasil untuk admin karena trigger guard). Jalankan `npm run build` dan perbaiki sampai lolos.

```bash
$ git checkout -b dev && git add -A && git commit -m "feat: foundation - auth, shell, profile (TM-01)" && git push -u origin dev
```

✅ Bisa login, lihat profil, tambah skill; `npm run build` hijau.

**Kebiasaan mulai sesi ini dan seterusnya:** satu fitur = satu commit · `/clear` di Claude Code tiap ganti modul · untuk fitur besar selalu awali 💬 *"Buat rencana implementasinya dulu, jangan menulis kode"* → review → *"lanjutkan"*.

---

## STEP 4 — Sesi #2: Modul Timesheet (Minggu 2)

💬 **Prompt 1 (entry, TS-01/03):**
> Baca CLAUDE.md. Rencanakan dulu halaman Timesheet: grid mingguan (baris = kombinasi project+activity, kolom = Sen–Min, sel = jam), navigasi minggu, simpan sebagai draft, tombol "Submit Minggu Ini" yang mengubah semua draft minggu itu menjadi submitted. Ingat unique constraint (profile, project, activity, work_date) — gunakan upsert. Setelah saya setujui rencananya, implementasikan.

💬 **Prompt 2 (approval, TS-02):**
> Buat halaman Persetujuan Timesheet untuk manager: daftar submitted dari direct reports (RLS sudah membatasi), aksi approve/reject per minggu per orang dengan catatan wajib saat reject. Status rejected bisa diedit ulang oleh talent.

💬 **Prompt 3 (compliance, TS-04):**
> Tambahkan kartu compliance di halaman approval: per squad, siapa yang belum submit minggu berjalan. Tampilkan juga banner pengingat di dashboard user jika minggu lalu belum submit.

```bash
$ npm run build && git add -A && git commit -m "feat: timesheet module (TS-01..04)" && git push
```

✅ Uji dengan 2 akun: talent isi & submit → manager approve → status berubah, `submitted_at`/`approved_by` terisi otomatis (cek di tabel — ini di-stamp trigger, bukan frontend).

---

## STEP 5 — Sesi #3: Talent & Workload (Minggu 3)

💬 **Prompt 1 (competency matrix, TM-02/04):**
> Buat halaman Talent: tabel semua talent (nama, role, squad, grade) dengan pencarian berdasarkan skill + level minimum (join profile_skills–skills), dan halaman detail talent menampilkan skill & riwayat penugasan dari allocations.

💬 **Prompt 2 (alokasi, WA-01):**
> Buat halaman Alokasi (akses pm/manager ke atas): matrix talent × bulan, isi persentase alokasi per project. Validasi client-side total per orang per bulan, tandai merah jika > 100%.

💬 **Prompt 3 (utilisasi, WA-02/03/04):**
> Buat halaman Workload berbasis view `utilization_monthly` (query view, jangan agregasi ulang): heatmap squad × bulan (dynamic import recharts), daftar orang dengan utilisasi >100% atau <60% sebagai alert, dan perbandingan planned (allocations) vs actual (view) per orang.

✅ Heatmap tampil dengan data timesheet yang sudah di-approve di Step 4; bundle tetap wajar (chart di-lazy-load).

---

## STEP 6 — Sesi #4: Feasibility & Budget (Minggu 4)

> ⚠️ Sebelum sesi ini: konfirmasi bobot scoring (25/25/20/15/15) ke management — open question #1 requirement doc. Kalau berubah, minta Claude Code membuat migrasi baru untuk kolom `total_score` DULU.

💬 **Prompt 1 (feasibility, PF-01/02/05):**
> Buat modul Feasibility: form intake case (judul, customer, deskripsi, estimasi revenue/effort/durasi, kompetensi dibutuhkan, 5 skor 0–5 dengan slider — total_score dihitung DB), dan papan pipeline kanban 4 kolom: Undecided, Go, Hold, No-Go.

💬 **Prompt 2 (resource check + decision, PF-03/04):**
> Di detail case: panel "Resource Check" yang mencocokkan required_competencies dengan profile_skills + sisa kapasitas dari allocations periode terkait. Lalu aksi keputusan untuk chapter_lead (go/no_go/hold + rasional wajib — DB akan menolak tanpa rasional). Tampilkan jejak keputusan (decided_by, decided_at).

💬 **Prompt 3 (budget, BC-01..05):**
> Buat modul Budget: kelola budget_lines (chapter_lead/admin), input budget_entries commitment/realization (pm ke atas, bisa link ke feasibility case), dan halaman ringkasan dari view `budget_summary` dengan progress bar per line — kuning ≥80%, merah ≥100% dari plan. Role talent tidak melihat menu ini sama sekali.

✅ Login sebagai talent → menu Budget tidak ada DAN query manual ke budget_lines dari console mengembalikan 0 baris (bukti pagar sesungguhnya adalah RLS).

---

## STEP 7 — Sesi #5: Dashboard Eksekutif & Export (Minggu 5)

💬 **Prompt 1 (XM-01):**
> Buat halaman Dashboard sesuai role: untuk executive/chapter_lead tampilkan 4 kartu ringkasan (utilisasi chapter bulan berjalan, % compliance timesheet minggu lalu, jumlah feasibility undecided + rata-rata skor, posisi budget: plan vs realized total) masing-masing link ke modulnya; untuk talent tampilkan ringkasan pribadi (timesheet minggu ini, utilisasi sendiri, alokasi berjalan).

💬 **Prompt 2 (XM-03):**
> Tambahkan tombol "Export Excel" di tabel utama tiap modul memakai library xlsx via dynamic import. Nama file: TANIA_<modul>_<tanggal>.xlsx.

✅ Semua requirement "Must" R1 terpenuhi — cek silang dengan Section 6 requirement document.

---

## STEP 8 — Deploy Netlify + Otomasi (±1 jam)

1. Merge ke main (deploy pertama):
   ```bash
   $ git checkout main && git merge dev && git push
   ```
2. Di netlify.com: **Add new project → Import from GitHub → tania-portal**. Build command `npm run build`, publish directory `out` (atau biarkan membaca `netlify.toml` — minta Claude Code membuatnya jika belum: 💬 *"Buat netlify.toml: build npm run build, publish out, cache immutable untuk /_next/static/*"*).
3. **Environment variables** di Netlify: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Disiplin kredit (WAJIB):** Project configuration → Build & deploy → (a) Production branch = `main` saja, (b) **Stop builds untuk Deploy Previews & branch deploys**. Ingat: 1 deploy = 15 kredit dari 300/bulan.
5. Otomasi GitHub Actions — 💬 *"Buat .github/workflows/keepalive.yml sesuai Bagian 7.3 docs/Panduan_Development_TANIA_ClaudeCode.md: ping Supabase tiap 3 hari + job mingguan supabase db dump yang disimpan sebagai artifact."* Lalu set repo secrets `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.
6. Uji dari HP: buka URL Netlify, login, isi timesheet.

✅ Portal live di `https://<nama>.netlify.app`; workflow Actions hijau; Team → Usage Netlify menunjukkan ±15 kredit terpakai.

---

## STEP 9 — Avatar AI (Minggu 5–6)

> Satu-satunya langkah berbayar: butuh API key dari console.anthropic.com (pay-per-use; set spend limit, mis. $5/bulan). Rincian biaya & keamanan: `docs/TANIA_Avatar_Addendum.md`.

1. Migrasi chat sudah ter-apply di Step 2 (file ke-4). Deploy Edge Function:
   ```bash
   $ supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxx
   $ supabase functions deploy tania-assistant
   ```
2. Kunci CORS ke domain Netlify Anda (tanpa mengedit kode):
   ```bash
   $ supabase secrets set ALLOWED_ORIGINS="https://<site-anda>.netlify.app"
   $ supabase functions deploy tania-assistant
   ```
   Tanpa secret ini hanya `http://localhost:3000` yang diizinkan — aman, tapi widget produksi tidak akan jalan.
3. Uji via curl (perintah lengkap di Addendum Bagian 5) — harus menjawab dalam Bahasa Indonesia.
4. 💬 Widget frontend: salin **prompt Bagian 6** `TANIA_Avatar_Addendum.md` ke Claude Code apa adanya.
5. Uji ketat sebagai **talent**: tanya "berapa sisa budget?" → Avatar harus menjawab tidak punya akses (RLS bekerja), bukan angka.
6. Merge → main (deploy ke-2 bulan ini).

✅ Avatar menjawab pertanyaan data riil; user talent tidak bisa memancing data budget; token usage tercatat di `chat_messages`.

---

## STEP 10 — UAT & Go-Live (Minggu 6)

1. **Onboarding data:** admin membuat akun seluruh talent chapter (Authentication → Add user), set role & manager di halaman Admin; input projects aktif & budget lines RKAP.
2. **UAT 1 minggu** dengan 1 squad: siklus penuh timesheet (isi → submit → approve) + 1 feasibility case dummy sampai diputuskan.
3. **Checklist go-live:**
   - [ ] Smoke-test RLS diulang untuk keempat role utama
   - [ ] Backup mingguan Actions menghasilkan artifact dump
   - [ ] Self-signup Supabase masih nonaktif
   - [ ] Spend limit Anthropic terpasang
   - [ ] Kebijakan chapter: timesheet wajib submit tiap Jumat (TS compliance butuh mandat, bukan cuma fitur)
4. Umumkan ke chapter + jadwalkan review pemakaian kredit/kuota di akhir bulan pertama (trigger upgrade ada di Panduan Development Bagian 8: Supabase Pro dulu, Netlify belakangan).

---

## Lampiran: Pola Prompt Claude Code yang Terbukti Efektif

| Situasi | Prompt |
|---|---|
| Mulai fitur besar | "Buat rencana implementasi dulu, jangan menulis kode." → review → "Lanjutkan sesuai rencana." |
| Build gagal | "npm run build gagal: [tempel error]. Perbaiki tanpa melanggar aturan static export di CLAUDE.md." |
| Setelah ubah skema | "Buat migrasi baru untuk [perubahan], jalankan db push, regenerate database.types.ts, perbaiki semua type error." |
| Review keamanan | "Audit semua query supabase di src/ — pastikan tidak ada yang mengandalkan filter client-side untuk otorisasi." |
| Akhir sesi | "Rangkum keputusan produk sesi ini dan tambahkan ke bagian Decisions di CLAUDE.md." |
| Hemat konteks | Ketik `/clear` setiap ganti modul; `/compact` kalau sesi panjang tapi masih satu topik. |
