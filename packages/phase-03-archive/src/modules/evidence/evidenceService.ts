import { offlineDb } from "../../lib/offlineDb";
import { supabase } from "../../lib/supabase";

export async function storeEvidenceOffline(file: File) {
  const id = crypto.randomUUID();
  const db = await offlineDb;
  await db.put("blobs", {
    id,
    blob: file,
    name: file.name,
    type: file.type,
    createdAt: new Date().toISOString()
  });
  return id;
}

export async function uploadEvidence(params: {
  blobId: string;
  companyId: string;
  inspectionId: string;
  questionId?: string | null;
  evidenceType: "photo" | "video" | "document" | "signature" | "measurement" | "voice_note";
}) {
  const db = await offlineDb;
  const stored = await db.get("blobs", params.blobId);
  if (!stored) throw new Error("Evidence blob not found");

  const ext = stored.name?.split(".").pop() || "bin";
  const path = `${params.companyId}/${params.inspectionId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("inspection-evidence")
    .upload(path, stored.blob, {
      contentType: stored.type,
      upsert: false
    });

  if (uploadError) throw uploadError;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("inspection_evidence")
    .insert({
      company_id: params.companyId,
      inspection_id: params.inspectionId,
      question_id: params.questionId ?? null,
      evidence_type: params.evidenceType,
      storage_path: path,
      original_filename: stored.name,
      mime_type: stored.type,
      captured_at: stored.createdAt,
      captured_by: user?.id ?? null
    })
    .select()
    .single();

  if (error) throw error;
  await db.delete("blobs", params.blobId);
  return data;
}
