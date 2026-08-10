import { supabase } from "./supabase";

export type ReportType = "inspection_report" | "fraew_report" | "certificate" | "property_fire_door_report";

export type ReportRow = {
  id: string;
  inspection_id: string | null;
  property_id?: string | null;
  document_number: string;
  report_type: ReportType;
  title: string;
  status: "draft" | "generated" | "issued" | "superseded" | "withdrawn";
  current_version: number;
  created_at: string;
  updated_at: string;
  issued_at: string | null;
  orion_inspection_runs?: {
    asset_id: string;
    outcome: string;
    submitted_at: string | null;
    assets?: { asset_code: string; name: string | null } | null;
  } | null;
  properties?: { name: string; postcode: string | null } | null;
};

export type ReportVersion = {
  id: string;
  report_id: string;
  version_no: number;
  source_snapshot: any;
  generated_at: string;
  notes: string | null;
};

export type FireDoorReportProperty = {
  id: string;
  name: string;
  postcode: string | null;
};

export async function loadReports(companyId: string): Promise<ReportRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orion_reports")
    .select("id,inspection_id,property_id,document_number,report_type,title,status,current_version,created_at,updated_at,issued_at,orion_inspection_runs(asset_id,outcome,submitted_at,assets(asset_code,name)),properties(name,postcode)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReportRow[];
}

export async function loadSubmittedInspections(companyId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orion_inspection_runs")
    .select("id,asset_id,outcome,submitted_at,assets(asset_code,name),orion_inspection_templates(name,version)")
    .eq("company_id", companyId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadFireDoorReportProperties(companyId: string): Promise<FireDoorReportProperty[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("properties")
    .select("id,name,postcode")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as FireDoorReportProperty[];
}

export async function generateReport(inspectionId: string, reportType: Exclude<ReportType, "property_fire_door_report">, notes?: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("orion_generate_report", {
    p_inspection_id: inspectionId,
    p_report_type: reportType,
    p_notes: notes || null
  });
  if (error) throw error;
  return data as string;
}

export async function generatePropertyFireDoorReport(propertyId: string, notes?: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("orion_generate_property_fire_door_report", {
    p_property_id: propertyId,
    p_notes: notes || null
  });
  if (error) throw error;
  return data as string;
}

export async function loadReport(reportId: string): Promise<ReportRow> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("orion_reports")
    .select("id,inspection_id,property_id,document_number,report_type,title,status,current_version,created_at,updated_at,issued_at,orion_inspection_runs(asset_id,outcome,submitted_at,assets(asset_code,name)),properties(name,postcode)")
    .eq("id", reportId)
    .single();
  if (error) throw error;
  return data as unknown as ReportRow;
}

export async function loadReportVersions(reportId: string): Promise<ReportVersion[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orion_report_versions")
    .select("id,report_id,version_no,source_snapshot,generated_at,notes")
    .eq("report_id", reportId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReportVersion[];
}

export async function issueReport(reportId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("orion_issue_report", { p_report_id: reportId });
  if (error) throw error;
}
