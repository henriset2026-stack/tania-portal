-- ============================================================
-- TANIA — demo data
--
-- NOT A MIGRATION. Never place this in supabase/migrations/ and never run it
-- against a project holding real chapter data. It creates fictional people
-- with a shared, publicly known password and writes timesheets, allocations,
-- feasibility cases and budget entries in their names.
--
-- Idempotent: fixed UUIDs plus ON CONFLICT DO NOTHING, so re-running adds
-- nothing. To start over, run supabase/demo/reset_demo.sql first.
--
-- Every figure is arranged to be internally consistent, so the utilisation
-- and budget screens can be checked by hand against the source rows.
-- ============================================================

-- ---------- 1. Auth users ----------
-- Created directly rather than through the Auth Admin API so this needs only
-- SQL access. Passwords are bcrypt via pgcrypto, matching what GoTrue expects.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  v.email, extensions.crypt('TaniaDemo#2026', extensions.gen_salt('bf')), now(),
  now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', v.full_name), false, false,
  -- GoTrue scans these into non-nullable Go strings; leaving them NULL makes
  -- every login fail with "Database error querying schema".
  '', '', '', ''
from (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'rina.hartati@telkom.co.id',    'Rina Hartati'),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'bagus.wibowo@telkom.co.id',    'Bagus Wibowo'),
  ('11111111-1111-4111-8111-000000000003'::uuid, 'sari.wulandari@telkom.co.id',  'Sari Wulandari'),
  ('11111111-1111-4111-8111-000000000004'::uuid, 'tono.hidayat@telkom.co.id',    'Tono Hidayat'),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'doni.setiawan@telkom.co.id',   'Doni Setiawan'),
  ('11111111-1111-4111-8111-000000000006'::uuid, 'andi.prasetyo@telkom.co.id',   'Andi Prasetyo'),
  ('11111111-1111-4111-8111-000000000007'::uuid, 'dewi.anggraini@telkom.co.id',  'Dewi Anggraini'),
  ('11111111-1111-4111-8111-000000000008'::uuid, 'budi.santoso@telkom.co.id',    'Budi Santoso'),
  ('11111111-1111-4111-8111-000000000009'::uuid, 'citra.dewi@telkom.co.id',      'Citra Dewi'),
  ('11111111-1111-4111-8111-00000000000a'::uuid, 'eka.putra@telkom.co.id',       'Eka Putra'),
  ('11111111-1111-4111-8111-00000000000b'::uuid, 'fajar.nugroho@telkom.co.id',   'Fajar Nugroho')
) as v(id, email, full_name)
on conflict (id) do nothing;

-- ---------- 2. Roles, squads, reporting lines ----------
-- guard_profile_privileges() blocks role and manager changes unless the caller
-- is an admin; inside this script auth.uid() is NULL, so it is stood down.
alter table public.profiles disable trigger trg_guard_profile_privileges;

update public.profiles p set
  role  = v.role::public.user_role,
  squad = v.squad,
  grade = v.grade,
  location = 'Jakarta',
  manager_id = v.manager_id
from (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'chapter_lead', 'Chapter',     '6', null::uuid),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'executive',    'Chapter',     '7', null),
  ('11111111-1111-4111-8111-000000000003'::uuid, 'manager',      'Platform',    '5', null),
  ('11111111-1111-4111-8111-000000000004'::uuid, 'manager',      'Integration', '5', null),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'pm',           'Platform',    '5', '11111111-1111-4111-8111-000000000003'::uuid),
  ('11111111-1111-4111-8111-000000000006'::uuid, 'talent',       'Platform',    '4', '11111111-1111-4111-8111-000000000003'::uuid),
  ('11111111-1111-4111-8111-000000000007'::uuid, 'talent',       'Platform',    '3', '11111111-1111-4111-8111-000000000003'::uuid),
  ('11111111-1111-4111-8111-000000000008'::uuid, 'talent',       'Data & AI',   '5', '11111111-1111-4111-8111-000000000004'::uuid),
  ('11111111-1111-4111-8111-000000000009'::uuid, 'talent',       'Data & AI',   '3', '11111111-1111-4111-8111-000000000004'::uuid),
  ('11111111-1111-4111-8111-00000000000a'::uuid, 'talent',       'Integration', '4', '11111111-1111-4111-8111-000000000004'::uuid),
  ('11111111-1111-4111-8111-00000000000b'::uuid, 'talent',       'Integration', '3', '11111111-1111-4111-8111-000000000004'::uuid)
) as v(id, role, squad, grade, manager_id)
where p.id = v.id;

