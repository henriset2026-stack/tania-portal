"use client";

import { Fragment, useMemo, useState, type FormEvent } from "react";
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
import { date, money, moneyCompact, percent } from "@/lib/format";

/*
 * BC-01 plan register · BC-02 commitment · BC-03 realization · BC-04
 * threshold alerts · BC-05 dashboard.
 *
 * Thresholds are fixed for the MVP (DDD G-3); the requirement asks for
 * configurable ones.
 */
const WARN_AT = 80;
const OVER_AT = 100;

const ENTRY_ROLES = ["pm", "manager", "chapter_lead", "admin"];
const LINE_ROLES = ["chapter_lead", "admin"];

interface SummaryRow {
  id: string;
  fiscal_year: number;
  program: string;
  category: string;
  description: string | null;
  plan_amount: number;
  committed_amount: number;
  realized_amount: number;
  remaining_amount: number;
}
interface EffortRow {
  project_id: string; code: string | null; name: string | null;
  contributors: number | null; approved_hours: number | null;
  billable_hours: number | null; indicative_cost: number | null;
  contract_value: number | null; pct_of_contract: number | null;
  rows_without_rate: number | null;
}
interface ContribRow {
  project_id: string; profile_id: string; full_name: string | null;
  role: string | null; grade: string | null;
  approved_hours: number | null; indicative_cost: number | null; hourly_rate: number | null;
}
interface EntryRow {
  id: string;
  budget_line_id: string;
  entry_type: "commitment" | "realization";
  amount: number;
  description: string | null;
  entry_date: string;
  feasibility_case_id: string | null;
}

