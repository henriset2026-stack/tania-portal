"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { StateBoundary } from "@/components/state-boundary";
import { useSession } from "@/components/session-provider";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { date, dateTime, moneyCompact } from "@/lib/format";
import { monthKey } from "@/lib/week";

/*
 * PF-01 intake · PF-02 scoring · PF-03 resource check · PF-04 decision ·
 * PF-05 pipeline.
 *
 * Weights are locked in the total_score generated column (25/25/20/15/15,
 * ×20 → 0–100). The requirement asks for configurable weights; MVP diverges
 * deliberately (PRD §6, DDD G-4). The contributions shown here are display
 * only — the score itself always comes from the database.
 */
const DIMENSIONS = [
  { key: "score_strategic", label: "Strategic fit", weight: 0.25 },
  { key: "score_financial", label: "Financial attractiveness", weight: 0.25 },
  { key: "score_risk", label: "Delivery risk", weight: 0.2 },
  { key: "score_resource", label: "Resource availability", weight: 0.15 },
  { key: "score_technical", label: "Technical feasibility", weight: 0.15 },
] as const;

type ScoreKey = (typeof DIMENSIONS)[number]["key"];
type Decision = "go" | "no_go" | "hold";

const DECISION_LABEL: Record<string, string> = {
  go: "Go",
  no_go: "No-Go",
  hold: "Hold",
};
const SUBMIT_ROLES = ["pm", "manager", "chapter_lead", "admin"];
const DECIDE_ROLES = ["chapter_lead", "admin"];
/** Competency counts as available for staffing at this level or above. */
const MIN_LEVEL = 3;

interface CaseRow {
  id: string;
  title: string;
  customer: string | null;
  description: string | null;
  estimated_revenue: number | null;
  estimated_effort_md: number | null;
  estimated_duration_mo: number | null;
  required_competencies: string[];
  score_strategic: number | null;
  score_financial: number | null;
  score_risk: number | null;
  score_resource: number | null;
  score_technical: number | null;
  total_score: number;
  decision: Decision | null;
  decision_rationale: string | null;
  decided_at: string | null;
  submitted_by: string;
  created_at: string;
}
interface SkillRow {
  id: string;
  name: string;
}
interface PSkillRow {
  profile_id: string;
  skill_id: string;
  level: number;
}
interface AllocRow {
  profile_id: string;
  percent: number;
}

export default function FeasibilityPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Feasibility">
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
  const { profile } = useSession();

  const cases = useQuery<CaseRow>(
    () =>
      getSupabase()
        .from("feasibility_cases")
        .select(
          "id, title, customer, description, estimated_revenue, estimated_effort_md, estimated_duration_mo, required_competencies, score_strategic, score_financial, score_risk, score_resource, score_technical, total_score, decision, decision_rationale, decided_at, submitted_by, created_at",
        )
        .order("created_at", { ascending: false })
        .range(0, 199)
        .returns<CaseRow[]>(),
    [],
  );

  const selected = cases.rows.find((c) => c.id === selectedId) ?? null;

  return (
    <AppShell title="Feasibility">
      {selected ? (
        <CaseDetail
          row={selected}
          canDecide={profile != null && DECIDE_ROLES.includes(profile.role)}
          isOwner={selected.submitted_by === profile?.id}
          onChanged={cases.reload}
        />
      ) : (
        <Pipeline
          cases={cases}
          canSubmit={profile != null && SUBMIT_ROLES.includes(profile.role)}
        />
      )}
    </AppShell>
  );
}

/* ---------------------------------------------------------------- pipeline */

