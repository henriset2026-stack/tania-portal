-- ============================================================
-- TANIA — Migration 2/3: Row Level Security
-- CRITICAL: the browser holds the anon key, so RLS is the ONLY
-- security boundary. Every table gets RLS + explicit policies.
-- Role model (Section 5 of the Requirement Document):
--   executive | chapter_lead | manager | pm | talent | admin
-- ============================================================

-- ---------- Helper functions (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager_of(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = target and manager_id = auth.uid()
  );
$$;

-- Lock down direct execution surface
revoke all on function public.get_my_role() from anon;
revoke all on function public.is_manager_of(uuid) from anon;

-- ---------- Enable RLS everywhere ----------
alter table public.profiles          enable row level security;
alter table public.skills            enable row level security;
alter table public.profile_skills    enable row level security;
alter table public.projects          enable row level security;
alter table public.activities        enable row level security;
alter table public.allocations       enable row level security;
alter table public.timesheets        enable row level security;
alter table public.feasibility_cases enable row level security;
alter table public.budget_lines      enable row level security;
alter table public.budget_entries    enable row level security;
alter table public.audit_log         enable row level security;

-- No policies are created for role `anon` → anonymous users see NOTHING.

-- ============================================================
-- profiles
-- ============================================================
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- Privilege-escalation guard: only admin may change role / active flag /
-- reporting line (RLS cannot restrict per-column, so we enforce by trigger).
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() is distinct from 'admin' then
    if new.role       is distinct from old.role
    or new.is_active  is distinct from old.is_active
    or new.manager_id is distinct from old.manager_id then
      raise exception 'Only admin can change role, active status, or manager';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ============================================================
-- skills & profile_skills (TM-02: matrix searchable chapter-wide)
-- ============================================================
create policy "skills_select_authenticated"
  on public.skills for select
  to authenticated
  using (true);

create policy "skills_write_leads"
  on public.skills for all
  to authenticated
  using (public.get_my_role() in ('admin', 'chapter_lead'))
  with check (public.get_my_role() in ('admin', 'chapter_lead'));

create policy "profile_skills_select_authenticated"
  on public.profile_skills for select
  to authenticated
  using (true);

create policy "profile_skills_write_own_or_admin"
  on public.profile_skills for all
  to authenticated
  using (profile_id = auth.uid() or public.get_my_role() = 'admin')
  with check (profile_id = auth.uid() or public.get_my_role() = 'admin');

-- ============================================================
-- projects & activities (master data)
-- ============================================================
create policy "projects_select_authenticated"
  on public.projects for select
  to authenticated
  using (true);

create policy "projects_write_leads"
  on public.projects for all
  to authenticated
  using (public.get_my_role() in ('admin', 'chapter_lead', 'manager'))
  with check (public.get_my_role() in ('admin', 'chapter_lead', 'manager'));

create policy "projects_pm_update_own"
  on public.projects for update
  to authenticated
  using (pm_id = auth.uid())
  with check (pm_id = auth.uid());

create policy "activities_select_authenticated"
  on public.activities for select
  to authenticated
  using (true);

create policy "activities_write_admin"
  on public.activities for all
  to authenticated
  using (public.get_my_role() in ('admin', 'chapter_lead'))
  with check (public.get_my_role() in ('admin', 'chapter_lead'));

-- ============================================================
-- allocations (WA-01: visible to all, managed by manager+/pm)
-- ============================================================
create policy "allocations_select_authenticated"
  on public.allocations for select
  to authenticated
  using (true);

create policy "allocations_write_planners"
  on public.allocations for all
  to authenticated
  using (public.get_my_role() in ('admin', 'chapter_lead', 'manager', 'pm'))
  with check (public.get_my_role() in ('admin', 'chapter_lead', 'manager', 'pm'));

-- ============================================================
-- timesheets (TS-01..02)
--   talent : CRUD own rows while draft/rejected; may set to submitted
--   manager: read + approve/reject direct reports
--   leads  : read everything
-- ============================================================
create policy "timesheets_select_own_team_or_leads"
  on public.timesheets for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_manager_of(profile_id)
    or public.get_my_role() in ('executive', 'chapter_lead', 'admin')
  );

create policy "timesheets_insert_own"
  on public.timesheets for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and status in ('draft', 'submitted')
  );

