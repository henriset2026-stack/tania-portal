import type { UserRole } from "./db";

export interface NavItem {
  href: string;
  label: string;
  /** Roles that see the menu entry — mirrors UIUX.md §3 and PRD.md §8. */
  roles: readonly UserRole[];
  /** Not yet built; rendered disabled so the shape of the portal is visible. */
  planned?: boolean;
}

const ALL: readonly UserRole[] = [
  "executive",
  "chapter_lead",
  "manager",
  "pm",
  "talent",
  "admin",
];

export const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ALL },
  { href: "/timesheet", label: "Timesheet", roles: ALL },
  {
    href: "/timesheet/approval",
    label: "Approval",
    roles: ["chapter_lead", "manager", "admin"],
  },
  { href: "/talent", label: "Talent", roles: ALL },
  {
    href: "/workload",
    label: "Workload",
    roles: ["executive", "chapter_lead", "manager", "pm", "admin"],
  },
  { href: "/feasibility", label: "Feasibility", roles: ALL },
  {
    // `talent` has no access to budget data at all (AGENTS.md security rule 5).
    href: "/budget",
    label: "Budget",
    roles: ["executive", "chapter_lead", "manager", "pm", "admin"],
  },
  { href: "/admin", label: "Admin", roles: ["admin"] },
];

export function navFor(role: UserRole | null): NavItem[] {
  if (!role) return [];
  return NAV.filter((item) => item.roles.includes(role));
}
