import { supabase } from "./supabase";

export type OrionDefectStatus = "open" | "assigned" | "in_progress" | "resolved" | "verified" | "closed" | "cancelled";
export type OrionDefectSeverity = "low" | "medium" | "high" | "critical";

export type OrionDefect = {
  id: string;
  company_id: string;
  asset_id: string;
  inspection_id: string;
  defect_code: string;
  title: string;
  description: string;
  severity: OrionDefectSeverity;
  status: OrionDefectStatus;
  suggested_action: string | null;
  assigned_to: string | null;
  target_date: string | null;
  remedial_notes: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  assets: { id: string; asset_code: string; name: string | null } | null;
};

export async function loadDefects(companyId: string): Promise<OrionDefect[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orion_inspection_defects")
    .select("id,company_id,asset_id,inspection_id,defect_code,title,description,severity,status,suggested_action,assigned_to,target_date,remedial_notes,resolution_notes,resolved_at,verified_at,created_at,updated_at,assets(id,asset_code,name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrionDefect[];
}

export async function updateDefect(input: {
  defectId: string;
  status?: OrionDefectStatus | null;
  assignedTo?: string | null;
  targetDate?: string | null;
  remedialNotes?: string | null;
  resolutionNotes?: string | null;
}): Promise<OrionDefect> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("orion_update_defect", {
    p_defect_id: input.defectId,
    p_status: input.status ?? null,
    p_assigned_to: input.assignedTo ?? null,
    p_target_date: input.targetDate ?? null,
    p_remedial_notes: input.remedialNotes ?? null,
    p_resolution_notes: input.resolutionNotes ?? null
  });
  if (error) throw error;
  return data as OrionDefect;
}
