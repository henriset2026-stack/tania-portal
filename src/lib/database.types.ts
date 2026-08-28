export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          category: Database["public"]["Enums"]["activity_category"]
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_billable: boolean
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["activity_category"]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_billable?: boolean
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["activity_category"]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_billable?: boolean
          name?: string
        }
        Relationships: []
      }
      allocations: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          percent: number
          period_month: string
          profile_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          percent: number
          period_month: string
          profile_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          percent?: number
          period_month?: string
          profile_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: number
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: never
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: never
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      budget_entries: {
        Row: {
          amount: number
          budget_line_id: string
          created_at: string
          created_by: string
          description: string | null
          entry_date: string
          entry_type: Database["public"]["Enums"]["budget_entry_type"]
          feasibility_case_id: string | null
          id: string
        }
        Insert: {
          amount: number
          budget_line_id: string
          created_at?: string
          created_by: string
          description?: string | null
          entry_date?: string
          entry_type: Database["public"]["Enums"]["budget_entry_type"]
          feasibility_case_id?: string | null
          id?: string
        }
        Update: {
          amount?: number
          budget_line_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["budget_entry_type"]
          feasibility_case_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_entries_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "budget_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_feasibility_case_id_fkey"
            columns: ["feasibility_case_id"]
            isOneToOne: false
            referencedRelation: "feasibility_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          category: string
          created_at: string
          description: string | null
          fiscal_year: number
          id: string
          owner_id: string | null
          plan_amount: number
          program: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          fiscal_year: number
          id?: string
          owner_id?: string | null
          plan_amount?: number
          program: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          fiscal_year?: number
          id?: string
          owner_id?: string | null
          plan_amount?: number
          program?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          input_tokens: number | null
          output_tokens: number | null
          role: Database["public"]["Enums"]["chat_role"]
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          role: Database["public"]["Enums"]["chat_role"]
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          role?: Database["public"]["Enums"]["chat_role"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      feasibility_cases: {
        Row: {
          created_at: string
          customer: string | null
          decided_at: string | null
          decided_by: string | null
          decision: Database["public"]["Enums"]["feasibility_decision"] | null
          decision_rationale: string | null
          description: string | null
          estimated_duration_mo: number | null
          estimated_effort_md: number | null
          estimated_revenue: number | null
          id: string
          project_id: string | null
          required_competencies: string[]
          score_financial: number | null
          score_resource: number | null
          score_risk: number | null
          score_strategic: number | null
          score_technical: number | null
          submitted_by: string
          title: string
          total_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["feasibility_decision"] | null
          decision_rationale?: string | null
          description?: string | null
          estimated_duration_mo?: number | null
          estimated_effort_md?: number | null
          estimated_revenue?: number | null
          id?: string
          project_id?: string | null
          required_competencies?: string[]
          score_financial?: number | null
          score_resource?: number | null
          score_risk?: number | null
          score_strategic?: number | null
          score_technical?: number | null
          submitted_by: string
          title: string
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["feasibility_decision"] | null
          decision_rationale?: string | null
          description?: string | null
          estimated_duration_mo?: number | null
          estimated_effort_md?: number | null
          estimated_revenue?: number | null
          id?: string
          project_id?: string | null
          required_competencies?: string[]
          score_financial?: number | null
          score_resource?: number | null
          score_risk?: number | null
          score_strategic?: number | null
          score_technical?: number | null
          submitted_by?: string
          title?: string
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feasibility_cases_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "feasibility_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "feasibility_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_cases_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills: {
        Row: {
          is_certified: boolean
          level: number
          profile_id: string
          skill_id: string
          updated_at: string
        }
        Insert: {
          is_certified?: boolean
          level: number
          profile_id: string
          skill_id: string
          updated_at?: string
        }
        Update: {
          is_certified?: boolean
          level?: number
          profile_id?: string
          skill_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          grade: string | null
          id: string
          is_active: boolean
          location: string | null
          manager_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          squad: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          grade?: string | null
          id: string
          is_active?: boolean
          location?: string | null
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          squad?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          grade?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          squad?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_issues: {
        Row: {
          action_plan: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          opened_at: string
          owner_id: string | null
          project_id: string
          resolution: string | null
          resolved_at: string | null
          root_cause: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opened_at?: string
          owner_id?: string | null
          project_id: string
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opened_at?: string
          owner_id?: string | null
          project_id?: string
          resolution?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          actual_finish: string | null
          actual_start: string | null
          created_at: string
          evidence_url: string | null
          id: string
          name: string
          notes: string | null
          pic_id: string | null
          planned_finish: string
          planned_start: string
          progress_pct: number
          project_id: string
          status: Database["public"]["Enums"]["milestone_status"]
          updated_at: string
          weight: number
        }
        Insert: {
          actual_finish?: string | null
          actual_start?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          name: string
          notes?: string | null
          pic_id?: string | null
          planned_finish: string
          planned_start: string
          progress_pct?: number
          project_id: string
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
          weight: number
        }
        Update: {
          actual_finish?: string | null
          actual_start?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          pic_id?: string | null
          planned_finish?: string
          planned_start?: string
          progress_pct?: number
          project_id?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risks: {
        Row: {
          category: string | null
          contingency: string | null
          created_at: string
          description: string
          id: string
          impact: Database["public"]["Enums"]["risk_level"]
          mitigation: string | null
          owner_id: string | null
          probability: Database["public"]["Enums"]["risk_level"]
          project_id: string
          risk_score: number | null
          status: Database["public"]["Enums"]["risk_status"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          contingency?: string | null
          created_at?: string
          description: string
          id?: string
          impact: Database["public"]["Enums"]["risk_level"]
          mitigation?: string | null
          owner_id?: string | null
          probability: Database["public"]["Enums"]["risk_level"]
          project_id: string
          risk_score?: number | null
          status?: Database["public"]["Enums"]["risk_status"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          contingency?: string | null
          created_at?: string
          description?: string
          id?: string
          impact?: Database["public"]["Enums"]["risk_level"]
          mitigation?: string | null
          owner_id?: string | null
          probability?: Database["public"]["Enums"]["risk_level"]
          project_id?: string
          risk_score?: number | null
          status?: Database["public"]["Enums"]["risk_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string
          contract_value: number | null
          created_at: string
          customer: string | null
          end_date: string | null
          health_budget: Database["public"]["Enums"]["rag"]
          health_budget_note: string | null
          health_customer: Database["public"]["Enums"]["rag"]
          health_customer_note: string | null
          health_scope: Database["public"]["Enums"]["rag"]
          health_scope_note: string | null
          id: string
          name: string
          pm_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          code: string
          contract_value?: number | null
          created_at?: string
          customer?: string | null
          end_date?: string | null
          health_budget?: Database["public"]["Enums"]["rag"]
          health_budget_note?: string | null
          health_customer?: Database["public"]["Enums"]["rag"]
          health_customer_note?: string | null
          health_scope?: Database["public"]["Enums"]["rag"]
          health_scope_note?: string | null
          id?: string
          name: string
          pm_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          contract_value?: number | null
          created_at?: string
          customer?: string | null
          end_date?: string | null
          health_budget?: Database["public"]["Enums"]["rag"]
          health_budget_note?: string | null
          health_customer?: Database["public"]["Enums"]["rag"]
          health_customer_note?: string | null
          health_scope?: Database["public"]["Enums"]["rag"]
          health_scope_note?: string | null
          id?: string
          name?: string
          pm_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          activity_id: string
          approval_note: string | null
          approved_by: string | null
          created_at: string
          hours: number
          id: string
          notes: string | null
          profile_id: string
          project_id: string
          status: Database["public"]["Enums"]["timesheet_status"]
          submitted_at: string | null
          updated_at: string
          work_date: string
        }
        Insert: {
          activity_id: string
          approval_note?: string | null
          approved_by?: string | null
          created_at?: string
          hours: number
          id?: string
          notes?: string | null
          profile_id: string
          project_id: string
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          updated_at?: string
          work_date: string
        }
        Update: {
          activity_id?: string
          approval_note?: string | null
          approved_by?: string | null
          created_at?: string
          hours?: number
          id?: string
          notes?: string | null
          profile_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      budget_summary: {
        Row: {
          category: string | null
          committed_amount: number | null
          description: string | null
          fiscal_year: number | null
          id: string | null
          plan_amount: number | null
          program: string | null
          realized_amount: number | null
          remaining_amount: number | null
        }
        Relationships: []
      }
      project_health: {
        Row: {
          actual_progress: number | null
          aged_critical: number | null
          ambers: number | null
          code: string | null
          contract_value: number | null
          customer: string | null
          health_budget: Database["public"]["Enums"]["rag"] | null
          health_customer: Database["public"]["Enums"]["rag"] | null
          health_risk: Database["public"]["Enums"]["rag"] | null
          health_schedule: Database["public"]["Enums"]["rag"] | null
          health_scope: Database["public"]["Enums"]["rag"] | null
          milestone_count: number | null
          name: string | null
          open_critical: number | null
          open_issues: number | null
          overall_health: Database["public"]["Enums"]["rag"] | null
          planned_progress: number | null
          project_id: string | null
          reds: number | null
          schedule_variance: number | null
          status: Database["public"]["Enums"]["project_status"] | null
          top_open_risk: number | null
          total_weight: number | null
        }
        Relationships: []
      }
      project_progress: {
        Row: {
          actual_progress: number | null
          milestone_count: number | null
          planned_progress: number | null
          project_id: string | null
          schedule_variance: number | null
          total_weight: number | null
        }
        Relationships: []
      }
      utilization_monthly: {
        Row: {
          approved_hours: number | null
          capacity_hours: number | null
          full_name: string | null
          period_month: string | null
          profile_id: string | null
          squad: string | null
          utilization_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_manager_of: { Args: { target: string }; Returns: boolean }
    }
    Enums: {
      activity_category:
        | "delivery"
        | "presales"
        | "internal"
        | "leave"
        | "training"
      budget_entry_type: "commitment" | "realization"
      chat_role: "user" | "assistant"
      feasibility_decision: "go" | "no_go" | "hold"
      issue_severity: "low" | "medium" | "high" | "critical"
      issue_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "blocked"
        | "resolved"
        | "closed"
      milestone_status:
        | "not_started"
        | "in_progress"
        | "completed"
        | "delayed"
        | "blocked"
        | "cancelled"
      project_status:
        | "candidate"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      rag: "green" | "amber" | "red"
      risk_level: "low" | "medium" | "high"
      risk_status:
        | "identified"
        | "assessed"
        | "mitigating"
        | "closed"
        | "materialized"
      timesheet_status: "draft" | "submitted" | "approved" | "rejected"
      user_role:
        | "executive"
        | "chapter_lead"
        | "manager"
        | "pm"
        | "talent"
        | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_category: [
        "delivery",
        "presales",
        "internal",
        "leave",
        "training",
      ],
      budget_entry_type: ["commitment", "realization"],
      chat_role: ["user", "assistant"],
      feasibility_decision: ["go", "no_go", "hold"],
      issue_severity: ["low", "medium", "high", "critical"],
      issue_status: [
        "open",
        "assigned",
        "in_progress",
        "blocked",
        "resolved",
        "closed",
      ],
      milestone_status: [
        "not_started",
        "in_progress",
        "completed",
        "delayed",
        "blocked",
        "cancelled",
      ],
      project_status: [
        "candidate",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      rag: ["green", "amber", "red"],
      risk_level: ["low", "medium", "high"],
      risk_status: [
        "identified",
        "assessed",
        "mitigating",
        "closed",
        "materialized",
      ],
      timesheet_status: ["draft", "submitted", "approved", "rejected"],
      user_role: [
        "executive",
        "chapter_lead",
        "manager",
        "pm",
        "talent",
        "admin",
      ],
    },
  },
} as const
