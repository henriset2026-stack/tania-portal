import type { IconName, Tone } from "@/lib/modules";

/** Tile colours, matching the workspace-picker palette used in TeMan. */
const TONES: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: "#3b82f6", fg: "#ffffff" },
  emerald: { bg: "#10b981", fg: "#ffffff" },
  teal: { bg: "#0d9488", fg: "#ffffff" },
  sky: { bg: "#0ea5e9", fg: "#ffffff" },
  purple: { bg: "#8b5cf6", fg: "#ffffff" },
  indigo: { bg: "#6366f1", fg: "#ffffff" },
  orange: { bg: "#f97316", fg: "#ffffff" },
  slate: { bg: "#e2e8f0", fg: "#475569" },
  mint: { bg: "#bbf7d0", fg: "#15803d" },
};

const PATHS: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.2V12l3.2 2" strokeLinecap="round" />
    </>
  ),
  check: (
    <>
      <path d="M20.5 6.5 10 17 4 11.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8.5" r="3.4" />
      <path d="M3.5 19.5a6 6 0 0 1 12 0" strokeLinecap="round" />
      <path d="M16.5 6.4a3.2 3.2 0 0 1 0 6.2M17.5 19.5a6 6 0 0 0-1.6-4.1" strokeLinecap="round" />
    </>
  ),
  bars: (
    <>
      <path d="M4.5 20V11M10 20V4.8M15.5 20v-6.4M21 20V8.4" strokeLinecap="round" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6l8-4.4Z" strokeLinejoin="round" />
      <path d="M4 7.6 12 12l8-4.4M12 12v8.8" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.2" y="6" width="17.6" height="12.6" rx="2.4" />
      <path d="M3.2 10.2h17.6" />
      <circle cx="16.6" cy="14.4" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9M18.5 18.5l-1.9-1.9M7.4 7.4 5.5 5.5" strokeLinecap="round" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.4l1.9 4.9 4.9 1.9-4.9 1.9L12 17l-1.9-4.9L5.2 10.2l4.9-1.9L12 3.4Z" strokeLinejoin="round" />
      <path d="M18.4 15.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" strokeLinejoin="round" />
    </>
  ),
};

export function ModuleIcon({
  icon,
  tone,
  size = 44,
}: {
  icon: IconName;
  tone: Tone;
  size?: number;
}) {
  const c = TONES[tone];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: c.bg }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke={c.fg}
        strokeWidth="1.9"
      >
        {PATHS[icon]}
      </svg>
    </div>
  );
}
