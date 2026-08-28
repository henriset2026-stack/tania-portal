"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { StateBoundary } from "@/components/state-boundary";
import { ExportButton } from "@/components/export-button";
import { useSession } from "@/components/session-provider";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { hours as fmtHours, money, percent } from "@/lib/format";
import { capacityHours, recentMonths } from "@/lib/capacity";
import { ExecutiveSummary } from "@/components/executive-summary";
import { addDays, monthKey, startOfWeek, toKey } from "@/lib/week";

/*
 * XM-01 executive dashboard · XM-02 integrated data flow · XM-03 export.
 *
 * Every aggregate uses the active roster as its denominator, never the count
 * of rows utilization_monthly returns (SRS SF-1.5b). Averaging the view's
 * rows makes the figure RISE when someone stops filing timesheets.
 */
const CAPACITY_NOTE = "kapasitas 8 jam × Sen–Jum · libur nasional belum dikecualikan";
const SEES_ALL_TIMESHEETS = ["executive", "chapter_lead", "admin"];
const SEES_BUDGET = ["executive", "chapter_lead", "manager", "pm", "admin"];
const WARN_AT = 80;
const OVER_AT = 100;

interface Person { id: string; full_name: string; squad: string | null }
interface UtilRow { profile_id: string; approved_hours: number | null; utilization_pct: number | null }
interface AllocRow { profile_id: string; percent: number }
interface WeekRow { profile_id: string }
interface CaseRow { id: string; title: string; total_score: number; decision: string | null }
interface BudgetRow { plan_amount: number; committed_amount: number; realized_amount: number; remaining_amount: number; program: string; category: string }
interface HealthRow { overall_health: string | null; contract_value: number | null; aged_critical: number | null }

