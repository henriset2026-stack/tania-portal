# TANIA — Portal Digital Product & Solution

Internal portal for Chapter Product & Solution (DPS), Digital Product, Telkom Indonesia.
Five modules from Requirement Document v1.0: **Talent Management (TM)**, **Workload Analysis (WA)**, **Project Timesheet (TS)**, **Project Feasibility (PF)**, **Budget Control (BC)**, plus cross-module work (XM). A sixth area, **Project Control**, was added later to close the delivery-control gap against the DPS Project & Portfolio Control Tower — milestones, schedule variance, risk and issue registers, and six-dimension project health. Its formulas mirror `DPS-Project-Control-CRM/docs/01-prd.md` §7.2–§7.7 so both products report the same numbers. A sixth module — Avatar AI (AV) — is built but **not approved for production**; see §Avatar.

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
| `guard_project_health_notes()` | A non-green Budget/Scope/Customer dimension must carry a reason, or health scores quietly stop meaning anything |
| `guard_milestone_completion()` | 100% requires evidence; stamps `actual_finish`; marks an overdue unfinished milestone `delayed` |
| `stamp_issue_resolution()` | Stamps `resolved_at`, and refuses to close an issue with no resolution text |
| `enforce_timesheet_transition()` | The TS-02 state machine. **Do not try to express transition rules as a second UPDATE policy** — Postgres ORs every USING against the old row and every WITH CHECK against the new row separately, so two policies can permit a transition neither allows alone |
| `stamp_feasibility_decision()` | `decided_by` / `decided_at` are server-set, and a decision **without** `decision_rationale` is rejected |
| `audit_trigger()` | Append-only audit rows on `profiles`, `timesheets`, `feasibility_cases`, `budget_lines`, `budget_entries` |

---

## Database rules

- Schema changes ONLY via migration files in `supabase/migrations/` (never via dashboard). Naming: `YYYYMMDDHHMMSS_short_name.sql`.
- Migrations in the repo: seven files, all **applied to the linked Supabase project** (`tmzwlurjwantvuptpvpe`, PostgreSQL 17) on 2026-08-27. `supabase migration list --linked` is the authority. Never edit an applied migration — create a new one.
- **Do not edit a migration once it has been applied to a real project** — create a new one. (`init_schema` was corrected in place on 2026-08-26 only because it could never have applied: an ambiguous GROUP BY made the view fail to create, aborting the migration.)
- After any schema change, regenerate types:
  `supabase gen types typescript --linked > src/lib/database.types.ts`
  and fix all resulting type errors before finishing.
- Dashboard data comes from views `utilization_monthly` (WA-02) and `budget_summary` (BC-05) — **query the views, don't re-aggregate in the client.** Both use `security_invoker = true` so the caller's RLS still applies.
- **Never average `utilization_monthly` rows to get a squad or chapter figure.** The view joins from `timesheets`, so anyone with no rows is absent, not zero. Use the active roster as the denominator: `Σ approved_hours ÷ (headcount × capacityHours(month))` via `src/lib/capacity.ts`. Averaging the view rows for a 6-person chapter where 1 filed nothing reads 75% instead of 62.5% — and it *rises* as more people stop filing.
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

- Keep the bundle small: `dynamic import` for chart libraries (recharts) and anything heavy. Check bundle impact before adding a dependency — shared first-load JS is already ~281 KB gzipped against the 300 KB budget in SRS NFR-3.
- Excel export uses `src/lib/xlsx.ts`, a ~200-line dependency-free writer, loaded on demand. **Do not replace it with the `xlsx` npm package**: the last published version (0.18.5) carries two unfixed high-severity advisories and would fail NFR-11, and it is ~900 KB.
- Paginate every list query (`.range()`); never `select('*')` on timesheets or audit_log without filters — Supabase free tier has a 5 GB egress cap.
- Attachment uploads go to the `attachments` bucket, max 10 MB per file, validate size client-side before upload.
- Supabase free tier auto-pauses after 7 days idle; `.github/workflows/keepalive.yml` pings every 3 days. Don't remove it, and don't let it fail silently — it exits non-zero on any non-200.
- `.github/workflows/backup.yml` dumps the database weekly. **The dump is GPG-encrypted before it becomes an artifact** because this repo is public and anyone can download artifacts. Never add a step that uploads a plaintext dump, and never remove the guard step that refuses to upload one. Required secrets: `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`.