function Pipeline({
  cases,
  canSubmit,
}: {
  cases: ReturnType<typeof useQuery<CaseRow>>;
  canSubmit: boolean;
}) {
  const columns: Array<{ key: string; label: string; match: (c: CaseRow) => boolean }> = [
    { key: "pending", label: "Menunggu keputusan", match: (c) => c.decision == null },
    { key: "go", label: "Go", match: (c) => c.decision === "go" },
    { key: "hold", label: "Hold", match: (c) => c.decision === "hold" },
    { key: "no_go", label: "No-Go", match: (c) => c.decision === "no_go" },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pipeline kandidat proyek</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">PF-05</span>
        </CardHeader>
        <StateBoundary
          loading={cases.loading}
          error={cases.error}
          empty={cases.rows.length === 0}
          emptyMessage="Belum ada kandidat proyek."
          onRetry={cases.reload}
        >
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => {
              const items = cases.rows
                .filter(col.match)
                .sort((a, b) => Number(b.total_score) - Number(a.total_score));
              return (
                <div key={col.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[12px] font-medium text-muted-foreground">
                      {col.label}
                    </span>
                    <Badge>{items.length}</Badge>
                  </div>
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-[12px] text-muted-foreground">
                      Kosong
                    </p>
                  ) : (
                    items.map((c) => (
                      <Link
                        key={c.id}
                        href={`/feasibility/?id=${c.id}`}
                        className="rounded-lg border border-border bg-white p-3 hover:border-slate-300"
                      >
                        <div className="text-[13px] font-medium leading-snug">{c.title}</div>
                        <div className="mt-1 text-[11.5px] text-muted-foreground">
                          {c.customer ?? "—"} · {moneyCompact(c.estimated_revenue)}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="tabular text-[15px] font-semibold">
                            {Number(c.total_score).toFixed(1)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {date(c.created_at)}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </StateBoundary>
      </Card>

      {canSubmit ? <IntakeForm onSaved={cases.reload} /> : null}
    </>
  );
}

function IntakeForm({ onSaved }: { onSaved: () => void }) {
  const { profile } = useSession();
  const [f, setF] = useState({
    title: "",
    customer: "",
    revenue: "",
    effort: "",
    duration: "",
    competencies: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError(null);
    setOk(false);
    // submitted_by must equal auth.uid() for the insert policy to pass.
    const { error } = await getSupabase().from("feasibility_cases").insert({
      title: f.title.trim(),
      customer: f.customer.trim() || null,
      estimated_revenue: f.revenue ? Number(f.revenue) : null,
      estimated_effort_md: f.effort ? Number(f.effort) : null,
      estimated_duration_mo: f.duration ? Number(f.duration) : null,
      required_competencies: f.competencies
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      submitted_by: profile.id,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setF({ title: "", customer: "", revenue: "", effort: "", duration: "", competencies: "" });
      setOk(true);
      onSaved();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajukan kandidat proyek</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">PF-01</span>
      </CardHeader>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <Field label="Judul" htmlFor="f-title" required>
            <Input id="f-title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
        </div>
        <Field label="Customer" htmlFor="f-cust">
          <Input id="f-cust" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
        </Field>
        <Field label="Estimasi revenue (Rp)" htmlFor="f-rev">
          <Input id="f-rev" inputMode="numeric" value={f.revenue}
            onChange={(e) => setF({ ...f, revenue: e.target.value.replace(/[^\d]/g, "") })} />
        </Field>
        <Field label="Estimasi effort (man-days)" htmlFor="f-eff">
          <Input id="f-eff" inputMode="decimal" value={f.effort}
            onChange={(e) => setF({ ...f, effort: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
        <Field label="Durasi (bulan)" htmlFor="f-dur">
          <Input id="f-dur" inputMode="decimal" value={f.duration}
            onChange={(e) => setF({ ...f, duration: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
        <div className="md:col-span-3">
          <Field label="Kompetensi yang dibutuhkan" htmlFor="f-comp" hint="Pisahkan dengan koma, mis. ETL, Data Modeling">
            <Input id="f-comp" value={f.competencies} onChange={(e) => setF({ ...f, competencies: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center gap-3 md:col-span-3">
          <Button type="submit" variant="primary" disabled={busy || !f.title.trim()}>
            {busy ? "Menyimpan…" : "Ajukan"}
          </Button>
          {ok ? <span className="text-[12.5px] text-green-700">Kandidat diajukan.</span> : null}
          {error ? <span role="alert" className="text-[12.5px] text-destructive">{error}</span> : null}
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ detail */

function CaseDetail({
  row,
  canDecide,
  isOwner,
  onChanged,
}: {
  row: CaseRow;
  canDecide: boolean;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const decided = row.decision != null;
  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    score_strategic: row.score_strategic ?? 0,
    score_financial: row.score_financial ?? 0,
    score_risk: row.score_risk ?? 0,
    score_resource: row.score_resource ?? 0,
    score_technical: row.score_technical ?? 0,
  });
  const [decision, setDecision] = useState<Decision | "">("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The submitter may edit only while undecided; leads may edit regardless.
  const canEditScores = !decided && (isOwner || canDecide);

  const preview = DIMENSIONS.reduce((s, d) => s + scores[d.key] * d.weight * 20, 0);

  async function saveScores() {
    setBusy(true);
    setError(null);
    // total_score is a generated column — never sent.
    const { error } = await getSupabase()
      .from("feasibility_cases")
      .update(scores)
      .eq("id", row.id);
    setBusy(false);
    if (error) setError(error.message);
    else onChanged();
  }

  async function saveDecision() {
    if (!decision || !rationale.trim()) return;
    setBusy(true);
    setError(null);
    // decided_by / decided_at are stamped by the trigger, which also rejects
    // an empty rationale.
    const { error } = await getSupabase()
      .from("feasibility_cases")
      .update({ decision, decision_rationale: rationale.trim() })
      .eq("id", row.id);
    setBusy(false);
    if (error) setError(error.message);
    else onChanged();
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href="/feasibility/" className="text-[12.5px] underline underline-offset-2">
          ← Pipeline
        </Link>
        <h2 className="text-[15px] font-semibold">{row.title}</h2>
        {decided ? (
          <Badge tone={row.decision === "go" ? "success" : row.decision === "no_go" ? "danger" : "warning"}>
            {DECISION_LABEL[row.decision as string]}
          </Badge>
        ) : (
          <Badge tone="warning">menunggu keputusan</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_372px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Intake</CardTitle>
              <span className="text-[11.5px] text-muted-foreground">
                Diajukan {date(row.created_at)}
              </span>
            </CardHeader>
            <dl className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
              <div>
                <dt className="text-[12px] text-muted-foreground">Customer</dt>
                <dd className="mt-0.5 text-[13px] font-medium">{row.customer ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">Estimasi revenue</dt>
                <dd className="tabular mt-0.5 text-[13px] font-medium">
                  {moneyCompact(row.estimated_revenue)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">Estimasi effort</dt>
                <dd className="tabular mt-0.5 text-[13px] font-medium">
                  {row.estimated_effort_md ?? "—"} man-days
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">Durasi</dt>
                <dd className="tabular mt-0.5 text-[13px] font-medium">
                  {row.estimated_duration_mo ?? "—"} bulan
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scoring berbobot</CardTitle>
              <div className="flex items-baseline gap-1.5">
                <span className="tabular text-[22px] font-semibold tracking-tight">
                  {Number(row.total_score).toFixed(1)}
                </span>
                <span className="text-[12px] text-muted-foreground">/ 100</span>
              </div>
            </CardHeader>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="border-b border-border bg-surface px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Dimensi
                  </th>
                  <th className="w-[74px] border-b border-border bg-surface px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Bobot
                  </th>
                  <th className="w-[170px] border-b border-border bg-surface px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Skor (0–5)
                  </th>
                  <th className="w-[100px] border-b border-border bg-surface px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Kontribusi
                  </th>
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map((d) => (
                  <tr key={d.key}>
                    <td className="border-b border-slate-100 px-3 py-2">{d.label}</td>
                    <td className="tabular border-b border-slate-100 px-3 py-2 text-right">
                      {d.weight * 100}%
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      {canEditScores ? (
                        <select
                          aria-label={d.label}
                          value={scores[d.key]}
                          onChange={(e) => setScores({ ...scores, [d.key]: Number(e.target.value) })}
                          className="h-8 w-full rounded-md border border-border bg-white px-2 text-[13px]"
                        >
                          {[0, 1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="tracking-[2px]">
                          {"●".repeat(scores[d.key])}
                          <span className="text-slate-300">{"●".repeat(5 - scores[d.key])}</span>
                        </span>
                      )}
                    </td>
                    <td className="tabular border-b border-slate-100 px-3 py-2 text-right">
                      {(scores[d.key] * d.weight * 20).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface">
                  <td colSpan={3} className="border-t border-border px-3 py-2.5 font-semibold">
                    Total {canEditScores ? "(pratinjau)" : ""}
                  </td>
                  <td className="tabular border-t border-border px-3 py-2.5 text-right font-bold">
                    {preview.toFixed(1)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="flex items-center gap-3 border-t border-slate-100 p-4">
              {canEditScores ? (
                <Button variant="primary" disabled={busy} onClick={saveScores}>
                  {busy ? "Menyimpan…" : "Simpan skor"}
                </Button>
              ) : null}
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Skor bersifat informatif dan <strong className="font-semibold text-slate-700">tidak menentukan keputusan</strong>.
                Bobot dikunci di basis data; perubahannya butuh migrasi dan persetujuan manajemen.
              </p>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <ResourceCheck required={row.required_competencies} />

          <Card className={decided ? undefined : "border-slate-300"}>
            <CardHeader>
              <CardTitle>Keputusan</CardTitle>
              <span className="text-[11.5px] text-muted-foreground">PF-04</span>
            </CardHeader>
            {decided ? (
              <div className="flex flex-col gap-3 p-4">
                <Badge tone={row.decision === "go" ? "success" : row.decision === "no_go" ? "danger" : "warning"}>
                  {DECISION_LABEL[row.decision as string]}
                </Badge>
                <p className="text-[13px] leading-relaxed">{row.decision_rationale}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Diputuskan {dateTime(row.decided_at)}. Case terkunci dan tercatat di jejak audit.
                </p>
              </div>
            ) : canDecide ? (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex gap-2">
                  {(["go", "no_go", "hold"] as Decision[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDecision(d)}
                      aria-pressed={decision === d}
                      className={
                        "h-9 flex-1 rounded-md border text-[13px] font-medium " +
                        (decision === d
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-white text-slate-600 hover:bg-muted")
                      }
                    >
                      {DECISION_LABEL[d]}
                    </button>
                  ))}
                </div>
                <Field label="Alasan keputusan" htmlFor="rationale" required>
                  <textarea
                    id="rationale"
                    rows={4}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="min-h-[84px] rounded-md border border-border bg-white px-2.5 py-2 text-[13px] leading-relaxed focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  />
                </Field>
                <p className="text-[11.5px] text-muted-foreground">
                  Wajib diisi. Basis data menolak keputusan tanpa alasan.
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={busy || !decision || !rationale.trim()}
                  onClick={saveDecision}
                >
                  {busy ? "Menyimpan…" : "Simpan keputusan"}
                </Button>
                {error ? (
                  <p role="alert" className="text-[12.5px] text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="p-4 text-[12.5px] text-muted-foreground">
                Keputusan go/no-go/hold hanya dapat dicatat oleh chapter lead.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------- resource check */

function ResourceCheck({ required }: { required: string[] }) {
  const thisMonth = monthKey(new Date());

  const skills = useQuery<SkillRow>(
    () => getSupabase().from("skills").select("id, name").range(0, 299).returns<SkillRow[]>(),
    [],
  );
  const pskills = useQuery<PSkillRow>(
    () =>
      getSupabase()
        .from("profile_skills")
        .select("profile_id, skill_id, level")
        .gte("level", MIN_LEVEL)
        .range(0, 1999)
        .returns<PSkillRow[]>(),
    [],
  );
  const allocs = useQuery<AllocRow>(
    () =>
      getSupabase()
        .from("allocations")
        .select("profile_id, percent")
        .eq("period_month", thisMonth)
        .range(0, 999)
        .returns<AllocRow[]>(),
    [thisMonth],
  );

  const allocByPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocs.rows) m.set(a.profile_id, (m.get(a.profile_id) ?? 0) + Number(a.percent));
    return m;
  }, [allocs.rows]);

  const results = required.map((name) => {
    const skill = skills.rows.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!skill) return { name, known: false, total: 0, free: 0 };
    const holders = pskills.rows.filter((ps) => ps.skill_id === skill.id);
    const free = holders.filter((h) => (allocByPerson.get(h.profile_id) ?? 0) < 100).length;
    return { name, known: true, total: holders.length, free };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource check</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">PF-03 · level ≥ {MIN_LEVEL}</span>
      </CardHeader>
      <StateBoundary
        loading={skills.loading || pskills.loading || allocs.loading}
        error={skills.error ?? pskills.error ?? allocs.error}
        empty={required.length === 0}
        emptyMessage="Kompetensi yang dibutuhkan belum diisi pada intake."
      >
        <ul className="flex flex-col divide-y divide-slate-100">
          {results.map((r) => (
            <li key={r.name} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-[13px] font-medium">{r.name}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {r.known ? `${r.total} talent memiliki kompetensi ini` : "tidak ada di master skill"}
                </div>
              </div>
              {!r.known ? (
                <Badge tone="danger">tidak dikenal</Badge>
              ) : r.free === 0 ? (
                <Badge tone="danger">tidak tersedia</Badge>
              ) : r.free === 1 ? (
                <Badge tone="warning">{r.free} tersedia</Badge>
              ) : (
                <Badge tone="success">{r.free} tersedia</Badge>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
          &quot;Tersedia&quot; = memiliki kompetensi pada level ≥ {MIN_LEVEL} dan alokasi bulan ini di bawah 100%.
        </p>
      </StateBoundary>
    </Card>
  );
}
