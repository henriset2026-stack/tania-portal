-- ============================================================
-- TANIA — Migration 4: Avatar (AI Assistant) chat storage
-- Requirement IDs: AV-01..AV-06 (see docs/TANIA_Avatar_Addendum.md)
-- Apply with: supabase db push
-- ============================================================

create type public.chat_role as enum ('user', 'assistant');

create table public.chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title      text not null default 'Percakapan baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_conversations_profile
  on public.chat_conversations (profile_id, updated_at desc);

create trigger trg_chat_conversations_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role            public.chat_role not null,
  content         text not null,
  -- token usage for cost monitoring (AV-06)
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz not null default now()
);

create index idx_chat_messages_conversation
  on public.chat_messages (conversation_id, created_at);

-- ---------- RLS: strictly private per user ----------
alter table public.chat_conversations enable row level security;
alter table public.chat_messages      enable row level security;

create policy "chat_conversations_own"
  on public.chat_conversations for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "chat_messages_own_conversation"
  on public.chat_messages for all
  to authenticated
  using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.profile_id = auth.uid()
    )
  );

-- Note: NO admin/lead read policy on purpose — chat percakapan user
-- dengan Avatar bersifat privat, tidak bisa dibaca siapa pun kecuali
-- pemiliknya. Audit trail keputusan tetap di tabel modul, bukan di chat.
