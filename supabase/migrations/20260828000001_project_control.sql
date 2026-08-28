-- ============================================================
-- TANIA — Migration 8: Project Control (control-tower layer)
--
-- Closes the delivery-control gap against the DPS Project & Portfolio
-- Control Tower: milestones with weights, planned vs actual progress,
-- schedule variance, a risk register, an issue register, and six-dimension
-- project health rolled up to one RAG per project.
--
-- Formulas follow docs/01-prd.md §7.2–§7.7 of DPS-Project-Control-CRM so the
-- two products report the same numbers the same way.
--
-- Deliberately NOT included (see the notes at the end): customer 360 and the
-- sales pipeline, which belong to a CRM and contradict TANIA's non-goals;
-- daily health snapshots and the escalation engine, which need scheduled
-- jobs and notifications (XM-04, out of MVP).
-- ============================================================

-- ---------- ENUMS ----------
create type public.rag as enum ('green', 'amber', 'red');

create type public.milestone_status as enum
  ('not_started', 'in_progress', 'completed', 'delayed', 'blocked', 'cancelled');

create type public.risk_level as enum ('low', 'medium', 'high');

create type public.risk_status as enum
  ('identified', 'assessed', 'mitigating', 'closed', 'materialized');

create type public.issue_severity as enum ('low', 'medium', 'high', 'critical');

create type public.issue_status as enum
  ('open', 'assigned', 'in_progress', 'blocked', 'resolved', 'closed');

-- ---------- projects: contract value + the three manual health dimensions ----------
-- Schedule, Resource and Risk are computed; Budget, Scope and Customer are
-- the PM's judgement and require a reason when not green (DPS FR-M3-05).
alter table public.projects
  add column contract_value        numeric(16,2),
  add column health_budget         public.rag not null default 'green',
  add column health_budget_note    text,
  add column health_scope          public.rag not null default 'green',
  add column health_scope_note     text,
  add column health_customer       public.rag not null default 'green',
  add column health_customer_note  text;

-- A non-green manual dimension without a reason is how health scores quietly
-- become meaningless, so the database refuses it.
create or replace function public.guard_project_health_notes()
returns trigger
language plpgsql
as $$
begin
  if new.health_budget <> 'green' and coalesce(new.health_budget_note, '') = '' then
    raise exception 'health_budget_note wajib diisi bila Budget tidak green';
  end if;
  if new.health_scope <> 'green' and coalesce(new.health_scope_note, '') = '' then
    raise exception 'health_scope_note wajib diisi bila Scope tidak green';
  end if;
  if new.health_customer <> 'green' and coalesce(new.health_customer_note, '') = '' then
    raise exception 'health_customer_note wajib diisi bila Customer tidak green';
  end if;
  return new;
end;
$$;

create trigger trg_guard_project_health_notes
  before insert or update on public.projects
  for each row execute function public.guard_project_health_notes();

-- ---------- milestones (WBS level 3: the milestone itself) ----------
create table public.project_milestones (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  name           text not null,
  weight         numeric(5,2) not null check (weight > 0 and weight <= 100),
  planned_start  date not null,
  planned_finish date not null,
  actual_start   date,
  actual_finish  date,
  progress_pct   smallint not null default 0 check (progress_pct between 0 and 100),
  status         public.milestone_status not null default 'not_started',
  pic_id         uuid references public.profiles (id) on delete set null,
  evidence_url   text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint milestone_dates_ordered check (planned_finish >= planned_start)
);

create index idx_milestones_project on public.project_milestones (project_id);
create index idx_milestones_status  on public.project_milestones (status);

create trigger trg_milestones_updated_at
  before update on public.project_milestones
  for each row execute function public.set_updated_at();

-- A milestone at 100% must carry evidence (DPS FR-M4-07), and completion
-- implies an actual finish date.
create or replace function public.guard_milestone_completion()
returns trigger
language plpgsql
as $$
begin
  if new.progress_pct = 100 and coalesce(new.evidence_url, '') = '' then
    raise exception 'Milestone 100%% wajib melampirkan evidence';
  end if;
  if new.progress_pct = 100 and new.actual_finish is null then
    new.actual_finish := current_date;
  end if;
  -- Past its planned finish and not done: mark it delayed rather than letting
  -- the board look calm.
  if new.status not in ('completed', 'cancelled')
     and new.planned_finish < current_date
     and new.progress_pct < 100 then
    new.status := 'delayed';
  end if;
  return new;
