import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Page from "../components/Page";
import { loadAssetDetail, type AssetDetailRecord } from "../lib/assets";
import {
  loadInspectionAnswers,
  loadInspectionItems,
  loadInspectionRun,
  saveInspectionAnswer,
  startInspection,
  submitInspection,
  uploadInspectionEvidence,
  type InspectionAnswerResult,
  type InspectionItem,
  type InspectionRun
} from "../lib/inspection";
import { useTenant } from "../lib/tenant";

type Draft = {
  responseText: string;
  responseNumber: string;
  notes: string;
  result?: "pass" | "fail" | "na";
  failureReason?: string | null;
  answerId?: string;
  photoRequired?: boolean;
  photoUploaded?: boolean;
  file?: File | null;
};

export default function AssetInspection() {
  const { assetId, inspectionId } = useParams();
  const { activeTenant } = useTenant();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<AssetDetailRecord | null>(null);
  const [run, setRun] = useState<InspectionRun | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalNotes, setFinalNotes] = useState("");

  async function initialise() {
    if (!activeTenant || !assetId) return;

    setError("");

    try {
      const a = await loadAssetDetail(activeTenant.id, assetId);
      setAsset(a);

      if (!inspectionId) return;

      const r = await loadInspectionRun(inspectionId);

      if (r.asset_id !== assetId || r.company_id !== activeTenant.id) {
        throw new Error("Inspection does not belong to this asset.");
      }

      setRun(r);

      const [questionRows, answerRows] = await Promise.all([
        loadInspectionItems(r.template_id),
        loadInspectionAnswers(r.id)
      ]);

      setItems(questionRows);

      const seeded: Record<string, Draft> = {};
      for (const answer of answerRows as any[]) {
        seeded[answer.item_id] = {
          responseText: answer.response_text || "",
          responseNumber: answer.response_number == null ? "" : String(answer.response_number),
          notes: answer.engineer_notes || "",
          result: answer.result,
          failureReason: answer.failure_reason,
          answerId: answer.id
        };
      }

      setDrafts(seeded);
    } catch (e: any) {
      setError(e?.message || "Unable to load inspection.");
    }
  }

  useEffect(() => {
    initialise();
  }, [activeTenant, assetId, inspectionId]);

  async function begin() {
    if (!activeTenant || !assetId) return;

    setStarting(true);
    setError("");

    try {
      const id = await startInspection(activeTenant.id, assetId);
      navigate(`/assets/${assetId}/inspect/${id}`, { replace: true });
    } catch (e: any) {
      setError(e?.message || "Unable to start inspection.");
    } finally {
      setStarting(false);
    }
  }

  function setDraft(itemId: string, patch: Partial<Draft>) {
    setDrafts(current => ({
      ...current,
      [itemId]: {
        responseText: "",
        responseNumber: "",
        notes: "",
        ...(current[itemId] || {}),
        ...patch
      }
    }));
  }

  async function save(item: InspectionItem) {
    if (!run || !asset) return;

    const draft = drafts[item.id] || {
      responseText: "",
      responseNumber: "",
      notes: ""
    };

    setBusyItem(item.id);
    setError("");

    try {
      const result: InspectionAnswerResult = await saveInspectionAnswer({
        inspectionId: run.id,
        itemId: item.id,
        responseText: draft.responseText,
        responseNumber:
          item.input_type === "number" && draft.responseNumber !== ""
            ? Number(draft.responseNumber)
            : null,
        engineerNotes: draft.notes
      });

      let photoUploaded = draft.photoUploaded || false;

      if (
        result.result === "fail" &&
        result.photo_required_on_fail &&
        draft.file
      ) {
        await uploadInspectionEvidence({
          companyId: run.company_id,
          assetId: run.asset_id,
          inspectionId: run.id,
          answerId: result.answer_id,
          file: draft.file
        });
        photoUploaded = true;
      }

      setDraft(item.id, {
        result: result.result,
        failureReason: result.failure_reason,
        answerId: result.answer_id,
        photoRequired: result.photo_required_on_fail && result.result === "fail",
        photoUploaded,
        file: draft.file || null
      });
    } catch (e: any) {
      setError(e?.message || "Unable to save this inspection item.");
    } finally {
      setBusyItem("");
    }
  }

  async function finish() {
    if (!run || !asset) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await submitInspection(run.id, finalNotes);
      navigate(`/assets/${asset.id}?inspection=${run.id}&outcome=${result.outcome}`, {
        replace: true
      });
    } catch (e: any) {
      setError(e?.message || "Unable to submit inspection.");
    } finally {
      setSubmitting(false);
    }
  }

  const completed = useMemo(
    () => items.filter(item => drafts[item.id]?.result).length,
    [items, drafts]
  );

  const failures = useMemo(
    () => items.filter(item => drafts[item.id]?.result === "fail").length,
    [items, drafts]
  );

  if (!asset) {
    return (
      <Page title="Inspection" kicker="GUIDED WORKFLOW">
        {error ? <div className="warning">{error}</div> : <div className="panel">Loading asset...</div>}
      </Page>
    );
  }

  if (!inspectionId || !run) {
    return (
      <Page title="Start inspection" kicker="CONTROLLED WORKFLOW">
        <div className="page-toolbar">
          <div>
            <p className="muted">{asset.asset_code} - {asset.name || asset.asset_types?.name}</p>
          </div>
          <Link className="button-link secondary-link" to={`/assets/${asset.id}`}>Cancel</Link>
        </div>

        {error && <div className="warning">{error}</div>}

        <section className="panel inspection-start-card">
          <div className="eyebrow">ASSET TYPE</div>
          <h2>{asset.asset_types?.name || "Asset inspection"}</h2>
          <p>
            ORION will load the controlled inspection template for this asset type.
            Responses are evaluated immediately and failed controlled items can create defects automatically.
          </p>
          <button onClick={begin} disabled={starting}>
            {starting ? "Starting..." : "Begin inspection"}
          </button>
        </section>
      </Page>
    );
  }

  return (
    <Page title={`Inspect ${asset.asset_code}`} kicker="GUIDED INSPECTION">
      <div className="inspection-progress panel">
        <div>
          <span>Progress</span>
          <strong>{completed} / {items.length}</strong>
        </div>
        <div>
          <span>Failures</span>
          <strong>{failures}</strong>
        </div>
        <div className="progress-bar">
          <i style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      {error && <div className="warning inspection-error">{error}</div>}

      <div className="inspection-question-list">
        {items.map((item, index) => {
          const draft = drafts[item.id] || {
            responseText: "",
            responseNumber: "",
            notes: ""
          };

          return (
            <section
              className={`panel inspection-question ${draft.result ? `inspection-${draft.result}` : ""}`}
              key={item.id}
            >
              <div className="inspection-question-header">
                <div>
                  <div className="eyebrow">{item.section_name}</div>
                  <h2>{index + 1}. {item.prompt}</h2>
                  {item.help_text && <p>{item.help_text}</p>}
                </div>
                {draft.result && (
                  <span className={`inspection-result result-${draft.result}`}>
                    {draft.result.toUpperCase()}
                  </span>
                )}
              </div>

              {item.input_type === "number" && (
                <label className="inspection-field">
                  Measurement {item.unit ? `(${item.unit})` : ""}
                  <input
                    type="number"
                    step="0.1"
                    value={draft.responseNumber}
                    onChange={e => setDraft(item.id, { responseNumber: e.target.value })}
                  />
                  {item.min_value != null && item.max_value != null && (
                    <small>Controlled pass range: {item.min_value}-{item.max_value} {item.unit}</small>
                  )}
                </label>
              )}

              {item.input_type === "choice" && (
                <div className="inspection-choice-grid">
                  {(item.choices || []).map(choice => (
                    <button
                      type="button"
                      key={choice}
                      className={draft.responseText === choice ? "choice-selected" : "secondary"}
                      onClick={() => setDraft(item.id, { responseText: choice })}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {item.input_type === "text" && (
                <label className="inspection-field">
                  Response
                  <textarea
                    value={draft.responseText}
                    onChange={e => setDraft(item.id, { responseText: e.target.value })}
                  />
                </label>
              )}

              <label className="inspection-field">
                Engineer observations
                <textarea
                  value={draft.notes}
                  onChange={e => setDraft(item.id, { notes: e.target.value })}
                  placeholder="Required where a controlled item fails."
                />
              </label>

              {(item.photo_required_on_fail || draft.photoRequired) && (
                <label className="inspection-field">
                  Photographic evidence
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setDraft(item.id, { file: e.target.files?.[0] || null })
                    }
                  />
                  <small>
                    Required if this item fails. On a phone this can open the camera directly.
                  </small>
                </label>
              )}

              {draft.failureReason && (
                <div className="failure-reason">
                  <strong>Why ORION failed this item</strong>
                  <p>{draft.failureReason}</p>
                  {item.suggested_action && (
                    <>
                      <strong>Suggested action</strong>
                      <p>{item.suggested_action}</p>
                    </>
                  )}
                </div>
              )}

              {draft.photoRequired && !draft.photoUploaded && draft.result === "fail" && (
                <div className="evidence-alert">
                  Photograph required before this inspection can be submitted.
                </div>
              )}

              {draft.photoUploaded && (
                <div className="evidence-confirmed">Photographic evidence recorded.</div>
              )}

              <div className="inspection-actions">
                <button
                  type="button"
                  onClick={() => save(item)}
                  disabled={busyItem === item.id}
                >
                  {busyItem === item.id ? "Saving..." : draft.result ? "Update response" : "Save response"}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <section className="panel inspection-submit">
        <h2>Engineer sign-off</h2>
        <p>
          Review all responses before submission. Once submitted, the inspection outcome is stored against the asset.
        </p>
        <label className="inspection-field">
          Final inspection notes
          <textarea
            value={finalNotes}
            onChange={e => setFinalNotes(e.target.value)}
            placeholder="Overall observations, access limitations or follow-up requirements."
          />
        </label>
        <button disabled={submitting || completed !== items.length} onClick={finish}>
          {submitting ? "Submitting..." : "Submit inspection"}
        </button>
        {completed !== items.length && (
          <small>Complete all {items.length} controlled items before submission.</small>
        )}
      </section>
    </Page>
  );
}
