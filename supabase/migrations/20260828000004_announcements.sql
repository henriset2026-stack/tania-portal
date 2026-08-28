-- ============================================================
-- TANIA — Migration 11: announcements
--
-- Content for the rotating banner on the launcher home. Kept in the
-- database rather than hard-coded so the chapter can post notices without
-- a deploy, and scheduled so a notice can be written today and appear on
-- Monday.
--
-- Visibility is a date window plus a flag, evaluated in the view rather
-- than in the client: an expired notice should stop being served, not
-- merely stop being rendered.
-- ============================================================

create type public.announcement_tone as enum ('info', 'success', 'warning', 'critical');

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  tone        public.announcement_tone not null default 'info',
  link_url    text,
  link_label  text,
  -- Scheduling window. starts_at defaults to now so a notice posted without
  -- a date is live immediately; a null ends_at means it runs until switched
  -- off, which is the common case.
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  is_active   boolean not null default true,
  -- Lower sorts first, so an urgent notice can be pinned ahead of the rest.
  priority    smallint not null default 100,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint announcement_window_ordered
    check (ends_at is null or ends_at > starts_at),
  constraint announcement_link_pair
    -- A URL with no label renders as a bare link; a label with no URL is a
    -- button that does nothing. Require both or neither.
    check ((link_url is null) = (link_label is null))
);

create index idx_announcements_window
  on public.announcements (is_active, starts_at, ends_at);

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

-- Everyone signed in reads announcements; only leadership writes them.
create policy "announcements_select_authenticated"
  on public.announcements for select to authenticated using (true);

create policy "announcements_write_leads"
  on public.announcements for all to authenticated
  using (public.get_my_role() in ('chapter_lead', 'admin'))
  with check (public.get_my_role() in ('chapter_lead', 'admin'));

create trigger trg_audit_announcements
  after insert or update or delete on public.announcements
  for each row execute function public.audit_trigger();

-- Only what is live right now. The window is applied here so an expired
-- notice is never sent to the browser in the first place.
create or replace view public.announcements_active
with (security_invoker = true) as
select id, title, body, tone, link_url, link_label, starts_at, ends_at, priority
from public.announcements
where is_active
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
order by priority, starts_at desc;
