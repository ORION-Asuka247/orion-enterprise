import { supabase } from "./supabase";
export type CompletionSubmission = {
  id: string; defect_id: string; asset_id: string; notes: string; wide_path: string; detail_path: string;
  submitted_by: string; submitted_at: string; status: "pending" | "accepted" | "rejected";
  reviewed_by: string | null; reviewed_at: string | null; review_notes: string | null;
};
export { validateCompletion } from "./completionRules";
import { validateCompletion } from "./completionRules";
export async function loadCompletions(defectId: string): Promise<CompletionSubmission[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("orion_completion_submissions").select("*")
    .eq("defect_id", defectId).order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function submitCompletion(companyId: string, defectId: string, notes: string, wide: File | null, detail: File | null) {
  validateCompletion(notes, [wide, detail]);
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  const paths: string[] = [];
  for (const [i, file] of [wide!, detail!].entries()) {
    const path = `${companyId}/${user.id}/${defectId}/${crypto.randomUUID()}-${i}.${file.type.split('/')[1]}`;
    const { error } = await supabase.storage.from("completion-evidence").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}. Please retry; work status has not changed.`);
    paths.push(path);
  }
  const { error } = await supabase.rpc("orion_submit_completion", {
    p_defect_id: defectId, p_notes: notes.trim(), p_wide_path: paths[0], p_detail_path: paths[1]
  });
  if (error) throw error;
}
export async function reviewCompletion(id: string, accept: boolean, notes: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("orion_review_completion", { p_submission_id: id, p_accept: accept, p_notes: notes.trim() });
  if (error) throw error;
}
export async function evidenceUrl(bucket: string, path: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 900);
  if (error) throw error;
  return data.signedUrl;
}
