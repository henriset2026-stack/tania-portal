"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { StateBoundary } from "@/components/state-boundary";
import { ExportButton } from "@/components/export-button";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { date, money, moneyCompact, percent } from "@/lib/format";
import type { Rag } from "@/lib/db";

/*
 * Project Control — the delivery-control layer TANIA was missing against the
 * DPS Project & Portfolio Control Tower.
 *
 * Every number here comes from the project_health view, which implements the
 * DPS formulas (docs/01-prd.md §7.2–§7.7 in that repo): weighted progress,
 * planned progress by date interpolation, schedule variance, risk score from
 * probability × impact, and the roll-up where two ambers make a red.
 * Nothing is recomputed in the client.
 */

interface HealthRow {
  project_id: string;
  code: string | null;
  name: string | null;
  customer: string | null;
  status: string | null;
  contract_value: number | null;
  planned_progress: number | null;
  actual_progress: number | null;
  schedule_variance: number | null;
  milestone_count: number | null;
  total_weight: number | null;
  top_open_risk: number | null;
  open_critical: number | null;
  aged_critical: number | null;
  open_issues: number | null;
  health_schedule: Rag | null;
  health_risk: Rag | null;
  health_budget: Rag | null;
  health_scope: Rag | null;
  health_customer: Rag | null;
  health_budget_note?: string | null;
  overall_health: Rag | null;
}
interface MilestoneRow {
  id: string; project_id: string; name: string; weight: number;
  planned_start: string; planned_finish: string; actual_finish: string | null;
  progress_pct: number; status: string; evidence_url: string | null;
}
interface RiskRow {
  id: string; project_id: string; description: string; category: string | null;
  probability: string; impact: string; risk_score: number | null; status: string;
  mitigation: string | null;
}
interface IssueRow {
  id: string; project_id: string; title: string; severity: string; status: string;
  opened_at: string; resolved_at: string | null; action_plan: string | null;
}

