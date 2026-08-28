-- ============================================================
-- TANIA — Migration 9: Talent Journey (TM-05, TM-06)
--
-- Two things a talent cannot currently see about themselves:
--   1. A development plan — target competencies and certifications, with a
--      manager review (TM-05, previously deferred as Should).
--   2. A performance report drawn from work already recorded: approved
--      hours by category, billable share, projects touched, and — now that
--      Project Control exists — milestones they own and how many landed on
--      time.
--
-- Nothing here asks anyone to enter performance data by hand. Every number
-- in the report comes from timesheets and milestones that already exist, so
-- the report cannot disagree with the modules it is drawn from.
-- ============================================================

create type public.dev_goal_status as enum
  ('planned', 'in_progress', 'achieved', 'dropped');

-- ---------- development goals (TM-05) ----------
create table public.development_goals (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  -- Optional: a goal may be a named skill from the master list, or free text
  -- for something the chapter has not catalogued yet.
  skill_id         uuid references public.skills (id) on delete set null,
  title            text not null,
  target_level     smallint check (target_level between 1 and 5),
  target_date      date,
  is_certification boolean not null default false,
  status           public.dev_goal_status not null default 'planned',
  notes            text,
  -- Review by the manager or a lead. Stamped server-side, never by the owner.
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_devgoals_profile on public.development_goals (profile_id);
create index idx_devgoals_status  on public.development_goals (profile_id, status);

create trigger trg_devgoals_updated_at
  before update on public.development_goals
  for each row execute function public.set_updated_at();

-- A review is somebody else's judgement of your plan, so the reviewer is
-- stamped from the session and can never be the owner. Without this, the
-- owner could write their own review and the field would mean nothing.
create or replace function public.stamp_development_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if new.review_note is distinct from old.review_note
     and coalesce(new.review_note, '') <> '' then
    if actor is not null and actor = new.profile_id then
      raise exception 'Review rencana pengembangan tidak boleh ditulis oleh pemiliknya sendiri';
    end if;
    new.reviewed_by := actor;
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_stamp_development_review
  before update on public.development_goals
  for each row execute function public.stamp_development_review();

alter table public.development_goals enable row level security;

-- A development plan is personal: the owner, their manager, and leadership.
-- Not every signed-in user, unlike the competency matrix.
create policy "devgoals_select_own_manager_or_leads"
  on public.development_goals for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_manager_of(profile_id)
    or public.get_my_role() in ('chapter_lead', 'admin')
  );

create policy "devgoals_write_own"
  on public.development_goals for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Reviewers may update rows belonging to people they are responsible for.
create policy "devgoals_review_manager_or_leads"
  on public.development_goals for update to authenticated
  using (
    profile_id <> auth.uid()
    and (public.is_manager_of(profile_id)
         or public.get_my_role() in ('chapter_lead', 'admin'))
  )
  with check (
    profile_id <> auth.uid()
    and (public.is_manager_of(profile_id)
         or public.get_my_role() in ('chapter_lead', 'admin'))
  );

create trigger trg_audit_devgoals
  after insert or update or delete on public.development_goals
  for each row execute function public.audit_trigger();

-- ---------- performance report (TM-06) ----------
-- Monthly effort split, from approved timesheet rows only — the same basis
-- as utilization_monthly, so the two can never disagree.
create or replace view public.talent_performance
with (security_invoker = true) as
select
  t.profile_id,
  date_trunc('month', t.work_date)::date as period_month,
  sum(t.hours) filter (where t.status = 'approved')                          as approved_hours,
  sum(t.hours) filter (where t.status = 'approved' and a.is_billable)        as billable_hours,
  sum(t.hours) filter (where t.status = 'approved' and a.category = 'delivery') as delivery_hours,
  sum(t.hours) filter (where t.status = 'approved' and a.category = 'presales') as presales_hours,
  sum(t.hours) filter (where t.status = 'approved'
                         and a.category in ('internal', 'training'))         as internal_hours,
  sum(t.hours) filter (where t.status = 'approved' and a.category = 'leave') as leave_hours,
  count(distinct t.project_id) filter (where t.status = 'approved')          as projects_touched,
  count(*) filter (where t.status = 'rejected')                              as rejected_rows
from public.timesheets t
join public.activities a on a.id = t.activity_id
group by t.profile_id, date_trunc('month', t.work_date)::date;

-- Delivery ownership: milestones a person is PIC for, and how many finished
-- on or before their planned date. This is the part of a performance report
-- that timesheets alone cannot show.
create or replace view public.talent_delivery
with (security_invoker = true) as
select
  m.pic_id as profile_id,
  count(*)                                                     as milestones_owned,
  count(*) filter (where m.status = 'completed')               as milestones_completed,
  count(*) filter (where m.status = 'completed'
                     and m.actual_finish <= m.planned_finish)  as completed_on_time,
  count(*) filter (where m.status = 'delayed')                 as milestones_delayed,
  round(
    100.0 * count(*) filter (where m.status = 'completed'
                               and m.actual_finish <= m.planned_finish)
    / nullif(count(*) filter (where m.status = 'completed'), 0), 1
  ) as on_time_rate
from public.project_milestones m
where m.pic_id is not null
group by m.pic_id;
