import { offlineDb } from "../../lib/offlineDb";
import { supabase } from "../../lib/supabase";
import { uploadEvidence } from "../evidence/evidenceService";

export type SyncJob =
  | {
      id?: number;
      kind: "answer";
      payload: {
        inspectionId: string;
        questionId: string;
        answer: unknown;
      };
      createdAt: string;
    }
  | {
      id?: number;
      kind: "evidence";
      payload: {
        blobId: string;
        companyId: string;
        inspectionId: string;
        questionId?: string | null;
        evidenceType: "photo" | "video" | "document" | "signature" | "measurement" | "voice_note";
      };
      createdAt: string;
    };

export async function enqueue(job: Omit<SyncJob, "id" | "createdAt">) {
  const db = await offlineDb;
  await db.add("syncQueue", {
    ...job,
    createdAt: new Date().toISOString()
  });
}

async function processAnswer(job: Extract<SyncJob, { kind: "answer" }>) {
  const { data: evaluation, error: evalError } = await supabase.rpc(
    "evaluate_question_answer",
    {
      p_question_id: job.payload.questionId,
      p_answer: job.payload.answer
    }
  );
  if (evalError) throw evalError;

  const outcome = evaluation?.pass
    ? "pass"
    : evaluation?.failure_outcome ?? "fail";

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: saved, error } = await supabase
    .from("inspection_answers")
    .upsert(
      {
        inspection_id: job.payload.inspectionId,
        question_id: job.payload.questionId,
        answer: job.payload.answer,
        outcome,
        evaluated_rule_version_id: evaluation?.rule_version_id ?? null,
        evaluation_detail: evaluation ?? {},
        answered_by: user?.id ?? null,
        answered_at: new Date().toISOString()
      },
      { onConflict: "inspection_id,question_id" }
    )
    .select()
    .single();

  if (error) throw error;

  if (outcome === "fail") {
    await supabase.rpc("create_defect_from_failed_answer", {
      p_answer_id: saved.id
    });
  }

  await supabase.rpc("recalculate_inspection_outcome", {
    p_inspection_id: job.payload.inspectionId
  });
}

export async function flushSyncQueue() {
  if (!navigator.onLine) return { processed: 0, remaining: await queueCount() };

  const db = await offlineDb;
  const jobs = (await db.getAll("syncQueue")) as SyncJob[];
  let processed = 0;

  for (const job of jobs) {
    try {
      if (job.kind === "answer") {
        await processAnswer(job);
      } else if (job.kind === "evidence") {
        await uploadEvidence(job.payload);
      }

      if (job.id != null) await db.delete("syncQueue", job.id);
      processed += 1;
    } catch {
      break;
    }
  }

  return { processed, remaining: await queueCount() };
}

export async function queueCount() {
  const db = await offlineDb;
  return (await db.getAllKeys("syncQueue")).length;
}
