"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const { userId, loading: sessionLoading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && userId) router.replace("/dashboard/");
  }, [sessionLoading, userId, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) {
        // Deliberately vague: never reveal whether the address exists.
        setError("Email atau kata sandi salah.");
        return;
      }
      router.replace("/dashboard/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[560px] shrink-0 flex-col justify-between bg-[#0f172a] p-14 text-slate-200 lg:flex">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#e4002b" />
            <path d="M7 8.5h10M12 8.5V16" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <b className="text-[17px] tracking-wide text-white">TANIA</b>
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="text-[34px] font-semibold leading-tight tracking-tight text-white text-pretty">
            Portal Digital Product &amp; Solution
          </h2>
          <div className="grid max-w-[420px] grid-cols-2 gap-x-6 gap-y-3.5">
            {[
              ["Talent", "Profil & kompetensi"],
              ["Analytics", "Utilisasi & workload"],
              ["Insight", "Kelayakan proyek"],
              ["Action", "Timesheet & anggaran"],
            ].map(([t, d]) => (
              <div key={t}>
                <div className="text-[13.5px] font-semibold text-white">{t}</div>
                <div className="text-[12.5px] text-slate-400">{d}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11.5px] leading-relaxed text-slate-400">
          Chapter Product &amp; Solution · Digital Product
          <br />
          PT Telkom Indonesia (Persero) Tbk — internal
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-10">
        <form onSubmit={onSubmit} className="flex w-[380px] flex-col gap-5">
          <div>
            <h1 className="mb-1.5 text-[22px] font-semibold tracking-tight">Masuk</h1>
            <p className="text-[12px] text-muted-foreground">Gunakan email Telkom Anda.</p>
          </div>

          {!isSupabaseConfigured ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-900">
              Supabase belum dikonfigurasi. Salin <code>.env.example</code> ke{" "}
              <code>.env.local</code> dan isi <code>NEXT_PUBLIC_SUPABASE_URL</code> serta{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </p>
          ) : null}

          <div className="flex flex-col gap-3.5">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@telkom.co.id"
              />
            </Field>
            <Field label="Kata sandi" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="text-[12.5px] text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="h-[38px] w-full"
            disabled={busy || !isSupabaseConfigured}
          >
            {busy ? "Memproses…" : "Masuk"}
          </Button>

          <p className="rounded-lg border border-border bg-white p-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Portal ini <strong className="font-semibold text-slate-700">invite-only</strong>. Tidak
            ada pendaftaran mandiri — akun dibuat oleh admin chapter.
          </p>
        </form>
      </div>
    </div>
  );
}
