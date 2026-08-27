"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateBoundary } from "@/components/state-boundary";
import { useSession } from "@/components/session-provider";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { hours as fmtHours, percent } from "@/lib/format";
import type { Activity, Project, TimesheetStatus } from "@/lib/database.types";
import {
  addDays,
  monthKey,
  startOfWeek,
  toKey,
  weekLabel,
  weekdays,
} from "@/lib/week";

const CAPACITY_NOTE = "kapasitas 8 jam × Sen–Jum · libur nasional belum dikecualikan";

interface Cell {
  id: string | null;
  hours: number;
  status: TimesheetStatus;
  approval_note: string | null;
}
interface Row {
  key: string;
  project_id: string;
  activity_id: string;
  cells: Record<string, Cell>;
}
interface TimesheetRow {
  id: string;
  project_id: string;
  activity_id: string;
  work_date: string;
  hours: number;
  status: TimesheetStatus;
  approval_note: string | null;
}
interface UtilRow {
  approved_hours: number | null;
  capacity_hours: number | null;
  utilization_pct: number | null;
}

/** Only draft and rejected rows may be edited by their owner (SRS SF-2.1). */
const EDITABLE: TimesheetStatus[] = ["draft", "rejected"];

export default function TimesheetPage() {
  const { profile } = useSession();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => weekdays(weekStart), [weekStart]);
  const from = days[0].key;
  const to = toKey(addDays(weekStart, 6));
  const myId = profile?.id ?? null;

  const master = useQuery<Project | Activity>(
    () =>
      getSupabase()
        .from("projects")
        .select("id, code, name, status")
        .eq("status", "active")
        .order("code")
        .range(0, 199)
        .returns<Project[]>(),
    [],
  );
  const acts = useQuery<Activity>(
    () =>
      getSupabase()
        .from("activities")
        .select("id, code, name, category, is_billable, is_active")
        .eq("is_active", true)
        .order("code")
        .range(0, 199)
        .returns<Activity[]>(),
    [],
  );
  const sheet = useQuery<TimesheetRow>(
    () =>
      getSupabase()
        .from("timesheets")
        .select("id, project_id, activity_id, work_date, hours, status, approval_note")
        .eq("profile_id", myId ?? "")
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date")
        .range(0, 199)
        .returns<TimesheetRow[]>(),
    [myId, from, to],
  );
  const util = useQuery<UtilRow>(
    () =>
      getSupabase()
        .from("utilization_monthly")
        .select("approved_hours, capacity_hours, utilization_pct")
        .eq("profile_id", myId ?? "")
        .eq("period_month", monthKey(weekStart))
        .range(0, 0)
        .returns<UtilRow[]>(),
    [myId, weekStart],
  );

  const projects = master.rows as Project[];
  const activities = acts.rows as Activity[];

  const rows: Row[] = useMemo(() => {
    const byKey = new Map<string, Row>();
    for (const r of sheet.rows) {
      const key = `${r.project_id}:${r.activity_id}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          project_id: r.project_id,
          activity_id: r.activity_id,
          cells: {},
        });
      }
      byKey.get(key)!.cells[r.work_date] = {
        id: r.id,
        hours: Number(r.hours),
        status: r.status,
        approval_note: r.approval_note,
      };
    }
    // Rows added this session that have no saved cell yet.
    for (const k of Object.keys(edits)) {
      const [rowKey] = k.split("@");
      if (!byKey.has(rowKey)) {
        const [project_id, activity_id] = rowKey.split(":");
        byKey.set(rowKey, { key: rowKey, project_id, activity_id, cells: {} });
      }
    }
    return [...byKey.values()];
  }, [sheet.rows, edits]);

  const rejected = sheet.rows.filter((r) => r.status === "rejected");
  const locked = sheet.rows.some((r) => r.status === "submitted");
  const hasEditable =
    sheet.rows.length === 0 || sheet.rows.some((r) => EDITABLE.includes(r.status));

  function cellValue(row: Row, dayKey: string): string {
    const k = `${row.key}@${dayKey}`;
    if (k in edits) return edits[k];
    const c = row.cells[dayKey];
    return c && c.hours ? String(c.hours) : "";
  }
  function cellStatus(row: Row, dayKey: string): TimesheetStatus | null {
    return row.cells[dayKey]?.status ?? null;
  }
  function dayTotal(dayKey: string): number {
    return rows.reduce((sum, r) => sum + (Number(cellValue(r, dayKey)) || 0), 0);
  }
  function rowTotal(row: Row): number {
    return days.reduce((sum, d) => sum + (Number(cellValue(row, d.key)) || 0), 0);
  }
  const grandTotal = days.reduce((s, d) => s + dayTotal(d.key), 0);
  const overDay = days.find((d) => dayTotal(d.key) > 24);

  function addRow(projectId: string, activityId: string) {
    const key = `${projectId}:${activityId}`;
    if (rows.some((r) => r.key === key)) return;
    setEdits((e) => ({ ...e, [`${key}@${days[0].key}`]: "" }));
  }

  async function save() {
    if (!myId) return;
    setBusy("save");
    setError(null);
    setMessage(null);
    const supabase = getSupabase();
    const upserts: Array<Record<string, unknown>> = [];
    const deletes: string[] = [];

    for (const row of rows) {
      for (const d of days) {
        const k = `${row.key}@${d.key}`;
        if (!(k in edits)) continue;
        const existing = row.cells[d.key];
        if (existing && !EDITABLE.includes(existing.status)) continue; // locked
        const value = Number(edits[k]);
        if (!value) {
          if (existing?.id) deletes.push(existing.id);
          continue;
        }
        upserts.push({
          profile_id: myId,
          project_id: row.project_id,
          activity_id: row.activity_id,
          work_date: d.key,
          hours: value,
          // status is intentionally omitted: new rows default to draft, and a
          // rejected row keeps its status until the week is re-submitted.
        });
      }
    }

    if (deletes.length) {
      const { error } = await supabase.from("timesheets").delete().in("id", deletes);
      if (error) {
        setBusy(null);
        setError(error.message);
        return;
      }
    }
    if (upserts.length) {
      const { error } = await supabase
        .from("timesheets")
        .upsert(upserts, { onConflict: "profile_id,project_id,activity_id,work_date" });
      if (error) {
        setBusy(null);
        setError(error.message);
        return;
      }
    }
    setBusy(null);
    setEdits({});
    setMessage("Tersimpan.");
    sheet.reload();
    util.reload();
  }

  async function submit() {
    if (!myId) return;
    setBusy("submit");
    setError(null);
    setMessage(null);
    // submitted_at is stamped by stamp_timesheet_transitions() — never sent
    // from here (AGENTS.md security rule 3).
    const { error } = await getSupabase()
      .from("timesheets")
      .update({ status: "submitted" })
      .eq("profile_id", myId)
      .gte("work_date", from)
      .lte("work_date", to)
      .in("status", ["draft", "rejected"]);
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Timesheet dikirim untuk persetujuan.");
    sheet.reload();
  }

  const u = util.rows[0];
  const dirty = Object.keys(edits).length > 0;

  return (
    <AppShell
      title="Timesheet"
      actions={
        <div className="flex h-8 items-center rounded-md border border-border bg-white px-1">
          <button
            aria-label="Minggu sebelumnya"
            className="px-2 text-slate-500 hover:text-foreground"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            ‹
          </button>
          <span className="px-1 text-[13px] font-medium">{weekLabel(weekStart)}</span>
          <button
            aria-label="Minggu berikutnya"
            className="px-2 text-slate-500 hover:text-foreground"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            ›
          </button>
        </div>
      }
    >
      {/* Principle 2: the person entering the data sees their own number. */}
      <Card className="flex flex-wrap items-center gap-5 p-4">
        <div className="min-w-[190px]">
          <div className="text-[12px] text-muted-foreground">Utilisasi Anda bulan ini</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="tabular text-[24px] font-semibold tracking-tight">
              {percent(u?.utilization_pct ?? 0)}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {fmtHours(u?.approved_hours ?? 0)} / {u?.capacity_hours ?? "—"} jam
            </span>
          </div>
        </div>
        <div className="h-[9px] min-w-[120px] flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, u?.utilization_pct ?? 0)}%` }}
          />
        </div>
        <p className="max-w-[250px] text-right text-[11.5px] text-muted-foreground">
          {CAPACITY_NOTE}
        </p>
      </Card>

      {rejected.length > 0 ? (
        <Card className="border-red-200 bg-red-50 p-3.5">
          <p className="text-[12.5px] leading-relaxed text-red-900">
            <strong className="font-semibold">
              {rejected.length} baris ditolak — perbaiki lalu submit ulang.
            </strong>{" "}
            {rejected[0].approval_note ? `“${rejected[0].approval_note}”` : null}
          </p>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Entry mingguan</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">TS-01</span>
        </CardHeader>
        <StateBoundary
          loading={sheet.loading || master.loading || acts.loading}
          error={sheet.error ?? master.error ?? acts.error}
          onRetry={() => {
            sheet.reload();
            master.reload();
            acts.reload();
          }}
        >
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="w-[290px] border-b border-border bg-surface px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Proyek / Aktivitas
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.key}
                      className="w-[86px] border-b border-border bg-surface px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {d.short} {d.dayOfMonth}
                    </th>
                  ))}
                  <th className="w-[84px] border-b border-border bg-muted px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const project = projects.find((p) => p.id === row.project_id);
                  const activity = activities.find((a) => a.id === row.activity_id);
                  return (
                    <tr key={row.key}>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="font-medium">
                          {project ? `${project.code} · ${project.name}` : "—"}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground">
                          {activity ? `${activity.name} · ${activity.category}` : "—"}
                        </div>
                      </td>
                      {days.map((d) => {
                        const st = cellStatus(row, d.key);
                        const readOnly = st != null && !EDITABLE.includes(st);
                        return (
                          <td key={d.key} className="border-b border-slate-100 px-1.5 py-1.5">
                            <input
                              inputMode="decimal"
                              aria-label={`${project?.code ?? ""} ${d.short} ${d.dayOfMonth}`}
                              readOnly={readOnly}
                              value={cellValue(row, d.key)}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [`${row.key}@${d.key}`]: e.target.value.replace(/[^\d.,]/g, "").replace(",", "."),
                                }))
                              }
                              className={
                                "tabular h-8 w-full rounded-md border px-2 text-right text-[13px] " +
                                (readOnly
                                  ? "cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground"
                                  : st === "rejected"
                                    ? "border-red-300 bg-red-50 focus:outline-none focus:ring-[3px] focus:ring-red-100"
                                    : "border-border focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10")
                              }
                            />
                          </td>
                        );
                      })}
                      <td className="tabular border-b border-slate-100 bg-surface px-3 py-2 text-right font-semibold">
                        {fmtHours(rowTotal(row))}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={days.length + 2} className="border-b border-slate-100 px-3 py-2">
                    <AddRow
                      projects={projects}
                      activities={activities}
                      disabled={!hasEditable}
                      onAdd={addRow}
                    />
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-surface">
                  <td className="border-t border-border px-3 py-2.5 font-semibold">
                    Total per hari
                  </td>
                  {days.map((d) => {
                    const t = dayTotal(d.key);
                    return (
                      <td
                        key={d.key}
                        className={
                          "tabular border-t border-border px-3 py-2.5 text-right font-semibold " +
                          (t > 24 ? "text-destructive" : "")
                        }
                      >
                        {fmtHours(t)}
                      </td>
                    );
                  })}
                  <td className="tabular border-t border-border bg-muted px-3 py-2.5 text-right font-bold">
                    {fmtHours(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </StateBoundary>
      </Card>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {locked ? (
            <Badge tone="warning">Menunggu approval</Badge>
          ) : rejected.length ? (
            <Badge tone="danger">Ada baris ditolak</Badge>
          ) : (
            <Badge>Draft</Badge>
          )}
          {message ? <span className="text-[12.5px] text-green-700">{message}</span> : null}
          {error ? (
            <span role="alert" className="text-[12.5px] text-destructive">
              {error}
            </span>
          ) : null}
          {overDay ? (
            <span className="text-[12.5px] text-destructive">
              {overDay.short} melebihi 24 jam — perbaiki sebelum submit.
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy !== null || !dirty || !hasEditable}>
            {busy === "save" ? "Menyimpan…" : "Simpan draft"}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy !== null || dirty || !hasEditable || grandTotal === 0 || overDay != null}
            title={dirty ? "Simpan dulu sebelum submit" : undefined}
          >
            {busy === "submit" ? "Mengirim…" : rejected.length ? "Submit ulang" : "Submit"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function AddRow({
  projects,
  activities,
  disabled,
  onAdd,
}: {
  projects: Project[];
  activities: Activity[];
  disabled: boolean;
  onAdd: (projectId: string, activityId: string) => void;
}) {
  const [p, setP] = useState("");
  const [a, setA] = useState("");
  const cls =
    "h-8 rounded-md border border-border bg-white px-2 text-[12.5px] focus:border-primary focus:outline-none";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Proyek" value={p} onChange={(e) => setP(e.target.value)} className={cls}>
        <option value="">Pilih proyek…</option>
        {projects.map((x) => (
          <option key={x.id} value={x.id}>
            {x.code} · {x.name}
          </option>
        ))}
      </select>
      <select aria-label="Aktivitas" value={a} onChange={(e) => setA(e.target.value)} className={cls}>
        <option value="">Pilih aktivitas…</option>
        {activities.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={disabled || !p || !a}
        onClick={() => {
          onAdd(p, a);
          setP("");
          setA("");
        }}
      >
        + Tambah baris
      </Button>
    </div>
  );
}
