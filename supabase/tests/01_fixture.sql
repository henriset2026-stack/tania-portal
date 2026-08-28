-- ============================================================
-- Test fixture: one user per role, plus master data.
-- Applied after the migrations, before the assertions.
-- ============================================================

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'exec@t.co'),
  ('00000000-0000-0000-0000-0000000000c1', 'lead@t.co'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@t.co'),
  ('00000000-0000-0000-0000-0000000000b2', 'pm@t.co'),
  ('00000000-0000-0000-0000-0000000000d1', 'talent@t.co'),
  ('00000000-0000-0000-0000-0000000000d2', 'talent2@t.co'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@t.co');

-- Roles and the manager relationship are admin-only at runtime, so the guard
-- trigger is stood down while the fixture is built.
alter table public.profiles disable trigger trg_guard_profile_privileges;
update public.profiles set role='executive',    full_name='Exec',     squad='Chapter'  where id='00000000-0000-0000-0000-0000000000e1';
update public.profiles set role='chapter_lead', full_name='Lead',     squad='Chapter'  where id='00000000-0000-0000-0000-0000000000c1';
update public.profiles set role='manager',      full_name='Manager',  squad='Platform' where id='00000000-0000-0000-0000-0000000000a2';
update public.profiles set role='pm',           full_name='PM',       squad='Platform' where id='00000000-0000-0000-0000-0000000000b2';
update public.profiles set role='talent',       full_name='Talent A', squad='Platform',
       manager_id='00000000-0000-0000-0000-0000000000a2' where id='00000000-0000-0000-0000-0000000000d1';
update public.profiles set role='talent',       full_name='Talent B', squad='Data'     where id='00000000-0000-0000-0000-0000000000d2';
update public.profiles set role='admin',        full_name='Admin'                      where id='00000000-0000-0000-0000-0000000000a1';
alter table public.profiles enable trigger trg_guard_profile_privileges;

insert into public.projects (id, code, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'P1', 'Proyek Satu');

insert into public.budget_lines (id, fiscal_year, program, category, plan_amount) values
  ('00000000-0000-0000-0000-0000000000b1', 2026, 'Platform', 'Tools', 100000000);

insert into public.feasibility_cases (id, title, submitted_by, required_competencies) values
  ('00000000-0000-0000-0000-0000000000c2', 'Kasus Uji',
   '00000000-0000-0000-0000-0000000000b2', '{ETL}');

-- One timesheet row per talent, left in draft for the transition tests.
insert into public.timesheets (profile_id, project_id, activity_id, work_date, hours) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1',
   (select id from public.activities where code='DEL'), '2026-08-24', 8),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000f1',
   (select id from public.activities where code='DEL'), '2026-08-24', 8);

grant all on all tables in schema public to authenticated;

-- Rows in every remaining table, so a SELECT returning zero is unambiguously
-- a denial rather than an empty table.
insert into public.profile_skills (profile_id, skill_id, level)
  select '00000000-0000-0000-0000-0000000000d1', id, 4 from public.skills limit 1;

insert into public.allocations (profile_id, project_id, period_month, percent) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1', '2026-08-01', 100);

insert into public.budget_entries (budget_line_id, entry_type, amount, created_by, feasibility_case_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'realization', 85000000,
   '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-0000000000b1', 'realization', -5000000,
   '00000000-0000-0000-0000-0000000000b2', null),
  ('00000000-0000-0000-0000-0000000000b1', 'commitment',  60000000,
   '00000000-0000-0000-0000-0000000000b2', null);

insert into public.chat_conversations (id, profile_id) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1');

-- Approved hours for the utilisation assertions: Talent A works 6h on every
-- August 2026 weekday (21 of them) = 126h against a 168h capacity = 75.0%.
-- Talent B files nothing, so the view omits them entirely (SRS SF-1.5).
insert into public.timesheets (profile_id, project_id, activity_id, work_date, hours, status)
select '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1',
       (select id from public.activities where code='PRE'), d::date, 6, 'approved'
from generate_series('2026-08-01'::date, '2026-08-31'::date, '1 day') d
where extract(isodow from d) < 6;

-- ---------- project control (migration 8) ----------
insert into public.project_milestones (project_id, name, weight, planned_start, planned_finish, progress_pct, status, evidence_url) values
  ('00000000-0000-0000-0000-0000000000f1','Fase satu', 60,'2026-06-01','2026-07-31',100,'completed','https://example.invalid/evidence'),
  ('00000000-0000-0000-0000-0000000000f1','Fase dua',  40,'2026-09-01','2026-11-30',  0,'not_started',null);

insert into public.project_risks (project_id, description, probability, impact, status) values
  ('00000000-0000-0000-0000-0000000000f1','Risiko uji', 'high','high','mitigating');

insert into public.project_issues (project_id, title, severity, status, opened_at) values
  ('00000000-0000-0000-0000-0000000000f1','Issue uji','critical','open', now() - interval '5 days');
