import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { evidenceUrl, loadCompletions, reviewCompletion, submitCompletion, type CompletionSubmission } from "../lib/completion";
function Photo({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    evidenceUrl("completion-evidence", path).then(u => { if (active) setUrl(u); }).catch(() => { if (active) setError("Photo unavailable. Refresh to retry."); });
    return () => { active = false; };
  }, [path]);
  return <figure>{url ? <img src={url} alt={label} style={{ width: "100%", maxHeight: 280, objectFit: "contain" }} /> : <p>{error || "Loading photograph…"}</p>}<figcaption>{label}</figcaption></figure>;
}
export default function CompletionEvidence({ companyId, defectId }: { companyId: string; defectId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<CompletionSubmission[]>([]);
  const [notes, setNotes] = useState("");
  const [wide, setWide] = useState<File | null>(null);
  const [detail, setDetail] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  async function refresh() { setRows(await loadCompletions(defectId)); }
  useEffect(() => {
    setRows([]); setCanReview(false); setCanSubmit(false); setError("");
    refresh().catch(e => setError(e.message));
    if (supabase) {
      supabase.rpc("has_permission", { target_company: companyId, permission_code: "inspection.approve" }).then(({ data }) => setCanReview(data === true));
      supabase.rpc("has_permission", { target_company: companyId, permission_code: "defect.manage" }).then(({ data }) => setCanSubmit(data === true));
    }
  }, [companyId, defectId]);
  async function submit() {
    setBusy(true); setError("");
    try { await submitCompletion(companyId, defectId, notes, wide, detail); setNotes(""); setWide(null); setDetail(null); setFileKey(k => k + 1); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function review(row: CompletionSubmission, accept: boolean) {
    setBusy(true); setError("");
    try { await reviewCompletion(row.id, accept, reviewNotes[row.id] || ""); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="panel">
    <h3>Job completion &amp; evidence</h3>
    <p>Record work carried out, a wide view and a detail photograph. An authorised reviewer checks the submission before work can be resolved. Evidence review does not certify an asset or send a report.</p>
    {error && <div role="alert" className="warning">{error}</div>}
    {canSubmit && <>
      <label className="inspection-field">Work carried out and outstanding issues<textarea value={notes} maxLength={4000} onChange={e => setNotes(e.target.value)} /></label>
      <div className="grid two" key={fileKey}>
        <label className="inspection-field">Wide completion photograph<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setWide(e.target.files?.[0] || null)} /></label>
        <label className="inspection-field">Detail completion photograph<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setDetail(e.target.files?.[0] || null)} /></label>
      </div>
      <button type="button" disabled={busy || notes.trim().length < 10 || !wide || !detail} onClick={submit}>{busy ? "Saving…" : "Submit evidence for review"}</button>
    </>}
    {rows.map(row => <article className="panel" key={row.id}>
      <strong>{row.status === "pending" ? "AWAITING REVIEW" : row.status.toUpperCase()}</strong>
      <p>{row.notes}</p><small>Submitted {new Date(row.submitted_at).toLocaleString()}</small>
      <div className="grid two"><Photo path={row.wide_path} label="Wide completion view" /><Photo path={row.detail_path} label="Completion detail" /></div>
      {row.review_notes && <p><strong>Review:</strong> {row.review_notes}</p>}
      {row.status === "pending" && canReview && row.submitted_by !== user?.id && <>
        <label className="inspection-field">Review findings<textarea value={reviewNotes[row.id] || ""} maxLength={4000} onChange={e => setReviewNotes(n => ({ ...n, [row.id]: e.target.value }))} /></label>
        <div className="inspection-actions"><button disabled={busy || (reviewNotes[row.id] || "").trim().length < 10} onClick={() => review(row, true)}>Accept evidence</button><button disabled={busy || (reviewNotes[row.id] || "").trim().length < 10} className="secondary" onClick={() => review(row, false)}>Request corrected evidence</button></div>
      </>}
    </article>)}
  </section>;
}
