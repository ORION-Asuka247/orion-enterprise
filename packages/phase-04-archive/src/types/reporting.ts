export type UUID = string;

export type DocumentType =
  | "inspection_report"
  | "fraew_report"
  | "certificate"
  | "management_summary"
  | "quotation"
  | "work_order"
  | "completion_report";

export interface ReportBranding {
  organisationName: string;
  strapline?: string;
  logoDataUri?: string;
  accentHex?: string;
  footerText?: string;
  confidentialityText?: string;
  copyrightText?: string;
  contactLines?: string[];
}

export interface InspectionReportSnapshot {
  generated_at: string;
  inspection: {
    id: UUID;
    status: string;
    outcome: string;
    started_at?: string | null;
    submitted_at?: string | null;
    notes?: string | null;
    rule_snapshot: Record<string, unknown>;
  };
  property: {
    id: UUID;
    name: string;
    reference_code?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    town_city?: string | null;
    county?: string | null;
    postcode?: string | null;
  };
  asset: {
    id: UUID;
    asset_code: string;
    name?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serial_number?: string | null;
    status: string;
    block?: string | null;
    floor?: string | null;
    area?: string | null;
  };
  template: {
    template_id: UUID;
    template_code: string;
    template_name: string;
    template_version_id: UUID;
    template_version_no: number;
  };
  answers: Array<{
    section_code: string;
    section_title: string;
    question_id: UUID;
    question_code: string;
    prompt: string;
    question_type: string;
    unit?: string | null;
    answer: unknown;
    outcome: string;
    evaluation_detail: Record<string, unknown>;
  }>;
  defects: Array<{
    reference_code?: string | null;
    title: string;
    description?: string | null;
    severity: string;
    status: string;
    recommended_action?: string | null;
    target_date?: string | null;
  }>;
  evidence: Array<{
    id: UUID;
    question_id?: UUID | null;
    evidence_type: string;
    storage_path?: string | null;
    original_filename?: string | null;
    captured_at?: string | null;
    metadata: Record<string, unknown>;
  }>;
}

export interface FRAEWItem {
  fault: string;
  risk: string;
  action: string;
  evidence: string;
  who: string;
  severity?: string;
  reference?: string;
}
