import { useRef } from "react";
import type { QuestionVM } from "../assets/types";
import { storeEvidenceOffline } from "../evidence/evidenceService";

interface Props {
  question: QuestionVM;
  value: unknown;
  evidenceIds: string[];
  onAnswer(value: unknown): void;
  onEvidence(blobId: string): void;
}

export function QuestionField({
  question,
  value,
  evidenceIds,
  onAnswer,
  onEvidence
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const capture = async (file?: File) => {
    if (!file) return;
    const id = await storeEvidenceOffline(file);
    onEvidence(id);
  };

  return (
    <div className="question-card">
      <div className="question-title">
        {question.prompt}
        {question.is_required && <span className="required"> *</span>}
      </div>
      {question.help_text && <div className="help">{question.help_text}</div>}

      {question.question_type === "boolean" && (
        <div className="segmented">
          <button
            className={value === true ? "selected" : ""}
            onClick={() => onAnswer(true)}
            type="button"
          >
            Yes
          </button>
          <button
            className={value === false ? "selected" : ""}
            onClick={() => onAnswer(false)}
            type="button"
          >
            No
          </button>
        </div>
      )}

      {question.question_type === "number" && (
        <div className="number-input">
          <input
            type="number"
            inputMode="decimal"
            value={(value as string | number | undefined) ?? ""}
            onChange={(e) =>
              onAnswer(e.target.value === "" ? null : Number(e.target.value))
            }
          />
          {question.unit && <span>{question.unit}</span>}
        </div>
      )}

      {question.question_type === "text" && (
        <textarea
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
        />
      )}

      {question.question_type === "date" && (
        <input
          type="date"
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
        />
      )}

      {question.question_type === "single_choice" && (
        <select
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
        >
          <option value="">Select...</option>
          {(question.options ?? []).map((o: any) => {
            const opt = typeof o === "string" ? o : o?.label ?? o?.value ?? "";
            return <option key={opt} value={opt}>{opt}</option>;
          })}
        </select>
      )}

      {(question.evidence_required || question.question_type === "photo") && (
        <div className="evidence-block">
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => capture(e.target.files?.[0])}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => fileRef.current?.click()}
          >
            Take photograph
          </button>
          <span className="evidence-count">
            {evidenceIds.length} captured
          </span>
        </div>
      )}
    </div>
  );
}
