"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Field, Input } from "@/components/ui/field";
import { StateBoundary } from "@/components/state-boundary";
import { useSession } from "@/components/session-provider";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { hours as fmtHours, percent } from "@/lib/format";
import { capacityHours } from "@/lib/capacity";
import { monthKey } from "@/lib/week";

/*
 * TM-02 competency matrix · TM-03 assignment history · TM-04 talent search.
 *
 * The detail view is `?id=…` on this route rather than `/talent/[id]`: a
 * dynamic segment needs generateStaticParams() under output: "export", and
 * talent ids are only known at runtime.
 */

interface Person {
  id: string;
  full_name: string;
  email: string;
  squad: string | null;
  grade: string | null;
  role: string;
}
interface Skill {
  id: string;
  name: string;
  category: string | null;
}
interface PSkill {
  profile_id: string;
  skill_id: string;
  level: number;
  is_certified: boolean;
}
interface AllocRow {
  profile_id: string;
  project_id: string;
  period_month: string;
  percent: number;
  projects: { code: string; name: string } | null;
}
interface UtilRow {
  profile_id: string;
  approved_hours: number | null;
  utilization_pct: number | null;
}

const LEVELS = [1, 2, 3, 4, 5];

export default function TalentPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Talent">
          <p className="text-[13px] text-muted-foreground">Memuat…</p>
        </AppShell>
      }
    >
      <TalentInner />
    </Suspense>
  );
}

