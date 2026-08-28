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
import type { Activity, ActivityCategory, AuditLogRow, Project } from "@/lib/db";

const PAGE = 25; // every list query is paginated (AGENTS.md / TRD DA-1)

const CATEGORIES: ActivityCategory[] = [
  "delivery",
  "presales",
  "internal",
  "leave",
  "training",
];

type Tab = "projects" | "activities" | "announcements" | "audit";

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
                ["announcements", "Pengumuman"],
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
          {tab === "announcements" ? <Announcements /> : null}
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

/* ----------------------------------------------------- announcements */

interface AnnRow {
  id: string; title: string; body: string; tone: string;
  link_url: string | null; link_label: string | null;
  starts_at: string; ends_at: string | null; is_active: boolean; priority: number;
}

const TONES = ["info", "success", "warning", "critical"] as const;

/** Banner content. Scheduling and the active flag are what take a notice
 *  off the home page — deleting is for mistakes, not for expiry. */
function Announcements() {
  const { profile } = useSession();
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({
    title: "", body: "", tone: "info", link_url: "", link_label: "",
    ends_at: "", priority: "100",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows, loading, error: loadError, reload } = useQuery<AnnRow>(
    () =>
      getSupabase()
        .from("announcements")
        .select("id, title, body, tone, link_url, link_label, starts_at, ends_at, is_active, priority")
        .order("priority")
        .range(page * PAGE, page * PAGE + PAGE - 1)
        .returns<AnnRow[]>(),
    [page],
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true); setError(null);
    // link_url and link_label must both be present or both absent — the
    // database enforces it, so send null rather than an empty string.
    const url = form.link_url.trim() || null;
    const label = form.link_label.trim() || null;
    if (Boolean(url) !== Boolean(label)) {
      setBusy(false);
      setError("Isi URL dan label tautan bersama-sama, atau kosongkan keduanya.");
      return;
    }
    const { error } = await getSupabase().from("announcements").insert({
      title: form.title.trim(),
      body: form.body.trim(),
      tone: form.tone,
      link_url: url,
      link_label: label,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      priority: Number(form.priority) || 100,
      created_by: profile.id,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setForm({ title: "", body: "", tone: "info", link_url: "", link_label: "", ends_at: "", priority: "100" });
      reload();
    }
  }

  async function toggle(row: AnnRow) {
    setBusy(true); setError(null);
    const { error } = await getSupabase()
      .from("announcements").update({ is_active: !row.is_active }).eq("id", row.id);
    setBusy(false);
    if (error) setError(error.message); else reload();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tulis pengumuman</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">
            Tampil di banner beranda · prioritas kecil tampil lebih dulu
          </span>
        </CardHeader>
        <form onSubmit={add} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
          <div className="md:col-span-3">
            <Field label="Judul" htmlFor="an-title" required>
              <Input id="an-title" required value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
          </div>
          <Field label="Nada" htmlFor="an-tone">
            <select id="an-tone" value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
              className="h-[38px] w-full rounded-md border border-border bg-white px-3 text-[13.5px]">
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div className="md:col-span-4">
            <Field label="Isi" htmlFor="an-body" required>
              <textarea id="an-body" required rows={2} value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 text-[13.5px] focus:border-primary focus:outline-none" />
            </Field>
          </div>
          <Field label="URL tautan" htmlFor="an-url" hint="opsional, mis. /timesheet/">
            <Input id="an-url" value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
          </Field>
          <Field label="Label tautan" htmlFor="an-label" hint="wajib bila URL diisi">
            <Input id="an-label" value={form.link_label}
              onChange={(e) => setForm({ ...form, link_label: e.target.value })} />
          </Field>
          <Field label="Berakhir" htmlFor="an-end" hint="kosong = tanpa batas">
            <Input id="an-end" type="date" value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </Field>
          <Field label="Prioritas" htmlFor="an-prio">
            <Input id="an-prio" inputMode="numeric" value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value.replace(/[^0-9]/g, "") })} />
          </Field>
          <div className="flex items-center gap-3 md:col-span-4">
            <Button type="submit" variant="primary" disabled={busy || !form.title.trim() || !form.body.trim()}>
              {busy ? "Menyimpan…" : "Terbitkan"}
            </Button>
            {error ? <span role="alert" className="text-[12.5px] text-destructive">{error}</span> : null}
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengumuman</CardTitle>
          <Pager page={page} count={rows.length} onChange={setPage} />
        </CardHeader>
        <StateBoundary loading={loading} error={loadError} empty={rows.length === 0}
          emptyMessage="Belum ada pengumuman." onRetry={reload}>
          <Table>
            <thead>
              <tr>
                <Th className="w-[70px] text-right">Prio</Th>
                <Th className="w-[100px]">Nada</Th>
                <Th>Judul</Th>
                <Th className="w-[120px]">Berakhir</Th>
                <Th className="w-[130px]">Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const expired = a.ends_at != null && new Date(a.ends_at) <= new Date();
                return (
                  <tr key={a.id} className={!a.is_active || expired ? "text-muted-foreground" : undefined}>
                    <Td className="tabular text-right">{a.priority}</Td>
                    <Td>
                      <Badge tone={a.tone === "critical" ? "danger" : a.tone === "warning" ? "warning" : a.tone === "success" ? "success" : "neutral"}>
                        {a.tone}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-[11.5px] text-muted-foreground">{a.body.slice(0, 90)}</div>
                    </Td>
                    <Td className="tabular text-[12px]">{a.ends_at ? date(a.ends_at) : "—"}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {expired ? (
                          <Badge>kedaluwarsa</Badge>
                        ) : a.is_active ? (
                          <Badge tone="success">tayang</Badge>
                        ) : (
                          <Badge>nonaktif</Badge>
                        )}
                        <Button size="sm" disabled={busy} onClick={() => toggle(a)}>
                          {a.is_active ? "Matikan" : "Aktifkan"}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </StateBoundary>
      </Card>
    </>
  );
}
