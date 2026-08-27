"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { navFor } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useSession } from "./session-provider";
import { isSupabaseConfigured } from "@/lib/supabase";

const ROLE_LABEL: Record<string, string> = {
  executive: "executive",
  chapter_lead: "chapter lead",
  manager: "manager",
  pm: "PM",
  talent: "talent",
  admin: "admin",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Signed-in frame. Hiding a menu item is presentation only — RLS is what
 * actually protects the data, so every page still handles zero rows.
 */
export function AppShell({ title, actions, children }: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { loading, userId, profile, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

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
          Sesi tidak ditemukan. <Link href="/login/" className="underline">Masuk</Link>.
        </p>
      </div>
    );
  }

  const items = navFor(profile?.role ?? null);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[220px] shrink-0 flex-col bg-[#0f172a] py-4 text-slate-300">
        <div className="flex items-center gap-2.5 px-[18px] pb-[18px] pt-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#e4002b" />
            <path d="M7 8.5h10M12 8.5V16" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <b className="text-[16px] tracking-wide text-white">TANIA</b>
        </div>
        <nav className="flex flex-col gap-0.5 px-2.5">
          {items.map((item) => {
            const active = pathname === item.href || pathname === `${item.href}/`;
            if (item.planned) {
              return (
                <span
                  key={item.href}
                  title="Belum tersedia pada fase ini"
                  className="flex cursor-not-allowed items-center justify-between rounded-md px-2.5 py-2 text-[13.5px] text-slate-500"
                >
                  {item.label}
                  <span className="text-[10px] uppercase tracking-wide">segera</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={`${item.href}/`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-2 text-[13.5px]",
                  active ? "bg-slate-800 font-medium text-white" : "text-slate-400 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-6">
          <h1 className="text-[16px] font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-2.5">
            {actions}
            <span className="text-[12px] text-muted-foreground">
              {profile?.full_name ?? "—"}
              {profile ? ` · ${ROLE_LABEL[profile.role] ?? profile.role}` : ""}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11.5px] font-semibold text-slate-600">
              {profile ? initials(profile.full_name || profile.email) : "?"}
            </div>
            <button
              onClick={() => signOut()}
              className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Keluar
            </button>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-6">{children}</main>
      </div>
    </div>
  );
}
