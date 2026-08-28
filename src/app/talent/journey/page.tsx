"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { StateBoundary } from "@/components/state-boundary";
import { useSession } from "@/components/session-provider";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { date, hours as fmtHours, percent } from "@/lib/format";
import { capacityHours, monthShortLabel, recentMonths } from "@/lib/capacity";
import { monthKey } from "@/lib/week";

/*
 * Talent Journey — TM-05 (development plan) and TM-06 (talent analytics).
 *
 * Two halves:
 *   Raport   — performance drawn entirely from work already recorded. No one
 *              enters a score; the numbers come from approved timesheets and
 *              milestone ownership, so this page can never disagree with the
 *              Timesheet or Project Control modules.
 *   Rencana  — the development plan the talent owns, with a review that only
 *              somebody else can write (enforced by trigger, not by the UI).
 *
 * Visibility: a talent sees their own journey. Managers see their reports,
 * leads and admin see everyone — enforced by RLS on development_goals, so
 * the person picker below is convenience, not a security control.
 */

const TREND_MONTHS = 6;
const CAPABLE_LEVEL = 3; // counts as "can be staffed on it"

interface Person { id: string; full_name: string; squad: string | null; grade: string | null; manager_id: string | null }
interface UtilRow { profile_id: string; period_month: string; approved_hours: number | null; utilization_pct: number | null }
interface PerfRow {
  profile_id: string; period_month: string;
  approved_hours: number | null; billable_hours: number | null;
  delivery_hours: number | null; presales_hours: number | null;
  internal_hours: number | null; projects_touched: number | null; rejected_rows: number | null;
}
interface DeliveryRow {
  profile_id: string; milestones_owned: number | null; milestones_completed: number | null;
  completed_on_time: number | null; milestones_delayed: number | null; on_time_rate: number | null;
}
interface SkillRow { id: string; name: string }
interface PSkillRow { profile_id: string; skill_id: string; level: number; is_certified: boolean }
interface GoalRow {
  id: string; profile_id: string; skill_id: string | null; title: string;
  target_level: number | null; target_date: string | null; is_certification: boolean;
  status: string; notes: string | null;
  reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
}
interface DemandRow { required_competencies: string[]; decision: string | null }

const STATUS_LABEL: Record<string, string> = {
  planned: "Direncanakan",
  in_progress: "Berjalan",
  achieved: "Tercapai",
  dropped: "Dibatalkan",
};