export default function DashboardPage() {
  const { profile } = useSession();
  const month = monthKey(new Date());
  const weekStart = startOfWeek(new Date());
  const from = toKey(weekStart);
  const to = toKey(addDays(weekStart, 6));
  const year = new Date().getFullYear();

  const role = profile?.role ?? null;
  const seesAll = role != null && SEES_ALL_TIMESHEETS.includes(role);
  const seesBudget = role != null && SEES_BUDGET.includes(role);

  const people = useQuery<Person>(
    () =>
      getSupabase().from("profiles").select("id, full_name, squad")
        .eq("is_active", true).eq("role", "talent")
        .order("full_name").range(0, 499).returns<Person[]>(),
    [],
  );
  const util = useQuery<UtilRow>(
    () =>
      getSupabase().from("utilization_monthly")
        .select("profile_id, approved_hours, utilization_pct")
        .eq("period_month", month).range(0, 499).returns<UtilRow[]>(),
    [month],
  );
  const allocs = useQuery<AllocRow>(
    () =>
      getSupabase().from("allocations").select("profile_id, percent")
        .eq("period_month", month).range(0, 999).returns<AllocRow[]>(),
    [month],
  );
  const week = useQuery<WeekRow>(
    () =>
      getSupabase().from("timesheets").select("profile_id")
        .in("status", ["submitted", "approved"])
        .gte("work_date", from).lte("work_date", to)
        .range(0, 1999).returns<WeekRow[]>(),
    [from, to],
  );
  // Comparison periods. The summary shows movement, so it needs the month
  // and the week before this one — both real queries, not extrapolation.
  const prevMonth = recentMonths(month, 2)[0];
  const prevWeekStart = startOfWeek(addDays(weekStart, -7));
  const prevFrom = toKey(prevWeekStart);
  const prevTo = toKey(addDays(prevWeekStart, 6));

  const utilPrev = useQuery<UtilRow>(
    () =>
      getSupabase().from("utilization_monthly")
        .select("profile_id, approved_hours, utilization_pct")
        .eq("period_month", prevMonth).range(0, 499).returns<UtilRow[]>(),
    [prevMonth],
  );
  const weekPrev = useQuery<WeekRow>(
    () =>
      getSupabase().from("timesheets").select("profile_id")
        .in("status", ["submitted", "approved"])
        .gte("work_date", prevFrom).lte("work_date", prevTo)
        .range(0, 1999).returns<WeekRow[]>(),
    [prevFrom, prevTo],
  );
  const health = useQuery<HealthRow>(
    () =>
      getSupabase().from("project_health")
        .select("overall_health, contract_value, aged_critical")
        .range(0, 199).returns<HealthRow[]>(),
    [],
  );

  const cases = useQuery<CaseRow>(
    () =>
      getSupabase().from("feasibility_cases").select("id, title, total_score, decision")
        .order("total_score", { ascending: false }).range(0, 199).returns<CaseRow[]>(),
    [],
  );
  const budget = useQuery<BudgetRow>(
    () =>
      getSupabase().from("budget_summary")
        .select("program, category, plan_amount, committed_amount, realized_amount, remaining_amount")
        .eq("fiscal_year", year).range(0, 299).returns<BudgetRow[]>(),
    [year],
  );

  const cap = capacityHours(month);
  const utilBy = useMemo(() => new Map(util.rows.map((u) => [u.profile_id, u])), [util.rows]);
  const allocBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocs.rows) m.set(a.profile_id, (m.get(a.profile_id) ?? 0) + Number(a.percent));
    return m;
  }, [allocs.rows]);
  const submitted = useMemo(() => new Set(week.rows.map((r) => r.profile_id)), [week.rows]);

  const roster = people.rows;
  const chapterHours = roster.reduce(
    (s, p) => s + Number(utilBy.get(p.id)?.approved_hours ?? 0), 0);
  const chapterPct = roster.length ? (chapterHours / (roster.length * cap)) * 100 : 0;
  const overloaded = roster.filter((p) => (allocBy.get(p.id) ?? 0) > 100);
  const missing = roster.filter((p) => !submitted.has(p.id));
  const compliancePct = roster.length ? ((roster.length - missing.length) / roster.length) * 100 : 0;

  const bySquad = useMemo(() => {
    const names = [...new Set(roster.map((p) => p.squad ?? "Tanpa squad"))].sort();
    return names.map((squad) => {
      const members = roster.filter((p) => (p.squad ?? "Tanpa squad") === squad);
      const h = members.reduce((s, p) => s + Number(utilBy.get(p.id)?.approved_hours ?? 0), 0);
      return {
        squad,
        headcount: members.length,
        hours: h,
        pct: members.length ? (h / (members.length * cap)) * 100 : 0,
        overload: members.filter((p) => (allocBy.get(p.id) ?? 0) > 100).length,
      };
    });
  }, [roster, utilBy, allocBy, cap]);

  const pending = cases.rows.filter((c) => c.decision == null);
  const byDecision = {
    go: cases.rows.filter((c) => c.decision === "go").length,
    hold: cases.rows.filter((c) => c.decision === "hold").length,
    no_go: cases.rows.filter((c) => c.decision === "no_go").length,
  };

  // Previous-period figures use the same roster denominator (SF-1.5b).
  const utilPrevBy = new Map(utilPrev.rows.map((u) => [u.profile_id, u]));
  const prevCap = capacityHours(prevMonth);
  const prevHours = roster.reduce(
    (s, p) => s + Number(utilPrevBy.get(p.id)?.approved_hours ?? 0), 0);
  const utilPrevPct =
    utilPrev.rows.length === 0 || roster.length === 0
      ? null
      : (prevHours / (roster.length * prevCap)) * 100;

  const prevSubmitted = new Set(weekPrev.rows.map((r) => r.profile_id));
  const compliancePrevPct =
    weekPrev.rows.length === 0 || roster.length === 0
      ? null
      : (roster.filter((p) => prevSubmitted.has(p.id)).length / roster.length) * 100;

  const projectsRed = health.rows.filter((r) => r.overall_health === "red").length;
  const projectsAmber = health.rows.filter((r) => r.overall_health === "amber").length;
  const revenueAtRisk = health.rows
    .filter((r) => r.overall_health === "red")
    .reduce((s, r) => s + Number(r.contract_value ?? 0), 0);
  const agedCritical = health.rows.reduce((s, r) => s + Number(r.aged_critical ?? 0), 0);

  const bTotals = budget.rows.reduce(
    (t, r) => ({
      plan: t.plan + Number(r.plan_amount),
      realized: t.realized + Number(r.realized_amount),
      remaining: t.remaining + Number(r.remaining_amount),
    }),
    { plan: 0, realized: 0, remaining: 0 },
  );
  const absorbed = bTotals.plan ? (bTotals.realized / bTotals.plan) * 100 : 0;
  const overLines = budget.rows.filter(
    (r) => Number(r.plan_amount) && (Number(r.realized_amount) / Number(r.plan_amount)) * 100 >= OVER_AT,
  ).length;

  // Talent see only their own position — they have no budget access and no
  // visibility of other people's timesheets.
  if (role === "talent") {
    const me = profile ? utilBy.get(profile.id) : undefined;
    return (
      <AppShell title="Dashboard">
        <Card className="p-5">
          <div className="text-[12px] text-muted-foreground">Utilisasi Anda bulan ini</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-[28px] font-semibold tracking-tight">
              {percent(me?.utilization_pct ?? 0)}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {fmtHours(me?.approved_hours ?? 0)} / {cap} jam
            </span>
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">{CAPACITY_NOTE}</p>
        </Card>
        <Card className="p-5">
          <div className="text-[12px] text-muted-foreground">Timesheet minggu ini</div>
          <div className="mt-1">
            {profile && submitted.has(profile.id) ? (
              <Badge tone="success">sudah submit</Badge>
            ) : (
              <Badge tone="danger">belum submit</Badge>
            )}
          </div>
          <Link href="/timesheet/" className="mt-3 inline-block text-[12.5px] underline underline-offset-2">
            Buka timesheet →
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Dashboard"
      actions={
        <ExportButton
          filename={`tania-dashboard-${month.slice(0, 7)}`}
          sheetName="Utilisasi squad"
          disabled={bySquad.length === 0}
          rows={() => [
            ["Squad", "Talent aktif", "Jam approved", "Kapasitas", "Utilisasi %", "Overload"],
            ...bySquad.map((s) => [
              s.squad, s.headcount, s.hours, s.headcount * cap,
              Number(s.pct.toFixed(1)), s.overload,
            ]),
            [],
            ["CHAPTER", roster.length, chapterHours, roster.length * cap,
              Number(chapterPct.toFixed(1)), overloaded.length],
          ]}
        />
      }
    >
      {!seesAll ? (
        <Card className="border-amber-200 bg-amber-50 p-3.5">
          <p className="text-[12.5px] text-amber-900">
            Angka utilisasi dan compliance dihitung dari timesheet yang boleh Anda lihat.
            Sebagai {role}, itu berarti tim Anda sendiri — bukan seluruh chapter.
          </p>
        </Card>
      ) : null}

      <ExecutiveSummary
        loading={people.loading || util.loading || budget.loading || health.loading}
        utilPct={chapterPct}
        utilPrevPct={utilPrevPct}
        overloaded={overloaded.length}
        headcount={roster.length}
        compliancePct={compliancePct}
        compliancePrevPct={compliancePrevPct}
        missingCount={missing.length}
        projectsRed={projectsRed}
        projectsAmber={projectsAmber}
        projectsTotal={health.rows.length}
        revenueAtRisk={revenueAtRisk}
        agedCriticalIssues={agedCritical}
        pendingDecisions={pending.length}
        topPendingScore={pending.length ? Number(pending[0].total_score) : null}
        budgetAbsorbedPct={absorbed}
        budgetLinesOver={overLines}
        budgetLinesWarn={
          budget.rows.filter((r) => {
            const pct = Number(r.plan_amount) ? (Number(r.realized_amount) / Number(r.plan_amount)) * 100 : 0;
            return pct >= WARN_AT && pct < OVER_AT;
          }).length
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardLink href="/workload/" label="Utilisasi chapter">
          <div className="flex items-baseline gap-2">
            <span className="tabular text-[28px] font-semibold tracking-tight">
              {percent(chapterPct)}
            </span>
            {overloaded.length ? (
              <Badge tone="warning">{overloaded.length} overload</Badge>
            ) : (
              <Badge tone="success">tidak ada overload</Badge>
            )}
          </div>
          <Bar pct={chapterPct} />
          <p className="text-[11.5px] text-muted-foreground">
            {roster.length} talent aktif · rata-rata bulan ini
          </p>
        </CardLink>

        <CardLink href="/timesheet/approval/" label="Compliance timesheet">
          <div className="flex items-baseline gap-2">
            <span className="tabular text-[28px] font-semibold tracking-tight">
              {percent(compliancePct)}
            </span>
            {missing.length ? <Badge tone="danger">{missing.length} belum</Badge> : null}
          </div>
          <Bar pct={compliancePct} tone={compliancePct >= 90 ? "ok" : "bad"} />
          <p className="text-[11.5px] text-muted-foreground">
            {roster.length - missing.length} dari {roster.length} submit · target ≥ 90%
          </p>
        </CardLink>

        <CardLink href="/feasibility/" label="Pipeline feasibility">
          <div className="flex items-baseline gap-2">
            <span className="tabular text-[28px] font-semibold tracking-tight">
              {cases.rows.length}
            </span>
            <span className="text-[12px] text-muted-foreground">kandidat</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="success">{byDecision.go} go</Badge>
            <Badge>{byDecision.hold} hold</Badge>
            <Badge tone="warning">{pending.length} menunggu</Badge>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            {pending.length
              ? `Skor tertinggi menunggu: ${Number(pending[0].total_score).toFixed(1)}`
              : "Tidak ada yang menunggu keputusan"}
          </p>
        </CardLink>

        {seesBudget ? (
          <CardLink href="/budget/" label="Posisi anggaran">
            <div className="flex items-baseline gap-2">
              <span className="tabular text-[28px] font-semibold tracking-tight">
                {percent(absorbed)}
              </span>
              {overLines ? <Badge tone="danger">{overLines} lewat {OVER_AT}%</Badge> : null}
            </div>
            <Bar pct={absorbed} tone={absorbed >= WARN_AT ? "bad" : "ok"} />
            <p className="text-[11.5px] text-muted-foreground">
              Realisasi {money(bTotals.realized)} dari plan {money(bTotals.plan)}
            </p>
          </CardLink>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Utilisasi per squad</CardTitle>
            <Link href="/workload/" className="text-[12px] text-muted-foreground underline underline-offset-2">
              Lihat Workload →
            </Link>
          </CardHeader>
          <StateBoundary
            loading={people.loading || util.loading}
            error={people.error ?? util.error}
            empty={bySquad.length === 0}
            emptyMessage="Belum ada talent aktif."
            onRetry={() => { people.reload(); util.reload(); }}
          >
            <Table>
              <thead>
                <tr>
                  <Th>Squad</Th>
                  <Th className="w-[150px]">Utilisasi</Th>
                  <Th className="w-[90px] text-right">Rata-rata</Th>
                  <Th className="w-[80px] text-right">Overload</Th>
                </tr>
              </thead>
              <tbody>
                {bySquad.map((s) => (
                  <tr key={s.squad}>
                    <Td>
                      {s.squad}{" "}
                      <span className="text-[11px] text-muted-foreground">({s.headcount})</span>
                    </Td>
                    <Td><Bar pct={s.pct} /></Td>
                    <Td className="tabular text-right">{percent(s.pct)}</Td>
                    <Td className="tabular text-right">{s.overload}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
              {CAPACITY_NOTE}. Penyebut tiap squad adalah seluruh anggotanya, termasuk yang belum
              mengisi timesheet.
            </p>
          </StateBoundary>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Belum submit minggu ini</CardTitle>
            {missing.length ? (
              <Badge tone="danger">{missing.length} orang</Badge>
            ) : (
              <Badge tone="success">semua sudah</Badge>
            )}
          </CardHeader>
          {missing.length ? (
            <Table>
              <tbody>
                {missing.slice(0, 12).map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link href={`/talent/?id=${p.id}`} className="font-medium underline decoration-slate-300 underline-offset-[3px]">
                        {p.full_name}
                      </Link>
                      <div className="text-[11.5px] text-muted-foreground">{p.squad ?? "—"}</div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="p-4 text-[12.5px] text-muted-foreground">
              Seluruh talent aktif sudah submit minggu ini.
            </p>
          )}
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
            Compliance = talent yang submit pada minggu berjalan. Utilisasi memakai jam approved.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function CardLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-2.5 rounded-lg border border-border bg-white p-4 hover:border-slate-300">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      {children}
    </Link>
  );
}

function Bar({ pct, tone = "ok" }: { pct: number; tone?: "ok" | "bad" }) {
  return (
    <div className="h-[7px] w-full overflow-hidden rounded-full bg-muted">
      <div
        className={"h-full rounded-full " + (tone === "bad" ? "bg-amber-500" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
