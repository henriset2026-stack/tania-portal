"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { percent, money, dateTime } from "@/lib/format";
import { useCopilot } from "./copilot";
import { Button } from "./ui/button";

/*
 * Executive summary — one paragraph on the chapter's condition, the movement
 * since the previous period, and what needs attention, ranked.
 *
 * Two rules this follows:
 *
 *  - Nothing is invented. Every figure is passed in from a query. Where a
 *    comparison period has no data the delta renders as "—" rather than 0%,
 *    because "unchanged" and "unknown" are different claims.
 *  - The verdict is a stated rule, not a vibe. It is written out below and
 *    shown to the reader, so a red banner can always be traced to a cause.
 */

export interface SummaryInput {
  /** Roster-denominator utilisation for the month (SRS SF-1.5b). */
  utilPct: number;
  /** Same figure for the previous month, or null when that month has no data. */
  utilPrevPct: number | null;
  overloaded: number;
  headcount: number;

  compliancePct: number;
  compliancePrevPct: number | null;
  missingCount: number;

  projectsRed: number;
  projectsAmber: number;
  projectsTotal: number;
  revenueAtRisk: number;
  agedCriticalIssues: number;

  pendingDecisions: number;
  topPendingScore: number | null;

  budgetAbsorbedPct: number;
  budgetLinesOver: number;
  budgetLinesWarn: number;

  loading?: boolean;
}

type Verdict = "sehat" | "perhatian" | "kritis";

/** The rule, written once and shown to the reader. */
function verdictOf(d: SummaryInput): { v: Verdict; because: string[] } {
  const critical: string[] = [];
  const watch: string[] = [];

  if (d.agedCriticalIssues > 0)
    critical.push(`${d.agedCriticalIssues} issue kritikal terbuka lebih dari 3 hari`);
  if (d.projectsRed > 0) critical.push(`${d.projectsRed} proyek berstatus critical`);
  if (d.budgetLinesOver > 0) critical.push(`${d.budgetLinesOver} budget line melewati 100%`);
  if (d.compliancePct < 70) critical.push(`compliance timesheet ${percent(d.compliancePct)}`);

  if (d.overloaded > 0) watch.push(`${d.overloaded} talent dialokasikan di atas 100%`);
  if (d.compliancePct >= 70 && d.compliancePct < 90)
    watch.push(`compliance ${percent(d.compliancePct)} di bawah target 90%`);
  if (d.projectsAmber > 0) watch.push(`${d.projectsAmber} proyek at risk`);
  if (d.budgetLinesWarn > 0) watch.push(`${d.budgetLinesWarn} budget line melewati 80%`);
  if (d.pendingDecisions > 0)
    watch.push(`${d.pendingDecisions} kandidat proyek menunggu keputusan`);

  if (critical.length) return { v: "kritis", because: critical };
  if (watch.length) return { v: "perhatian", because: watch };
  return { v: "sehat", because: [] };
}

const VERDICT_STYLE: Record<Verdict, { tone: "success" | "warning" | "danger"; label: string; band: string }> = {
  sehat: { tone: "success", label: "Sehat", band: "border-green-200 bg-green-50" },
  perhatian: { tone: "warning", label: "Perlu perhatian", band: "border-amber-200 bg-amber-50" },
  kritis: { tone: "danger", label: "Kritis", band: "border-red-200 bg-red-50" },
};

/** Ranked so the most consequential item is read first. */
function actions(d: SummaryInput): Array<{ tone: "danger" | "warning" | "neutral"; text: string; href: string }> {
  const out: Array<{ tone: "danger" | "warning" | "neutral"; text: string; href: string }> = [];
  if (d.agedCriticalIssues > 0)
    out.push({
      tone: "danger",
      href: "/projects/",
      text: `${d.agedCriticalIssues} issue kritikal sudah melewati ambang eskalasi 3 hari — perlu keputusan hari ini.`,
    });
  if (d.projectsRed > 0)
    out.push({
      tone: "danger",
      href: "/projects/",
      text: `${d.projectsRed} proyek berstatus critical, membawa ${money(d.revenueAtRisk)} contract value.`,
    });
  if (d.budgetLinesOver > 0)
    out.push({
      tone: "danger",
      href: "/budget/",
      text: `${d.budgetLinesOver} budget line sudah melewati 100% plan — sisa anggarannya negatif.`,
    });
  if (d.overloaded > 0)
    out.push({
      tone: "warning",
      href: "/workload/",
      text: `${d.overloaded} talent dialokasikan di atas 100% pada periode ini.`,
    });
  if (d.missingCount > 0)
    out.push({
      tone: "warning",
      href: "/timesheet/approval/",
      text: `${d.missingCount} talent belum submit timesheet minggu ini; angka utilisasi belum lengkap sampai mereka mengisi.`,
    });
  if (d.pendingDecisions > 0)
    out.push({
      tone: "neutral",
      href: "/feasibility/",
      text:
        `${d.pendingDecisions} kandidat proyek menunggu keputusan chapter lead` +
        (d.topPendingScore != null ? `, skor tertinggi ${d.topPendingScore.toFixed(1)}.` : "."),
    });
  if (d.budgetLinesWarn > 0)
    out.push({
      tone: "warning",
      href: "/budget/",
      text: `${d.budgetLinesWarn} budget line sudah melewati ambang 80%.`,
    });
  return out;
}

