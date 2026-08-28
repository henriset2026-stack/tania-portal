/**
 * Stable aliases over the generated Supabase types.
 *
 * `database.types.ts` is produced by `supabase gen types typescript --linked`
 * and must never be hand-edited — regenerating would silently discard the
 * edits. This module is the hand-written layer on top of it, so application
 * code imports names that stay put while the generated file is replaced
 * wholesale.
 */
import type { Database } from "./database.types";

type Public = Database["public"];

export type Tables<T extends keyof Public["Tables"]> = Public["Tables"][T]["Row"];
export type Views<T extends keyof Public["Views"]> = Public["Views"][T]["Row"];
export type Enums<T extends keyof Public["Enums"]> = Public["Enums"][T];

/* ------------------------------------------------------------------ enums */

export type UserRole = Enums<"user_role">;
export type ProjectStatus = Enums<"project_status">;
export type ActivityCategory = Enums<"activity_category">;
export type TimesheetStatus = Enums<"timesheet_status">;
export type FeasibilityDecision = Enums<"feasibility_decision">;
export type BudgetEntryType = Enums<"budget_entry_type">;

/* ----------------------------------------------------------------- tables */

export type Profile = Tables<"profiles">;
export type Skill = Tables<"skills">;
export type ProfileSkill = Tables<"profile_skills">;
export type Project = Tables<"projects">;
export type Activity = Tables<"activities">;
export type Allocation = Tables<"allocations">;
export type Timesheet = Tables<"timesheets">;
export type FeasibilityCase = Tables<"feasibility_cases">;
export type BudgetLine = Tables<"budget_lines">;
export type BudgetEntry = Tables<"budget_entries">;
export type AuditLogRow = Tables<"audit_log">;

/* ------------------------------------------------- project control (M8) */

export type Rag = Enums<"rag">;
export type MilestoneStatus = Enums<"milestone_status">;
export type RiskLevel = Enums<"risk_level">;
export type RiskStatus = Enums<"risk_status">;
export type IssueSeverity = Enums<"issue_severity">;
export type IssueStatus = Enums<"issue_status">;

export type Milestone = Tables<"project_milestones">;
export type ProjectRisk = Tables<"project_risks">;
export type ProjectIssue = Tables<"project_issues">;

/* ------------------------------------------------- talent journey (TM-05) */

export type DevGoalStatus = Enums<"dev_goal_status">;
export type DevelopmentGoal = Tables<"development_goals">;

/* ------------------------------------------------------------------ views */

/**
 * Every column of both views is nullable in the generated types, because
 * PostgreSQL cannot promise non-null through an outer join or an aggregate.
 * That is not a modelling mistake to paper over: `utilization_monthly`
 * genuinely returns NULL `approved_hours` for someone whose rows are all
 * still draft (SRS SF-1.5), so the app must handle it.
 */
export type UtilizationRow = Views<"utilization_monthly">;
export type BudgetSummaryRow = Views<"budget_summary">;
export type ProjectHealthRow = Views<"project_health">;
export type ProjectProgressRow = Views<"project_progress">;
export type TalentPerformanceRow = Views<"talent_performance">;
export type TalentDeliveryRow = Views<"talent_delivery">;