function TalentInner() {
  const params = useSearchParams();
  const selectedId = params.get("id");
  const { profile } = useSession();
  const [nameFilter, setNameFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [minLevel, setMinLevel] = useState(1);
  const thisMonth = monthKey(new Date());

  const people = useQuery<Person>(
    () =>
      getSupabase()
        .from("profiles")
        .select("id, full_name, email, squad, grade, role")
        .eq("is_active", true)
        .order("full_name")
        .range(0, 499)
        .returns<Person[]>(),
    [],
  );
  const skills = useQuery<Skill>(
    () =>
      getSupabase()
        .from("skills")
        .select("id, name, category")
        .order("name")
        .range(0, 299)
        .returns<Skill[]>(),
    [],
  );
  const pskills = useQuery<PSkill>(
    () =>
      getSupabase()
        .from("profile_skills")
        .select("profile_id, skill_id, level, is_certified")
        .range(0, 1999)
        .returns<PSkill[]>(),
    [],
  );
  const allocs = useQuery<AllocRow>(
    () =>
      getSupabase()
        .from("allocations")
        .select("profile_id, project_id, period_month, percent, projects:project_id(code, name)")
        .eq("period_month", thisMonth)
        .range(0, 999)
        .returns<AllocRow[]>(),
    [thisMonth],
  );
  const util = useQuery<UtilRow>(
    () =>
      getSupabase()
        .from("utilization_monthly")
        .select("profile_id, approved_hours, utilization_pct")
        .eq("period_month", thisMonth)
        .range(0, 499)
        .returns<UtilRow[]>(),
    [thisMonth],
  );

  const skillById = useMemo(
    () => new Map(skills.rows.map((s) => [s.id, s])),
    [skills.rows],
  );
  const allocByPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocs.rows) m.set(a.profile_id, (m.get(a.profile_id) ?? 0) + Number(a.percent));
    return m;
  }, [allocs.rows]);
  const utilByPerson = useMemo(
    () => new Map(util.rows.map((u) => [u.profile_id, u])),
    [util.rows],
  );

  // TM-04: competency + availability.
  const results = useMemo(() => {
    let list = people.rows;
    if (nameFilter.trim()) {
      const q = nameFilter.trim().toLowerCase();
      list = list.filter((p) => p.full_name.toLowerCase().includes(q));
    }
    if (skillFilter) {
      const ok = new Set(
        pskills.rows
          .filter((ps) => ps.skill_id === skillFilter && ps.level >= minLevel)
          .map((ps) => ps.profile_id),
      );
      list = list.filter((p) => ok.has(p.id));
    }
    return list;
  }, [people.rows, pskills.rows, nameFilter, skillFilter, minLevel]);

  const selected = people.rows.find((p) => p.id === selectedId) ?? null;

  return (
    <AppShell title="Talent">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pencarian staffing</CardTitle>
              <span className="text-[11.5px] text-muted-foreground">TM-04</span>
            </CardHeader>
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-[190px] flex-1">
                <Field label="Nama" htmlFor="q-name">
                  <Input
                    id="q-name"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Cari nama…"
                  />
                </Field>
              </div>
              <div className="min-w-[190px] flex-1">
                <Field label="Kompetensi" htmlFor="q-skill">
                  <select
                    id="q-skill"
                    value={skillFilter}
                    onChange={(e) => setSkillFilter(e.target.value)}
                    className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]"
                  >
                    <option value="">Semua kompetensi</option>
                    {skills.rows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="w-[150px]">
                <Field label="Level minimum" htmlFor="q-level">
                  <select
                    id="q-level"
                    value={minLevel}
                    disabled={!skillFilter}
                    onChange={(e) => setMinLevel(Number(e.target.value))}
                    className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px] disabled:bg-muted"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        ≥ {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Talent{" "}
                <span className="font-normal text-muted-foreground">
                  ({results.length} dari {people.rows.length})
                </span>
              </CardTitle>
              <span className="text-[11.5px] text-muted-foreground">
                Ketersediaan bulan ini
              </span>
            </CardHeader>
            <StateBoundary
              loading={people.loading}
              error={people.error}
              empty={results.length === 0}
              emptyMessage={
                skillFilter
                  ? "Tidak ada talent dengan kompetensi dan level tersebut."
                  : "Belum ada talent aktif."
              }
              onRetry={people.reload}
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Nama</Th>
                    <Th className="w-[120px]">Squad</Th>
                    <Th className="w-[100px] text-right">Alokasi</Th>
                    <Th className="w-[110px] text-right">Utilisasi</Th>
                    <Th className="w-[90px]" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((p) => {
                    const alloc = allocByPerson.get(p.id) ?? 0;
                    const u = utilByPerson.get(p.id);
                    // Absent from the view means no timesheet rows, i.e. 0%
                    // — never a missing row (SRS SF-1.5).
                    const pct = u?.utilization_pct ?? 0;
                    return (
                      <tr key={p.id}>
                        <Td>
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-[11.5px] text-muted-foreground">
                            {p.grade ? `grade ${p.grade}` : "—"} · {p.role}
                          </div>
                        </Td>
                        <Td className="text-muted-foreground">{p.squad ?? "—"}</Td>
                        <Td className="tabular text-right">
                          {alloc ? `${alloc}%` : "—"}
                          {alloc > 100 ? " ⚠" : ""}
                        </Td>
                        <Td className="tabular text-right">{percent(pct)}</Td>
                        <Td className="text-right">
                          <Link
                            href={`/talent/?id=${p.id}`}
                            className="text-[12.5px] underline underline-offset-2"
                          >
                            Detail
                          </Link>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </StateBoundary>
          </Card>
        </div>

        <Detail
          person={selected}
          isSelf={selected?.id === profile?.id}
          isAdmin={profile?.role === "admin"}
          skills={skills.rows}
          skillById={skillById}
          pskills={pskills.rows.filter((ps) => ps.profile_id === selected?.id)}
          allocs={allocs.rows.filter((a) => a.profile_id === selected?.id)}
          util={selected ? (utilByPerson.get(selected.id) ?? null) : null}
          month={thisMonth}
          onChanged={pskills.reload}
        />
      </div>
    </AppShell>
  );
}

function Detail({
  person,
  isSelf,
  isAdmin,
  skills,
  skillById,
  pskills,
  allocs,
  util,
  month,
  onChanged,
}: {
  person: Person | null;
  isSelf: boolean;
  isAdmin: boolean;
  skills: Skill[];
  skillById: Map<string, Skill>;
  pskills: PSkill[];
  allocs: AllocRow[];
  util: UtilRow | null;
  month: string;
  onChanged: () => void;
}) {
  const [addSkill, setAddSkill] = useState("");
  const [addLevel, setAddLevel] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // profile_skills may be written by the owner or an admin.
  const canEdit = isSelf || isAdmin;

  async function save() {
    if (!person || !addSkill) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabase()
      .from("profile_skills")
      .upsert(
        { profile_id: person.id, skill_id: addSkill, level: addLevel },
        { onConflict: "profile_id,skill_id" },
      );
    setBusy(false);
    if (error) setError(error.message);
    else {
      setAddSkill("");
      onChanged();
    }
  }

  async function remove(skillId: string) {
    if (!person) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabase()
      .from("profile_skills")
      .delete()
      .eq("profile_id", person.id)
      .eq("skill_id", skillId);
    setBusy(false);
    if (error) setError(error.message);
    else onChanged();
  }

  if (!person) {
    return (
      <Card className="p-6">
        <p className="text-[13px] text-muted-foreground">
          Pilih seorang talent untuk melihat kompetensi dan riwayat penugasannya.
        </p>
      </Card>
    );
  }

  const cap = capacityHours(month);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{person.full_name}</CardTitle>
          <Badge>{person.role}</Badge>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 p-4">
          <div>
            <dt className="text-[12px] text-muted-foreground">Squad</dt>
            <dd className="text-[13px]">{person.squad ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted-foreground">Grade</dt>
            <dd className="text-[13px]">{person.grade ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted-foreground">Utilisasi bulan ini</dt>
            <dd className="tabular text-[13px]">
              {percent(util?.utilization_pct ?? 0)}{" "}
              <span className="text-muted-foreground">
                ({fmtHours(util?.approved_hours ?? 0)} / {cap} jam)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted-foreground">Email</dt>
            <dd className="truncate text-[13px]">{person.email}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competency matrix</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">TM-02</span>
        </CardHeader>
        {pskills.length === 0 ? (
          <p className="p-4 text-[12.5px] text-muted-foreground">Belum ada kompetensi tercatat.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {pskills.map((ps) => (
              <li key={ps.skill_id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="text-[13px] font-medium">
                    {skillById.get(ps.skill_id)?.name ?? "—"}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {skillById.get(ps.skill_id)?.category ?? "—"}
                    {ps.is_certified ? " · tersertifikasi" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-label={`Level ${ps.level} dari 5`} className="tracking-[2px]">
                    {"●".repeat(ps.level)}
                    <span className="text-slate-300">{"●".repeat(5 - ps.level)}</span>
                  </span>
                  {canEdit ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(ps.skill_id)}>
                      Hapus
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-4">
            <select
              aria-label="Kompetensi"
              value={addSkill}
              onChange={(e) => setAddSkill(e.target.value)}
              className="h-8 min-w-[150px] flex-1 rounded-md border border-border bg-white px-2 text-[12.5px]"
            >
              <option value="">Tambah kompetensi…</option>
              {skills
                .filter((s) => !pskills.some((ps) => ps.skill_id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="Level"
              value={addLevel}
              onChange={(e) => setAddLevel(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-white px-2 text-[12.5px]"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
            <Button size="sm" variant="primary" disabled={busy || !addSkill} onClick={save}>
              Simpan
            </Button>
            {error ? (
              <p role="alert" className="w-full text-[12px] text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat penugasan</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">TM-03 · bulan ini</span>
        </CardHeader>
        {allocs.length === 0 ? (
          <p className="p-4 text-[12.5px] text-muted-foreground">
            Belum ada alokasi pada bulan ini.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {allocs.map((a) => (
              <li key={a.project_id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[13px]">
                  {a.projects ? `${a.projects.code} · ${a.projects.name}` : "—"}
                </span>
                <span className="tabular text-[13px] font-medium">{a.percent}%</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
