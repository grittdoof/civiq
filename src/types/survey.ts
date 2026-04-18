// ═══════════════════════════════════════════════════
// CIVIQ — Types principaux
// ═══════════════════════════════════════════════════

// ─── Survey Schema (JSON stocké en base) ───

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "checkbox_grid"
  | "scale"
  | "date"
  | "number";

export interface FieldOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: string;
}

export interface SurveyField {
  id: string;
  type: FieldType;
  label: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  options?: FieldOption[];
  columns?: number; // pour checkbox_grid
  min?: number; // pour scale/number
  max?: number;
  min_label?: string;
  max_label?: string;
  conditional?: {
    field: string;
    value: string | string[];
  };
}

export interface SurveyStep {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  fields: SurveyField[];
}

export interface SurveySettings {
  allow_anonymous?: boolean;
  show_progress?: boolean;
  estimated_time?: string;
  require_email?: boolean;
  custom_css?: string;
  redirect_url?: string;
}

export interface SurveySchema {
  steps: SurveyStep[];
  settings: SurveySettings;
}

// ─── Database Models ───

export interface Commune {
  id: string;
  name: string;
  slug: string;
  code_postal?: string;
  departement?: string;
  logo_url?: string;
  primary_color: string;
  accent_color: string;
  contact_email?: string;
  website_url?: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Survey {
  id: string;
  commune_id: string;
  title: string;
  slug: string;
  description?: string;
  schema: SurveySchema;
  status: "draft" | "published" | "closed" | "archived";
  starts_at?: string;
  ends_at?: string;
  allow_anonymous: boolean;
  require_email: boolean;
  max_responses?: number;
  custom_header_text?: string;
  custom_thank_you?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  // Relations
  commune?: Commune;
  _count?: { responses: number };
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  commune_id: string;
  data: Record<string, unknown>;
  respondent_name?: string;
  respondent_email?: string;
  respondent_phone?: string;
  submitted_at: string;
  duration_seconds?: number;
}

export interface SurveyTemplate {
  id: string;
  title: string;
  description?: string;
  category?: string;
  schema: SurveySchema;
  is_public: boolean;
  commune_id?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  commune_id?: string;
  full_name?: string;
  role: "super_admin" | "admin" | "editor" | "viewer";
  avatar_url?: string;
  created_at: string;
}

// ─── Survey Stats ───

export interface SurveyStats {
  total_responses: number;
  first_response?: string;
  last_response?: string;
  avg_duration?: number;
}

export interface FieldAnalytics {
  field_id: string;
  field_label: string;
  type: FieldType;
  distribution: Record<string, number>;
  total_answers: number;
}