const RAG_TONE: Record<Rag, "success" | "warning" | "danger"> = {
  green: "success",
  amber: "warning",
  red: "danger",
};
const RAG_LABEL: Record<Rag, string> = { green: "On Track", amber: "At Risk", red: "Critical" };

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Project Control">
          <p className="text-[13px] text-muted-foreground">Memuat…</p>
        </AppShell>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const selectedId = params.get("id");

  const health = useQuery<HealthRow>(
    () =>
      getSupabase()
        .from("project_health")
        .select(
          "project_id, code, name, customer, status, contract_value, planned_progress, actual_progress, schedule_variance, milestone_count, total_weight, top_open_risk, open_critical, aged_critical, open_issues, health_schedule, health_risk, health_budget, health_scope, health_customer, overall_health",
        )
        .order("code")
        .range(0, 199)
        .returns<HealthRow[]>(),
    [],
  );
  const milestones = useQuery<MilestoneRow>(
    () =>
      getSupabase()
        .from("project_milestones")
        .select("id, project_id, name, weight, planned_start, planned_finish, actual_finish, progress_pct, status, evidence_url")
        .order("planned_start")
        .range(0, 499)
        .returns<MilestoneRow[]>(),
    [],
  );
  const risks = useQuery<RiskRow>(
    () =>
      getSupabase()
        .from("project_risks")
        .select("id, project_id, description, category, probability, impact, risk_score, status, mitigation")
        .order("risk_score", { ascending: false })
        .range(0, 499)
        .returns<RiskRow[]>(),
    [],
  );
  const issues = useQuery<IssueRow>(
    () =>
      getSupabase()
        .from("project_issues")
        .select("id, project_id, title, severity, status, opened_at, resolved_at, action_plan")
        .order("opened_at", { ascending: false })
        .range(0, 499)
        .returns<IssueRow[]>(),
    [],
  );

  const rows = health.rows;
  const dist = useMemo(() => {
    const d = { green: 0, amber: 0, red: 0 };
    for (const r of rows) if (r.overall_health) d[r.overall_health]++;
    return d;
  }, [rows]);

  // DPS §7.5 — contract value carried by projects that are red.
  const revenueAtRisk = rows
    .filter((r) => r.overall_health === "red")
    .reduce((s, r) => s + Number(r.contract_value ?? 0), 0);

  const selected = rows.find((r) => r.project_id === selectedId) ?? null;

  return (
    <AppShell
      title="Project Control"
      actions={
        <ExportButton
          filename="tania-portfolio"
          sheetName="Portfolio"
          disabled={rows.length === 0}
          rows={() => [
            ["Kode", "Proyek", "Customer", "Contract value", "Planned %", "Actual %", "SV",
              "Schedule", "Risk", "Budget", "Scope", "Customer health", "Overall", "Open issues"],
            ...rows.map((r) => [
              r.code ?? "", r.name ?? "", r.customer ?? "", Number(r.contract_value ?? 0),
              Number(r.planned_progress ?? 0), Number(r.actual_progress ?? 0),
              Number(r.schedule_variance ?? 0),
              r.health_schedule ?? "", r.health_risk ?? "", r.health_budget ?? "",
              r.health_scope ?? "", r.health_customer ?? "", r.overall_health ?? "",
              Number(r.open_issues ?? 0),
            ]),
          ]}
        />
      }
    >
      {/* --------------------------------------------- portfolio summary -- */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Proyek dipantau</div>
          <div className="tabular mt-0.5 text-[26px] font-semibold tracking-tight">{rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Distribusi kesehatan</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="success">{dist.green} on track</Badge>
            <Badge tone="warning">{dist.amber} at risk</Badge>
            <Badge tone="danger">{dist.red} critical</Badge>
          </div>
        </Card>
        <Card className={`p-4 ${revenueAtRisk > 0 ? "border-red-200 bg-red-50" : ""}`}>
          <div className="text-[12px] text-muted-foreground">Revenue at risk</div>
          <div className="tabular mt-0.5 text-[21px] font-semibold tracking-tight">
            {money(revenueAtRisk)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            contract value proyek berstatus critical
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Issue kritikal terbuka</div>
          <div className="tabular mt-0.5 text-[26px] font-semibold tracking-tight">
            {rows.reduce((s, r) => s + Number(r.open_critical ?? 0), 0)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {rows.reduce((s, r) => s + Number(r.aged_critical ?? 0), 0)} melewati 3 hari
          </div>
        </Card>
      </div>

      {/* ---------------------------------------------- portfolio table --- */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">
            SV = actual − planned · dua amber dihitung merah
          </span>
        </CardHeader>
        <StateBoundary
          loading={health.loading}
          error={health.error}
          empty={rows.length === 0}
          emptyMessage="Belum ada proyek."
          onRetry={health.reload}
        >
          <Table>
            <thead>
              <tr>
                <Th className="w-[92px]">Kode</Th>
                <Th>Proyek</Th>
                <Th className="w-[84px] text-right">Planned</Th>
                <Th className="w-[80px] text-right">Actual</Th>
                <Th className="w-[76px] text-right">SV</Th>
                <Th className="w-[210px]">Dimensi</Th>
                <Th className="w-[118px]">Overall</Th>
                <Th className="w-[70px] text-right">Issue</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sv = Number(r.schedule_variance ?? 0);
                return (
                  <tr key={r.project_id} className={r.overall_health === "red" ? "bg-red-50" : undefined}>
                    <Td className="font-medium">{r.code}</Td>
                    <Td>
                      <Link
                        href={`/projects/?id=${r.project_id}`}
                        className="font-medium underline decoration-slate-300 underline-offset-[3px]"
                      >
                        {r.name}
                      </Link>
                      <div className="text-[11.5px] text-muted-foreground">
                        {r.customer ?? "—"} · {moneyCompact(r.contract_value)}
                        {Number(r.milestone_count ?? 0) === 0 ? " · belum ada milestone" : ""}
                      </div>
                    </Td>
                    <Td className="tabular text-right">{percent(r.planned_progress)}</Td>
                    <Td className="tabular text-right font-semibold">{percent(r.actual_progress)}</Td>
                    <Td className={"tabular text-right font-semibold " + (sv < -5 ? "text-destructive" : "")}>
                      {sv > 0 ? "+" : ""}
                      {percent(sv)}
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <Dim label="Sch" v={r.health_schedule} />
                        <Dim label="Rsk" v={r.health_risk} />
                        <Dim label="Bud" v={r.health_budget} />
                        <Dim label="Scp" v={r.health_scope} />
                        <Dim label="Cst" v={r.health_customer} />
                      </div>
                    </Td>
                    <Td>
                      {r.overall_health ? (
                        <Badge tone={RAG_TONE[r.overall_health]}>{RAG_LABEL[r.overall_health]}</Badge>
                      ) : null}
                    </Td>
                    <Td className="tabular text-right">
                      {r.open_issues}
                      {Number(r.aged_critical ?? 0) > 0 ? " ⛔" : ""}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
            Sch = Schedule · Rsk = Risk · Bud = Budget · Scp = Scope · Cst = Customer. Schedule dan
            Risk dihitung sistem; Budget, Scope, dan Customer diisi PM dan wajib beralasan bila tidak
            hijau. Issue kritikal terbuka lebih dari 3 hari membuat proyek merah tanpa memandang
            dimensi lain.
          </p>
        </StateBoundary>
      </Card>

      {selected ? (
        <Detail
          row={selected}
          milestones={milestones.rows.filter((m) => m.project_id === selected.project_id)}
          risks={risks.rows.filter((x) => x.project_id === selected.project_id)}
          issues={issues.rows.filter((x) => x.project_id === selected.project_id)}
        />
      ) : (
        <p className="text-[12.5px] text-muted-foreground">
          Pilih sebuah proyek untuk melihat milestone, risiko, dan issue-nya.
        </p>
      )}
    </AppShell>
  );
}

function Dim({ label, v }: { label: string; v: Rag | null }) {
  const bg = v === "red" ? "#ef4444" : v === "amber" ? "#f59e0b" : "#16a34a";
  return (
    <span
      title={`${label}: ${v ?? "—"}`}
      className="inline-flex h-[22px] items-center gap-1 rounded px-1.5 text-[10.5px] font-semibold text-white"
      style={{ background: bg }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ detail */

function Detail({
  row,
  milestones,
  risks,
  issues,
}: {
  row: HealthRow;
  milestones: MilestoneRow[];
  risks: RiskRow[];
  issues: IssueRow[];
}) {
  // Captured once at mount: calling Date.now() during render is impure and
  // would make the same props produce different output (react-hooks/purity).
  const [now] = useState(() => Date.now());

  const weightTotal = milestones
    .filter((m) => m.status !== "cancelled")
    .reduce((s, m) => s + Number(m.weight), 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/projects/" className="text-[12.5px] underline underline-offset-2">
          ← Portfolio
        </Link>
        <h2 className="text-[15px] font-semibold">
          {row.code} · {row.name}
        </h2>
        {row.overall_health ? (
          <Badge tone={RAG_TONE[row.overall_health]}>{RAG_LABEL[row.overall_health]}</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Milestone</CardTitle>
            <span
              className={
                "text-[11.5px] " +
                (Math.abs(weightTotal - 100) > 0.01 ? "font-semibold text-destructive" : "text-muted-foreground")
              }
            >
              Total bobot {weightTotal}%{Math.abs(weightTotal - 100) > 0.01 ? " — harus 100%" : ""}
            </span>
          </CardHeader>
          <StateBoundary empty={milestones.length === 0} emptyMessage="Belum ada milestone.">
            <Table>
              <thead>
                <tr>
                  <Th>Milestone</Th>
                  <Th className="w-[70px] text-right">Bobot</Th>
                  <Th className="w-[110px]">Rencana</Th>
                  <Th className="w-[150px]">Progress</Th>
                  <Th className="w-[110px]">Status</Th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <div className="font-medium">{m.name}</div>
                      {m.evidence_url ? (
                        <a href={m.evidence_url} className="text-[11.5px] underline underline-offset-2">
                          evidence
                        </a>
                      ) : m.progress_pct === 100 ? (
                        <span className="text-[11.5px] text-destructive">evidence belum ada</span>
                      ) : null}
                    </Td>
                    <Td className="tabular text-right">{m.weight}%</Td>
                    <Td className="tabular text-[12px] text-muted-foreground">
                      {date(m.planned_start)} → {date(m.planned_finish)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${m.progress_pct}%` }}
                          />
                        </div>
                        <span className="tabular text-[12px]">{m.progress_pct}%</span>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={m.status === "delayed" ? "danger" : m.status === "completed" ? "success" : "neutral"}>
                        {m.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </StateBoundary>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk register</CardTitle>
              <span className="text-[11.5px] text-muted-foreground">skor = probability × impact</span>
            </CardHeader>
            <StateBoundary empty={risks.length === 0} emptyMessage="Belum ada risiko tercatat.">
              <ul className="flex flex-col divide-y divide-slate-100">
                {risks.map((r) => {
                  const score = Number(r.risk_score ?? 0);
                  return (
                    <li key={r.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[12.5px] leading-relaxed">{r.description}</p>
                        <Badge tone={score >= 9 ? "danger" : score >= 6 ? "warning" : "neutral"}>
                          {score}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[11.5px] text-muted-foreground">
                        {r.category ?? "—"} · {r.probability}/{r.impact} · {r.status}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </StateBoundary>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Issue</CardTitle>
              <span className="text-[11.5px] text-muted-foreground">aging dari tanggal dibuka</span>
            </CardHeader>
            <StateBoundary empty={issues.length === 0} emptyMessage="Belum ada issue.">
              <ul className="flex flex-col divide-y divide-slate-100">
                {issues.map((i) => {
                  const days = Math.floor(
                    (now - new Date(i.opened_at).getTime()) / 86_400_000,
                  );
                  const open = !["resolved", "closed"].includes(i.status);
                  const escalate = open && i.severity === "critical" && days > 3;
                  return (
                    <li key={i.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[12.5px] font-medium leading-relaxed">{i.title}</p>
                        <Badge
                          tone={
                            i.severity === "critical" ? "danger" : i.severity === "high" ? "warning" : "neutral"
                          }
                        >
                          {i.severity}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[11.5px] text-muted-foreground">
                        {i.status} · {open ? `${days} hari terbuka` : "selesai"}
                        {escalate ? (
                          <strong className="ml-1 font-semibold text-destructive">
                            — melewati ambang eskalasi 3 hari
                          </strong>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </StateBoundary>
            <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
              Ambang eskalasi ditampilkan, tetapi pengirimannya menunggu modul notifikasi (XM-04).
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