alter table public.profiles enable trigger trg_guard_profile_privileges;

-- ---------- 3. Projects ----------
insert into public.projects (id, code, name, customer, status, pm_id, start_date, end_date) values
  ('22222222-2222-4222-8222-000000000001','DWH-01','Data Warehouse Modernisasi','Bank Nusantara','active',
   '11111111-1111-4111-8111-000000000005','2026-03-02','2026-12-18'),
  ('22222222-2222-4222-8222-000000000002','API-02','API Gateway Konsolidasi','Telkomsel','active',
   '11111111-1111-4111-8111-000000000005','2026-05-04','2026-11-27'),
  ('22222222-2222-4222-8222-000000000003','CX-03','Portal Layanan Pelanggan','PLN','active',
   '11111111-1111-4111-8111-000000000005','2026-07-01','2027-03-31'),
  ('22222222-2222-4222-8222-000000000004','INT-04','Integrasi Billing','Bank Nusantara','on_hold',
   '11111111-1111-4111-8111-000000000005','2026-02-02','2026-09-30')
on conflict (id) do nothing;

-- ---------- 4. Competency matrix (TM-02) ----------
insert into public.profile_skills (profile_id, skill_id, level, is_certified)
select v.pid, s.id, v.level, v.cert
from (values
  ('11111111-1111-4111-8111-000000000006'::uuid, 'Backend Development',   5, true),
  ('11111111-1111-4111-8111-000000000006'::uuid, 'Cloud & DevOps',        4, false),
  ('11111111-1111-4111-8111-000000000007'::uuid, 'UI/UX Design',          4, false),
  ('11111111-1111-4111-8111-000000000007'::uuid, 'Frontend Development',  3, false),
  ('11111111-1111-4111-8111-000000000008'::uuid, 'Data Engineering',      5, true),
  ('11111111-1111-4111-8111-000000000008'::uuid, 'Data Science / AI',     4, true),
  ('11111111-1111-4111-8111-000000000009'::uuid, 'Data Engineering',      3, false),
  ('11111111-1111-4111-8111-000000000009'::uuid, 'Quality Assurance',     4, false),
  ('11111111-1111-4111-8111-00000000000a'::uuid, 'Backend Development',   4, false),
  ('11111111-1111-4111-8111-00000000000a'::uuid, 'Solution Architecture', 3, false),
  ('11111111-1111-4111-8111-00000000000b'::uuid, 'Quality Assurance',     3, false),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'Project Management',    5, true),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'Presales & Solutioning',4, false)
) as v(pid, skill, level, cert)
join public.skills s on s.name = v.skill
on conflict (profile_id, skill_id) do nothing;

-- ---------- 5. Allocations (WA-01) ----------
-- Budi is deliberately over 100% so the overload alert has something to show.
insert into public.allocations (profile_id, project_id, period_month, percent)
select v.pid, v.proj, m.month, v.pct
from (values
  ('11111111-1111-4111-8111-000000000006'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 100),
  ('11111111-1111-4111-8111-000000000007'::uuid, '22222222-2222-4222-8222-000000000003'::uuid, 100),
  ('11111111-1111-4111-8111-000000000008'::uuid, '22222222-2222-4222-8222-000000000001'::uuid,  80),
  ('11111111-1111-4111-8111-000000000008'::uuid, '22222222-2222-4222-8222-000000000002'::uuid,  40),
  ('11111111-1111-4111-8111-000000000009'::uuid, '22222222-2222-4222-8222-000000000001'::uuid,  80),
  ('11111111-1111-4111-8111-00000000000a'::uuid, '22222222-2222-4222-8222-000000000002'::uuid,  60),
  ('11111111-1111-4111-8111-00000000000b'::uuid, '22222222-2222-4222-8222-000000000002'::uuid,  80)
) as v(pid, proj, pct)
cross join (values ('2026-07-01'::date), ('2026-08-01'::date), ('2026-09-01'::date)) as m(month)
on conflict (profile_id, project_id, period_month) do nothing;

