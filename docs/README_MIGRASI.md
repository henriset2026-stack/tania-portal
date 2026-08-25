# TANIA — Migrasi Database Supabase

Tiga file migrasi siap pakai untuk skema lengkap TANIA (5 modul + audit log + storage), dengan RLS sebagai pagar keamanan utama.

## Isi

| File | Isi |
|---|---|
| `20260825000001_init_schema.sql` | Enum, 11 tabel, index, trigger `updated_at`, auto-create profile saat user Auth dibuat, view `budget_summary` & `utilization_monthly`, audit trigger |
| `20260825000002_rls_policies.sql` | Helper `get_my_role()` & `is_manager_of()`, RLS aktif di semua tabel, ±30 policy per role, guard anti privilege-escalation, stamping server-side (submitted_at, approved_by, decided_by), bucket storage `attachments` |
| `20260825000003_seed_master_data.sql` | Seed 5 activity type (TS-03) + 12 skill awal (TM-02), plus skrip smoke-test RLS (dokumentasi) |

## Cara Apply

```bash
# 1. Salin folder supabase/ ini ke root repo tania-portal
# 2. Link ke project Supabase Anda (sekali saja)
supabase link --project-ref <project-ref-anda>

# 3. Push semua migrasi
supabase db push

# 4. Generate TypeScript types untuk frontend
supabase gen types typescript --linked > src/lib/database.types.ts
```

## Setelah Apply — 3 langkah manual

1. **Buat user pertama** di Dashboard → Authentication → Add user (profil dibuat otomatis oleh trigger).
2. **Angkat diri Anda jadi admin** via SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'email-anda@telkom.co.id';
   ```
3. **Matikan self-signup**: Authentication → Providers → Email → nonaktifkan "Allow new users to sign up" (portal internal = invite-only).

## Keputusan Desain (bisa diubah nanti)

- **Bobot scoring PF-02** hardcoded di generated column `total_score`: strategic 25%, financial 25%, risk 20%, resource 15%, technical 15% (skala 0–100). Mengubah bobot = migrasi baru yang drop + re-add kolom. Ini sesuai open question #1 di Requirement Document — konfirmasi dulu ke management.
- **Kapasitas WA-02** diasumsikan 8 jam × hari kerja Senin–Jumat (belum memperhitungkan libur nasional). Cukup untuk MVP; kalender libur bisa ditambah sebagai tabel di fase berikutnya.
- **Budget**: `committed_amount`/`realized_amount` tidak disimpan di `budget_lines`, melainkan dihitung dari `budget_entries` lewat view `budget_summary` — satu sumber kebenaran, tidak bisa out-of-sync.
- **View memakai `security_invoker = true`** sehingga RLS tabel dasarnya tetap berlaku saat view di-query dari frontend.
- **Kolom sensitif ditulis server-side**: klien tidak bisa memalsukan `submitted_at`, `approved_by`, `decided_by`, `decided_at` — semuanya di-stamp oleh trigger.
- **Talent tidak punya akses budget sama sekali** (tidak ada policy SELECT untuk role talent di `budget_lines`/`budget_entries`).

## Prompt lanjutan untuk Claude Code (sesi #1 langsung ke UI)

> Skema dan RLS sudah di-apply (lihat supabase/migrations/). Jalankan `supabase gen types typescript --linked > src/lib/database.types.ts`, buat Supabase client typed di src/lib/supabase.ts, lalu implementasikan halaman login + halaman profil (TM-01) memakai tabel profiles. Jangan ubah skema; kalau butuh perubahan, buat file migrasi baru.