create policy "timesheets_update_own_while_editable"
  on public.timesheets for update
  to authenticated
  using (
    profile_id = auth.uid()
    and status in ('draft', 'rejected')
  )
  with check (
    profile_id = auth.uid()
    and status in ('draft', 'submitted')
  );

create policy "timesheets_delete_own_draft"
  on public.timesheets for delete
  to authenticated
  using (profile_id = auth.uid() and status = 'draft');

create policy "timesheets_approve_by_manager_or_leads"
  on public.timesheets for update
  to authenticated
  using (
    status = 'submitted'
    and (public.is_manager_of(profile_id)
         or public.get_my_role() in ('chapter_lead', 'admin'))
  )
  with check (status in ('approved', 'rejected'));

-- Stamp submitted_at / approved_by server-side so clients can't spoof them
create or replace function public.stamp_timesheet_transitions()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    new.submitted_at := now();
  end if;
  if new.status in ('approved', 'rejected')
     and old.status is distinct from new.status then
    new.approved_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_stamp_timesheet_transitions
  before update on public.timesheets
  for each row execute function public.stamp_timesheet_transitions();

-- ============================================================
-- feasibility_cases (PF-01..04)
--   pm+    : submit cases; edit own case while undecided
--   leads  : record go/no-go/hold decision
--   all    : read the pipeline (PF-05)
-- ============================================================
create policy "feasibility_select_authenticated"
  on public.feasibility_cases for select
  to authenticated
  using (true);

create policy "feasibility_insert_pm_up"
  on public.feasibility_cases for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin')
    and decision is null
  );

create policy "feasibility_update_own_undecided"
  on public.feasibility_cases for update
  to authenticated
  using (submitted_by = auth.uid() and decision is null)
  with check (submitted_by = auth.uid() and decision is null);

create policy "feasibility_decide_leads"
  on public.feasibility_cases for update
  to authenticated
  using (public.get_my_role() in ('chapter_lead', 'admin'))
  with check (public.get_my_role() in ('chapter_lead', 'admin'));

-- Stamp decision metadata server-side (PF-04 audit trail)
create or replace function public.stamp_feasibility_decision()
returns trigger
language plpgsql
as $$
begin
  if new.decision is not null and old.decision is distinct from new.decision then
    new.decided_by := auth.uid();
    new.decided_at := now();
    if coalesce(new.decision_rationale, '') = '' then
      raise exception 'decision_rationale is required when recording a decision';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_stamp_feasibility_decision
  before update on public.feasibility_cases
  for each row execute function public.stamp_feasibility_decision();

-- ============================================================
-- budget (BC-01..05): no talent access at all
-- ============================================================
create policy "budget_lines_select_manager_up"
  on public.budget_lines for select
  to authenticated
  using (public.get_my_role() in
         ('manager', 'pm', 'chapter_lead', 'executive', 'admin'));

create policy "budget_lines_write_leads"
  on public.budget_lines for all
  to authenticated
  using (public.get_my_role() in ('chapter_lead', 'admin'))
  with check (public.get_my_role() in ('chapter_lead', 'admin'));

create policy "budget_entries_select_manager_up"
  on public.budget_entries for select
  to authenticated
  using (public.get_my_role() in
         ('manager', 'pm', 'chapter_lead', 'executive', 'admin'));

create policy "budget_entries_insert_pm_up"
  on public.budget_entries for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin')
  );

create policy "budget_entries_modify_leads"
  on public.budget_entries for update
  to authenticated
  using (public.get_my_role() in ('chapter_lead', 'admin'))
  with check (public.get_my_role() in ('chapter_lead', 'admin'));

create policy "budget_entries_delete_leads"
  on public.budget_entries for delete
  to authenticated
  using (public.get_my_role() in ('chapter_lead', 'admin'));

-- ============================================================
-- audit_log: read-only for leadership; writes only via trigger
-- (audit_trigger() is SECURITY DEFINER, so no INSERT policy needed)
-- ============================================================
create policy "audit_select_leads"
  on public.audit_log for select
  to authenticated
  using (public.get_my_role() in ('chapter_lead', 'admin'));

-- ============================================================
-- Storage: bucket for feasibility attachments (PF-06)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)  -- 10 MB per file
on conflict (id) do nothing;

create policy "attachments_read_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments');

create policy "attachments_upload_pm_up"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and public.get_my_role() in ('pm', 'manager', 'chapter_lead', 'admin')
  );

create policy "attachments_delete_owner_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and (owner = auth.uid() or public.get_my_role() = 'admin')
  );