-- ---------- 6. Timesheets (TS-01, TS-02) ----------
-- Approved history: every weekday from 1 July to 21 August 2026.
-- Dewi Anggraini files nothing at all, so she is absent from
-- utilization_monthly and the UI must still show her at 0% (SRS SF-1.5).
insert into public.timesheets (profile_id, project_id, activity_id, work_date, hours, status, notes)
select v.pid, v.proj, a.id, d::date, v.h, 'approved', null
from (values
  ('11111111-1111-4111-8111-000000000006'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 6.0),
  ('11111111-1111-4111-8111-000000000008'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 8.0),
  ('11111111-1111-4111-8111-000000000009'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 7.0),
  ('11111111-1111-4111-8111-00000000000a'::uuid, '22222222-2222-4222-8222-000000000002'::uuid, 4.0),
  ('11111111-1111-4111-8111-00000000000b'::uuid, '22222222-2222-4222-8222-000000000002'::uuid, 5.0)
) as v(pid, proj, h)
cross join generate_series('2026-07-01'::date, '2026-08-21'::date, '1 day') d
join public.activities a on a.code = 'DEL'
where extract(isodow from d) < 6
on conflict (profile_id, project_id, activity_id, work_date) do nothing;

-- Current week (24–28 Aug): a live approval queue.
--   Andi  submitted 40h  · Citra submitted 44h (trips the >40 warning)
--   Eka   submitted 30h  · Fajar draft (not yet submitted)
--   Budi  rejected, so the "fix and resubmit" path is visible
insert into public.timesheets (profile_id, project_id, activity_id, work_date, hours, status, approval_note)
select v.pid, v.proj, a.id, d::date, v.h, v.st::public.timesheet_status, v.note
from (values
  ('11111111-1111-4111-8111-000000000006'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 8.0, 'submitted', null),
  ('11111111-1111-4111-8111-000000000009'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 8.8, 'submitted', null),
  ('11111111-1111-4111-8111-00000000000a'::uuid, '22222222-2222-4222-8222-000000000002'::uuid, 6.0, 'submitted', null),
  ('11111111-1111-4111-8111-00000000000b'::uuid, '22222222-2222-4222-8222-000000000002'::uuid, 5.0, 'draft',     null),
  ('11111111-1111-4111-8111-000000000008'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 8.0, 'rejected',
   'Jam integrasi masuk ke kode proyek yang salah — mohon pindah ke API-02.')
) as v(pid, proj, h, st, note)
cross join generate_series('2026-08-24'::date, '2026-08-28'::date, '1 day') d
join public.activities a on a.code = 'DEL'
where extract(isodow from d) < 6
on conflict (profile_id, project_id, activity_id, work_date) do nothing;

-- A little presales, so the category split is not all delivery.
insert into public.timesheets (profile_id, project_id, activity_id, work_date, hours, status)
select '11111111-1111-4111-8111-000000000005'::uuid,
       '22222222-2222-4222-8222-000000000003'::uuid, a.id, d::date, 4.0, 'approved'
from generate_series('2026-08-03'::date, '2026-08-21'::date, '1 day') d
join public.activities a on a.code = 'PRE'
where extract(isodow from d) < 6
on conflict (profile_id, project_id, activity_id, work_date) do nothing;

-- ---------- 7. Feasibility pipeline (PF-01..05) ----------
insert into public.feasibility_cases (
  id, title, customer, description, estimated_revenue, estimated_effort_md,
  estimated_duration_mo, required_competencies,
  score_strategic, score_financial, score_risk, score_resource, score_technical,
  decision, decision_rationale, decided_by, submitted_by
) values
  ('33333333-3333-4333-8333-000000000001','Migrasi Data Warehouse Bank X','Bank X',
   'Migrasi warehouse on-premise ke arsitektur lakehouse.',2400000000,320,6.0,
   '{"Data Engineering","Solution Architecture"}',5,4,3,4,3,
   null,null,null,'11111111-1111-4111-8111-000000000005'),
  ('33333333-3333-4333-8333-000000000002','Platform Analitik Ritel','Sinar Jaya',
   'Dashboard penjualan near-real-time untuk 200 gerai.',1150000000,180,4.0,
   '{"Data Science / AI","Frontend Development"}',4,4,3,3,4,
   null,null,null,'11111111-1111-4111-8111-000000000005'),
  ('33333333-3333-4333-8333-000000000003','Modernisasi Core Billing','PLN',
   'Penggantian mesin billing legacy.',5600000000,900,14.0,
   '{"Backend Development","Solution Architecture","Quality Assurance"}',5,5,2,2,2,
   'hold','Nilai strategis tinggi, tetapi kapasitas Solution Architecture tidak memadai sebelum kuartal I 2027. Ditinjau ulang setelah DWH-01 selesai.',
   '11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000005'),
  ('33333333-3333-4333-8333-000000000004','Chatbot Layanan Pelanggan','Telkomsel',
   'Asisten percakapan untuk tier-1 support.',780000000,120,3.0,
   '{"Data Science / AI"}',4,3,4,4,4,
   'go','Effort kecil, kompetensi tersedia, dan menjadi rujukan untuk peluang AI berikutnya.',
   '11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000005'),
  ('33333333-3333-4333-8333-000000000005','Sistem Logistik Terpadu','Pos Indonesia',
   'Perencanaan rute dan pelacakan armada.',920000000,260,7.0,
   '{"Backend Development","UI/UX Design"}',2,3,2,2,3,
   'no_go','Marjin di bawah ambang chapter dan tidak selaras dengan fokus data & integrasi.',
   '11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000005')
