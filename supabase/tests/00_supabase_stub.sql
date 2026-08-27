-- ============================================================
-- Minimal Supabase surface so the real migrations can run on a plain
-- PostgreSQL instance (local Docker, or a CI service container).
--
-- This is NOT part of the deployed schema. `supabase db push` never applies
-- it — Supabase provides auth and storage itself. It exists only so the
-- authorization tests can run without the full Supabase stack.
-- ============================================================

create role anon;
create role authenticated;

create schema if not exists auth;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb
);

-- Mirrors Supabase: auth.uid() reads the JWT subject from the session,
-- so a test can act as a given user with `set local request.jwt.claim.sub`.
create function auth.uid() returns uuid
language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema if not exists storage;

create table storage.buckets (
  id text primary key, name text, public boolean default false, file_size_limit bigint
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);

grant usage on schema public, auth, storage to authenticated, anon;
