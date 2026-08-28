-- ============================================================
-- TANIA — Migration 10: effort-to-cost (TS-05)
--
-- Turns approved timesheet hours into an indicative internal cost per
-- project, so Budget Control can show what the chapter's own effort is
-- worth alongside the money it spends on tools, subcon and cloud.
--
-- Two boundaries this respects:
--
--   Rates are per ROLE and GRADE, never per person. TS-05 says "standard
--   rate per role", and PRD non-goal N1 keeps payroll out of TANIA. No
--   individual compensation is stored here, and none should ever be added:
--   a per-person rate column would turn this table into salary data with
--   none of the controls that would require.
--
--   Effort cost is NOT subtracted from budget_lines. Those lines cover
--   tools, training, subcon and cloud — external spend. Labour is an
--   internal cost shown beside them, and treating it as a drawdown would
--   double-count. The UI states this; so does this comment, because the
--   next person to read the view will wonder.
-- ============================================================

create table public.cost_rates (
  id           uuid primary key default gen_random_uuid(),
  fiscal_year  smallint not null,
  role         public.user_role not null,
  -- Empty string means "any grade in this role" — the fallback rate. Not
  -- NULL, because NULLs are distinct in a unique constraint and would let
  -- duplicate defaults through.
  grade        text not null default '',
  hourly_rate  numeric(12,2) not null check (hourly_rate >= 0),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (fiscal_year, role, grade)
);

create trigger trg_cost_rates_updated_at
  before update on public.cost_rates
  for each row execute function public.set_updated_at();

alter table public.cost_rates enable row level security;

-- Rate cards are commercially sensitive: same audience as budget data, and
-- `talent` has no access at all.
create policy "cost_rates_select_manager_up"
  on public.cost_rates for select to authenticated
  using (public.get_my_role() in
         ('manager', 'pm', 'chapter_lead', 'executive', 'admin'));

create policy "cost_rates_write_leads"
  on public.cost_rates for all to authenticated
  using (public.get_my_role() in ('chapter_lead', 'admin'))
  with check (public.get_my_role() in ('chapter_lead', 'admin'));

create trigger trg_audit_cost_rates
  after insert or update or delete on public.cost_rates
  for each row execute function public.audit_trigger();

-- ---------- per-person contribution to each project ----------
-- Rate resolution prefers an exact grade match, then the role fallback. A
-- person with no matching rate still appears, with hours and a NULL cost —
-- never a zero, which would read as "free".
create or replace view public.project_talent_contribution
with (security_invoker = true) as
select
  t.project_id,
  t.profile_id,
  p.full_name,
  p.squad,
  p.role,
  p.grade,
  date_trunc('month', t.work_date)::date as period_month,
  sum(t.hours) filter (where t.status = 'approved')                     as approved_hours,
  sum(t.hours) filter (where t.status = 'approved' and a.is_billable)   as billable_hours,
  max(rate.hourly_rate)                                                 as hourly_rate,
  case
    when max(rate.hourly_rate) is null then null
    else round(sum(t.hours) filter (where t.status = 'approved')
               * max(rate.hourly_rate), 2)
  end                                                                   as indicative_cost
from public.timesheets t
join public.profiles p   on p.id = t.profile_id
join public.activities a on a.id = t.activity_id
left join lateral (
  select r.hourly_rate
  from public.cost_rates r
  where r.fiscal_year = extract(year from t.work_date)::smallint
    and r.role = p.role
    and (r.grade = coalesce(p.grade, '') or r.grade = '')
  order by (r.grade <> '') desc          -- exact grade beats the fallback
  limit 1
) rate on true
group by t.project_id, t.profile_id, p.full_name, p.squad, p.role, p.grade,
         date_trunc('month', t.work_date)::date;

-- ---------- rolled up per project ----------
create or replace view public.project_effort_cost
with (security_invoker = true) as
select
  c.project_id,
  pr.code,
  pr.name,
  pr.customer,
  pr.contract_value,
  count(distinct c.profile_id)                      as contributors,
  sum(c.approved_hours)                             as approved_hours,
  sum(c.billable_hours)                             as billable_hours,
  sum(c.indicative_cost)                            as indicative_cost,
  -- How much of the contract value the chapter's own effort has consumed.
  -- NULL when either side is unknown, rather than a misleading zero.
  case
    when pr.contract_value is null or pr.contract_value = 0
      or sum(c.indicative_cost) is null then null
    else round(sum(c.indicative_cost) / pr.contract_value * 100, 1)
  end                                               as pct_of_contract,
  count(*) filter (where c.hourly_rate is null)     as rows_without_rate
from public.project_talent_contribution c
join public.projects pr on pr.id = c.project_id
group by c.project_id, pr.code, pr.name, pr.customer, pr.contract_value;
