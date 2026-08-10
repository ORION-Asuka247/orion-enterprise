import { supabase } from "./supabase";

export type ReportType = "inspection_report" | "fraew_report" | "certificate";

export type ReportRow = {
  id: string;
  inspection_id: string;
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
};

export type ReportVersion = {
  id: string;
  report_id: string;
  version_no: number;
  source_snapshot: any;
  generated_at: string;
  notes: string | null;
};

export type ReportEvidenceLink = {
  key: string;
  url: string | null;
  fileName: string;
  mimeType: string | null;
  capturedAt: string | null;
  itemCode: string | null;
};

export async function loadReports(companyId: string): Promise<ReportRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orion_reports")
    .select("id,inspection_id,document_number,report_type,title,status,current_version,created_at,updated_at,issued_at,orion_inspection_runs(asset_id,outcome,submitted_at,assets(asset_code,name))")
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

export async function generateReport(inspectionId: string, reportType: ReportType, notes?: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("orion_generate_report", {
    p_inspection_id: inspectionId,
    p_report_type: reportType,
    p_notes: notes || null
  });
  if (error) throw error;
  return data as string;
}

export async function loadReport(reportId: string): Promise<ReportRow> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("orion_reports")
    .select("id,inspection_id,document_number,report_type,title,status,current_version,created_at,updated_at,issued_at,orion_inspection_runs(asset_id,outcome,submitted_at,assets(asset_code,name))")
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

export async function createReportEvidenceLinks(evidence: any[]): Promise<ReportEvidenceLink[]> {
  if (!supabase || !Array.isArray(evidence) || evidence.length === 0) return [];

  return Promise.all(evidence.map(async (item: any, index: number) => {
    const bucket = item.storage_bucket || "inspection-evidence";
    const path = item.storage_path || "";
    let url: string | null = null;

    if (path) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (!error) url = data?.signedUrl || null;
    }

    return {
      key: item.id || path || String(index),
      url,
      fileName: item.file_name || `Evidence ${index + 1}`,
      mimeType: item.mime_type || null,
      capturedAt: item.captured_at || item.created_at || null,
      itemCode: item.item_code || null
    };
  }));
}

export async function issueReport(reportId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("orion_issue_report", { p_report_id: reportId });
  if (error) throw error;
}
