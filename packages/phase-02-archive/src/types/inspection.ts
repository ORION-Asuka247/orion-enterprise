export type UUID = string;

export type TemplateStatus = "draft" | "in_review" | "approved" | "retired";
export type InspectionStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled";

export type InspectionOutcome =
  | "pass"
  | "fail"
  | "conditional"
  | "not_applicable"
  | "pending";

export type QuestionType =
  | "boolean"
  | "single_choice"
  | "multi_choice"
  | "number"
  | "text"
  | "date"
  | "photo"
  | "signature";

export type DefectSeverity = "low" | "medium" | "high" | "critical";

export interface InspectionTemplate {
  id: UUID;
  company_id?: UUID | null;
  code: string;
  name: string;
  compliance_domain_id?: UUID | null;
  asset_type_id?: UUID | null;
  description?: string | null;
  is_system: boolean;
}

export interface InspectionQuestion {
  id: UUID;
  section_id: UUID;
  code: string;
  prompt: string;
  help_text?: string | null;
  question_type: QuestionType;
  unit?: string | null;
  options: unknown[];
  is_required: boolean;
  evidence_required: boolean;
  min_photos: number;
  sort_order: number;
}

export interface Inspection {
  id: UUID;
  company_id: UUID;
  property_id: UUID;
  asset_id: UUID;
  template_id: UUID;
  template_version_id: UUID;
  status: InspectionStatus;
  outcome: InspectionOutcome;
  inspector_user_id?: UUID | null;
  rule_snapshot: Record<string, unknown>;
}

export interface InspectionAnswer {
  id: UUID;
  inspection_id: UUID;
  question_id: UUID;
  answer: unknown;
  outcome: InspectionOutcome;
  evaluated_rule_version_id?: UUID | null;
  evaluation_detail: Record<string, unknown>;
}

export interface RuleEvaluation {
  pass: boolean;
  rule_version_id?: UUID | null;
  failure_outcome?: InspectionOutcome;
  severity?: DefectSeverity | null;
  failure_message?: string | null;
}
