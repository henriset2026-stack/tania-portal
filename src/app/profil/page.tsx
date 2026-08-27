"use client";

import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { StateBoundary } from "@/components/state-boundary";
import { useSession } from "@/components/session-provider";
import { getSupabase } from "@/lib/supabase";
import { date } from "@/lib/format";

/**
 * TM-01 — talent profile.
 *
 * A user may update their own row, but guard_profile_privileges() rejects any
 * change to role, is_active or manager_id from a non-admin. Those fields are
 * therefore shown read-only rather than disabled inputs that would fail on save.
 */
export default function ProfilPage() {
  const { profile, loading, error } = useSession();
  // Seeded from the loaded profile via a key reset rather than an effect.
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", squad: "", grade: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (profile && seeded !== profile.id) {
    // Render-phase sync of derived state — the pattern React recommends over
    // an effect for "reset this form when the source record changes".
    setSeeded(profile.id);
    setForm({
      full_name: profile.full_name ?? "",
      squad: profile.squad ?? "",
      grade: profile.grade ?? "",
      location: profile.location ?? "",
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setSaved(false);
    setSaveError(null);
    const { error } = await getSupabase()
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        squad: form.squad.trim() || null,
        grade: form.grade.trim() || null,
        location: form.location.trim() || null,
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) setSaveError(error.message);
    else setSaved(true);
  }

  return (
    <AppShell title="Profil">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Data diri</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">TM-01</span>
        </CardHeader>
        <StateBoundary loading={loading} error={error} empty={!profile}
          emptyMessage="Profil tidak ditemukan untuk akun ini.">
          <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nama lengkap" htmlFor="full_name">
                <Input
                  id="full_name"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>
              <Field label="Squad" htmlFor="squad">
                <Input
                  id="squad"
                  value={form.squad}
                  onChange={(e) => setForm({ ...form, squad: e.target.value })}
                  placeholder="mis. Platform"
                />
              </Field>
              <Field label="Grade" htmlFor="grade">
                <Input
                  id="grade"
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  placeholder="mis. 4"
                />
              </Field>
              <Field label="Lokasi" htmlFor="location">
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="mis. Jakarta"
                />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </Button>
              {saved ? <span className="text-[12.5px] text-green-700">Tersimpan.</span> : null}
              {saveError ? (
                <span role="alert" className="text-[12.5px] text-destructive">
                  {saveError}
                </span>
              ) : null}
            </div>
          </form>
        </StateBoundary>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dikelola admin</CardTitle>
          <span className="text-[11.5px] text-muted-foreground">
            Hanya admin yang dapat mengubah bagian ini
          </span>
        </CardHeader>
        <dl className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-[12px] text-muted-foreground">Email</dt>
            <dd className="mt-0.5 text-[13px]">{profile?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted-foreground">Peran</dt>
            <dd className="mt-0.5">
              <Badge>{profile?.role ?? "—"}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
              {profile?.is_active ? (
                <Badge tone="success">aktif</Badge>
              ) : (
                <Badge tone="danger">nonaktif</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted-foreground">Bergabung</dt>
            <dd className="mt-0.5 text-[13px]">{date(profile?.created_at)}</dd>
          </div>
        </dl>
      </Card>
    </AppShell>
  );
}
