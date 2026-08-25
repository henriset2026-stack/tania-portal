# TANIA — Portal Digital Product & Solution

Internal portal for Chapter Product & Solution (DPS), Digital Product, Telkom Indonesia.
Five modules: **Talent Management (TM)**, **Workload Analysis (WA)**, **Project Timesheet (TS)**, **Project Feasibility (PF)**, **Budget Control (BC)**.
Requirement reference: `docs/TANIA_Requirement_Document_v1.0` (requirement IDs like TM-01, WA-02, TS-02, PF-04, BC-05 refer to that document).

## Stack (do NOT change without explicit approval)

- **Frontend**: Next.js (App Router) with `output: 'export'` in `next.config` — **pure static export**.
  - FORBIDDEN: SSR, API routes, route handlers, server actions, middleware, `next/image` default loader (use `images: { unoptimized: true }`).
  - Every build must succeed with `npm run build` producing the `out/` folder.
- **UI**: Tailwind CSS + shadcn/ui. UI language: **Bahasa Indonesia**. Code, comments, commit messages: **English**.
- **Backend**: Supabase only (PostgreSQL + Auth + Storage) via `@supabase/supabase-js`. No custom API layer of any kind.
- **Hosting**: Netlify **Free tier** (credit-based, hard limit). Every production deploy costs credits — never suggest workflows that deploy on every commit.

## Security rules (non-negotiable)

1. The browser holds the Supabase `anon` key, so **RLS is the only security boundary**. Every new table MUST get RLS enabled + explicit policies in the same migration. No exceptions.
2. Roles (`executive`, `chapter_lead`, `manager`, `pm`, `talent`, `admin`) live in `public.profiles.role` and are enforced by RLS via `get_my_role()` — **never** enforce authorization only in frontend code. Frontend role checks are UX sugar, not security.
3. Never trust client-set values for `submitted_at`, `approved_by`, `decided_by`, `decided_at` — these are stamped by DB triggers. Do not add UI that writes them.
4. Never expose or commit the `service_role` key. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may appear in the frontend/env.
5. `talent` role has zero access to budget tables. Do not build UI that assumes otherwise.

## Database rules

- Schema changes ONLY via migration files in `supabase/migrations/` (never via dashboard). Naming: `YYYYMMDDHHMMSS_short_name.sql`.
- Existing migrations (already applied): `..._init_schema.sql`, `..._rls_policies.sql`, `..._seed_master_data.sql`. Do not edit applied migrations — create new ones.
- After any schema change, regenerate types:
  `supabase gen types typescript --linked > src/lib/database.types.ts`
  and fix all resulting type errors before finishing.
- Dashboard data comes from views `utilization_monthly` (WA-02) and `budget_summary` (BC-05) — query the views, don't re-aggregate in the client.
- Feasibility scoring weights (PF-02) are hardcoded in the `total_score` generated column (25/25/20/15/15). Changing weights = new migration, and requires management approval first — flag it, don't just do it.

## Performance / free-tier discipline

- Keep the bundle small: `dynamic import` for chart libraries (recharts), `xlsx`, and anything heavy. Check bundle impact before adding a dependency.
- Paginate every list query (`.range()`); never `select('*')` on timesheets or audit_log without filters — Supabase free tier has a 5 GB egress cap.
- Attachment uploads go to the `attachments` bucket, max 10 MB per file, validate size client-side before upload.

## Commands

```bash
npm run dev          # local development
npm run build        # static export → out/ (must pass before every commit)
npm run lint         # eslint
supabase db push     # apply new migrations
supabase gen types typescript --linked > src/lib/database.types.ts
```

## Project structure

```
src/
  app/                # App Router pages: /login, /dashboard, /talent, /timesheet,
                      # /workload, /feasibility, /budget, /admin
  components/         # shared components (shadcn/ui in components/ui)
  lib/
    supabase.ts       # typed Supabase browser client (singleton)
    database.types.ts # GENERATED — never edit by hand
supabase/
  migrations/         # SQL migrations (append-only)
docs/                 # requirement document, guides
```

## Workflow conventions

- One module/phase per session. Plan first for any non-trivial feature: propose an implementation plan, wait for approval, then code.
- Run `npm run build` after completing each feature — static export breaks silently when server-only APIs sneak in.
- Daily work on branch `dev`; merge to `main` max 2–3×/week (each `main` deploy costs 15 Netlify credits). Never enable Netlify deploy previews.
- Auth is invite-only (self-signup disabled). New users are created by admins in the Supabase dashboard or an admin page.
- When a product decision is made in a session (e.g. scoring weights, capacity rules), record it in this file under "Decisions".

## Decisions

- 2026-08: MVP capacity assumption for utilization = 8h × Mon–Fri (national holidays not yet excluded).
- 2026-08: Budget committed/realized amounts are derived from `budget_entries` via `budget_summary` view — never stored on `budget_lines`.
