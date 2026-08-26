-- ============================================================
-- TANIA — Migration 5/5: forbid self-managed profiles
-- Closes DDD G-1 / SRS DR-9.
--
-- Why this matters:
--   is_manager_of(target) is true when profiles.manager_id = auth.uid().
--   A profile listing itself as its own manager therefore satisfies
--   "timesheets_approve_by_manager_or_leads" for its OWN rows, letting
--   that person approve their own timesheet — defeating the separation
--   of duties that TS-02 exists to create (SRS SF-2.8).
-- ============================================================

-- ---------- 1. Repair existing violations ----------
-- guard_profile_privileges() rejects any change to manager_id unless
-- get_my_role() = 'admin'. Inside a migration auth.uid() is NULL, so
-- get_my_role() returns NULL, `NULL is distinct from 'admin'` is true,
-- and the guard would abort this repair. Disable that single trigger for
-- the statement. audit_trigger() stays enabled, so the repair is still
-- written to audit_log.
alter table public.profiles disable trigger trg_guard_profile_privileges;

update public.profiles
   set manager_id = null
 where manager_id = id;

alter table public.profiles enable trigger trg_guard_profile_privileges;

-- ---------- 2. Enforce from now on ----------
alter table public.profiles
  drop constraint if exists profiles_manager_not_self;

alter table public.profiles
  add constraint profiles_manager_not_self
  check (manager_id is null or manager_id <> id);
