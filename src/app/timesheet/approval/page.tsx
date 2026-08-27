"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { StateBoundary } from "@/components/state-boundary";
import { ReasonDialog } from "@/components/reason-dialog";
import { useSession } from "@/components/session-provider";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";
import { hours as fmtHours, percent } from "@/lib/format";
import type { ActivityCategory } from "@/lib/database.types";
import { addDays, startOfWeek, toKey, weekLabel } from "@/lib/week";

const OVER_WEEK = 40; // soft warning threshold, flagged not blocked

interface PendingRow {
  id: string;
  profile_id: string;
  hours: number;
  work_date: string;
  activities: { category: ActivityCategory } | null;
  profiles: { full_name: string; squad: string | null } | null;
}
interface ActiveProfile {
  id: string;
  full_name: string;
  squad: string | null;
  role: string;
}
interface SubmittedMark {
  profile_id: string;
}

interface Person {
  id: string;
  name: string;
  squad: string | null;
  total: number;
  byCategory: Record<string, number>;
}

export default function ApprovalPage() {
  const { profile } = useSession();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(addDays(new Date(), -7)));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const from = toKey(weekStart);
  const to = toKey(addDays(weekStart, 6));
  const myId = profile?.id ?? "";

  // Rows awaiting a decision. Own rows are excluded: no role may approve its
  // own timesheet, and the RLS policy would reject the update anyway
  // (migration 20260827000001).
  const pending = useQuery<PendingRow>(
    () =>
      getSupabase()
        .from("timesheets")
        .select(
          "id, profile_id, hours, work_date, activities:activity_id(category), profiles:profile_id(full_name, squad)",
        )
        .eq("status", "submitted")
        .neq("profile_id", myId)
        .gte("work_date", from)
        .lte("work_date", to)
        .order("profile_id")
        .range(0, 499)
        .returns<PendingRow[]>(),
    [myId, from, to],
  );

  const active = useQuery<ActiveProfile>(
    () =>
      getSupabase()
        .from("profiles")
        .select("id, full_name, squad, role")
        .eq("is_active", true)
        .eq("role", "talent")
        .order("full_name")
        .range(0, 499)
        .returns<ActiveProfile[]>(),
    [],
  );

  // Who has anything submitted or approved this week, among rows visible to
  // the caller under RLS.
  const submittedMarks = useQuery<SubmittedMark>(
    () =>
      getSupabase()
        .from("timesheets")
        .select("profile_id")
        .in("status", ["submitted", "approved"])
        .gte("work_date", from)
        .lte("work_date", to)
        .range(0, 999)
        .returns<SubmittedMark[]>(),
    [from, to],
  );

  const people: Person[] = useMemo(() => {
    const byPerson = new Map<string, Person>();
    for (const r of pending.rows) {
      const p =
        byPerson.get(r.profile_id) ??
        ({
          id: r.profile_id,
          name: r.profiles?.full_name ?? "—",
          squad: r.profiles?.squad ?? null,
          total: 0,
          byCategory: {},
        } satisfies Person);
      const h = Number(r.hours);
      p.total += h;
      const cat = r.activities?.category ?? "lain";
      p.byCategory[cat] = (p.byCategory[cat] ?? 0) + h;
      byPerson.set(r.profile_id, p);
    }
    return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [pending.rows]);

  async function decide(person: Person, status: "approved" | "rejected", note?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    // approved_by is stamped by the trigger; never sent from the client.
    const patch: Record<string, unknown> = { status };
    if (status === "rejected") patch.approval_note = note ?? null;
    const { error } = await getSupabase()
      .from("timesheets")
      .update(patch)
      .eq("profile_id", person.id)
      .eq("status", "submitted")
      .gte("work_date", from)
      .lte("work_date", to);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRejecting(null);
    setSelected(new Set());
    setMessage(
      status === "approved"
        ? `Timesheet ${person.name} disetujui.`
        : `Timesheet ${person.name} ditolak.`,
    );
    pending.reload();
    submittedMarks.reload();
  }

  async function approveSelected() {
    for (const id of selected) {
      const person = people.find((p) => p.id === id);
      if (person) await decide(person, "approved");
    }
  }

  const submittedIds = new Set(submittedMarks.rows.map((r) => r.profile_id));
  const missing = active.rows.filter((p) => p.id !== myId && !submittedIds.has(p.id));

  const bySquad = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const p of active.rows) {
      const key = p.squad ?? "Tanpa squad";
      const e = map.get(key) ?? { total: 0, done: 0 };
      e.total += 1;
      if (submittedIds.has(p.id)) e.done += 1;
      map.set(key, e);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "id"));
    // submittedIds is derived from submittedMarks.rows
  }, [active.rows, submittedMarks.rows]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell
      title="Approval Timesheet"
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
      <Card>
        <CardHeader>
          <CardTitle>
            Menunggu persetujuan{" "}
            {people.length ? <Badge tone="warning">{people.length}</Badge> : null}
          </CardTitle>
          <Button
            size="sm"
            variant="primary"
            disabled={busy || selected.size === 0}
            onClick={approveSelected}
          >
            Setujui {selected.size} terpilih
          </Button>
        </CardHeader>
        <StateBoundary
          loading={pending.loading}
          error={pending.error}
          empty={people.length === 0}
          emptyMessage="Tidak ada timesheet yang menunggu persetujuan pada minggu ini."
          onRetry={pending.reload}
        >
          <Table>
            <thead>
              <tr>
                <Th className="w-[40px]" />
                <Th>Nama</Th>
                <Th className="w-[90px] text-right">Total</Th>
                <Th className="w-[96px] text-right">Delivery</Th>
                <Th className="w-[96px] text-right">Presales</Th>
                <Th className="w-[96px] text-right">Internal</Th>
                <Th className="w-[200px]" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const over = p.total > OVER_WEEK;
                return (
                  <tr key={p.id} className={over ? "bg-amber-50" : undefined}>
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${p.name}`}
                        checked={selected.has(p.id)}
                        onChange={(e) =>
                          setSelected((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          })
                        }
                        className="h-[15px] w-[15px] accent-slate-900"
                      />
                    </Td>
                    <Td>
                      <div className="font-medium">{p.name}</div>
                      <div className={"text-[11.5px] " + (over ? "text-amber-800" : "text-muted-foreground")}>
                        {p.squad ?? "—"}
                        {over ? ` · melebihi ${OVER_WEEK} jam pada minggu ini` : ""}
                      </div>
                    </Td>
                    <Td className="tabular text-right font-semibold">
                      {fmtHours(p.total)}
                      {over ? " ⚠" : ""}
                    </Td>
                    <Td className="tabular text-right">{fmtHours(p.byCategory.delivery ?? 0)}</Td>
                    <Td className="tabular text-right">{fmtHours(p.byCategory.presales ?? 0)}</Td>
                    <Td className="tabular text-right">{fmtHours(p.byCategory.internal ?? 0)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" disabled={busy} onClick={() => setRejecting(p)}>
                          Tolak
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busy}
                          onClick={() => decide(p, "approved")}
                        >
                          Setujui
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </StateBoundary>
        {message ? (
          <p className="border-t border-slate-100 px-4 py-2.5 text-[12.5px] text-green-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="border-t border-slate-100 px-4 py-2.5 text-[12.5px] text-destructive">
            {error}
          </p>
        ) : null}
      </Card>

      {/* TS-04 — compliance per squad. Reminders are XM-04 and out of MVP. */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance per squad</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">TS-04</span>
        </CardHeader>
        <StateBoundary
          loading={active.loading || submittedMarks.loading}
          error={active.error ?? submittedMarks.error}
          empty={active.rows.length === 0}
          emptyMessage="Belum ada talent aktif."
          onRetry={() => {
            active.reload();
            submittedMarks.reload();
          }}
        >
          <Table>
            <thead>
              <tr>
                <Th>Squad</Th>
                <Th className="w-[120px] text-right">Sudah submit</Th>
                <Th className="w-[120px] text-right">Talent aktif</Th>
                <Th className="w-[140px] text-right">Compliance</Th>
              </tr>
            </thead>
            <tbody>
              {bySquad.map(([squad, e]) => (
                <tr key={squad}>
                  <Td>{squad}</Td>
                  <Td className="tabular text-right">{e.done}</Td>
                  <Td className="tabular text-right">{e.total}</Td>
                  <Td className="tabular text-right font-semibold">
                    {percent(e.total ? (e.done / e.total) * 100 : 0)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </StateBoundary>
        <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
          Dihitung dari talent yang submit pada minggu berjalan, bukan dari jam approved.
          Angka mencerminkan timesheet yang boleh Anda lihat — manager hanya melihat timnya.
        </p>
      </Card>

      {/* Principle 5: people with nothing submitted stay visible. */}
      <Card>
        <CardHeader>
          <CardTitle>Belum submit</CardTitle>
          {missing.length ? (
            <Badge tone="danger">{missing.length} orang</Badge>
          ) : (
            <Badge tone="success">Semua sudah submit</Badge>
          )}
        </CardHeader>
        {missing.length ? (
          <div className="flex flex-wrap gap-2 p-4">
            {missing.map((p) => (
              <Badge key={p.id}>
                {p.full_name}
                {p.squad ? ` · ${p.squad}` : ""}
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>

      <ReasonDialog
        open={rejecting != null}
        title={rejecting ? `Tolak timesheet ${rejecting.name}` : ""}
        description="Alasan dikirim ke pemilik timesheet dan tercatat di jejak audit."
        label="Alasan penolakan"
        confirmLabel="Tolak timesheet"
        busy={busy}
        error={error}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => rejecting && decide(rejecting, "rejected", reason)}
      />
    </AppShell>
  );
}