export default function JourneyPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Talent Journey">
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
  const router = useRouter();
  const { profile } = useSession();
  const requested = params.get("id");
  const subjectId = requested ?? profile?.id ?? null;
  const isSelf = subjectId === profile?.id;
  const months = useMemo(() => recentMonths(monthKey(new Date()), TREND_MONTHS), []);

  const people = useQuery<Person>(
    () =>
      getSupabase().from("profiles").select("id, full_name, squad, grade, manager_id")
        .eq("is_active", true).order("full_name").range(0, 499).returns<Person[]>(),
    [],
  );
  const util = useQuery<UtilRow>(
    () =>
      getSupabase().from("utilization_monthly")
        .select("profile_id, period_month, approved_hours, utilization_pct")
        .eq("profile_id", subjectId ?? "").in("period_month", months)
        .range(0, 99).returns<UtilRow[]>(),
    [subjectId, months.join(",")],
  );
  const perf = useQuery<PerfRow>(
    () =>
      getSupabase().from("talent_performance")
        .select("profile_id, period_month, approved_hours, billable_hours, delivery_hours, presales_hours, internal_hours, projects_touched, rejected_rows")
        .eq("profile_id", subjectId ?? "").in("period_month", months)
        .range(0, 99).returns<PerfRow[]>(),
    [subjectId, months.join(",")],
  );
  const delivery = useQuery<DeliveryRow>(
    () =>
      getSupabase().from("talent_delivery")
        .select("profile_id, milestones_owned, milestones_completed, completed_on_time, milestones_delayed, on_time_rate")
        .eq("profile_id", subjectId ?? "").range(0, 9).returns<DeliveryRow[]>(),
    [subjectId],
  );
  const skills = useQuery<SkillRow>(
    () => getSupabase().from("skills").select("id, name").order("name").range(0, 299).returns<SkillRow[]>(),
    [],
  );
  const mySkills = useQuery<PSkillRow>(
    () =>
      getSupabase().from("profile_skills").select("profile_id, skill_id, level, is_certified")
        .eq("profile_id", subjectId ?? "").range(0, 199).returns<PSkillRow[]>(),
    [subjectId],
  );
  const goals = useQuery<GoalRow>(
    () =>
      getSupabase().from("development_goals")
        .select("id, profile_id, skill_id, title, target_level, target_date, is_certification, status, notes, reviewed_by, reviewed_at, review_note")
        .eq("profile_id", subjectId ?? "").order("target_date").range(0, 99).returns<GoalRow[]>(),
    [subjectId],
  );
  const demand = useQuery<DemandRow>(
    () =>
      getSupabase().from("feasibility_cases").select("required_competencies, decision")
        .range(0, 199).returns<DemandRow[]>(),
    [],
  );

  const subject = people.rows.find((p) => p.id === subjectId) ?? null;
  const skillName = useMemo(() => new Map(skills.rows.map((s) => [s.id, s.name])), [skills.rows]);
  const held = useMemo(
    () => new Map(mySkills.rows.map((s) => [s.skill_id, s])),
    [mySkills.rows],
  );
  const d = delivery.rows[0];

  // Managers see their reports; leads and admin see everyone. RLS enforces
  // the same thing on the data — this only shapes the picker.
  const canPick =
    profile != null && ["manager", "chapter_lead", "admin"].includes(profile.role);
  const pickable = canPick
    ? profile?.role === "manager"
      ? people.rows.filter((p) => p.manager_id === profile.id || p.id === profile.id)
      : people.rows
    : [];

  // Self-improvement, grounded in demand: competencies the pipeline asks for
  // that this person does not yet hold at a staffable level.
  const gaps = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of demand.rows) {
      if (c.decision === "no_go") continue;
      for (const name of c.required_competencies ?? []) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, n]) => {
        const s = skills.rows.find((x) => x.name.toLowerCase() === name.toLowerCase());
        const lvl = s ? (held.get(s.id)?.level ?? 0) : 0;
        return { name, demand: n, level: lvl, known: Boolean(s) };
      })
      .filter((g) => g.level < CAPABLE_LEVEL)
      .sort((a, b) => b.demand - a.demand || a.level - b.level);
  }, [demand.rows, skills.rows, held]);

  const loading = people.loading || util.loading || perf.loading;

  return (
    <AppShell
      title="Talent Journey"
      actions={
        canPick && pickable.length > 1 ? (
          <select
            aria-label="Lihat journey"
            value={subjectId ?? ""}
            onChange={(e) => router.push(`/talent/journey/?id=${e.target.value}`)}
            className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
          >
            {pickable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {p.id === profile?.id ? " (Anda)" : ""}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      <StateBoundary
        loading={loading}
        error={people.error ?? util.error ?? perf.error}
        empty={!subject}
        emptyMessage="Profil tidak ditemukan, atau Anda tidak berhak melihat journey orang ini."
      >
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[19px] font-semibold tracking-tight">{subject?.full_name}</h2>
            <span className="text-[12.5px] text-muted-foreground">
              {subject?.squad ?? "—"}
              {subject?.grade ? ` · grade ${subject.grade}` : ""}
            </span>
            {isSelf ? <Badge tone="success">Journey Anda</Badge> : <Badge>Dilihat sebagai atasan</Badge>}
          </div>
          <p className="mt-2 max-w-[820px] text-[12.5px] leading-relaxed text-muted-foreground">
            Seluruh angka pada raport diambil dari timesheet yang sudah disetujui dan milestone yang
            Anda pegang. Tidak ada penilaian manual — bila sebuah angka terasa keliru, perbaikannya
            ada di modul asalnya, bukan di halaman ini.
          </p>
        </Card>

        {/* ------------------------------------------------- raport ----- */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Metric
            label="Utilisasi bulan ini"
            value={percent(util.rows.find((u) => u.period_month === months[months.length - 1])?.utilization_pct ?? 0)}
            hint={`kapasitas ${capacityHours(months[months.length - 1])} jam`}
          />
          <Metric
            label="Rasio billable"
            value={(() => {
              const tot = perf.rows.reduce((s, r) => s + Number(r.approved_hours ?? 0), 0);
              const bil = perf.rows.reduce((s, r) => s + Number(r.billable_hours ?? 0), 0);
              return tot ? percent((bil / tot) * 100) : "—";
            })()}
            hint={`${TREND_MONTHS} bulan terakhir`}
          />
          <Metric
            label="Milestone dipegang"
            value={String(d?.milestones_owned ?? 0)}
            hint={`${d?.milestones_completed ?? 0} selesai · ${d?.milestones_delayed ?? 0} terlambat`}
          />
          <Metric
            label="Selesai tepat waktu"
            value={d?.on_time_rate == null ? "—" : percent(d.on_time_rate)}
            hint={d?.on_time_rate == null ? "belum ada yang selesai" : "dari milestone yang selesai"}
            tone={d?.on_time_rate != null && Number(d.on_time_rate) < 70 ? "warn" : undefined}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Raport performa</CardTitle>
            <span className="text-[11.5px] text-muted-foreground">
              {monthShortLabel(months[0])} – {monthShortLabel(months[months.length - 1])} · jam approved
            </span>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th className="w-[90px]">Bulan</Th>
                <Th className="w-[110px] text-right">Utilisasi</Th>
                <Th className="w-[100px] text-right">Approved</Th>
                <Th className="w-[100px] text-right">Delivery</Th>
                <Th className="w-[100px] text-right">Presales</Th>
                <Th className="w-[100px] text-right">Internal</Th>
                <Th className="w-[90px] text-right">Proyek</Th>
                <Th className="w-[90px] text-right">Ditolak</Th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const u = util.rows.find((x) => x.period_month === m);
                const p = perf.rows.find((x) => x.period_month === m);
                const none = !p;
                return (
                  <tr key={m} className={none ? "text-muted-foreground" : undefined}>
                    <Td>{monthShortLabel(m)}</Td>
                    <Td className="tabular text-right font-medium">{percent(u?.utilization_pct ?? 0)}</Td>
                    <Td className="tabular text-right">{fmtHours(p?.approved_hours ?? 0)}</Td>
                    <Td className="tabular text-right">{fmtHours(p?.delivery_hours ?? 0)}</Td>
                    <Td className="tabular text-right">{fmtHours(p?.presales_hours ?? 0)}</Td>
                    <Td className="tabular text-right">{fmtHours(p?.internal_hours ?? 0)}</Td>
                    <Td className="tabular text-right">{p?.projects_touched ?? "–"}</Td>
                    <Td className={"tabular text-right " + (Number(p?.rejected_rows ?? 0) > 0 ? "text-destructive" : "")}>
                      {p?.rejected_rows ?? "–"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
            Bulan tanpa baris berarti belum ada timesheet approved — bukan nol jam yang tercatat.
            Kolom &quot;Ditolak&quot; menghitung baris yang dikembalikan atasan; angkanya sinyal
            kualitas pengisian, bukan kualitas kerja.
          </p>
        </Card>

        {/* -------------------------------------------- capability ------ */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kompetensi saat ini</CardTitle>
              <span className="text-[11.5px] text-muted-foreground">TM-02</span>
            </CardHeader>
            <StateBoundary empty={mySkills.rows.length === 0} emptyMessage="Belum ada kompetensi tercatat.">
              <ul className="flex flex-col divide-y divide-slate-100">
                {mySkills.rows.map((s) => (
                  <li key={s.skill_id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[13px]">
                      {skillName.get(s.skill_id) ?? "—"}
                      {s.is_certified ? (
                        <Badge tone="success" className="ml-2">tersertifikasi</Badge>
                      ) : null}
                    </span>
                    <span aria-label={`Level ${s.level} dari 5`} className="tracking-[2px]">
                      {"●".repeat(s.level)}
                      <span className="text-slate-300">{"●".repeat(5 - s.level)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </StateBoundary>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peluang pengembangan</CardTitle>
              <span className="text-[11.5px] text-muted-foreground">dari permintaan pipeline</span>
            </CardHeader>
            <StateBoundary
              empty={gaps.length === 0}
              emptyMessage="Tidak ada kompetensi yang diminta pipeline dan belum Anda kuasai di level 3."
            >
              <ul className="flex flex-col divide-y divide-slate-100">
                {gaps.slice(0, 6).map((g) => (
                  <li key={g.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <div className="text-[13px] font-medium">{g.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        diminta {g.demand} kandidat proyek · level Anda{" "}
                        {g.level === 0 ? "belum ada" : g.level}
                        {g.known ? "" : " · belum ada di master skill"}
                      </div>
                    </div>
                    <Badge tone={g.demand >= 2 ? "warning" : "neutral"}>{g.demand}×</Badge>
                  </li>
                ))}
              </ul>
            </StateBoundary>
            <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
              Dihitung dari kompetensi yang diminta kandidat proyek yang belum ditolak, dibanding
              level Anda. Ambang staffable adalah level {CAPABLE_LEVEL}.
            </p>
          </Card>
        </div>

        {/* ------------------------------------------- development ------ */}
        <Goals
          goals={goals}
          skills={skills.rows}
          subjectId={subjectId}
          isSelf={isSelf}
          canReview={!isSelf && canPick}
        />
      </StateBoundary>
    </AppShell>
  );
}

function Metric({
  label, value, hint, tone,
}: { label: string; value: string; hint: string; tone?: "warn" }) {
  return (
    <Card className={`p-4 ${tone === "warn" ? "border-amber-200 bg-amber-50" : ""}`}>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-[24px] font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </Card>
  );
}

/* ----------------------------------------------------- development plan */

function Goals({
  goals, skills, subjectId, isSelf, canReview,
}: {
  goals: ReturnType<typeof useQuery<GoalRow>>;
  skills: SkillRow[];
  subjectId: string | null;
  isSelf: boolean;
  canReview: boolean;
}) {
  const [form, setForm] = useState({ title: "", skill_id: "", target_level: "", target_date: "", cert: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!subjectId) return;
    setBusy(true); setError(null);
    const { error } = await getSupabase().from("development_goals").insert({
      profile_id: subjectId,
      title: form.title.trim(),
      skill_id: form.skill_id || null,
      target_level: form.target_level ? Number(form.target_level) : null,
      target_date: form.target_date || null,
      is_certification: form.cert,
    });
    setBusy(false);
    if (error) setError(error.message);
    else { setForm({ title: "", skill_id: "", target_level: "", target_date: "", cert: false }); goals.reload(); }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true); setError(null);
    const { error } = await getSupabase().from("development_goals").update({ status }).eq("id", id);
    setBusy(false);
    if (error) setError(error.message); else goals.reload();
  }

  async function submitReview(id: string) {
    if (!reviewText.trim()) return;
    setBusy(true); setError(null);
    // reviewed_by / reviewed_at are stamped by the trigger, which also refuses
    // a review written by the goal's owner.
    const { error } = await getSupabase()
      .from("development_goals").update({ review_note: reviewText.trim() }).eq("id", id);
    setBusy(false);
    if (error) setError(error.message);
    else { setReviewing(null); setReviewText(""); goals.reload(); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rencana pengembangan</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">TM-05</span>
      </CardHeader>
      <StateBoundary
        loading={goals.loading}
        error={goals.error}
        empty={goals.rows.length === 0}
        emptyMessage={isSelf ? "Belum ada rencana. Tambahkan target pertama Anda di bawah." : "Belum ada rencana pengembangan."}
        onRetry={goals.reload}
      >
        <ul className="flex flex-col divide-y divide-slate-100">
          {goals.rows.map((g) => (
            <li key={g.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[13.5px] font-medium">
                    {g.title}
                    {g.is_certification ? <Badge className="ml-2">sertifikasi</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {g.target_level ? `target level ${g.target_level} · ` : ""}
                    {g.target_date ? `tenggat ${date(g.target_date)}` : "tanpa tenggat"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={g.status === "achieved" ? "success" : g.status === "dropped" ? "neutral" : "warning"}>
                    {STATUS_LABEL[g.status] ?? g.status}
                  </Badge>
                  {isSelf && g.status !== "achieved" ? (
                    <Button size="sm" disabled={busy} onClick={() => setStatus(g.id, "achieved")}>
                      Tandai tercapai
                    </Button>
                  ) : null}
                </div>
              </div>
              {g.notes ? (
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{g.notes}</p>
              ) : null}

              {g.review_note ? (
                <div className="mt-2 rounded-lg border border-border bg-surface p-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Catatan atasan · {date(g.reviewed_at)}
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed">{g.review_note}</p>
                </div>
              ) : canReview ? (
                reviewing === g.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      rows={2}
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Catatan untuk rencana ini…"
                      className="rounded-md border border-border px-2.5 py-2 text-[12.5px] focus:border-primary focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" disabled={busy || !reviewText.trim()}
                        onClick={() => submitReview(g.id)}>
                        Simpan catatan
                      </Button>
                      <Button size="sm" onClick={() => { setReviewing(null); setReviewText(""); }}>
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" className="mt-2" onClick={() => setReviewing(g.id)}>
                    Beri catatan
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      </StateBoundary>

      {isSelf ? (
        <form onSubmit={add} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
          <div className="min-w-[220px] flex-1">
            <Field label="Target pengembangan" htmlFor="g-title" required>
              <Input id="g-title" required value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="mis. Naik ke level 4 Data Engineering" />
            </Field>
          </div>
          <div className="w-[190px]">
            <Field label="Kompetensi" htmlFor="g-skill">
              <select id="g-skill" value={form.skill_id}
                onChange={(e) => setForm({ ...form, skill_id: e.target.value })}
                className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]">
                <option value="">— tidak terkait —</option>
                {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-[120px]">
            <Field label="Target level" htmlFor="g-level">
              <select id="g-level" value={form.target_level}
                onChange={(e) => setForm({ ...form, target_level: e.target.value })}
                className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]">
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-[150px]">
            <Field label="Tenggat" htmlFor="g-date">
              <Input id="g-date" type="date" value={form.target_date}
                onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </Field>
          </div>
          <label className="flex h-[38px] items-center gap-2 text-[13px]">
            <input type="checkbox" checked={form.cert}
              onChange={(e) => setForm({ ...form, cert: e.target.checked })}
              className="h-[15px] w-[15px] accent-slate-900" />
            Sertifikasi
          </label>
          <Button type="submit" variant="primary" disabled={busy || !form.title.trim()}>
            {busy ? "Menyimpan…" : "Tambah target"}
          </Button>
          {error ? <p role="alert" className="w-full text-[12.5px] text-destructive">{error}</p> : null}
        </form>
      ) : null}

      <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
        Rencana dimiliki talent yang bersangkutan. Catatan atasan hanya dapat ditulis orang lain —
        basis data menolak review yang ditulis pemiliknya sendiri.{" "}
        <Link href="/talent/" className="underline underline-offset-2">Kembali ke direktori talent</Link>
      </p>
    </Card>
  );
}
