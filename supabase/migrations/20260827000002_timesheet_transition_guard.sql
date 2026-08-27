-- ============================================================
-- TANIA — Migration 7: enforce the timesheet state machine
--
-- Why a trigger and not policies:
--   PostgreSQL evaluates permissive RLS policies for UPDATE by OR-ing every
--   USING clause against the OLD row and every WITH CHECK clause against the
--   NEW row, independently. With two UPDATE policies on public.timesheets:
--
--     timesheets_update_own_while_editable
--       USING      own AND status in (draft, rejected)
--       WITH CHECK own AND status in (draft, submitted)
--     timesheets_approve_by_manager_or_leads
--       USING      status = submitted AND profile_id <> auth.uid() AND (…)
--       WITH CHECK status in (approved, rejected)
--
--   an owner updating their OWN DRAFT row to 'approved' satisfies the first
--   policy's USING and the second policy's WITH CHECK. Neither policy permits
--   that transition on its own, but the pair does — so a talent could approve
--   their own timesheet straight from draft, bypassing TS-02 entirely and
--   getting approved_by stamped with their own id.
--
--   A BEFORE UPDATE trigger sees OLD and NEW together, so the transition can
--   be judged as a whole. Verified against PostgreSQL 16.
-- ============================================================

create or replace function public.enforce_timesheet_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor       uuid    := auth.uid();
  is_owner    boolean := old.profile_id = actor;
  may_approve boolean := actor is not null
                         and old.profile_id <> actor
                         and (public.is_manager_of(old.profile_id)
                              or public.get_my_role() in ('chapter_lead', 'admin'));
begin
  -- No session identity means this is not a browser request: migrations and
  -- admin SQL. RLS policies on this table are granted `to authenticated`
  -- only, so `anon` cannot reach this trigger.
  if actor is null then
    return new;
  end if;

  if new.status is distinct from old.status then
    if is_owner
       and old.status in ('draft', 'rejected')
       and new.status in ('draft', 'submitted') then
      null;                       -- owner submits, or reverts to draft
    elsif may_approve
       and old.status = 'submitted'
       and new.status in ('approved', 'rejected') then
      null;                       -- approver decides
    else
      raise exception
        'Transisi status timesheet tidak diizinkan: % -> %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_timesheet_transition
  before update on public.timesheets
  for each row execute function public.enforce_timesheet_transition();
