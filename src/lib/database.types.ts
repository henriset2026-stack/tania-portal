/**
 * PLACEHOLDER — not the generated file.
 *
 * AGENTS.md requires this file to come from:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 *
 * That cannot run until the repo is linked to a Supabase project. Until then
 * this hand-written stand-in mirrors supabase/migrations/ so the app type-checks.
 * Replace it wholesale — do not patch it — as soon as the project is linked,
 * then fix any resulting type errors.
 */

export type UserRole =
  | "executive"
  | "chapter_lead"
  | "manager"
  | "pm"
  | "talent"
  | "admin";

export type ProjectStatus =
  | "candidate"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ActivityCategory =
  | "delivery"
  | "presales"
  | "internal"
  | "leave"
  | "training";

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  squad: string | null;
  grade: string | null;
  location: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  customer: string | null;
  status: ProjectStatus;
  pm_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  code: string;
  name: string;
  category: ActivityCategory;
  is_billable: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  actor: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}