export function ExecutiveSummary(d: SummaryInput) {
  const copilot = useCopilot();
  // Captured at mount: calling Date() during render would make the same data
  // produce different output (react-hooks/purity).
  const [computedAt] = useState(() => new Date());

  if (d.loading) {
    return (
      <Card className="p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
      </Card>
    );
  }

  const { v, because } = verdictOf(d);
  const style = VERDICT_STYLE[v];
  const items = actions(d);

  return (
    <Card className={`overflow-hidden ${style.band}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold tracking-tight">Ringkasan Eksekutif</h2>
          <Badge tone={style.tone}>{style.label}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] text-slate-600">
            Diperbarui {dateTime(computedAt)}
          </span>
          {/* Hands the summary's own findings to the assistant as a starting
              question, rather than making the reader retype them. */}
          <Button
            size="sm"
            onClick={() =>
              copilot.open(
                because.length
                  ? `Kondisi chapter saat ini ${style.label.toLowerCase()} karena ${because.join("; ")}. ` +
                    "Jelaskan penyebabnya dari data dan sarankan urutan penanganannya."
                  : "Ringkas kondisi chapter bulan ini dari data utilisasi, compliance, pipeline, dan anggaran.",
              )
            }
          >
            Tanya Copilot
          </Button>
        </div>
      </div>

      <div className="bg-white px-5 py-4">
        {/* ------------------------------------------------ narrative --- */}
        <p className="max-w-[900px] text-[13.5px] leading-relaxed text-slate-700 text-pretty">
          Utilisasi chapter berada di{" "}
          <strong className="font-semibold text-slate-900">{percent(d.utilPct)}</strong> atas{" "}
          {d.headcount} talent aktif <Delta now={d.utilPct} prev={d.utilPrevPct} unit="poin" />.
          Compliance timesheet minggu ini{" "}
          <strong className="font-semibold text-slate-900">{percent(d.compliancePct)}</strong>{" "}
          <Delta now={d.compliancePct} prev={d.compliancePrevPct} unit="poin" />.{" "}
          {d.projectsTotal > 0 ? (
            <>
              Dari {d.projectsTotal} proyek yang dipantau,{" "}
              <strong className="font-semibold text-slate-900">{d.projectsRed} critical</strong> dan{" "}
              {d.projectsAmber} at risk
              {d.revenueAtRisk > 0 ? (
                <>
                  , dengan {money(d.revenueAtRisk)} contract value pada proyek critical
                </>
              ) : null}
              .{" "}
            </>
          ) : (
            <>Belum ada proyek dengan milestone untuk dipantau. </>
          )}
          Serapan anggaran{" "}
          <strong className="font-semibold text-slate-900">{percent(d.budgetAbsorbedPct)}</strong>{" "}
          dari plan tahun berjalan.
        </p>

        {because.length > 0 ? (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-slate-600">
            Status <strong className="font-semibold">{style.label.toLowerCase()}</strong> karena{" "}
            {because.join("; ")}.
          </p>
        ) : (
          <p className="mt-2.5 text-[12.5px] text-slate-600">
            Tidak ada indikator yang melewati ambang perhatian pada periode ini.
          </p>
        )}

        {/* --------------------------------------------- action list ---- */}
        {items.length > 0 ? (
          <>
            <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Perlu tindakan
            </h3>
            <ol className="mt-2 flex flex-col gap-2">
              {items.map((a, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        a.tone === "danger" ? "#ef4444" : a.tone === "warning" ? "#f59e0b" : "#94a3b8",
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-[13px] leading-relaxed text-slate-700">
                    {a.text}{" "}
                    <Link href={a.href} className="underline underline-offset-2">
                      buka
                    </Link>
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        <p className="mt-4 border-t border-slate-100 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Kritis bila ada issue kritikal melewati 3 hari, proyek critical, budget line di atas 100%,
          atau compliance di bawah 70%. Perlu perhatian bila ada overload, compliance di bawah 90%,
          proyek at risk, budget line di atas 80%, atau keputusan yang menunggu. Perbandingan
          periode memakai bulan dan minggu sebelumnya; bertanda &quot;—&quot; bila periode
          pembanding belum punya data.
        </p>
      </div>
    </Card>
  );
}

/** Movement against the comparison period, or "—" when there is nothing to compare. */
function Delta({ now, prev, unit }: { now: number; prev: number | null; unit: string }) {
  if (prev == null) {
    return <span className="text-[12px] text-muted-foreground">(pembanding —)</span>;
  }
  const diff = now - prev;
  const flat = Math.abs(diff) < 0.05;
  const up = diff > 0;
  const color = flat ? "#64748b" : up ? "#15803d" : "#b91c1c";
  return (
    <span className="text-[12px] font-medium" style={{ color }}>
      ({flat ? "setara" : `${up ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)} ${unit}`} vs periode
      sebelumnya)
    </span>
  );
}
