-- ============================================================
-- TANIA — Portal Digital Product & Solution
-- Migration 1/3: Core schema (enums, tables, triggers, indexes)
-- Modules: TM (Talent), WA (Workload), TS (Timesheet),
--          PF (Feasibility), BC (Budget), XM (Cross-module)
-- Apply with: supabase db push
-- ============================================================

-- ---------- ENUMS ----------
create type public.user_role as enum
  ('executive', 'chapter_lead', 'manager', 'pm', 'talent', 'admin');

create type public.project_status as enum
  ('candidate', 'active', 'on_hold', 'completed', 'cancelled');

create type public.activity_category as enum
  ('delivery', 'presales', 'internal', 'leave', 'training');

create type public.timesheet_status as enum
  ('draft', 'submitted', 'approved', 'rejected');

create type public.feasibility_decision as enum
  ('go', 'no_go', 'hold');

create type public.budget_entry_type as enum
  ('commitment', 'realization');

-- ---------- COMMON: updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- TM-01: profiles (linked to Supabase Auth) ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        public.user_role not null default 'talent',
  squad       text,
  grade       text,
  location    text,
  manager_id  uuid references public.profiles (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_profiles_manager on public.profiles (manager_id);
create index idx_profiles_squad   on public.profiles (squad);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a user is created in Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- TM-02: skills & competency matrix ----------
create table public.skills (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  category   text,
  created_at timestamptz not null default now()
);

create table public.profile_skills (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  skill_id     uuid not null references public.skills (id) on delete cascade,
  level        smallint not null check (level between 1 and 5),
  is_certified boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (profile_id, skill_id)
);

create trigger trg_profile_skills_updated_at
  before update on public.profile_skills
  for each row execute function public.set_updated_at();

-- ---------- Master data: projects & activities ----------
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  customer   text,
  status     public.project_status not null default 'active',
  pm_id      uuid references public.profiles (id) on delete set null,
  start_date date,
  end_date   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_pm on public.projects (pm_id);

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  category    public.activity_category not null,
  is_billable boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- WA-01: allocations (planned) ----------
create table public.allocations (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  period_month date not null,  -- always the 1st of the month
  percent      numeric(5,2) not null check (percent > 0 and percent <= 150),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (profile_id, project_id, period_month),
  constraint allocations_period_is_month_start
    check (period_month = date_trunc('month', period_month)::date)
);

create index idx_allocations_period on public.allocations (period_month);
create index idx_allocations_profile on public.allocations (profile_id);

create trigger trg_allocations_updated_at
  before update on public.allocations
  for each row execute function public.set_updated_at();

-- ---------- TS-01..04: timesheets (actual) ----------
create table public.timesheets (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete restrict,
  activity_id   uuid not null references public.activities (id) on delete restrict,
  work_date     date not null,
  hours         numeric(4,2) not null check (hours > 0 and hours <= 24),
  notes         text,
  status        public.timesheet_status not null default 'draft',
  submitted_at  timestamptz,
  approved_by   uuid references public.profiles (id) on delete set null,
  approval_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (profile_id, project_id, activity_id, work_date)
);

create index idx_timesheets_profile_date on public.timesheets (profile_id, work_date);
create index idx_timesheets_status       on public.timesheets (status);
create index idx_timesheets_project      on public.timesheets (project_id);

create trigger trg_timesheets_updated_at
  before update on public.timesheets
  for each row execute function public.set_updated_at();

-- ---------- PF-01..05: feasibility cases ----------
-- Scoring weights (PF-02), adjustable by editing the generated column:
--   strategic 25% · financial 25% · delivery risk 20%
--   resource availability 15% · technical 15%  → total on a 0–100 scale
create table public.feasibility_cases (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  customer              text,
  description           text,
  estimated_revenue     numeric(16,2),
  estimated_effort_md   numeric(8,1),   -- man-days
  estimated_duration_mo numeric(4,1),   -- months
  required_competencies text[] not null default '{}',
  score_strategic       smallint check (score_strategic  between 0 and 5),
  score_financial       smallint check (score_financial  between 0 and 5),
  score_risk            smallint check (score_risk       between 0 and 5),
  score_resource        smallint check (score_resource   between 0 and 5),
  score_technical       smallint check (score_technical  between 0 and 5),
  total_score           numeric(5,1) generated always as (
                          (coalesce(score_strategic, 0) * 0.25
                         + coalesce(score_financial, 0) * 0.25
                         + coalesce(score_risk,      0) * 0.20
                         + coalesce(score_resource,  0) * 0.15
                         + coalesce(score_technical, 0) * 0.15) * 20
                        ) stored,
  decision              public.feasibility_decision,
  decision_rationale    text,
  decided_by            uuid references public.profiles (id) on delete set null,
  decided_at            timestamptz,
  project_id            uuid references public.projects (id) on delete set null,
  submitted_by          uuid not null references public.profiles (id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_feasibility_decision on public.feasibility_cases (decision);
create index idx_feasibility_submitter on public.feasibility_cases (submitted_by);

create trigger trg_feasibility_updated_at
  before update on public.feasibility_cases
  for each row execute function public.set_updated_at();

-- ---------- BC-01..05: budget ----------
create table public.budget_lines (
  id          uuid primary key default gen_random_uuid(),
  fiscal_year smallint not null,
  program     text not null,
  category    text not null,
  description text,
  plan_amount numeric(16,2) not null default 0 check (plan_amount >= 0),
  owner_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (fiscal_year, program, category)
);

create trigger trg_budget_lines_updated_at
  before update on public.budget_lines
  for each row execute function public.set_updated_at();

create table public.budget_entries (
  id                  uuid primary key default gen_random_uuid(),
  budget_line_id      uuid not null references public.budget_lines (id) on delete cascade,
  entry_type          public.budget_entry_type not null,
  amount              numeric(16,2) not null check (amount <> 0),
  description         text,
  entry_date          date not null default current_date,
  feasibility_case_id uuid references public.feasibility_cases (id) on delete set null,
  created_by          uuid not null references public.profiles (id) on delete restrict,
  created_at          timestamptz not null default now()
);

create index idx_budget_entries_line on public.budget_entries (budget_line_id);

-- Plan vs commitment vs realization in one view (BC-05 dashboard source)
create or replace view public.budget_summary
with (security_invoker = true) as
select
  bl.id,
  bl.fiscal_year,
  bl.program,
  bl.category,
  bl.description,
  bl.plan_amount,
  coalesce(sum(be.amount) filter (where be.entry_type = 'commitment'),  0) as committed_amount,
  coalesce(sum(be.amount) filter (where be.entry_type = 'realization'), 0) as realized_amount,
  bl.plan_amount
    - coalesce(sum(be.amount) filter (where be.entry_type = 'realization'), 0) as remaining_amount
from public.budget_lines bl
left join public.budget_entries be on be.budget_line_id = bl.id
group by bl.id;

-- ---------- WA-02: utilization view (actual hours vs capacity) ----------
-- Capacity assumption for MVP: 8h × working days Mon–Fri per month.
create or replace view public.utilization_monthly
with (security_invoker = true) as
with workdays as (
  select
    date_trunc('month', d)::date as period_month,
    count(*) filter (where extract(isodow from d) < 6) as working_days
  from generate_series(
         date_trunc('year', now()) - interval '1 year',
         date_trunc('year', now()) + interval '2 years' - interval '1 day',
         interval '1 day'
       ) as d
  group by 1
)
select
  t.profile_id,
  p.full_name,
  p.squad,
  date_trunc('month', t.work_date)::date as period_month,
  sum(t.hours) filter (where t.status = 'approved') as approved_hours,
  w.working_days * 8 as capacity_hours,
  round(
    coalesce(sum(t.hours) filter (where t.status = 'approved'), 0)
      / nullif(w.working_days * 8, 0) * 100, 1
  ) as utilization_pct
from public.timesheets t
join public.profiles p on p.id = t.profile_id
join workdays w on w.period_month = date_trunc('month', t.work_date)::date
group by t.profile_id, p.full_name, p.squad, period_month, w.working_days;

-- ---------- XM-05: audit log ----------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor       uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_table_record on public.audit_log (table_name, record_id);

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, actor, after_data)
    values (tg_table_name, new.id::text, tg_op, auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, actor, before_data, after_data)
    values (tg_table_name, new.id::text, tg_op, auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log (table_name, record_id, action, actor, before_data)
    values (tg_table_name, old.id::text, tg_op, auth.uid(), to_jsonb(old));
    return old;
  end if;
end;
$$;

-- Audit the decision- and money-bearing tables (XM-05)
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();
create trigger trg_audit_timesheets
  after update or delete on public.timesheets
  for each row execute function public.audit_trigger();
create trigger trg_audit_feasibility
  after insert or update or delete on public.feasibility_cases
  for each row execute function public.audit_trigger();
create trigger trg_audit_budget_lines
  after insert or update or delete on public.budget_lines
  for each row execute function public.audit_trigger();
create trigger trg_audit_budget_entries
  after insert or update or delete on public.budget_entries
  for each row execute function public.audit_trigger();
