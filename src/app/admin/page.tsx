"use client";

import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { StateBoundary } from "@/components/state-boundary";
import { useSession } from "@/components/session-provider";
import { getSupabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { cn } from "@/lib/cn";
import { date, dateTime } from "@/lib/format";
import type { Activity, ActivityCategory, AuditLogRow, Project } from "@/lib/database.types";

const PAGE = 25; // every list query is paginated (AGENTS.md / TRD DA-1)

const CATEGORIES: ActivityCategory[] = [
  "delivery",
  "presales",
  "internal",
  "leave",
  "training",
];

type Tab = "projects" | "activities" | "audit";

export default function AdminPage() {
  const { profile } = useSession();
  const [tab, setTab] = useState<Tab>("projects");

  // Menu visibility already hides this route for non-admins, but a typed URL
  // must not show an empty shell — RLS would return nothing anyway.
  const notAdmin = profile != null && profile.role !== "admin";

  return (
    <AppShell title="Admin">
      {notAdmin ? (
        <Card className="p-6">
          <p className="text-[13px] text-muted-foreground">
            Tidak ada data yang dapat Anda lihat. Halaman ini hanya untuk admin.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex gap-1.5">
            {(
              [
                ["projects", "Proyek"],
                ["activities", "Aktivitas"],
                ["audit", "Jejak audit"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "h-8 rounded-md px-3 text-[13px] font-medium",
                  tab === key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-white text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "projects" ? <Projects /> : null}
          {tab === "activities" ? <Activities /> : null}
          {tab === "audit" ? <AuditLog /> : null}
        </>
      )}
    </AppShell>
  );
}

/* ---------------------------------------------------------------- projects */

function Projects() {
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({ code: "", name: "", customer: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { rows, loading, error, reload } = useQuery<Project>(
    () =>
      getSupabase()
        .from("projects")
        .select("id, code, name, customer, status, pm_id, start_date, end_date, created_at, updated_at")
        .order("code")
        .range(page * PAGE, page * PAGE + PAGE - 1)
        .returns<Project[]>(),
    [page],
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const { error } = await getSupabase().from("projects").insert({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      customer: form.customer.trim() || null,
    });
    setBusy(false);
    if (error) {
      setFormError(
        error.code === "23505" ? `Kode ${form.code.toUpperCase()} sudah dipakai.` : error.message,
      );
      return;
    }
    setForm({ code: "", name: "", customer: "" });
    reload();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tambah proyek</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">Kode harus unik</span>
        </CardHeader>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-[130px]">
            <Field label="Kode" htmlFor="p-code">
              <Input
                id="p-code"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="P1"
              />
            </Field>
          </div>
          <div className="min-w-[240px] flex-1">
            <Field label="Nama proyek" htmlFor="p-name">
              <Input
                id="p-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
          </div>
          <div className="min-w-[180px] flex-1">
            <Field label="Customer" htmlFor="p-cust">
              <Input
                id="p-cust"
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Tambah"}
          </Button>
          {formError ? (
            <p role="alert" className="w-full text-[12.5px] text-destructive">
              {formError}
            </p>
          ) : null}
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proyek</CardTitle>
          <Pager page={page} count={rows.length} onChange={setPage} />
        </CardHeader>
        <StateBoundary
          loading={loading}
          error={error}
          empty={rows.length === 0}
          emptyMessage="Belum ada proyek."
          onRetry={reload}
        >
          <Table>
            <thead>
              <tr>
                <Th className="w-[110px]">Kode</Th>
                <Th>Nama</Th>
                <Th className="w-[180px]">Customer</Th>
                <Th className="w-[120px]">Status</Th>
                <Th className="w-[120px]">Mulai</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.code}</Td>
                  <Td>{p.name}</Td>
                  <Td className="text-muted-foreground">{p.customer ?? "—"}</Td>
                  <Td>
                    <Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge>
                  </Td>
                  <Td className="tabular">{date(p.start_date)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </StateBoundary>
      </Card>
    </>
  );
}

/* -------------------------------------------------------------- activities */

function Activities() {
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<{ code: string; name: string; category: ActivityCategory }>({
    code: "",
    name: "",
    category: "delivery",
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { rows, loading, error, reload } = useQuery<Activity>(
    () =>
      getSupabase()
        .from("activities")
        .select("id, code, name, category, is_billable, is_active, created_at")
        .order("code")
        .range(page * PAGE, page * PAGE + PAGE - 1)
        .returns<Activity[]>(),
    [page],
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const { error } = await getSupabase().from("activities").insert({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      // Only delivery work is billable by default; corrected per activity later.
      is_billable: form.category === "delivery",
    });
    setBusy(false);
    if (error) {
      setFormError(
        error.code === "23505" ? `Kode ${form.code.toUpperCase()} sudah dipakai.` : error.message,
      );
      return;
    }
    setForm({ code: "", name: "", category: "delivery" });
    reload();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tambah aktivitas</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">TS-03 · daftar terkendali</span>
        </CardHeader>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-[130px]">
            <Field label="Kode" htmlFor="a-code">
              <Input
                id="a-code"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="DEL"
              />
            </Field>
          </div>
          <div className="min-w-[240px] flex-1">
            <Field label="Nama aktivitas" htmlFor="a-name">
              <Input
                id="a-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
          </div>
          <div className="w-[170px]">
            <Field label="Kategori" htmlFor="a-cat">
              <select
                id="a-cat"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as ActivityCategory })
                }
                className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Tambah"}
          </Button>
          {formError ? (
            <p role="alert" className="w-full text-[12.5px] text-destructive">
              {formError}
            </p>
          ) : null}
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas</CardTitle>
          <Pager page={page} count={rows.length} onChange={setPage} />
        </CardHeader>
        <StateBoundary
          loading={loading}
          error={error}
          empty={rows.length === 0}
          emptyMessage="Belum ada aktivitas."
          onRetry={reload}
        >
          <Table>
            <thead>
              <tr>
                <Th className="w-[110px]">Kode</Th>
                <Th>Nama</Th>
                <Th className="w-[130px]">Kategori</Th>
                <Th className="w-[110px]">Billable</Th>
                <Th className="w-[100px]">Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium">{a.code}</Td>
                  <Td>{a.name}</Td>
                  <Td className="text-muted-foreground">{a.category}</Td>
                  <Td>{a.is_billable ? "Ya" : "Tidak"}</Td>
                  <Td>
                    {a.is_active ? (
                      <Badge tone="success">aktif</Badge>
                    ) : (
                      <Badge>nonaktif</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </StateBoundary>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------- audit */

function AuditLog() {
  const [page, setPage] = useState(0);
  const [table, setTable] = useState("");

  const { rows, loading, error, reload } = useQuery<AuditLogRow>(() => {
    // Never select * on audit_log, and always paginate (TRD DA-2).
    const q = getSupabase()
      .from("audit_log")
      .select("id, table_name, record_id, action, actor, before_data, after_data, created_at")
      .order("id", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    return (table ? q.eq("table_name", table) : q).returns<AuditLogRow[]>();
  }, [page, table]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jejak audit</CardTitle>
        <div className="flex items-center gap-3">
          <select
            aria-label="Filter tabel"
            value={table}
            onChange={(e) => {
              setPage(0);
              setTable(e.target.value);
            }}
            className="h-8 rounded-md border border-border bg-white px-2 text-[12.5px]"
          >
            <option value="">Semua tabel</option>
            {["profiles", "timesheets", "feasibility_cases", "budget_lines", "budget_entries"].map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ),
            )}
          </select>
          <Pager page={page} count={rows.length} onChange={setPage} />
        </div>
      </CardHeader>
      <StateBoundary
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyMessage="Belum ada perubahan tercatat."
        onRetry={reload}
      >
        <Table>
          <thead>
            <tr>
              <Th className="w-[150px]">Waktu</Th>
              <Th className="w-[150px]">Tabel</Th>
              <Th className="w-[100px]">Aksi</Th>
              <Th>Record</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="tabular">{dateTime(r.created_at)}</Td>
                <Td className="text-muted-foreground">{r.table_name}</Td>
                <Td>
                  <Badge
                    tone={
                      r.action === "DELETE"
                        ? "danger"
                        : r.action === "INSERT"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {r.action}
                  </Badge>
                </Td>
                <Td className="font-mono text-[11.5px] text-muted-foreground">{r.record_id}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </StateBoundary>
    </Card>
  );
}

/* ------------------------------------------------------------------ shared */

function Pager({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px] text-muted-foreground">Hal. {page + 1}</span>
      <Button size="sm" onClick={() => onChange(Math.max(0, page - 1))} disabled={page === 0}>
        Sebelumnya
      </Button>
      <Button size="sm" onClick={() => onChange(page + 1)} disabled={count < PAGE}>
        Berikutnya
      </Button>
    </div>
  );
}
