export type UUID = string;

export interface AssetSummary {
  id: UUID;
  company_id: UUID;
  property_id: UUID;
  asset_code: string;
  qr_token: UUID;
  name?: string | null;
  status: string;
  property_name?: string | null;
  block_name?: string | null;
  floor_name?: string | null;
  area_name?: string | null;
}

export interface EngineerAssignment {
  id: UUID;
  inspection_id: UUID;
  company_id: UUID;
  asset_id: UUID;
  property_id: UUID;
  scheduled_for?: string | null;
  status: string;
  asset?: AssetSummary | null;
}

export interface QuestionVM {
  id: UUID;
  code: string;
  prompt: string;
  help_text?: string | null;
  question_type:
    | "boolean"
    | "single_choice"
    | "multi_choice"
    | "number"
    | "text"
    | "date"
    | "photo"
    | "signature";
  unit?: string | null;
  options?: unknown[];
  is_required: boolean;
  evidence_required: boolean;
  min_photos: number;
  sort_order: number;
}

export interface SectionVM {
  id: UUID;
  code: string;
  title: string;
  instructions?: string | null;
  sort_order: number;
  questions: QuestionVM[];
}

export interface InspectionDraft {
  inspectionId: UUID;
  answers: Record<UUID, unknown>;
  evidence: Record<UUID, string[]>;
  signatureBlobId?: string | null;
  currentSectionIndex: number;
  updatedAt: string;
}
