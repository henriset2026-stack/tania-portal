"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/use-query";
import { getSupabase } from "@/lib/supabase";

/*
 * Rotating announcement banner for the launcher home.
 *
 * Auto-rotating content is where carousels usually fail accessibility, so
 * the moving parts are deliberate:
 *
 *  - WCAG 2.2.2 (Pause, Stop, Hide): anything that moves automatically for
 *    more than five seconds needs a way to stop it. There is a pause
 *    button, and it is the first control, not an afterthought.
 *  - prefers-reduced-motion turns auto-advance OFF entirely. Someone who
 *    has asked the system for less movement should not have to find a
 *    button on every visit.
 *  - Rotation pauses on hover and on keyboard focus, so nobody loses the
 *    item they were reading or tabbing through.
 *  - The live region is polite while paused and off while rotating: a
 *    screen reader should not announce a new notice every seven seconds.
 *  - Every slide stays in the DOM, hidden with `hidden`, so prev/next and
 *    the dots address real elements rather than a re-rendered single node.
 */

const ROTATE_MS = 7000;
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "critical";
  link_url: string | null;
  link_label: string | null;
}

const TONE: Record<Announcement["tone"], { band: string; chip: string; label: string }> = {
  info: { band: "from-sky-50 to-white border-sky-200", chip: "bg-sky-100 text-sky-800", label: "Informasi" },
  success: { band: "from-green-50 to-white border-green-200", chip: "bg-green-100 text-green-800", label: "Kabar baik" },
  warning: { band: "from-amber-50 to-white border-amber-200", chip: "bg-amber-100 text-amber-900", label: "Perhatian" },
  critical: { band: "from-red-50 to-white border-red-200", chip: "bg-red-100 text-red-800", label: "Penting" },
};

export function AnnouncementBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hovering = useRef(false);

  // The motion preference is external state, so it is subscribed to rather
  // than copied into state by an effect. The third argument is the server
  // snapshot: assume motion is allowed during prerender, then correct on
  // hydration.
  const reducedMotion = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(MOTION_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );

  const { rows, loading, error } = useQuery<Announcement>(
    () =>
      getSupabase()
        .from("announcements_active")
        .select("id, title, body, tone, link_url, link_label")
        .range(0, 19)
        .returns<Announcement[]>(),
    [],
  );

  const count = rows.length;
  const rotating = count > 1 && !paused && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const t = setInterval(() => {
      if (!hovering.current) setIndex((i) => (i + 1) % count);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [rotating, count]);

  if (loading || error || count === 0) return null;

  // Derived, not corrected by an effect: if the list shrinks between renders
  // the index is clamped here rather than briefly pointing past the end.
  const safe = Math.min(index, count - 1);
  const current = rows[safe];
  const tone = TONE[current.tone] ?? TONE.info;

  return (
    <section
      aria-label="Pengumuman"
      className={`rounded-xl border bg-gradient-to-r ${tone.band}`}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      onFocusCapture={() => setPaused(true)}
    >
      <div
        aria-live={paused || reducedMotion ? "polite" : "off"}
        aria-atomic="true"
        className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4"
      >
        <div className="min-w-0 flex-1">
          {rows.map((a, i) => (
            <div key={a.id} hidden={i !== safe}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                    (TONE[a.tone] ?? TONE.info).chip
                  }`}
                >
                  {(TONE[a.tone] ?? TONE.info).label}
                </span>
                <h2 className="text-[14.5px] font-semibold tracking-tight text-slate-900">
                  {a.title}
                </h2>
              </div>
              <p className="mt-1 max-w-[820px] text-[13px] leading-relaxed text-slate-700 text-pretty">
                {a.body}
              </p>
              {a.link_url && a.link_label ? (
                <Link
                  href={a.link_url}
                  className="mt-1.5 inline-block text-[12.5px] font-medium underline underline-offset-2"
                >
                  {a.link_label} →
                </Link>
              ) : null}
            </div>
          ))}
        </div>

        {/* ------------------------------------------------ controls ---- */}
        {count > 1 ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              aria-label={paused ? "Lanjutkan pergantian pengumuman" : "Hentikan pergantian pengumuman"}
              title={paused ? "Lanjutkan" : "Jeda"}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-600 hover:text-slate-900"
            >
              {paused ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4.5v15l13-7.5-13-7.5Z" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="4.5" width="4.2" height="15" rx="1.2" />
                  <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              aria-label="Pengumuman sebelumnya"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-600 hover:text-slate-900"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>

            <div className="flex items-center gap-1 px-1">
              {rows.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Pengumuman ${i + 1} dari ${count}: ${a.title}`}
                  aria-current={i === safe ? "true" : undefined}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (i === safe ? "w-5 bg-slate-800" : "w-1.5 bg-slate-400/60 hover:bg-slate-500")
                  }
                />
              ))}
            </div>

            <button
              onClick={() => setIndex((i) => (i + 1) % count)}
              aria-label="Pengumuman berikutnya"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-600 hover:text-slate-900"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      <p className="sr-only">
        {`Pengumuman ${safe + 1} dari ${count}.`}
        {reducedMotion
          ? " Pergantian otomatis dimatikan karena preferensi gerak minimal."
          : paused
            ? " Pergantian otomatis dijeda."
            : ""}
      </p>
    </section>
  );
}
