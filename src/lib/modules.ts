import type { UserRole } from "./db";

/**
 * Module catalogue for the launcher home, following the TeMan workspace-picker
 * layout used elsewhere in Divisi Digital Product.
 *
 * Visibility mirrors UIUX.md §3 and PRD.md §8 exactly — the same source as
 * `nav.ts`. Hiding a card is presentation only; RLS is what actually protects
 * the data, so every page still handles zero rows.
 */
export interface ModuleCard {
  href: string;
  title: string;
  /** Shown under the title in monospace, like the domains in the template. */
  path: string;
  description: string;
  /** Requirement IDs this module implements. */
  ids: string;
  roles: readonly UserRole[];
  tone: Tone;
  icon: IconName;
  /** Built but not approved for production — rendered dimmed with a badge. */
  soon?: string;
}

export type Tone =
  | "blue" | "emerald" | "teal" | "sky"
  | "purple" | "indigo" | "orange" | "slate" | "mint";

export type IconName =
  | "grid" | "clock" | "check" | "users"
  | "bars" | "cube" | "wallet" | "cog" | "sparkle";

const ALL: readonly UserRole[] = [
  "executive", "chapter_lead", "manager", "pm", "talent", "admin",
];
const NOT_TALENT: readonly UserRole[] = [
  "executive", "chapter_lead", "manager", "pm", "admin",
];

export const MODULES: readonly ModuleCard[] = [
  {
    href: "/dashboard/",
    title: "Dashboard Eksekutif",
    path: "tania/dashboard",
    description: "Ringkasan utilisasi, compliance, pipeline, dan posisi anggaran chapter.",
    ids: "XM-01",
    roles: ALL,
    tone: "blue",
    icon: "grid",
  },
  {
    href: "/timesheet/",
    title: "Timesheet",
    path: "tania/timesheet",
    description: "Isi jam kerja mingguan per proyek dan aktivitas, lalu submit untuk disetujui.",
    ids: "TS-01",
    roles: ALL,
    tone: "emerald",
    icon: "clock",
  },
  {
    href: "/timesheet/approval/",
    title: "Approval Timesheet",
    path: "tania/timesheet/approval",
    description: "Antrean persetujuan tim beserta compliance per squad.",
    ids: "TS-02 · TS-04",
    roles: ["chapter_lead", "manager", "admin"],
    tone: "teal",
    icon: "check",
  },
  {
    href: "/projects/",
    title: "Project Control",
    path: "tania/projects",
    description: "Progress vs rencana, schedule variance, risk register, dan kesehatan proyek per dimensi.",
    ids: "M3 · M4 · M6 · M7",
    roles: ALL,
    tone: "teal",
    icon: "cube",
  },
  {
    href: "/talent/",
    title: "Talent Management",
    path: "tania/talent",
    description: "Profil, competency matrix, dan pencarian talent untuk staffing.",
    ids: "TM-02 · TM-04",
    roles: ALL,
    tone: "sky",
    icon: "users",
  },
  {
    href: "/workload/",
    title: "Workload Analysis",
    path: "tania/workload",
    description: "Alokasi rencana vs utilisasi aktual, heatmap squad, dan alert overload.",
    ids: "WA-01 · WA-04",
    roles: NOT_TALENT,
    tone: "purple",
    icon: "bars",
  },
  {
    href: "/feasibility/",
    title: "Project Feasibility",
    path: "tania/feasibility",
    description: "Intake kandidat proyek, scoring berbobot, dan keputusan go/no-go beraudit.",
    ids: "PF-01 · PF-04",
    roles: ALL,
    tone: "indigo",
    icon: "grid",
  },
  {
    href: "/budget/",
    title: "Budget Control",
    path: "tania/budget",
    description: "Plan vs komitmen vs realisasi per program, dengan alert ambang serapan.",
    ids: "BC-01 · BC-05",
    roles: NOT_TALENT,
    tone: "orange",
    icon: "wallet",
  },
  {
    href: "/admin/",
    title: "Administrator",
    path: "tania/admin",
    description: "Master data proyek dan aktivitas, serta jejak audit perubahan.",
    ids: "TS-03 · XM-05",
    roles: ["admin"],
    tone: "slate",
    icon: "cog",
  },
  {
    // Built (migration + edge function) but awaiting an approved spend cap,
    // so it is shown the way the template shows an unbuilt workspace.
    href: "/avatar/",
    title: "TANIA Avatar",
    path: "tania/avatar",
    description: "Asisten AI yang menjawab dari data live kelima modul, sebatas hak akses Anda.",
    ids: "AV-01 · AV-07",
    roles: ALL,
    tone: "mint",
    icon: "sparkle",
    soon: "Menunggu persetujuan plafon biaya.",
  },
];

export function modulesFor(role: UserRole | null): ModuleCard[] {
  if (!role) return [];
  return MODULES.filter((m) => m.roles.includes(role));
}

export const ROLE_LABEL: Record<UserRole, string> = {
  executive: "Executive",
  chapter_lead: "Chapter Lead",
  manager: "Manager",
  pm: "Project Manager",
  talent: "Talent",
  admin: "Administrator",
};
