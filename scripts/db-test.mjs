#!/usr/bin/env node
/**
 * Authorization and calculation tests against a real PostgreSQL instance.
 *
 * SRS §8.2 makes this a release gate: no (role × table) combination may go
 * without both an ALLOW and a DENY result, and the derived figures must be
 * cross-checked. These ran as throwaway scripts while the modules were built;
 * this is the same set, kept.
 *
 *   node scripts/db-test.mjs            # spins up Docker postgres:16
 *   PSQL="psql postgresql://..." node scripts/db-test.mjs   # existing server
 *
 * A note on measuring: an UPDATE or DELETE filtered away by RLS affects zero
 * rows and raises NO error. Absence of an error therefore proves nothing —
 * every write case below asserts on rows affected.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CONTAINER = "tania-db-test";
const MIGRATIONS = "supabase/migrations";
const TESTS = "supabase/tests";
const EXTERNAL = process.env.PSQL;

/* ------------------------------------------------------------------ users */

const U = {
  executive: "00000000-0000-0000-0000-0000000000e1",
  chapter_lead: "00000000-0000-0000-0000-0000000000c1",
  manager: "00000000-0000-0000-0000-0000000000a2",
  pm: "00000000-0000-0000-0000-0000000000b2",
  talent: "00000000-0000-0000-0000-0000000000d1",
  talent_other: "00000000-0000-0000-0000-0000000000d2",
  admin: "00000000-0000-0000-0000-0000000000a1",
};
const PROJECT = "00000000-0000-0000-0000-0000000000f1";
const CASE = "00000000-0000-0000-0000-0000000000c2";
const LINE = "00000000-0000-0000-0000-0000000000b1";

/* -------------------------------------------------------------- plumbing  */

