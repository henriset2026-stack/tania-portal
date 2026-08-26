# TANIA — Portal Digital Product & Solution

Internal portal for Chapter Product & Solution (DPS), Digital Product, Telkom Indonesia.
Five modules: **Talent Management (TM)**, **Workload Analysis (WA)**, **Project Timesheet (TS)**, **Project Feasibility (PF)**, **Budget Control (BC)**, plus cross-module work (XM). A sixth module — Avatar AI (AV) — is built but **not approved for production**; see §Avatar.

**Read before changing anything:** `BRD.md` (why it is worth doing) · `PRD.md` (what and why) · `SAD.md` (how it is built) · `SRS.md` (formal, testable behaviour — the SF-x rules and acceptance criteria) · `TRD.md` (data dictionary, config inventory, query and endpoint contracts) · `DDD.md` (database design, ON DELETE policy, RLS patterns, known gaps) · `UIUX.md` (page map, screen specs, required states, formats) · `supabase/migrations/` (the actual truth).
Requirement IDs like TM-01, WA-02, TS-02, PF-04, BC-05 refer to `docs/TANIA_Requirement_Document_v1.0.pdf`.

> When this file, the docs, and the migrations disagree, **the migrations win**. Fix the docs, not the schema.

---

## Stack (do NOT change without explicit approval)

- **Frontend**: Next.js (App Router) with `output: 'export'` in `next.config` — **pure static export**.
  - FORBIDDEN: SSR, API routes, route handlers, server actions, middleware, `next/image` default loader (use `images: { unoptimized: true }`).
  - Every build must succeed with `npm run build` producing the `out/` folder.
- **UI**: Tailwind CSS + shadcn/ui. UI language: **Bahasa Indonesia**. Code, comments, commit messages: **English**.
- **Backend**: Supabase only (PostgreSQL + Auth + Storage) via `@supabase/supabase-js`. No custom API layer of any kind.
- **Hosting**: Netlify **Free tier** (credit-based, hard limit). Every production deploy costs credits — never suggest workflows that deploy on every commit.

The whole architecture rests on one decision: **there is no application server, so the database is the only place security can live.** Do not propose changes that quietly reintroduce a server tier.

---

## Security rules (non-negotiable)

1. The browser holds the Supabase `anon` key, so **RLS is the only security boundary**. Every new table MUST get RLS enabled + explicit policies in the same migration. No exceptions.
2. Roles (`executive`, `chapter_lead`, `manager`, `pm`, `talent`, `admin`) live in `public.profiles.role` and are enforced by RLS via `get_my_role()` — **never** enforce authorization only in frontend code. Frontend role checks are UX sugar, not security.
3. Never trust client-set values for `submitted_at`, `approved_by`, `decided_by`, `decided_at` — these are stamped by DB triggers. Do not add UI that writes them.
4. Never expose or commit the `service_role` key. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may appear in the frontend/env.
5. `talent` role has zero access to budget tables. Do not build UI that assumes otherwise.
6. **This repository is public.** Never commit `.env*`, database dumps, real personnel data, or customer names. Assume anything committed is permanently public.

### Helper functions — why they are SECURITY DEFINER

`get_my_role()` and `is_manager_of(target)` are `stable` + `security definer` + `set search_path = public`, and revoked from `anon`. This is deliberate: a policy on `profiles` that reads `profiles` would recurse forever without them. If you add a helper for policies, follow the same shape.

### Triggers that enforce integrity — do not bypass

| Trigger | What it guarantees |
|---|---|
| `handle_new_user()` | A `profiles` row exists for every `auth.users` row |
| `guard_profile_privileges()` | Non-admins cannot change `role`, `is_active`, or `manager_id` — including on their own row |
| `stamp_timesheet_transitions()` | `submitted_at` / `approved_by` are server-set on status change |
| `stamp_feasibility_decision()` | `decided_by` / `decided_at` are server-set, and a decision **without** `decision_rationale` is rejected |
| `audit_trigger()` | Append-only audit rows on `profiles`, `timesheets`, `feasibility_cases`, `budget_lines`, `budget_entries` |

---

## Database rules

- Schema changes ONLY via migration files in `supabase/migrations/` (never via dashboard). Naming: `YYYYMMDDHHMMSS_short_name.sql`.
- Migrations in the repo: `..._init_schema.sql`, `..._rls_policies.sql`, `..._seed_master_data.sql`, `..._avatar_chat.sql`, `..._profile_manager_not_self.sql`. All five verified to apply in order on a clean PostgreSQL 16. **There is no evidence any of them has been pushed to a Supabase project yet** — confirm before assuming the schema is live.
- **Do not edit a migration once it has been applied to a real project** — create a new one. (`init_schema` was corrected in place on 2026-08-26 only because it could never have applied: an ambiguous GROUP BY made the view fail to create, aborting the migration.)
- After any schema change, regenerate types:
  `supabase gen types typescript --linked > src/lib/database.types.ts`
  and fix all resulting type errors before finishing.
- Dashboard data comes from views `utilization_monthly` (WA-02) and `budget_summary` (BC-05) — **query the views, don't re-aggregate in the client.** Both use `security_invoker = true` so the caller's RLS still applies.
- Derived numbers live in the database, never in the client:
  - `feasibility_cases.total_score` is a **generated column** (weights 25/25/20/15/15, ×20 → 0–100).
  - `committed_amount` / `realized_amount` are **never stored** on `budget_lines` — they come from `budget_entries` via `budget_summary`.
