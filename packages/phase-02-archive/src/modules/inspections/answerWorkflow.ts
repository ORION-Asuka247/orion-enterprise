import type { UUID, InspectionOutcome } from "../../types/inspection";
import {
  evaluateQuestionAnswer,
  saveInspectionAnswer,
  createDefectFromFailedAnswer,
  recalculateInspectionOutcome,
} from "./inspectionService";

export async function answerInspectionQuestion(params: {
  inspectionId: UUID;
  questionId: UUID;
  answer: unknown;
}) {
  const evaluation = await evaluateQuestionAnswer(
    params.questionId,
    params.answer,
  );

  const outcome: InspectionOutcome = evaluation.pass
    ? "pass"
    : evaluation.failure_outcome ?? "fail";

  const saved = await saveInspectionAnswer({
    inspectionId: params.inspectionId,
    questionId: params.questionId,
    answer: params.answer,
    outcome,
    evaluatedRuleVersionId: evaluation.rule_version_id ?? null,
    evaluationDetail: evaluation,
  });

  let defectId: UUID | null = null;

  if (outcome === "fail") {
    defectId = await createDefectFromFailedAnswer(saved.id);
  }

  const inspectionOutcome = await recalculateInspectionOutcome(
    params.inspectionId,
  );

  return {
    answer: saved,
    evaluation,
    defectId,
    inspectionOutcome,
  };
}
