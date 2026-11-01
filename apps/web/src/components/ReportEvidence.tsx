import { useEffect, useState } from "react";
import { evidenceUrl } from "../lib/completion";
import { supabase } from "../lib/supabase";
type Evidence = { id?: string; file_name?: string; storage_bucket?: string; storage_path?: string; captured_at?: string; caption?: string };
export default function ReportEvidence({ items, inspectionId, reportId }: { items: Evidence[]; inspectionId?: string; reportId?: string }) {
  const [rows, setRows] = useState<{ item: Evidence; url: string; error: string }[]>([]);
  useEffect(() => {
    let active = true;
    setRows([]);
    Promise.all(items.map(async item => {
      try {
        let bucket = item.storage_bucket, path = item.storage_path;
        // Older immutable snapshots stored the evidence ID but not its storage path.
        if ((!bucket || !path) && item.id && inspectionId && supabase) {
          if (!reportId) throw new Error("Report identity is missing.");
          const { data, error } = await supabase.rpc("orion_report_evidence_location", {p_report_id: reportId, p_evidence_id: item.id});
          if (error) throw error;
          bucket = data.storage_bucket; path = data.storage_path;
        }
        if (!bucket || !path || !["inspection-evidence", "completion-evidence"].includes(bucket)) throw new Error("Photo reference is unavailable.");
        return { item, url: await evidenceUrl(bucket, path), error: "" };
      } catch { return { item, url: "", error: "Photograph unavailable. Refresh and check access before issuing this report." }; }
    })).then(next => { if (active) setRows(next); });
    return () => { active = false; };
  }, [items, inspectionId, reportId]);
  return <div className="report-evidence-grid">{rows.map(({ item, url, error }, i) => <figure key={item.id || `${item.storage_path}-${i}`}>
    {url ? <img src={url} alt={item.caption || item.file_name || `Evidence ${i + 1}`} /> : <p role="alert">{error}</p>}
    <figcaption>{item.caption || item.file_name || `Evidence ${i + 1}`}{item.captured_at ? ` · ${new Date(item.captured_at).toLocaleString()}` : ""}</figcaption>
  </figure>)}</div>;
}
