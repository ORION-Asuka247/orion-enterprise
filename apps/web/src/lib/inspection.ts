import { supabase } from "./supabase";

export type InspectionItem = {
  id: string;
  item_code: string;
  section_name: string;
  prompt: string;
  help_text: string | null;
  rule_type: "numeric_range" | "choice" | "text";
  input_type: "number" | "choice" | "text";
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
  choices: string[];
  pass_values: string[];
  failure_severity: "low" | "medium" | "high" | "critical";
  photo_required_on_fail: boolean;
  notes_required_on_fail: boolean;
  suggested_action: string | null;
  display_order: number;
};

export type InspectionRun = {
  id: string;
  company_id: string;
  asset_id: string;
  template_id: string;
  status: "in_progress" | "submitted" | "cancelled";
  outcome: "pending" | "pass" | "fail";
  started_at: string;
  submitted_at: string | null;
  engineer_notes: string | null;
};

export type InspectionAnswerResult = {
  answer_id: string;
  result: "pass" | "fail" | "na";
  failure_reason: string | null;
  defect_id: string | null;
  photo_required_on_fail: boolean;
};

export type InspectionHistoryRow = {
  id: string;
  status: string;
  outcome: string;
  started_at: string;
  submitted_at: string | null;
  inspector_user_id: string;
};

function uniqueToken() {
  const c = window.crypto as Crypto & { randomUUID?: () => string };
  if (c && c.randomUUID) return c.randomUUID();
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

export async function startInspection(companyId: string, assetId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("orion_start_asset_inspection", {
    p_company_id: companyId,
    p_asset_id: assetId
  });

  if (error) throw error;
  return data as string;
}

export async function loadInspectionRun(inspectionId: string): Promise<InspectionRun> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("orion_inspection_runs")
    .select("id,company_id,asset_id,template_id,status,outcome,started_at,submitted_at,engineer_notes")
    .eq("id", inspectionId)
    .single();

  if (error) throw error;
  return data as InspectionRun;
}

export async function loadInspectionItems(templateId: string): Promise<InspectionItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orion_inspection_template_items")
    .select(`
      id,item_code,section_name,prompt,help_text,rule_type,input_type,
      min_value,max_value,unit,choices,pass_values,failure_severity,
      photo_required_on_fail,notes_required_on_fail,suggested_action,display_order
    `)
    .eq("template_id", templateId)
    .order("display_order");

  if (error) throw error;
  return (data ?? []) as unknown as InspectionItem[];
}

export async function loadInspectionAnswers(inspectionId: string) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orion_inspection_answers")
    .select("id,item_id,response_text,response_number,result,failure_reason,engineer_notes")
    .eq("inspection_id", inspectionId);

  if (error) throw error;
  return data ?? [];
}

export async function saveInspectionAnswer(input: {
  inspectionId: string;
  itemId: string;
  responseText?: string;
  responseNumber?: number | null;
  engineerNotes?: string;
}): Promise<InspectionAnswerResult> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("orion_save_inspection_answer", {
    p_inspection_id: input.inspectionId,
    p_item_id: input.itemId,
    p_response_text: input.responseText || null,
    p_response_number: input.responseNumber ?? null,
    p_engineer_notes: input.engineerNotes || null
  });

  if (error) throw error;
  return data as InspectionAnswerResult;
}

export async function uploadInspectionEvidence(input: {
  companyId: string;
  assetId: string;
  inspectionId: string;
  answerId: string;
  file: File;
}) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${input.companyId}/${input.inspectionId}/${uniqueToken()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("inspection-evidence")
    .upload(path, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || undefined
    });

  if (uploadError) {
    throw new Error(
      "Photo upload failed. Confirm the private Supabase Storage bucket named inspection-evidence exists and has authenticated upload policies. " +
      uploadError.message
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Authentication required.");

  const { data, error } = await supabase
    .from("orion_inspection_evidence")
    .insert({
      company_id: input.companyId,
      inspection_id: input.inspectionId,
      answer_id: input.answerId,
      asset_id: input.assetId,
      storage_bucket: "inspection-evidence",
      storage_path: path,
      file_name: input.file.name,
      mime_type: input.file.type || null,
      captured_by: user.id
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function submitInspection(inspectionId: string, engineerNotes?: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("orion_submit_inspection", {
    p_inspection_id: inspectionId,
    p_engineer_notes: engineerNotes || null
  });

  if (error) throw error;
  return data as { inspection_id: string; outcome: "pass" | "fail"; failed_items: number };
}

export async function loadNewInspectionHistory(companyId: string, assetId: string): Promise<InspectionHistoryRow[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orion_inspection_runs")
    .select("id,status,outcome,started_at,submitted_at,inspector_user_id")
    .eq("company_id", companyId)
    .eq("asset_id", assetId)
    .order("started_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InspectionHistoryRow[];
}

export async function loadNewInspectionDefects(companyId: string, assetId: string) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orion_inspection_defects")
    .select("id,defect_code,title,description,severity,status,suggested_action,created_at")
    .eq("company_id", companyId)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