end;
$$;

create trigger trg_guard_milestone_completion
  before insert or update on public.project_milestones
  for each row execute function public.guard_milestone_completion();

-- ---------- risk register ----------
create table public.project_risks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  description  text not null,
  category     text,
  probability  public.risk_level not null,
  impact       public.risk_level not null,
  -- Low=1 Medium=2 High=3, score 1–9 (DPS §7.6). Generated, so it can never
  -- disagree with its inputs.
  risk_score   smallint generated always as (
                 (case probability when 'low' then 1 when 'medium' then 2 else 3 end)
               * (case impact      when 'low' then 1 when 'medium' then 2 else 3 end)
               ) stored,
  status       public.risk_status not null default 'identified',
  owner_id     uuid references public.profiles (id) on delete set null,
  mitigation   text,
  contingency  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_risks_project on public.project_risks (project_id);
create index idx_risks_open    on public.project_risks (project_id, status) where status <> 'closed';

create trigger trg_risks_updated_at
  before update on public.project_risks
  for each row execute function public.set_updated_at();

-- ---------- issue register ----------
create table public.project_issues (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  title        text not null,
  description  text,
  severity     public.issue_severity not null default 'medium',
  status       public.issue_status not null default 'open',
  owner_id     uuid references public.profiles (id) on delete set null,
  due_date     date,
  opened_at    timestamptz not null default now(),
  resolved_at  timestamptz,
  root_cause   text,
  action_plan  text,
  resolution   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_issues_project on public.project_issues (project_id);
create index idx_issues_open    on public.project_issues (project_id, severity)
  where status not in ('resolved', 'closed');

create trigger trg_issues_updated_at
  before update on public.project_issues
  for each row execute function public.set_updated_at();

-- resolved_at is stamped server-side, like every other decision timestamp.
create or replace function public.stamp_issue_resolution()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then
    new.resolved_at := now();
    if coalesce(new.resolution, '') = '' then
      raise exception 'resolution wajib diisi saat issue ditutup';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_stamp_issue_resolution
  before update on public.project_issues
  for each row execute function public.stamp_issue_resolution();

-- ---------- progress & schedule variance (DPS §7.2, §7.3) ----------
create or replace view public.project_progress
with (security_invoker = true) as
select
  p.id as project_id,
  count(m.id) as milestone_count,
  coalesce(sum(m.weight), 0) as total_weight,
  round(
    coalesce(sum(m.weight * m.progress_pct) / nullif(sum(m.weight), 0), 0), 1
  ) as actual_progress,
  round(
    coalesce(sum(m.weight * (
      case
        when current_date >= m.planned_finish then 100
        when current_date <= m.planned_start  then 0
        else (current_date - m.planned_start)::numeric
             / nullif((m.planned_finish - m.planned_start), 0) * 100
      end
    )) / nullif(sum(m.weight), 0), 0), 1
  ) as planned_progress,
  round(
    coalesce(sum(m.weight * m.progress_pct) / nullif(sum(m.weight), 0), 0)
  - coalesce(sum(m.weight * (
      case
        when current_date >= m.planned_finish then 100
        when current_date <= m.planned_start  then 0
        else (current_date - m.planned_start)::numeric
             / nullif((m.planned_finish - m.planned_start), 0) * 100
      end
    )) / nullif(sum(m.weight), 0), 0), 1
  ) as schedule_variance
from public.projects p
left join public.project_milestones m
  on m.project_id = p.id and m.status <> 'cancelled'
group by p.id;

-- ---------- six-dimension health rolled up to one RAG (DPS §7.4) ----------
create or replace view public.project_health
with (security_invoker = true) as
with prog as (select * from public.project_progress),
risk as (
  select project_id,
         max(risk_score) filter (where status <> 'closed') as top_open_risk
  from public.project_risks group by project_id
),
iss as (
  select project_id,
         count(*) filter (
           where severity = 'critical' and status not in ('resolved','closed')
         ) as open_critical,
         count(*) filter (
           where severity = 'critical' and status not in ('resolved','closed')
             and opened_at < now() - interval '3 days'
         ) as aged_critical,
         count(*) filter (where status not in ('resolved','closed')) as open_issues
  from public.project_issues group by project_id
),
dims as (
  select
    p.id as project_id,
    p.code, p.name, p.customer, p.status, p.contract_value,
    pr.actual_progress, pr.planned_progress, pr.schedule_variance,
    pr.milestone_count, pr.total_weight,
    coalesce(r.top_open_risk, 0) as top_open_risk,
    coalesce(i.open_critical, 0) as open_critical,
    coalesce(i.aged_critical, 0) as aged_critical,
    coalesce(i.open_issues, 0)   as open_issues,
    -- Schedule from SV (§7.3)
    (case
       when pr.milestone_count = 0        then 'green'
       when pr.schedule_variance >= -5    then 'green'
       when pr.schedule_variance >= -15   then 'amber'
       else 'red'
     end)::public.rag as health_schedule,
    -- Risk from the highest open score (§7.4)
    (case
       when coalesce(r.top_open_risk, 0) >= 9 then 'red'
       when coalesce(r.top_open_risk, 0) >= 6 then 'amber'
       else 'green'
     end)::public.rag as health_risk,
    p.health_budget, p.health_scope, p.health_customer
  from public.projects p
  left join prog pr on pr.project_id = p.id
  left join risk r  on r.project_id = p.id
  left join iss  i  on i.project_id = p.id
),
counted as (
  select d.*,
    (case when health_schedule = 'red' then 1 else 0 end
   + case when health_risk     = 'red' then 1 else 0 end
   + case when health_budget   = 'red' then 1 else 0 end
   + case when health_scope    = 'red' then 1 else 0 end
   + case when health_customer = 'red' then 1 else 0 end) as reds,
    (case when health_schedule = 'amber' then 1 else 0 end
   + case when health_risk     = 'amber' then 1 else 0 end
   + case when health_budget   = 'amber' then 1 else 0 end
   + case when health_scope    = 'amber' then 1 else 0 end
   + case when health_customer = 'amber' then 1 else 0 end) as ambers
  from dims d
)
select c.*,
  (case
     -- An aged critical issue turns a project red regardless of dimensions.
     when c.aged_critical > 0 then 'red'
     when c.reds > 0          then 'red'
     when c.ambers >= 2       then 'red'
     when c.ambers = 1        then 'amber'
     else 'green'
   end)::public.rag as overall_health
from counted c;

-- ---------- RLS ----------
-- Reading project control data is open to every signed-in user, the same as
-- projects themselves. Writing is for the people who run delivery.
alter table public.project_milestones enable row level security;
alter table public.project_risks      enable row level security;
alter table public.project_issues     enable row level security;

create policy "milestones_select_authenticated"
  on public.project_milestones for select to authenticated using (true);
create policy "milestones_write_delivery"
  on public.project_milestones for all to authenticated
  using (public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin'))
  with check (public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin'));

create policy "risks_select_authenticated"
  on public.project_risks for select to authenticated using (true);
create policy "risks_write_delivery"
  on public.project_risks for all to authenticated
  using (public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin'))
  with check (public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin'));

create policy "issues_select_authenticated"
  on public.project_issues for select to authenticated using (true);
create policy "issues_write_delivery"
  on public.project_issues for all to authenticated
  using (public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin'))
  with check (public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin'));

-- ---------- audit ----------
create trigger trg_audit_milestones
  after insert or update or delete on public.project_milestones
  for each row execute function public.audit_trigger();
create trigger trg_audit_risks
  after insert or update or delete on public.project_risks
  for each row execute function public.audit_trigger();
create trigger trg_audit_issues
  after insert or update or delete on public.project_issues
  for each row execute function public.audit_trigger();

-- ============================================================
-- Not carried over from the DPS control tower, and why:
--
--   Customer 360, contacts, opportunities, sales pipeline — a CRM layer.
--     TANIA's non-goals N2 and N4 rule it out; the chapter is not running
--     sales from this portal.
--   Daily health/progress snapshots for trend charts — needs a scheduled
--     job. Deferrable: the audit log already records every change, so the
--     history is recoverable when the job is added.
--   Issue escalation engine — needs notifications (XM-04, Should, out of
--     MVP). The data it would key on (severity, opened_at, status) is here,
--     so the engine is additive rather than a redesign.
--   Milestone dependencies, critical path and Gantt — P1 in DPS itself.
--   Resource requirement vs allocation gap — WA-01..04 already measure
--     allocation and utilisation; adding a requirements table is a separate
--     decision about who owns demand planning.
-- ============================================================