on conflict (id) do nothing;

-- ---------- 8. Budget (BC-01..05) ----------
insert into public.budget_lines (id, fiscal_year, program, category, description, plan_amount, owner_id) values
  ('44444444-4444-4444-8444-000000000001',2026,'Platform','Tools','Lisensi & tooling engineering',
   400000000,'11111111-1111-4111-8111-000000000001'),
  ('44444444-4444-4444-8444-000000000002',2026,'Platform','Training','Sertifikasi & pelatihan chapter',
   150000000,'11111111-1111-4111-8111-000000000001'),
  ('44444444-4444-4444-8444-000000000003',2026,'Delivery','Subcon','Tenaga ahli pihak ketiga',
   800000000,'11111111-1111-4111-8111-000000000001'),
  ('44444444-4444-4444-8444-000000000004',2026,'Delivery','Cloud','Konsumsi cloud proyek delivery',
   600000000,'11111111-1111-4111-8111-000000000001')
on conflict (id) do nothing;

-- Tools sits at 82.5% (amber), Subcon at 105% (red), the rest comfortable.
-- One negative entry is a correction, which must be summed, not deleted.
insert into public.budget_entries (budget_line_id, entry_type, amount, description, entry_date, created_by, feasibility_case_id)
values
  ('44444444-4444-4444-8444-000000000001','commitment', 120000000,'PO perpanjangan lisensi observability','2026-04-14','11111111-1111-4111-8111-000000000001',null),
  ('44444444-4444-4444-8444-000000000001','realization',210000000,'Lisensi observability kuartal I–II','2026-06-30','11111111-1111-4111-8111-000000000001',null),
  ('44444444-4444-4444-8444-000000000001','realization',135000000,'Lisensi BI & data catalog','2026-08-12','11111111-1111-4111-8111-000000000001',null),
  ('44444444-4444-4444-8444-000000000001','realization', -15000000,'Koreksi pembebanan ganda Juli','2026-08-18','11111111-1111-4111-8111-000000000001',null),

  ('44444444-4444-4444-8444-000000000002','realization', 42000000,'Sertifikasi cloud 6 engineer','2026-05-20','11111111-1111-4111-8111-000000000001',null),
  ('44444444-4444-4444-8444-000000000002','commitment',  35000000,'Pelatihan data engineering H2','2026-08-05','11111111-1111-4111-8111-000000000001',null),

  ('44444444-4444-4444-8444-000000000003','commitment', 500000000,'Kontrak subcon DWH-01','2026-03-10','11111111-1111-4111-8111-000000000005','33333333-3333-4333-8333-000000000004'),
  ('44444444-4444-4444-8444-000000000003','realization',620000000,'Penagihan subcon Maret–Juli','2026-07-31','11111111-1111-4111-8111-000000000005',null),
  ('44444444-4444-4444-8444-000000000003','realization',220000000,'Penagihan subcon Agustus','2026-08-25','11111111-1111-4111-8111-000000000005',null),

  ('44444444-4444-4444-8444-000000000004','realization',180000000,'Konsumsi cloud semester I','2026-06-30','11111111-1111-4111-8111-000000000005',null),
  ('44444444-4444-4444-8444-000000000004','commitment', 240000000,'Reservasi kapasitas H2','2026-07-15','11111111-1111-4111-8111-000000000001',null);
