# TANIA Avatar — Addendum Requirement & Panduan Implementasi
### Modul 6: AI Agent Bot "TANIA" (Avatar)

Addendum untuk *TANIA Requirement Document v1.0* dan *Panduan Development TANIA*.

---

## 1. Deskripsi

Avatar TANIA adalah asisten AI di dalam portal: tombol avatar melayang di pojok kanan bawah yang membuka panel chat. User bertanya dalam bahasa natural ("berapa utilisasi squad saya bulan ini?", "timesheet saya minggu lalu sudah di-approve belum?", "siapa yang punya skill Data Engineering level 4 ke atas?") dan Avatar menjawab dengan **data riil dari database** — bukan jawaban generik.

## 2. Requirement (AV-01..AV-07)

| ID | Requirement | Deskripsi | Priority |
|---|---|---|---|
| AV-01 | Chat widget | Avatar melayang di semua halaman; panel chat dengan riwayat percakapan per user | Must |
| AV-02 | Jawaban berbasis data | Bot menjawab dari data live 5 modul via tool use — dilarang mengarang angka | Must |
| AV-03 | Hak akses identik dengan user | Bot HANYA bisa membaca data yang boleh dibaca si penanya (enforced oleh RLS, bukan prompt) | Must |
| AV-04 | Read-only | Bot tidak pernah mengubah data; untuk aksi, bot mengarahkan ke halaman modul | Must |
| AV-05 | Riwayat privat | Percakapan tersimpan per user; tidak ada siapa pun (termasuk admin) yang bisa membaca chat orang lain | Must |
| AV-06 | Monitoring biaya | Token usage tercatat per pesan untuk memantau biaya API | Must |
| AV-07 | Bahasa | Bot menjawab dalam Bahasa Indonesia | Must |

## 3. Arsitektur & Keamanan

```
Browser (Next.js statis, Netlify)
   │  fetch + JWT user
   ▼
Supabase Edge Function: tania-assistant     ← API key Anthropic HANYA di sini
   │  1. Verifikasi JWT user
   │  2. Loop tool-use dengan Claude (max 5 putaran)
   │  3. Semua query DB memakai JWT SI USER → RLS berlaku
   ▼
Claude API (model: Haiku — termurah)  +  PostgreSQL (RLS)
```

Dua keputusan keamanan yang tidak boleh dilanggar:

1. **API key tidak pernah menyentuh browser.** Frontend statis tidak bisa menyimpan rahasia — semua panggilan ke Claude lewat Edge Function (`supabase secrets set ANTHROPIC_API_KEY=...`).
2. **RLS adalah pagar bot, bukan prompt.** Edge Function meneruskan JWT user ke setiap query, jadi kalau seorang `talent` bertanya soal budget, database mengembalikan nol baris — bot tidak mungkin bocor walau prompt-nya di-jailbreak. Ini persis AV-03.

Tools yang tersedia untuk bot (semuanya read-only):
`get_my_profile`, `get_my_timesheet_week`, `get_utilization`, `search_talent_by_skill`, `get_feasibility_pipeline`, `get_budget_summary`.

## 4. Dampak Biaya (jujur & terukur)

| Komponen | Biaya |
|---|---|
| Supabase Edge Functions | **Rp 0** — free tier 500.000 invocation/bulan, jauh dari cukup |
| Penyimpanan chat | **Rp 0** — dalam kuota DB 500 MB |
| Netlify | **Rp 0** — tidak ada tambahan (widget bagian dari bundle statis) |
| **Claude API (Haiku)** | **Berbayar per pemakaian** — kasarnya ±Rp 50–150 per pertanyaan (tergantung panjang data). 500 pertanyaan/bulan ≈ Rp 25–75 ribu |

Jadi Avatar adalah **satu-satunya komponen berbayar** di TANIA, dan biayanya pay-per-use tanpa langganan. Mitigasi biaya sudah tertanam: model Haiku, `max_tokens` 1024, riwayat dibatasi 12 pesan, panjang pertanyaan dibatasi 2.000 karakter, dan token usage dicatat per pesan (AV-06) sehingga bisa dibuat laporan biaya dari SQL:

```sql
select date_trunc('month', created_at) as bulan,
       sum(input_tokens) as input, sum(output_tokens) as output
from chat_messages group by 1 order by 1;
```

Set juga **spend limit** di console Anthropic sebagai pagar terakhir.

## 5. Langkah Implementasi

```bash
# 1. Salin file ke repo
#    supabase/migrations/20260826000001_avatar_chat.sql
#    supabase/functions/tania-assistant/index.ts

# 2. Apply migrasi chat (tabel + RLS)
supabase db push

# 3. Set API key (dapatkan dari console.anthropic.com)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxx

# 4. Deploy edge function
supabase functions deploy tania-assistant

# 5. Uji cepat via curl (ganti <anon-key> dan <jwt-user>)
curl -X POST "https://<project-ref>.supabase.co/functions/v1/tania-assistant" \
  -H "Authorization: Bearer <jwt-user>" -H "Content-Type: application/json" \
  -d '{"message":"siapa kamu?"}'
```

Sebelum produksi: set origin yang diizinkan lewat secret (tidak perlu mengedit kode):

```bash
supabase secrets set ALLOWED_ORIGINS="https://<site-anda>.netlify.app"
supabase functions deploy tania-assistant
```

Beberapa origin dipisah koma. Bila secret tidak di-set, hanya `http://localhost:3000` yang diizinkan — deployment gagal tertutup, bukan terbuka ke semua origin.

## 6. Prompt untuk Claude Code (frontend widget)

> Baca CLAUDE.md bagian "Avatar". Buat komponen `AvatarChat`:
> - Tombol bulat melayang kanan-bawah dengan avatar TANIA (inisial "T", warna merah Telkom #E1231A), muncul di semua halaman setelah login.
> - Klik → panel chat (drawer di mobile, popover 380px di desktop): daftar pesan, input teks, indikator "TANIA sedang mengetik…".
> - Kirim pesan: POST ke `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tania-assistant` dengan header `Authorization: Bearer <access_token dari session Supabase>`, body `{conversation_id, message}`. Simpan `conversation_id` dari respons untuk pesan berikutnya.
> - Muat riwayat percakapan terakhir dari tabel `chat_conversations`/`chat_messages` via supabase-js (RLS sudah membatasi ke milik user).
> - Tombol "Percakapan baru". Tangani error dengan pesan ramah.
> - Jangan tambah dependency chat library — cukup komponen sendiri + shadcn/ui.

## 7. Tambahan untuk CLAUDE.md

Tambahkan blok ini ke `CLAUDE.md` (bagian baru setelah "Performance / free-tier discipline"):

```markdown
## Avatar (AI assistant) rules

- The Anthropic API key exists ONLY as a Supabase Edge Function secret.
  Never put it in frontend code, env vars prefixed NEXT_PUBLIC_, or the repo.
- All Avatar DB reads go through the caller's JWT (RLS enforced). Never use
  the service_role key in the tania-assistant function.
- Avatar is READ-ONLY. Do not add tools that insert/update/delete.
- Model: Claude Haiku, max_tokens 1024, history capped at 12 messages,
  question capped at 2000 chars — do not raise these without approval
  (cost control).
- Chat history is private per user. Never add admin read access to
  chat_conversations/chat_messages.
```

## 8. Update Tabel Requirement (untuk Requirement Document v1.1)

Jika addendum ini disetujui management, masukkan AV-01..AV-07 sebagai Section 6.7 di Requirement Document, dan tambahkan baris di tabel Integration: "Anthropic Claude API — Outbound — AI assistant (Avatar) — R1/R2".
