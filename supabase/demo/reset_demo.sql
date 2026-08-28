-- ============================================================
-- TANIA — remove demo data
--
-- Deletes only the fixed demo UUID ranges, so anything created by hand while
-- exploring survives. Master data seeded by migration 3 (skills, activities)
-- is left alone.
--
-- Deleting the auth users cascades to their profiles, and from there to
-- timesheets, allocations and competency rows — the CASCADE chain recorded as
-- DDD G-2. That is exactly why this file must never point at real data.
-- ============================================================

delete from public.budget_entries
 where budget_line_id in (select id from public.budget_lines
                          where id::text like '44444444-4444-4444-8444-%');
delete from public.budget_lines    where id::text like '44444444-4444-4444-8444-%';
delete from public.feasibility_cases where id::text like '33333333-3333-4333-8333-%';
delete from public.timesheets      where profile_id::text like '11111111-1111-4111-8111-%';
delete from public.allocations     where profile_id::text like '11111111-1111-4111-8111-%';
delete from public.profile_skills  where profile_id::text like '11111111-1111-4111-8111-%';
delete from public.projects        where id::text like '22222222-2222-4222-8222-%';
delete from auth.users             where id::text like '11111111-1111-4111-8111-%';
