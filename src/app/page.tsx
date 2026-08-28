"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { ModuleIcon } from "@/components/module-icon";
import { modulesFor, ROLE_LABEL } from "@/lib/modules";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Launcher home, following the TeMan workspace-picker layout used in Divisi
 * Digital Product: greeting, context line, then a grid of module cards.
 *
 * Deliberately omitted from that template: the "Lihat sbg / Peran / Orang"
 * impersonation switch, the workspace switcher and the active-project picker.
 * TANIA has no such features, and a control that looks real but does nothing
 * is worse than none.
 *
 * Static export cannot redirect at the edge (no middleware, no redirects
 * config), so signed-out visitors are sent to /login in the browser.
 */
export default function Home() {
  const router = useRouter();
  const { loading, userId, profile, signOut } = useSession();

  useEffect(() => {
    if (!loading && !userId && isSupabaseConfigured) router.replace("/login/");
  }, [loading, userId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">
        Memuat…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-[13px] text-muted-foreground">
          Sesi tidak ditemukan.{" "}
          <Link href="/login/" className="underline underline-offset-2">
            Masuk
          </Link>
          .
        </p>
      </div>
    );
  }

  const role = profile?.role ?? null;
  const modules = modulesFor(role);
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "rekan";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f6fbfa] via-white to-[#f7f9fc]">
      <Header />

      <main className="mx-auto w-full max-w-[1440px] px-6 pb-16 lg:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="pt-8">
            <p className="text-[15px] text-slate-600">
              Selamat datang kembali,{" "}
              <strong className="font-semibold text-foreground">
                {profile?.full_name ?? firstName}
              </strong>
              ! <span aria-hidden="true">👋</span>
            </p>

            <h1 className="mt-3 text-[44px] font-bold leading-[1.08] tracking-[-0.02em] text-slate-900">
              Pilih <span className="text-[#0d9488]">modul</span> Anda
            </h1>

            <p className="mt-5 max-w-[640px] text-[15px] leading-relaxed text-slate-600 text-pretty">
              Anda bekerja di Organisasi{" "}
              <strong className="font-semibold text-slate-800">Telkom DDP</strong>, Chapter{" "}
              <strong className="font-semibold text-slate-800">Product &amp; Solution</strong>
              {profile?.squad ? (
                <>
                  , squad{" "}
                  <strong className="font-semibold text-slate-800">{profile.squad}</strong>
                </>
              ) : null}{" "}
              sebagai{" "}
              <strong className="font-semibold text-slate-800">
                {role ? ROLE_LABEL[role] : "—"}
              </strong>
              . Pastikan Anda mengisi{" "}
              <Link href="/timesheet/" className="text-[#0d9488] underline underline-offset-2">
                Timesheet
              </Link>{" "}
              minggu ini.
            </p>

            <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
              Modul yang tampil menyesuaikan peran Anda. Menyembunyikan kartu hanya urusan
              tampilan — pembatasan sesungguhnya ada di Row Level Security basis data.
            </p>
          </section>

          <Illustration />
        </div>

        {/* ---------------------------------------------- module grid ---- */}
        <section className="mt-10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e6f6f3]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
              </svg>
            </div>
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight text-slate-900">
                Modul tersedia
              </h2>
              <p className="text-[13px] text-slate-500">
                Pilih salah satu modul di bawah ini untuk melanjutkan
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map((m) =>
              m.soon ? (
                <div
                  key={m.href}
                  className="flex flex-col rounded-xl border border-dashed border-slate-300 bg-white/60 p-5"
                >
                  <div className="flex items-start gap-3">
                    <ModuleIcon icon={m.icon} tone={m.tone} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15.5px] font-semibold text-slate-400">{m.title}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                          Segera
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[12.5px] text-slate-400">{m.path}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{m.description}</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{m.soon}</p>
                </div>
              ) : (
                <Link
                  key={m.href}
                  href={m.href}
                  className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488]"
                >
                  <div className="flex items-start gap-3">
                    <ModuleIcon icon={m.icon} tone={m.tone} />
                    <div className="min-w-0">
                      <h3 className="text-[15.5px] font-semibold text-slate-900">{m.title}</h3>
                      <p className="mt-0.5 font-mono text-[12.5px] text-[#0d9488]">{m.path}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{m.description}</p>
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">
                      {m.ids}
                    </span>
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors group-hover:border-[#0d9488] group-hover:text-[#0d9488]"
                      aria-hidden="true"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-[11.5px] text-slate-500">
          <span>
            TANIA — Portal Digital Product &amp; Solution · PT Telkom Indonesia (Persero) Tbk —
            internal
          </span>
          <button onClick={() => signOut()} className="underline underline-offset-2 hover:text-slate-800">
            Keluar
          </button>
        </footer>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------- header */

function Header() {
  const { profile, signOut } = useSession();
  const initials = (profile?.full_name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
      <div className="flex items-center gap-3">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#e4002b" />
          <path d="M7 8.5h10M12 8.5V16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div>
          <div className="text-[17px] font-bold tracking-tight text-slate-900">TANIA</div>
          <div className="text-[10.5px] uppercase tracking-[0.09em] text-slate-500">
            Digital Product &amp; Solution
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d9488] text-[12px] font-semibold text-white">
          {initials}
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-slate-900">
            {profile?.full_name ?? "—"}
          </div>
          <div className="text-[11px] text-slate-500">
            {profile ? ROLE_LABEL[profile.role] : ""}
          </div>
        </div>
        <button
          onClick={() => signOut()}
          aria-label="Keluar"
          className="ml-1 text-slate-400 hover:text-slate-700"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
          </svg>
        </button>
      </div>
    </header>
  );
}

/* --------------------------------------------------------- illustration */

/** Floating tiles around the chapter mark, echoing the template's hero art. */
function Illustration() {
  const tiles = [
    { top: 8, left: 4, tone: "#8b5cf6", icon: "M4.5 20V11M10 20V4.8M15.5 20v-6.4M21 20V8.4" },
    { top: 0, left: 52, tone: "#0ea5e9", icon: "M9.5 8.5a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM3 17a6.5 6.5 0 0 1 13 0" },
    { top: 30, left: 78, tone: "#f97316", icon: "M3 6h18v12H3zM3 9l9 5 9-5" },
    { top: 62, left: 10, tone: "#10b981", icon: "M20.5 6.5 10 17 4 11.2" },
    { top: 70, left: 66, tone: "#6366f1", icon: "M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6l8-4.4Z" },
  ];
  return (
    <div className="relative hidden min-h-[300px] lg:block" aria-hidden="true">
      {tiles.map((t, i) => (
        <div
          key={i}
          className="absolute flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,.07)]"
          style={{ top: `${t.top}%`, left: `${t.left}%` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.tone} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={t.icon} />
          </svg>
        </div>
      ))}
      <div className="absolute left-[30%] top-[32%] flex h-[104px] w-[104px] items-center justify-center rounded-[26px] border border-slate-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,.10)]">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#e4002b" />
          <path d="M7 8.5h10M12 8.5V16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
