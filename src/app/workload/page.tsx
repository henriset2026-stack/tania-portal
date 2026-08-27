"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Field, Input } from "@/components/ui/field";
import { StateBoundary } from "@/components/state-boundary";
import { ExportButton } from "@/components/export-button";
import { useSession } from "@/components/session-provider";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { hours as fmtHours, percent } from "@/lib/format";
import { capacityHours, monthShortLabel, recentMonths } from "@/lib/capacity";
import { monthKey } from "@/lib/week";

/*
 * WA-01 allocation register · WA-02 utilisation · WA-03 alerts · WA-04 heatmap.
 *
 * Thresholds are fixed for the MVP (DDD G-3): overload above 100% allocation,
 * idle below 60% utilisation. The requirement asks for configurable ones.
 */
const OVERLOAD_ALLOC = 100;
const IDLE_UTIL = 60;
const HEATMAP_MONTHS = 4;
const CAPACITY_NOTE = "kapasitas 8 jam × Sen–Jum · libur nasional belum dikecualikan";

const WRITE_ROLES = ["manager", "pm", "chapter_lead", "admin"];

interface Person {
  id: string;
  full_name: string;
  squad: string | null;
  grade: string | null;
}
interface AllocRow {
  profile_id: string;
  project_id: string;
  period_month: string;
  percent: number;
}
interface UtilRow {
  profile_id: string;
  period_month: string;
  approved_hours: number | null;
  utilization_pct: number | null;
}
interface ProjectRow {
  id: string;
  code: string;
  name: string;
}