- Feasibility scoring weights (PF-02) are hardcoded in the `total_score` generated column. Changing weights = new migration, and requires management approval first — **flag it, don't just do it.**

### Invariants the schema already enforces — don't re-implement in JS, don't violate

- `timesheets`: unique per (`profile_id`, `project_id`, `activity_id`, `work_date`); `hours` > 0 and ≤ 24.
- `allocations`: unique per (`profile_id`, `project_id`, `period_month`); `percent` > 0 and ≤ 150; `period_month` must be the 1st of the month.
- `budget_lines`: unique per (`fiscal_year`, `program`, `category`).
- `profile_skills.level` between 1 and 5; each `feasibility_cases` dimension score between 0 and 5.

---

## Performance / free-tier discipline

- Keep the bundle small: `dynamic import` for chart libraries (recharts), `xlsx`, and anything heavy. Check bundle impact before adding a dependency.
- Paginate every list query (`.range()`); never `select('*')` on timesheets or audit_log without filters — Supabase free tier has a 5 GB egress cap.
- Attachment uploads go to the `attachments` bucket, max 10 MB per file, validate size client-side before upload.
- Supabase free tier auto-pauses after 7 days idle; `.github/workflows/keepalive.yml` pings every 3 days. Don't remove it, and don't let it fail silently — it exits non-zero on any non-200.
- `.github/workflows/backup.yml` dumps the database weekly. **The dump is GPG-encrypted before it becomes an artifact** because this repo is public and anyone can download artifacts. Never add a step that uploads a plaintext dump, and never remove the guard step that refuses to upload one. Required secrets: `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`.

---

## Commands

```bash
npm run dev          # local development
npm run build        # static export → out/ (must pass before every commit)
npm run lint         # eslint
supabase db push     # apply new migrations
supabase gen types typescript --linked > src/lib/database.types.ts
```

---

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
  functions/
    tania-assistant/  # Avatar edge function (Deno)
docs/                 # requirement document, guides, avatar addendum
PRD.md · SAD.md       # product requirements · architecture
```

---

## Workflow conventions

- One module/phase per session. **Plan first for any non-trivial feature**: propose an implementation plan, wait for approval, then code.
- Run `npm run build` after completing each feature — static export breaks silently when server-only APIs sneak in.
- Daily work on branch `dev`; merge to `main` max 2–3×/week (each `main` deploy costs 15 of 300 monthly Netlify credits). Never enable Netlify deploy previews.
- Auth is invite-only (self-signup disabled). New users are created by admins in the Supabase dashboard or an admin page.
- When a product decision is made in a session (e.g. scoring weights, capacity rules), record it below under "Decisions".
- Report honestly: if `npm run build` fails or a step was skipped, say so with the output. Do not claim a feature works without having run it.

### Before you claim a task is done

1. `npm run build` passes.
2. Any new table has RLS enabled **and** explicit policies in the same migration.
3. Types regenerated if the schema changed, with no type errors left.
4. No new `select('*')` without filters, no un-paginated list query.
5. Nothing sensitive added to a public repo.

---

## Avatar (module 6 — built, NOT approved for production)

Edge function `supabase/functions/tania-assistant/` + tables `chat_conversations`, `chat_messages`.

- `ANTHROPIC_API_KEY` lives **only** in the edge function secret — never in the browser, never in the repo.
- Every DB tool runs with the **caller's JWT**, so RLS applies: a `talent` asking about budget gets zero rows. Security comes from RLS, **not** from prompt instructions. Never "fix" a permission issue by editing the system prompt.
- Read-only by design (AV-04). The bot never writes data; it points users to the module page.
- Chat history is private per user (AV-05) — there is no admin read path, and none should be added.
- Token usage is recorded per message (AV-06) for cost monitoring.
- Browser access is limited to the `ALLOWED_ORIGINS` secret (exact-match origins). Unset = `http://localhost:3000` only, so an unconfigured deploy fails closed. Production holds **exactly one origin — the Netlify domain**; do not add others "just in case":
  `supabase secrets set ALLOWED_ORIGINS="https://<site>.netlify.app" && supabase functions deploy tania-assistant`
  Re-run both whenever the site URL changes, or the widget breaks with a CORS error.
- This is the only paid component. Do not enable it in production without an approved monthly spend cap.

---

## Decisions

- 2026-08: MVP capacity assumption for utilization = 8h × Mon–Fri (national holidays not yet excluded).
- 2026-08: Budget committed/realized amounts are derived from `budget_entries` via `budget_summary` view — never stored on `budget_lines`.
- 2026-08: Avatar CORS uses an `ALLOWED_ORIGINS` allowlist secret with exact-match origins, not a wildcard. Default when unset is localhost only — an unconfigured deploy must fail closed, never open.
- 2026-08-27: Separation of duties on timesheet approval applies to every role — nobody approves their own row. A chapter lead's timesheet is approved by an admin and vice versa. Anyone who files timesheets must be approvable by someone else: give them a `manager_id`, or ensure a lead/admin other than themselves exists.
- 2026-08: Database backups are GPG symmetric AES-256 encrypted before upload, so backup confidentiality does not depend on repo visibility. The passphrase is the recovery key — losing it makes every backup unrecoverable.
- 2026-08: Production `ALLOWED_ORIGINS` contains **only the Netlify domain**. No custom Telkom domain is in scope; adding one later is a secret change plus function redeploy, not a code change.
- 2026-08: `AGENTS.md` is the canonical agent instruction file; `CLAUDE.md` imports it via `@AGENTS.md`. Edit this file, not `CLAUDE.md`.
