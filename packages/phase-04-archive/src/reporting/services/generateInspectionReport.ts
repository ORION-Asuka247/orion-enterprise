import { supabaseAdmin } from "../supabaseAdmin";
import { renderHtmlToPdf } from "../renderers/playwrightRenderer";
import { renderInspectionReportHtml } from "../templates/inspectionReport";
import { sha256 } from "../hash";
import type { InspectionReportSnapshot, ReportBranding } from "../../types/reporting";

export async function generateInspectionReport(params: {
  inspectionId: string;
  companyId: string;
  documentId: string;
  documentNumber: string;
  templateVersionId: string;
  versionNo: number;
  branding: ReportBranding;
}) {
  const { data: snapshot, error: snapshotError } = await supabaseAdmin.rpc(
    "build_inspection_report_snapshot",
    { p_inspection_id: params.inspectionId }
  );
  if (snapshotError) throw snapshotError;

  const html = renderInspectionReportHtml(
    snapshot as InspectionReportSnapshot,
    params.branding,
    params.documentNumber,
    params.versionNo
  );

  const pdf = await renderHtmlToPdf(html);
  const hash = sha256(pdf);
  const path =
    `${params.companyId}/${params.documentId}/v${params.versionNo}-${hash.slice(0, 12)}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("generated-documents")
    .upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false
    });

  if (uploadError) throw uploadError;

  return {
    path,
    bytes: pdf.length,
    sha256: hash,
    sourceSnapshot: snapshot
  };
}
