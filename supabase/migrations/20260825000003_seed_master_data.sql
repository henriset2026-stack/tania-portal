-- ============================================================
-- TANIA — Migration 3/3: Seed master data
-- Activities (TS-03) and starter skill catalogue (TM-02).
-- Projects, profiles, and budget lines are created via the app.
-- ============================================================

insert into public.activities (code, name, category, is_billable) values
  ('DEL', 'Project Delivery',        'delivery', true),
  ('PRE', 'Presales / Proposal',     'presales', false),
  ('INT', 'Internal / Chapter Work', 'internal', false),
  ('LEA', 'Leave / Cuti',            'leave',    false),
  ('TRN', 'Training / Certification','training', false)
on conflict (code) do nothing;

insert into public.skills (name, category) values
  ('Product Management',        'Product'),
  ('Business Analysis',         'Product'),
  ('Solution Architecture',     'Engineering'),
  ('Frontend Development',      'Engineering'),
  ('Backend Development',       'Engineering'),
  ('Data Engineering',          'Data & AI'),
  ('Data Science / AI',         'Data & AI'),
  ('Cloud & DevOps',            'Engineering'),
  ('Quality Assurance',         'Engineering'),
  ('UI/UX Design',              'Design'),
  ('Project Management',        'Delivery'),
  ('Presales & Solutioning',    'Commercial')
on conflict (name) do nothing;

-- ============================================================
-- RLS SMOKE TEST (dokumentasi — jalankan manual di SQL Editor,
-- JANGAN di-uncomment di migrasi):
--
--   1) Buat 2 user via Authentication → Add user (A dan B).
--   2) Set A sebagai talent, B sebagai manager dari A:
--        update profiles set role='manager' where email='b@...';
--        update profiles set manager_id=(select id from profiles
--          where email='b@...') where email='a@...';
--   3) Di SQL Editor, impersonate A:
--        select set_config('request.jwt.claims',
--          json_build_object('sub', '<uuid-A>', 'role', 'authenticated')::text,
--          true);
--        set local role authenticated;
--        select * from timesheets;   -- hanya baris milik A
--        select * from budget_lines; -- 0 baris (talent tidak boleh)
--   4) Ulangi dengan uuid B → timesheet A ikut terlihat (manager).
-- ============================================================