export default function WorkloadPage() {
  const { profile } = useSession();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [squadFilter, setSquadFilter] = useState("");

  const months = useMemo(() => recentMonths(month, HEATMAP_MONTHS), [month]);
  const canWrite = profile != null && WRITE_ROLES.includes(profile.role);

  const people = useQuery<Person>(
    () =>
      getSupabase()
        .from("profiles")
        .select("id, full_name, squad, grade")
        .eq("is_active", true)
        .eq("role", "talent")
        .order("full_name")
        .range(0, 499)
        .returns<Person[]>(),
    [],
  );
  const projects = useQuery<ProjectRow>(
    () =>
      getSupabase()
        .from("projects")
        .select("id, code, name")
        .eq("status", "active")
        .order("code")
        .range(0, 199)
        .returns<ProjectRow[]>(),
    [],
  );
  const allocs = useQuery<AllocRow>(
    () =>
      getSupabase()
        .from("allocations")
        .select("profile_id, project_id, period_month, percent")
        .eq("period_month", month)
        .range(0, 999)
        .returns<AllocRow[]>(),
    [month],
  );
  const util = useQuery<UtilRow>(
    () =>
      getSupabase()
        .from("utilization_monthly")
        .select("profile_id, period_month, approved_hours, utilization_pct")
        .in("period_month", months)
        .range(0, 1999)
        .returns<UtilRow[]>(),
    [months.join(",")],
  );

  const allocByPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocs.rows) m.set(a.profile_id, (m.get(a.profile_id) ?? 0) + Number(a.percent));
    return m;
  }, [allocs.rows]);

  const utilKey = (pid: string, mk: string) => `${pid}@${mk}`;
  const utilMap = useMemo(() => {
    const m = new Map<string, UtilRow>();
    for (const u of util.rows) m.set(utilKey(u.profile_id, u.period_month), u);
    return m;
  }, [util.rows]);

  const squads = useMemo(
    () => [...new Set(people.rows.map((p) => p.squad ?? "Tanpa squad"))].sort(),
    [people.rows],
  );
  const roster = squadFilter
    ? people.rows.filter((p) => (p.squad ?? "Tanpa squad") === squadFilter)
    : people.rows;

  const cap = capacityHours(month);

  // Chapter figure is hours-weighted over the FULL roster, so people with no
  // timesheet rows pull the average down instead of vanishing (SRS SF-1.5).
  const chapterHours = roster.reduce(
    (s, p) => s + Number(utilMap.get(utilKey(p.id, month))?.approved_hours ?? 0),
    0,
  );
  const chapterPct = roster.length ? (chapterHours / (roster.length * cap)) * 100 : 0;

  // WA-04: same denominator rule, per squad per month.
  const heatmap = useMemo(() => {
    return squads.map((squad) => {
      const members = people.rows.filter((p) => (p.squad ?? "Tanpa squad") === squad);
      const cells = months.map((mk) => {
        const c = capacityHours(mk);
        const h = members.reduce(
          (s, p) => s + Number(utilMap.get(utilKey(p.id, mk))?.approved_hours ?? 0),
          0,
        );
        return { month: mk, pct: members.length ? (h / (members.length * c)) * 100 : 0 };
      });
      return { squad, headcount: members.length, cells };
    });
  }, [squads, people.rows, months, utilMap]);

  const alerts = roster
    .map((p) => {
      const alloc = allocByPerson.get(p.id) ?? 0;
      const u = utilMap.get(utilKey(p.id, month));
      const pct = Number(u?.utilization_pct ?? 0);
      const hasRows = u != null;
      if (alloc > OVERLOAD_ALLOC)
        return { p, tone: "warning" as const, text: `dialokasikan ${alloc}% — melebihi ${OVERLOAD_ALLOC}%` };
      if (!hasRows && alloc > 0)
        return { p, tone: "danger" as const, text: `dialokasikan ${alloc}% tetapi belum ada timesheet approved` };
      if (pct < IDLE_UTIL)
        return { p, tone: "neutral" as const, text: `utilisasi ${percent(pct)} — di bawah ${IDLE_UTIL}%` };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <AppShell
      title="Workload"
      actions={
        <div className="flex items-center gap-2">
          <ExportButton
            filename={`tania-workload-${month.slice(0, 7)}`}
            sheetName="Workload"
            disabled={roster.length === 0}
            rows={() => [
              ["Talent", "Squad", "Alokasi %", "Utilisasi %", "Jam approved", "Kapasitas"],
              ...roster.map((p) => {
                const u = utilMap.get(utilKey(p.id, month));
                return [
                  p.full_name,
                  p.squad ?? "",
                  allocByPerson.get(p.id) ?? 0,
                  Number(Number(u?.utilization_pct ?? 0).toFixed(1)),
                  Number(u?.approved_hours ?? 0),
                  cap,
                ];
              }),
              [],
              ["Rata-rata", "", "", Number(chapterPct.toFixed(1)), chapterHours, roster.length * cap],
            ]}
          />
          <input
            type="month"
            aria-label="Periode"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(`${e.target.value}-01`)}
            className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
          />
          <select
            aria-label="Squad"
            value={squadFilter}
            onChange={(e) => setSquadFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
          >
            <option value="">Semua squad</option>
            {squads.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Alokasi rencana vs utilisasi aktual</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">
            Alokasi = rencana · Utilisasi = jam approved ÷ kapasitas
          </span>
        </CardHeader>
        <StateBoundary
          loading={people.loading || util.loading || allocs.loading}
          error={people.error ?? util.error ?? allocs.error}
          empty={roster.length === 0}
          emptyMessage="Belum ada talent aktif pada filter ini."
          onRetry={() => {
            people.reload();
            util.reload();
            allocs.reload();
          }}
        >
          <Table>
            <thead>
              <tr>
                <Th>Talent</Th>
                <Th className="w-[120px]">Squad</Th>
                <Th className="w-[92px] text-right">Alokasi</Th>
                <Th className="w-[96px] text-right">Utilisasi</Th>
                <Th className="w-[190px]">Aktual</Th>
                <Th className="w-[104px] text-right">Jam approved</Th>
                <Th className="w-[160px]">Status</Th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => {
                const alloc = allocByPerson.get(p.id) ?? 0;
                const u = utilMap.get(utilKey(p.id, month));
                const pct = Number(u?.utilization_pct ?? 0);
                const hrs = Number(u?.approved_hours ?? 0);
                const noRows = u == null;
                const over = alloc > OVERLOAD_ALLOC;
                return (
                  <tr
                    key={p.id}
                    className={noRows ? "bg-red-50" : over ? "bg-amber-50" : undefined}
                  >
                    <Td>
                      <Link
                        href={`/talent/?id=${p.id}`}
                        className="font-medium underline decoration-slate-300 underline-offset-[3px]"
                      >
                        {p.full_name}
                      </Link>
                      <div className="text-[11.5px] text-muted-foreground">
                        {p.grade ? `grade ${p.grade}` : "—"}
                      </div>
                    </Td>
                    <Td className="text-muted-foreground">{p.squad ?? "—"}</Td>
                    <Td className={"tabular text-right " + (over ? "font-semibold text-amber-800" : "")}>
                      {alloc ? `${alloc}%` : "—"}
                      {over ? " ⚠" : ""}
                    </Td>
                    <Td
                      className={
                        "tabular text-right font-semibold " + (noRows ? "text-destructive" : "")
                      }
                    >
                      {percent(pct)}
                    </Td>
                    <Td>
                      <div className="h-[7px] w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            "h-full rounded-full " +
                            (pct >= IDLE_UTIL ? "bg-primary" : "bg-slate-400")
                          }
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </Td>
                    <Td className={"tabular text-right " + (noRows ? "text-destructive" : "")}>
                      {fmtHours(hrs)}
                    </Td>
                    <Td>
                      {noRows ? (
                        <Badge tone="danger">belum ada timesheet</Badge>
                      ) : over ? (
                        <Badge tone="warning">overload alokasi</Badge>
                      ) : pct < IDLE_UTIL ? (
                        <Badge>idle &lt; {IDLE_UTIL}%</Badge>
                      ) : (
                        <Badge tone="success">normal</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface">
                <Td colSpan={3} className="border-t border-border font-semibold">
                  Rata-rata {squadFilter || "chapter"} · {roster.length} talent
                </Td>
                <Td className="tabular border-t border-border text-right font-bold">
                  {percent(chapterPct)}
                </Td>
                <Td className="border-t border-border">
                  <div className="h-[7px] w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, chapterPct)}%` }}
                    />
                  </div>
                </Td>
                <Td className="tabular border-t border-border text-right font-semibold">
                  {fmtHours(chapterHours)}
                </Td>
                <Td className="border-t border-border" />
              </tr>
            </tfoot>
          </Table>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
            {CAPACITY_NOTE}. Rata-rata memakai seluruh talent aktif sebagai penyebut, termasuk
            yang belum mengisi timesheet.
          </p>
        </StateBoundary>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Heatmap utilisasi per squad</CardTitle>
            <span className="text-[11.5px] text-muted-foreground">
              WA-04 · {monthShortLabel(months[0])} – {monthShortLabel(months[months.length - 1])}
            </span>
          </CardHeader>
          <StateBoundary
            loading={util.loading || people.loading}
            error={util.error ?? people.error}
            empty={heatmap.length === 0}
            emptyMessage="Belum ada squad."
          >
            <div className="flex flex-col gap-2 p-4">
              <div
                className="grid items-center gap-1.5"
                style={{ gridTemplateColumns: `150px repeat(${months.length}, minmax(0,1fr))` }}
              >
                <span />
                {months.map((m) => (
                  <span key={m} className="text-center text-[11.5px] text-muted-foreground">
                    {monthShortLabel(m)}
                  </span>
                ))}
              </div>
              {heatmap.map((row) => (
                <div
                  key={row.squad}
                  className="grid items-center gap-1.5"
                  style={{ gridTemplateColumns: `150px repeat(${months.length}, minmax(0,1fr))` }}
                >
                  <span className="truncate text-[13px]">
                    {row.squad}{" "}
                    <span className="text-[11px] text-muted-foreground">({row.headcount})</span>
                  </span>
                  {row.cells.map((c) => (
                    <div
                      key={c.month}
                      className="flex h-[34px] items-center justify-center rounded-md text-[12px] font-semibold"
                      style={heatColor(c.pct)}
                      title={`${row.squad} · ${monthShortLabel(c.month)} · ${percent(c.pct)}`}
                    >
                      {percent(c.pct)}
                      {c.pct > 100 ? " ⚠" : ""}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </StateBoundary>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
            Angka selalu ditulis — warna bukan satu-satunya penanda. Penyebut tiap sel adalah
            jumlah anggota squad × kapasitas bulan itu.
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perlu perhatian</CardTitle>
            <span className="text-[11.5px] text-muted-foreground">WA-03</span>
          </CardHeader>
          {alerts.length === 0 ? (
            <p className="p-4 text-[12.5px] text-muted-foreground">
              Tidak ada yang perlu perhatian pada periode ini.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 p-4">
              {alerts.map(({ p, tone, text }) => (
                <li key={p.id} className="flex gap-2.5">
                  <Badge tone={tone} className="shrink-0">
                    {tone === "danger" ? "⛔" : tone === "warning" ? "⚠" : "i"}
                  </Badge>
                  <span className="text-[12.5px] leading-relaxed">
                    <strong className="font-semibold">{p.full_name}</strong> {text}.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canWrite ? (
        <AllocationForm
          people={people.rows}
          projects={projects.rows}
          month={month}
          onSaved={allocs.reload}
        />
      ) : null}
    </AppShell>
  );
}

/** Percent → a slate ramp with an amber top end. Text is always shown too. */
function heatColor(pct: number): { background: string; color: string } {
  if (pct > 100) return { background: "#f59e0b", color: "#3f2b00" };
  if (pct >= 85) return { background: "#1e293b", color: "#ffffff" };
  if (pct >= 70) return { background: "#475569", color: "#ffffff" };
  if (pct >= 55) return { background: "#94a3b8", color: "#0f172a" };
  if (pct >= 40) return { background: "#cbd5e1", color: "#0f172a" };
  return { background: "#e2e8f0", color: "#475569" };
}

function AllocationForm({
  people,
  projects,
  month,
  onSaved,
}: {
  people: Person[];
  projects: ProjectRow[];
  month: string;
  onSaved: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pct, setPct] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    const value = Number(pct);
    if (!(value > 0 && value <= 150)) {
      setBusy(false);
      setError("Persentase harus di atas 0 dan maksimal 150.");
      return;
    }
    const { error } = await getSupabase()
      .from("allocations")
      .upsert(
        { profile_id: personId, project_id: projectId, period_month: month, percent: value },
        { onConflict: "profile_id,project_id,period_month" },
      );
    setBusy(false);
    if (error) setError(error.message);
    else {
      setOk(true);
      onSaved();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrasi alokasi</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">WA-01 · periode terpilih</span>
      </CardHeader>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[190px] flex-1">
          <Field label="Talent" htmlFor="al-person">
            <select
              id="al-person"
              required
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]"
            >
              <option value="">Pilih talent…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="min-w-[190px] flex-1">
          <Field label="Proyek" htmlFor="al-project">
            <select
              id="al-project"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]"
            >
              <option value="">Pilih proyek…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="w-[130px]">
          <Field label="Persentase" htmlFor="al-pct" hint="maks 150">
            <Input
              id="al-pct"
              inputMode="numeric"
              required
              value={pct}
              onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </Field>
        </div>
        <Button type="submit" variant="primary" disabled={busy || !personId || !projectId}>
          {busy ? "Menyimpan…" : "Simpan alokasi"}
        </Button>
        {ok ? <span className="text-[12.5px] text-green-700">Tersimpan.</span> : null}
        {error ? (
          <p role="alert" className="w-full text-[12.5px] text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