function sh(cmd, args, input) {
  return execFileSync(cmd, args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function psql(sql, { tuples = false } = {}) {
  const flags = ["-U", "postgres", "-v", "ON_ERROR_STOP=1"];
  if (tuples) flags.push("-t", "-A");
  if (EXTERNAL) {
    const [bin, ...rest] = EXTERNAL.split(" ");
    return sh(bin, [...rest, ...flags.filter((f) => f !== "-U" && f !== "postgres")], sql);
  }
  return sh("docker", ["exec", "-i", CONTAINER, "psql", ...flags], sql);
}

/** Run `sql` as `uid`, returning rows affected (or throwing on a DB error). */
function asUser(uid, sql) {
  const out = psql(
    `begin;
     set local role authenticated;
     set local request.jwt.claim.sub = '${uid}';
     ${sql}
     commit;`,
  );
  const tags = [...out.matchAll(/^(SELECT|INSERT \d+|UPDATE|DELETE)\s+(\d+)$/gm)];
  return tags.length ? Number(tags[tags.length - 1][2]) : 0;
}

/** Rows a user can SELECT from a relation. */
function visibleRows(uid, relation) {
  return Number(
    psql(
      `begin;
       set local role authenticated;
       set local request.jwt.claim.sub = '${uid}';
       select count(*) from public.${relation};
       rollback;`,
      { tuples: true },
    )
      .trim()
      .split("\n")
      .filter((l) => /^\d+$/.test(l))
      .pop(),
  );
}

let pass = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Expect a statement to be permitted (rows affected > 0) or not. */
function expectWrite(name, uid, sql, allowed) {
  let got, detail = "";
  try {
    const n = asUser(uid, sql);
    got = n > 0;
    if (!got) detail = "0 rows";
  } catch (e) {
    got = false;
    detail = String(e.stderr || e.message).split("\n").find((l) => /ERROR/.test(l))?.slice(0, 80) ?? "error";
  }
  check(name, got === allowed, got === allowed ? "" : `wanted ${allowed ? "ALLOW" : "DENY"}, got ${got ? "ALLOW" : `DENY (${detail})`}`);
}

/* ---------------------------------------------------------------- set-up */

function bootstrap() {
  if (!EXTERNAL) {
    try { sh("docker", ["rm", "-f", CONTAINER]); } catch {}
    sh("docker", ["run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=pg", "postgres:16"]);
    process.stdout.write("  waiting for postgres");
    for (let i = 0; i < 60; i++) {
      try {
        sh("docker", ["exec", CONTAINER, "pg_isready", "-U", "postgres"]);
        break;
      } catch {
        process.stdout.write(".");
        sh("sleep", ["1"]);
      }
    }
    sh("sleep", ["2"]);
    console.log(" ready");
  }
  psql(readFileSync(join(TESTS, "00_supabase_stub.sql"), "utf8"));
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    psql(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  psql(readFileSync(join(TESTS, "01_fixture.sql"), "utf8"));
}

function teardown() {
  if (!EXTERNAL) {
    try { sh("docker", ["rm", "-f", CONTAINER]); } catch {}
  }
}

/* ----------------------------------------------------------------- tests */

/** SRS §8.2: every (role × table) needs an ALLOW and a DENY somewhere. */
const READ_MATRIX = {
  profiles:            { allow: ["executive", "chapter_lead", "manager", "pm", "talent", "admin"], deny: [] },
  skills:              { allow: ["executive", "talent", "admin"], deny: [] },
  profile_skills:      { allow: ["executive", "talent", "admin"], deny: [] },
  projects:            { allow: ["executive", "talent", "admin"], deny: [] },
  activities:          { allow: ["executive", "talent", "admin"], deny: [] },
  allocations:         { allow: ["executive", "manager", "talent", "admin"], deny: [] },
  feasibility_cases:   { allow: ["executive", "chapter_lead", "pm", "talent", "admin"], deny: [] },
  budget_lines:        { allow: ["executive", "chapter_lead", "manager", "pm", "admin"], deny: ["talent"] },
  budget_entries:      { allow: ["executive", "chapter_lead", "manager", "pm", "admin"], deny: ["talent"] },
  budget_summary:      { allow: ["executive", "chapter_lead", "manager", "pm", "admin"], deny: ["talent"] },
  audit_log:           { allow: ["chapter_lead", "admin"], deny: ["executive", "manager", "pm", "talent"] },
  utilization_monthly: { allow: ["executive", "chapter_lead", "admin"], deny: [] },
  project_milestones:  { allow: ["executive", "pm", "talent", "admin"], deny: [] },
  project_risks:       { allow: ["executive", "pm", "talent", "admin"], deny: [] },
  project_issues:      { allow: ["executive", "pm", "talent", "admin"], deny: [] },
  project_health:      { allow: ["executive", "chapter_lead", "pm", "admin"], deny: [] },
  project_progress:    { allow: ["executive", "chapter_lead", "pm", "admin"], deny: [] },
  talent_performance:  { allow: ["executive", "chapter_lead", "admin"], deny: [] },
  cost_rates:          { allow: ["executive", "chapter_lead", "manager", "pm", "admin"], deny: ["talent"] },
  // A development plan is personal: owner, their manager, and leadership only.
  development_goals:   { allow: ["chapter_lead", "admin", "manager"], deny: ["pm", "executive", "talent_other"] },
  chat_conversations:  { allow: ["talent"], deny: ["chapter_lead", "admin", "executive"] },
};

function readTests() {
  console.log("\n── read access (role × table) ──");
  for (const [table, spec] of Object.entries(READ_MATRIX)) {
    for (const role of spec.allow) {
      const n = visibleRows(U[role], table);
      check(`${role} reads ${table}`, n > 0, n === 0 ? "0 rows, expected some" : "");
    }
    for (const role of spec.deny) {
      const n = visibleRows(U[role], table);
      check(`${role} blocked from ${table}`, n === 0, n > 0 ? `saw ${n} rows` : "");
    }
  }
  // Own-row scoping, not just table-level access.
  check(
    "talent sees only their own chat",
    visibleRows(U.talent_other, "chat_conversations") === 0,
  );
  check(
    "talent sees their own timesheet rows",
    visibleRows(U.talent, "timesheets") > 0,
  );
}

function timesheetTests() {
  console.log("\n── timesheet lifecycle (TS-01, TS-02, SF-2) ──");
  const day = "'2026-09-07'";
  const act = "(select id from public.activities where code='DEL')";

  expectWrite("talent inserts their own row", U.talent,
    `insert into public.timesheets (profile_id,project_id,activity_id,work_date,hours)
     values ('${U.talent}','${PROJECT}',${act},${day},6);`, true);

  expectWrite("talent inserts for someone else", U.talent,
    `insert into public.timesheets (profile_id,project_id,activity_id,work_date,hours)
     values ('${U.talent_other}','${PROJECT}',${act},${day},6);`, false);

  // The cross-policy hole closed by migration 7: an owner must not be able to
  // jump a draft row straight to approved.
  expectWrite("talent approves their own draft", U.talent,
    `update public.timesheets set status='approved'
     where profile_id='${U.talent}' and work_date=${day};`, false);

  expectWrite("talent submits", U.talent,
    `update public.timesheets set status='submitted'
     where profile_id='${U.talent}' and work_date=${day} and status='draft';`, true);

  expectWrite("talent edits after submitting", U.talent,
    `update public.timesheets set hours=7
     where profile_id='${U.talent}' and work_date=${day};`, false);

  expectWrite("unrelated manager approves", U.pm,
    `update public.timesheets set status='approved'
     where profile_id='${U.talent}' and work_date=${day} and status='submitted';`, false);

  expectWrite("their manager rejects with a note", U.manager,
    `update public.timesheets set status='rejected', approval_note='Perbaiki.'
     where profile_id='${U.talent}' and work_date=${day} and status='submitted';`, true);

  expectWrite("talent fixes a rejected row", U.talent,
    `update public.timesheets set hours=7
     where profile_id='${U.talent}' and work_date=${day};`, true);

  expectWrite("talent resubmits", U.talent,
    `update public.timesheets set status='submitted'
     where profile_id='${U.talent}' and work_date=${day} and status='rejected';`, true);

  expectWrite("their manager approves", U.manager,
    `update public.timesheets set status='approved'
     where profile_id='${U.talent}' and work_date=${day} and status='submitted';`, true);

  const stamped = psql(
    `select approved_by::text from public.timesheets
     where profile_id='${U.talent}' and work_date=${day};`, { tuples: true }).trim();
  check("approved_by is the approver, not the owner", stamped === U.manager, `got ${stamped}`);

  // Separation of duties for the roles that can approve broadly.
  expectWrite("lead creates a submitted row of their own", U.chapter_lead,
    `insert into public.timesheets (profile_id,project_id,activity_id,work_date,hours,status)
     values ('${U.chapter_lead}','${PROJECT}',${act},'2026-09-08',8,'submitted');`, true);
  expectWrite("lead approves their own timesheet", U.chapter_lead,
    `update public.timesheets set status='approved'
     where profile_id='${U.chapter_lead}' and work_date='2026-09-08';`, false);
  expectWrite("admin approves the lead's timesheet", U.admin,
    `update public.timesheets set status='approved'
     where profile_id='${U.chapter_lead}' and work_date='2026-09-08' and status='submitted';`, true);
}

function feasibilityTests() {
  console.log("\n── feasibility (PF-02, PF-04, SF-3) ──");
  expectWrite("pm submits as themselves", U.pm,
    `insert into public.feasibility_cases (title, submitted_by) values ('Baru','${U.pm}');`, true);
  expectWrite("pm submits as someone else", U.pm,
    `insert into public.feasibility_cases (title, submitted_by) values ('Palsu','${U.chapter_lead}');`, false);
  expectWrite("pm scores their undecided case", U.pm,
    `update public.feasibility_cases set score_strategic=5, score_financial=4, score_risk=3,
       score_resource=4, score_technical=3 where id='${CASE}';`, true);
  expectWrite("anyone writes the generated total_score", U.chapter_lead,
    `update public.feasibility_cases set total_score=99 where id='${CASE}';`, false);
  expectWrite("pm decides", U.pm,
    `update public.feasibility_cases set decision='go', decision_rationale='x' where id='${CASE}';`, false);
  expectWrite("lead decides without a rationale", U.chapter_lead,
    `update public.feasibility_cases set decision='go' where id='${CASE}';`, false);
  expectWrite("lead decides with a rationale", U.chapter_lead,
    `update public.feasibility_cases set decision='go', decision_rationale='Layak.' where id='${CASE}';`, true);
  expectWrite("submitter edits after the decision", U.pm,
    `update public.feasibility_cases set title='Diubah' where id='${CASE}';`, false);
}

function budgetTests() {
  console.log("\n── budget (BC-01..05, SF-4) ──");
  expectWrite("lead creates a budget line", U.chapter_lead,
    `insert into public.budget_lines (fiscal_year,program,category,plan_amount)
     values (2026,'Delivery','Subcon',200000000);`, true);
  expectWrite("pm creates a budget line", U.pm,
    `insert into public.budget_lines (fiscal_year,program,category,plan_amount)
     values (2026,'X','Y',1);`, false);
  expectWrite("pm records an entry as themselves", U.pm,
    `insert into public.budget_entries (budget_line_id,entry_type,amount,created_by)
     values ('${LINE}','realization',1000000,'${U.pm}');`, true);
  expectWrite("pm records an entry as someone else", U.pm,
    `insert into public.budget_entries (budget_line_id,entry_type,amount,created_by)
     values ('${LINE}','realization',1,'${U.chapter_lead}');`, false);
  expectWrite("zero-amount entry", U.pm,
    `insert into public.budget_entries (budget_line_id,entry_type,amount,created_by)
     values ('${LINE}','realization',0,'${U.pm}');`, false);
  expectWrite("pm deletes an entry", U.pm,
    `delete from public.budget_entries where amount=1000000;`, false);
  expectWrite("lead deletes an entry", U.chapter_lead,
    `delete from public.budget_entries where amount=1000000;`, true);
}

function profileTests() {
  console.log("\n── profile privileges (SF-5) ──");
  expectWrite("talent renames themselves", U.talent,
    `update public.profiles set full_name='Talent A2' where id='${U.talent}';`, true);
  expectWrite("talent promotes themselves", U.talent,
    `update public.profiles set role='admin' where id='${U.talent}';`, false);
  expectWrite("talent reassigns their manager", U.talent,
    `update public.profiles set manager_id='${U.chapter_lead}' where id='${U.talent}';`, false);
  expectWrite("admin changes a role", U.admin,
    `update public.profiles set role='talent' where id='${U.talent}';`, true);
  expectWrite("anyone becomes their own manager", U.admin,
    `update public.profiles set manager_id=id where id='${U.talent}';`, false);
}

function calculationTests() {
  console.log("\n── derived figures (SF-1, SF-3, SF-4) ──");
  const util = psql(
    `select approved_hours::text || '|' || capacity_hours::text || '|' || utilization_pct::text
     from public.utilization_monthly
     where profile_id='${U.talent}' and period_month='2026-08-01';`, { tuples: true }).trim();
  check("utilisation = 126h / 168h = 75.0%", util === "126.00|168|75.0", `got ${util}`);

  // SF-1.5 has two shapes, and the UI must handle both as "nothing approved":
  // absent entirely (no rows that month), or present with NULL approved_hours
  // (rows exist but none approved). Talent B has a single draft row.
  const draftOnly = psql(
    `select coalesce(approved_hours::text,'NULL') || '|' || utilization_pct::text
     from public.utilization_monthly
     where profile_id='${U.talent_other}' and period_month='2026-08-01';`, { tuples: true }).trim();
  check("draft-only person: present, approved NULL, 0.0%", draftOnly === "NULL|0.0", `got ${draftOnly}`);

  const absent = psql(
    `select count(*)::text from public.utilization_monthly
     where profile_id='${U.talent_other}' and period_month='2026-09-01';`, { tuples: true }).trim();
  check("month with no rows at all: absent from the view", absent === "0", `got ${absent}`);

  const score = psql(
    `select total_score::text from public.feasibility_cases where id='${CASE}';`,
    { tuples: true }).trim();
  check("total_score 5/4/3/4/3 = 78.0", score === "78.0", `got ${score}`);

  const budget = psql(
    `select committed_amount::text || '|' || realized_amount::text || '|' || remaining_amount::text
     from public.budget_summary where id='${LINE}';`, { tuples: true }).trim();
  check(
    "budget: 85M - 5M correction = 80M realized, remaining 20M, commitments excluded",
    budget === "60000000.00|80000000.00|20000000.00",
    `got ${budget}`,
  );
}

function projectControlTests() {
  console.log("\n── project control (M3, M4, M6, M7) ──");
  const P = PROJECT;
  expectWrite("pm adds a milestone", U.pm,
    `insert into public.project_milestones (project_id,name,weight,planned_start,planned_finish)
     values ('${P}','Baru',10,'2026-10-01','2026-10-31');`, true);
  expectWrite("talent adds a milestone", U.talent,
    `insert into public.project_milestones (project_id,name,weight,planned_start,planned_finish)
     values ('${P}','Curang',10,'2026-10-01','2026-10-31');`, false);
  expectWrite("milestone at 100% without evidence", U.pm,
    `update public.project_milestones set progress_pct=100
     where project_id='${P}' and name='Baru';`, false);
  expectWrite("milestone at 100% with evidence", U.pm,
    `update public.project_milestones set progress_pct=100, evidence_url='https://example.invalid/x'
     where project_id='${P}' and name='Baru';`, true);
  expectWrite("closing an issue without a resolution", U.pm,
    `update public.project_issues set status='resolved' where project_id='${P}';`, false);
  expectWrite("closing an issue with a resolution", U.pm,
    `update public.project_issues set status='resolved', resolution='Sudah ditangani.'
     where project_id='${P}';`, true);
  expectWrite("non-green Budget health without a reason", U.chapter_lead,
    `update public.projects set health_budget='red' where id='${P}';`, false);
  expectWrite("non-green Budget health with a reason", U.chapter_lead,
    `update public.projects set health_budget='red', health_budget_note='Biaya melampaui rencana.'
     where id='${P}';`, true);

  const risk = psql(
    `select risk_score::text from public.project_risks where project_id='${P}' limit 1;`,
    { tuples: true }).trim();
  check("risk score high x high = 9", risk === "9", `got ${risk}`);

  const prog = psql(
    `select actual_progress::text || '|' || planned_progress::text
     from public.project_progress where project_id='${P}';`, { tuples: true }).trim();
  check("weighted progress reflects milestone weights", prog.includes("|"), `got ${prog}`);
}

function journeyTests() {
  console.log("\n── talent journey (TM-05) ──");
  const GOAL = "00000000-0000-0000-0000-0000000000e3";
  expectWrite("owner adds their own goal", U.talent,
    `insert into public.development_goals (profile_id, title) values ('${U.talent}','Target baru');`, true);
  expectWrite("someone adds a goal for another person", U.talent,
    `insert into public.development_goals (profile_id, title) values ('${U.talent_other}','Titipan');`, false);
  expectWrite("owner writes their own review", U.talent,
    `update public.development_goals set review_note='Saya nilai sendiri.' where id='${GOAL}';`, false);
  expectWrite("their manager writes the review", U.manager,
    `update public.development_goals set review_note='Sejalan dengan kebutuhan squad.' where id='${GOAL}';`, true);
  const stamped = psql(
    `select reviewed_by::text from public.development_goals where id='${GOAL}';`,
    { tuples: true }).trim();
  check("reviewed_by is the reviewer, not the owner", stamped === U.manager, `got ${stamped}`);
  expectWrite("an unrelated talent reads someone's plan", U.talent_other,
    `update public.development_goals set title='Diubah' where id='${GOAL}';`, false);
}

function effortCostTests() {
  console.log("\n── effort to cost (TS-05) ──");
  expectWrite("lead sets a rate", U.chapter_lead,
    `insert into public.cost_rates (fiscal_year, role, grade, hourly_rate)
     values (2027,'talent','',210000);`, true);
  expectWrite("pm sets a rate", U.pm,
    `insert into public.cost_rates (fiscal_year, role, grade, hourly_rate)
     values (2027,'manager','',1);`, false);
  expectWrite("duplicate rate for the same year/role/grade", U.chapter_lead,
    `insert into public.cost_rates (fiscal_year, role, grade, hourly_rate)
     values (2027,'talent','',999);`, false);

  // The property that matters: the views are security_invoker, so a talent
  // who cannot read the rate card gets NULL cost on their own hours rather
  // than a figure. Without security_invoker this would leak the rate card
  // to everyone.
  const asTalent = psql(
    `begin; set local role authenticated;
     set local request.jwt.claim.sub = '${U.talent}';
     select coalesce(max(hourly_rate)::text,'NULL') || '|' ||
            coalesce(max(indicative_cost)::text,'NULL') || '|' ||
            coalesce(max(approved_hours)::text,'NULL')
     from public.project_talent_contribution;
     rollback;`, { tuples: true })
    .trim().split("\n").filter((l) => l.includes("|")).pop() ?? "";
  check("talent sees own hours but no rate and no cost",
    asTalent.startsWith("NULL|NULL|") && !asTalent.endsWith("|NULL"), `got ${asTalent}`);

  const asLead = psql(
    `begin; set local role authenticated;
     set local request.jwt.claim.sub = '${U.chapter_lead}';
     select coalesce(max(hourly_rate)::text,'NULL')
     from public.project_talent_contribution;
     rollback;`, { tuples: true })
    .trim().split("\n").filter((l) => /\d|NULL/.test(l)).pop() ?? "";
  check("lead does see the rate", asLead !== "NULL" && asLead !== "", `got ${asLead}`);
}

function auditTests() {
  console.log("\n── audit trail (SF-6) ──");
  const n = Number(psql(
    `select count(*)::text from public.audit_log where table_name='timesheets';`,
    { tuples: true }).trim());
  check("timesheet changes are audited", n > 0, `got ${n} rows`);
  expectWrite("anyone inserts into audit_log directly", U.admin,
    `insert into public.audit_log (table_name,record_id,action) values ('x','y','INSERT');`, false);
}

/* ------------------------------------------------------------------ main */

console.log("TANIA — database authorization and calculation tests");
try {
  bootstrap();
  readTests();
  timesheetTests();
  feasibilityTests();
  budgetTests();
  profileTests();
  calculationTests();
  projectControlTests();
  journeyTests();
  effortCostTests();
  auditTests();
} catch (e) {
  console.error("\nharness error:", String(e.stderr || e.message).slice(0, 600));
  teardown();
  process.exit(2);
}
teardown();

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