export default function BudgetPage() {
  const { profile } = useSession();
  const [year, setYear] = useState(() => new Date().getFullYear());

  const canEntry = profile != null && ENTRY_ROLES.includes(profile.role);
  const canLines = profile != null && LINE_ROLES.includes(profile.role);
  // `talent` has no access to budget data at all; RLS returns zero rows, and
  // an empty table would read as "no budget exists" (UIUX principle 9).
  const noAccess = profile != null && profile.role === "talent";

  const summary = useQuery<SummaryRow>(
    () =>
      getSupabase()
        .from("budget_summary")
        .select(
          "id, fiscal_year, program, category, description, plan_amount, committed_amount, realized_amount, remaining_amount",
        )
        .eq("fiscal_year", year)
        .order("program")
        .range(0, 299)
        .returns<SummaryRow[]>(),
    [year],
  );
  const entries = useQuery<EntryRow>(
    () =>
      getSupabase()
        .from("budget_entries")
        .select("id, budget_line_id, entry_type, amount, description, entry_date, feasibility_case_id")
        .order("entry_date", { ascending: false })
        .range(0, 49)
        .returns<EntryRow[]>(),
    [year],
  );

  // TS-05 — effort turned into indicative internal cost. Shown beside the
  // budget lines, not subtracted from them: those lines are external spend
  // (tools, subcon, cloud), so treating labour as a drawdown would
  // double-count.
  const effort = useQuery<EffortRow>(
    () =>
      getSupabase()
        .from("project_effort_cost")
        .select("project_id, code, name, contributors, approved_hours, billable_hours, indicative_cost, contract_value, pct_of_contract, rows_without_rate")
        .order("indicative_cost", { ascending: false, nullsFirst: false })
        .range(0, 99)
        .returns<EffortRow[]>(),
    [],
  );
  const contrib = useQuery<ContribRow>(
    () =>
      getSupabase()
        .from("project_talent_contribution")
        .select("project_id, profile_id, full_name, role, grade, approved_hours, indicative_cost, hourly_rate")
        .range(0, 999)
        .returns<ContribRow[]>(),
    [],
  );

  const totals = useMemo(() => {
    const t = { plan: 0, committed: 0, realized: 0, remaining: 0 };
    for (const r of summary.rows) {
      t.plan += Number(r.plan_amount);
      t.committed += Number(r.committed_amount);
      t.realized += Number(r.realized_amount);
      t.remaining += Number(r.remaining_amount);
    }
    return t;
  }, [summary.rows]);

  const lineName = (id: string) => {
    const r = summary.rows.find((x) => x.id === id);
    return r ? `${r.program} · ${r.category}` : "—";
  };

  if (noAccess) {
    return (
      <AppShell title="Budget Control">
        <Card className="p-6">
          <p className="text-[13px] text-muted-foreground">
            Tidak ada data yang dapat Anda lihat. Data anggaran tidak terbuka untuk peran talent.
          </p>
        </Card>
      </AppShell>
    );
  }

  const absorbed = totals.plan ? (totals.realized / totals.plan) * 100 : 0;

  return (
    <AppShell
      title="Budget Control"
      actions={
        <div className="flex items-center gap-2">
        <ExportButton
          filename={`tania-budget-${year}`}
          sheetName={`Budget ${year}`}
          disabled={summary.rows.length === 0}
          rows={() => [
            ["Program", "Kategori", "Plan", "Komitmen", "Realisasi", "Sisa", "Serapan %"],
            ...summary.rows.map((r) => [
              r.program, r.category,
              Number(r.plan_amount), Number(r.committed_amount),
              Number(r.realized_amount), Number(r.remaining_amount),
              Number(absorbedOf(r).toFixed(1)),
            ]),
            [],
            ["TOTAL", "", totals.plan, totals.committed, totals.realized, totals.remaining,
              Number(absorbed.toFixed(1))],
            [],
            ["Sisa = Plan - Realisasi. Komitmen tidak mengurangi sisa."],
          ]}
        />
        <select
          aria-label="Tahun fiskal"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
        >
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>
              Tahun fiskal {y}
            </option>
          ))}
        </select>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SummaryCard label="Plan" value={money(totals.plan)} />
        <SummaryCard label="Komitmen" value={money(totals.committed)} />
        <SummaryCard label="Realisasi" value={money(totals.realized)} />
        <SummaryCard
          label="Sisa"
          value={money(totals.remaining)}
          tone={absorbed >= OVER_AT ? "danger" : absorbed >= WARN_AT ? "warning" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget line</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">
            BC-05 · {summary.rows.length} line ·{" "}
            {summary.rows.filter((r) => absorbedOf(r) >= OVER_AT).length} melewati {OVER_AT}%
          </span>
        </CardHeader>
        <StateBoundary
          loading={summary.loading}
          error={summary.error}
          empty={summary.rows.length === 0}
          emptyMessage={`Belum ada budget line untuk tahun fiskal ${year}.`}
          onRetry={summary.reload}
        >
          <Table>
            <thead>
              <tr>
                <Th>Program</Th>
                <Th className="w-[120px]">Kategori</Th>
                <Th className="w-[110px] text-right">Plan</Th>
                <Th className="w-[110px] text-right">Komitmen</Th>
                <Th className="w-[110px] text-right">Realisasi</Th>
                <Th className="w-[110px] text-right">Sisa</Th>
                <Th className="w-[190px]">Serapan</Th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => {
                const pct = absorbedOf(r);
                const over = pct >= OVER_AT;
                const warn = !over && pct >= WARN_AT;
                return (
                  <tr key={r.id} className={over ? "bg-red-50" : warn ? "bg-amber-50" : undefined}>
                    <Td className="font-medium">{r.program}</Td>
                    <Td className="text-muted-foreground">{r.category}</Td>
                    <Td className="tabular text-right">{moneyCompact(r.plan_amount)}</Td>
                    <Td className="tabular text-right">{moneyCompact(r.committed_amount)}</Td>
                    <Td className="tabular text-right">{moneyCompact(r.realized_amount)}</Td>
                    <Td
                      className={
                        "tabular text-right " +
                        (Number(r.remaining_amount) < 0 ? "font-semibold text-destructive" : "")
                      }
                    >
                      {moneyCompact(r.remaining_amount)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={
                              "h-full rounded-full " +
                              (over ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary")
                            }
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        {over ? (
                          <Badge tone="danger">{percent(pct)} ⛔</Badge>
                        ) : warn ? (
                          <Badge tone="warning">{percent(pct)} ⚠</Badge>
                        ) : (
                          <Badge>{percent(pct)}</Badge>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {/* Required caption — without it this column set is near-certain to
              be misread (UIUX §5.5, SRS SF-4.2). */}
          <div className="flex items-start gap-2 border-t border-border bg-surface px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8"
              className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="9.2" />
              <path d="M12 11v5.5M12 7.6v.9" strokeLinecap="round" />
            </svg>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-slate-700">Sisa = Plan − Realisasi.</strong>{" "}
              Komitmen tidak mengurangi sisa — komitmen adalah belanja yang sudah diikat tetapi
              belum terjadi. Peringatan pada {WARN_AT}% dan {OVER_AT}% dari plan.
            </p>
          </div>
        </StateBoundary>
      </Card>

      {/* ------------------------------------- TS-05 talent contribution -- */}
      <TalentContribution effort={effort} contrib={contrib} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader>
            <CardTitle>Entry terakhir</CardTitle>
            <span className="text-[11.5px] text-muted-foreground">BC-02 · BC-03</span>
          </CardHeader>
          <StateBoundary
            loading={entries.loading}
            error={entries.error}
            empty={entries.rows.length === 0}
            emptyMessage="Belum ada entry."
            onRetry={entries.reload}
          >
            <Table>
              <thead>
                <tr>
                  <Th className="w-[110px]">Tanggal</Th>
                  <Th className="w-[110px]">Jenis</Th>
                  <Th>Budget line</Th>
                  <Th className="w-[120px] text-right">Jumlah</Th>
                </tr>
              </thead>
              <tbody>
                {entries.rows.map((e) => (
                  <tr key={e.id}>
                    <Td className="tabular">{date(e.entry_date)}</Td>
                    <Td>
                      <Badge tone={e.entry_type === "commitment" ? "success" : "neutral"}>
                        {e.entry_type === "commitment" ? "Komitmen" : "Realisasi"}
                      </Badge>
                    </Td>
                    <Td>
                      <div>{lineName(e.budget_line_id)}</div>
                      {e.description ? (
                        <div className="text-[11.5px] text-muted-foreground">{e.description}</div>
                      ) : null}
                    </Td>
                    <Td
                      className={
                        "tabular text-right " + (Number(e.amount) < 0 ? "text-destructive" : "")
                      }
                    >
                      {moneyCompact(e.amount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-muted-foreground">
              Entry bernilai negatif adalah mekanisme koreksi — ikut dijumlahkan apa adanya, tidak
              dihapus.
            </p>
          </StateBoundary>
        </Card>

        <div className="flex flex-col gap-4">
          {canEntry ? (
            <EntryForm lines={summary.rows} onSaved={() => { summary.reload(); entries.reload(); }} />
          ) : null}
          {canLines ? <LineForm year={year} onSaved={summary.reload} /> : null}
        </div>
      </div>
    </AppShell>
  );
}

function absorbedOf(r: SummaryRow): number {
  return Number(r.plan_amount) ? (Number(r.realized_amount) / Number(r.plan_amount)) * 100 : 0;
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "";
  return (
    <Card className={`p-4 ${cls}`}>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-[21px] font-semibold tracking-tight">{value}</div>
    </Card>
  );
}

function EntryForm({ lines, onSaved }: { lines: SummaryRow[]; onSaved: () => void }) {
  const { profile } = useSession();
  const [lineId, setLineId] = useState("");
  const [type, setType] = useState<"commitment" | "realization">("realization");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const value = Number(amount);
    if (!value) {
      setError("Jumlah tidak boleh nol. Gunakan nilai negatif untuk koreksi.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(false);
    // created_by must equal auth.uid() for the insert policy to pass.
    const { error } = await getSupabase().from("budget_entries").insert({
      budget_line_id: lineId,
      entry_type: type,
      amount: value,
      description: desc.trim() || null,
      created_by: profile.id,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setAmount("");
      setDesc("");
      setOk(true);
      onSaved();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catat entry</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">BC-02 · BC-03</span>
      </CardHeader>
      <form onSubmit={submit} className="flex flex-col gap-3 p-4">
        <Field label="Budget line" htmlFor="e-line" required>
          <select
            id="e-line"
            required
            value={lineId}
            onChange={(ev) => setLineId(ev.target.value)}
            className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]"
          >
            <option value="">Pilih budget line…</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.program} · {l.category}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Jenis" htmlFor="e-type">
          <select
            id="e-type"
            value={type}
            onChange={(ev) => setType(ev.target.value as "commitment" | "realization")}
            className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]"
          >
            <option value="realization">Realisasi</option>
            <option value="commitment">Komitmen</option>
          </select>
        </Field>
        <Field label="Jumlah (Rp)" htmlFor="e-amt" hint="Negatif untuk koreksi" required>
          <Input
            id="e-amt"
            inputMode="numeric"
            required
            value={amount}
            onChange={(ev) => setAmount(ev.target.value.replace(/[^\d-]/g, ""))}
          />
        </Field>
        <Field label="Keterangan" htmlFor="e-desc">
          <Input id="e-desc" value={desc} onChange={(ev) => setDesc(ev.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy || !lineId || !amount}>
            {busy ? "Menyimpan…" : "Catat"}
          </Button>
          {ok ? <span className="text-[12.5px] text-green-700">Tersimpan.</span> : null}
        </div>
        {error ? (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function LineForm({ year, onSaved }: { year: number; onSaved: () => void }) {
  const [program, setProgram] = useState("");
  const [category, setCategory] = useState("");
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().from("budget_lines").insert({
      fiscal_year: year,
      program: program.trim(),
      category: category.trim(),
      plan_amount: Number(plan) || 0,
    });
    setBusy(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Kombinasi tahun, program dan kategori sudah ada."
          : error.message,
      );
      return;
    }
    setProgram("");
    setCategory("");
    setPlan("");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah budget line</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">BC-01 · TF {year}</span>
      </CardHeader>
      <form onSubmit={submit} className="flex flex-col gap-3 p-4">
        <Field label="Program" htmlFor="l-prog" required>
          <Input id="l-prog" required value={program} onChange={(e) => setProgram(e.target.value)} />
        </Field>
        <Field label="Kategori" htmlFor="l-cat" required>
          <Input id="l-cat" required value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label="Plan (Rp)" htmlFor="l-plan" required>
          <Input
            id="l-plan"
            inputMode="numeric"
            required
            value={plan}
            onChange={(e) => setPlan(e.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !program || !category}>
          {busy ? "Menyimpan…" : "Tambah line"}
        </Button>
        {error ? (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

/* ------------------------------------------ TS-05 talent contribution */

function TalentContribution({
  effort,
  contrib,
}: {
  effort: ReturnType<typeof useQuery<EffortRow>>;
  contrib: ReturnType<typeof useQuery<ContribRow>>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const totalCost = effort.rows.reduce((s, r) => s + Number(r.indicative_cost ?? 0), 0);
  const totalHours = effort.rows.reduce((s, r) => s + Number(r.approved_hours ?? 0), 0);
  const missingRates = effort.rows.reduce((s, r) => s + Number(r.rows_without_rate ?? 0), 0);

  const people = useMemo(() => {
    const m = new Map<string, ContribRow[]>();
    for (const c of contrib.rows) {
      const list = m.get(c.project_id) ?? [];
      const existing = list.find((x) => x.profile_id === c.profile_id);
      if (existing) {
        existing.approved_hours = Number(existing.approved_hours ?? 0) + Number(c.approved_hours ?? 0);
        existing.indicative_cost =
          existing.indicative_cost == null && c.indicative_cost == null
            ? null
            : Number(existing.indicative_cost ?? 0) + Number(c.indicative_cost ?? 0);
      } else {
        list.push({ ...c });
      }
      m.set(c.project_id, list);
    }
    for (const list of m.values())
      list.sort((a, b) => Number(b.indicative_cost ?? 0) - Number(a.indicative_cost ?? 0));
    return m;
  }, [contrib.rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontribusi talent per proyek</CardTitle>
        <span className="text-[11.5px] text-muted-foreground">
          TS-05 · {fmtHoursTotal(totalHours)} jam approved · {money(totalCost)} indikatif
        </span>
      </CardHeader>
      <StateBoundary
        loading={effort.loading}
        error={effort.error}
        empty={effort.rows.length === 0}
        emptyMessage="Belum ada jam approved pada proyek mana pun."
        onRetry={() => { effort.reload(); contrib.reload(); }}
      >
        <Table>
          <thead>
            <tr>
              <Th className="w-[92px]">Kode</Th>
              <Th>Proyek</Th>
              <Th className="w-[86px] text-right">Orang</Th>
              <Th className="w-[100px] text-right">Jam</Th>
              <Th className="w-[120px] text-right">Biaya indikatif</Th>
              <Th className="w-[110px] text-right">% kontrak</Th>
              <Th className="w-[90px]" />
            </tr>
          </thead>
          <tbody>
            {effort.rows.map((r) => {
              const open = openId === r.project_id;
              return (
                // Keyed on the fragment: the row and its detail row are one
                // list item, so the key belongs here, not on the children.
                <Fragment key={r.project_id}>
                  <tr>
                    <Td className="font-medium">{r.code}</Td>
                    <Td>
                      {r.name}
                      {Number(r.rows_without_rate ?? 0) > 0 ? (
                        <div className="text-[11.5px] text-amber-700">
                          sebagian jam belum punya rate
                        </div>
                      ) : null}
                    </Td>
                    <Td className="tabular text-right">{r.contributors}</Td>
                    <Td className="tabular text-right">{fmtHoursTotal(Number(r.approved_hours ?? 0))}</Td>
                    <Td className="tabular text-right font-semibold">
                      {r.indicative_cost == null ? "—" : moneyCompact(r.indicative_cost)}
                    </Td>
                    <Td className="tabular text-right">
                      {r.pct_of_contract == null ? "—" : percent(r.pct_of_contract)}
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" onClick={() => setOpenId(open ? null : r.project_id)}>
                        {open ? "Tutup" : "Rincian"}
                      </Button>
                    </Td>
                  </tr>
                  {open ? (
                    <tr>
                      <Td colSpan={7} className="bg-surface p-0">
                        <ul className="flex flex-col divide-y divide-slate-100">
                          {(people.get(r.project_id) ?? []).map((c) => (
                            <li
                              key={c.profile_id}
                              className="flex items-center justify-between px-4 py-2"
                            >
                              <span className="text-[12.5px]">
                                {c.full_name}
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {c.role}
                                  {c.grade ? ` grade ${c.grade}` : ""}
                                  {c.hourly_rate ? ` · ${moneyCompact(c.hourly_rate)}/jam` : " · rate belum diatur"}
                                </span>
                              </span>
                              <span className="tabular text-[12.5px]">
                                {fmtHoursTotal(Number(c.approved_hours ?? 0))} jam ·{" "}
                                <strong className="font-semibold">
                                  {c.indicative_cost == null ? "—" : moneyCompact(c.indicative_cost)}
                                </strong>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
        <div className="flex items-start gap-2 border-t border-border bg-surface px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8"
            className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="9.2" />
            <path d="M12 11v5.5M12 7.6v.9" strokeLinecap="round" />
          </svg>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-slate-700">
              Biaya ini tidak mengurangi budget line di atas.
            </strong>{" "}
            Budget line mencatat belanja eksternal — tools, training, subcon, cloud. Angka di sini
            adalah biaya internal indikatif dari jam approved dikalikan standard rate per peran dan
            grade, bukan gaji perorangan. Menjumlahkan keduanya berarti menghitung ganda.
            {missingRates > 0
              ? " Sebagian jam belum punya rate pada tahun fiskalnya, sehingga biayanya ditulis \u201c\u2014\u201d, bukan nol."
              : ""}
          </p>
        </div>
      </StateBoundary>
    </Card>
  );
}

function fmtHoursTotal(n: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}