---

## Commands

All five MVP phases are built. Every route in the page map exists.

Talent detail is `/talent/?id=…`, not `/talent/[id]` — a dynamic segment needs
`generateStaticParams()` under `output: "export"` and the ids are runtime-only.

`supabase/` (Deno) and `design/` (canvas artboards) are excluded from
`tsconfig.json` and `eslint.config.mjs` — different runtimes with their own
tooling. Do not remove those exclusions; `npm run build` fails without them.

```bash
npm run dev          # local development
npm run build        # static export → out/ (must pass before every commit)
npm run lint         # eslint
npm run test:db      # RLS + calculation suite on a throwaway postgres:16
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
    database.types.ts # GENERATED by `supabase gen types` — never edit by hand
    db.ts             # hand-written aliases over it; import types from HERE
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
- **`dev` is the default branch and holds the application.** `main` is stale — documentation only, no `package.json`, no `src/`. Work on `dev`.
- Hosting is **Vercel** (`chapter-dps/tania-portal`, public alias `https://tania-portal.vercel.app`), deployed manually with `vercel deploy --prod`. There is no Git integration yet, so a push does not deploy.
- The Netlify credit discipline in `SAD.md` AD-9 (300 credits/month, 15 per deploy, previews off) applies only if the project moves back to Netlify. `netlify.toml` is kept for that case.
- Auth is invite-only (self-signup disabled). New users are created by admins in the Supabase dashboard or an admin page.
- When a product decision is made in a session (e.g. scoring weights, capacity rules), record it below under "Decisions".
- Report honestly: if `npm run build` fails or a step was skipped, say so with the output. Do not claim a feature works without having run it.

### Before you claim a task is done

0. `npm run test:db` passes — it is the only check that proves a policy or a
   derived figure still behaves. Requires Docker; CI runs it on every push.
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
  `supabase secrets set ALLOWED_ORIGINS="https://tania-portal.vercel.app" && supabase functions deploy tania-assistant`
  Both are **already done** on project `tmzwlurjwantvuptpvpe`: the function is deployed and the allowlist holds `https://tania-portal.vercel.app,http://localhost:3000`. Verified in production — the allowed origin is echoed, a foreign origin gets 403.
  Re-run both whenever the site URL changes, or the widget breaks with a CORS error.
- This is the only paid component. `ANTHROPIC_API_KEY` is **not set**, so the widget renders and fails with a plain message rather than answering. Do not set the key without an approved monthly spend cap (BRD D2).
- The widget is `src/components/copilot.tsx`, mounted in the root layout so it appears on every signed-in page and renders nothing when signed out.

---

## Decisions

- 2026-08: MVP capacity assumption for utilization = 8h × Mon–Fri (national holidays not yet excluded).
- 2026-08: Budget committed/realized amounts are derived from `budget_entries` via `budget_summary` view — never stored on `budget_lines`.
- 2026-08: Avatar CORS uses an `ALLOWED_ORIGINS` allowlist secret with exact-match origins, not a wildcard. Default when unset is localhost only — an unconfigured deploy must fail closed, never open.
- 2026-08-27: Separation of duties on timesheet approval applies to every role — nobody approves their own row. A chapter lead's timesheet is approved by an admin and vice versa. Anyone who files timesheets must be approvable by someone else: give them a `manager_id`, or ensure a lead/admin other than themselves exists.
- 2026-08: Database backups are GPG symmetric AES-256 encrypted before upload, so backup confidentiality does not depend on repo visibility. The passphrase is the recovery key — losing it makes every backup unrecoverable.
- 2026-08: Production `ALLOWED_ORIGINS` contains **only the production frontend origin** — now `https://tania-portal.vercel.app`, not a Netlify domain. No custom Telkom domain is in scope; adding one later is a secret change plus function redeploy, not a code change.
- 2026-08: `AGENTS.md` is the canonical agent instruction file; `CLAUDE.md` imports it via `@AGENTS.md`. Edit this file, not `CLAUDE.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
