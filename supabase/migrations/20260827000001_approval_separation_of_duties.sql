-- ============================================================
-- TANIA — Migration 6: nobody approves their own timesheet
-- Completes SRS SF-2.8; closes the residual gap noted in DDD §14.
--
-- Closing G-1 (self-manager) removed the is_manager_of() route to
-- self-approval, but the role branch of this policy still let a
-- chapter_lead or admin approve their OWN submitted rows.
--
-- Decision (2026-08-27): separation of duties applies to every role.
-- A chapter lead's timesheet is approved by an admin. Anyone who files
-- timesheets must therefore be approvable by someone else — either they
-- have a manager_id, or a lead/admin other than themselves exists.
-- ============================================================

drop policy if exists "timesheets_approve_by_manager_or_leads" on public.timesheets;

create policy "timesheets_approve_by_manager_or_leads"
  on public.timesheets for update
  to authenticated
  using (
    status = 'submitted'
    -- Separation of duties: the approver is never the owner of the row.
    and profile_id <> auth.uid()
    and (public.is_manager_of(profile_id)
         or public.get_my_role() in ('chapter_lead', 'admin'))
  )
  with check (status in ('approved', 'rejected'));
