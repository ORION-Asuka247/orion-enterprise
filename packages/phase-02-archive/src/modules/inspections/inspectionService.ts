import { supabase } from "../../lib/supabase";
import type { UUID, RuleEvaluation, InspectionOutcome } from "../../types/inspection";

export async function evaluateQuestionAnswer(
  questionId: UUID,
  answer: unknown,
): Promise<RuleEvaluation> {
  const { data, error } = await supabase.rpc("evaluate_question_answer", {
    p_question_id: questionId,
    p_answer: answer,
  });

  if (error) throw error;
  return data as RuleEvaluation;
}

export async function saveInspectionAnswer(params: {
  inspectionId: UUID;
  questionId: UUID;
  answer: unknown;
  outcome: InspectionOutcome;
  evaluatedRuleVersionId?: UUID | null;
  evaluationDetail?: Record<string, unknown>;
}) {
  const {
    inspectionId,
    questionId,
    answer,
    outcome,
    evaluatedRuleVersionId = null,
    evaluationDetail = {},
  } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Authentication required");

  const { data, error } = await supabase
    .from("inspection_answers")
    .upsert(
      {
        inspection_id: inspectionId,
        question_id: questionId,
        answer,
        outcome,
        evaluated_rule_version_id: evaluatedRuleVersionId,
        evaluation_detail: evaluationDetail,
        answered_by: user.id,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "inspection_id,question_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function validateInspectionSubmission(inspectionId: UUID) {
  const { data, error } = await supabase.rpc("validate_inspection_submission", {
    p_inspection_id: inspectionId,
  });

  if (error) throw error;
  return data as {
    valid: boolean;
    missing_required_answers: number;
    missing_required_evidence: number;
  };
}

export async function captureRuleSnapshot(inspectionId: UUID) {
  const { data, error } = await supabase.rpc("capture_inspection_rule_snapshot", {
    p_inspection_id: inspectionId,
  });

  if (error) throw error;
  return data;
}

export async function recalculateInspectionOutcome(inspectionId: UUID) {
  const { data, error } = await supabase.rpc("recalculate_inspection_outcome", {
    p_inspection_id: inspectionId,
  });

  if (error) throw error;
  return data as InspectionOutcome;
}

export async function createDefectFromFailedAnswer(answerId: UUID) {
  const { data, error } = await supabase.rpc("create_defect_from_failed_answer", {
    p_answer_id: answerId,
  });

  if (error) throw error;
  return data as UUID | null;
}
