import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Page from "../components/Page";
import { issueReport, loadReport, loadReportVersions, type ReportRow, type ReportVersion } from "../lib/reports";

function value(v: unknown) {
  return v == null || v === "" ? "—" : String(v);
}

function propertyFireDoorReport(report: ReportRow, selected: ReportVersion) {
  const s = selected.source_snapshot || {};
  const property = s.property || {};
  const summary = s.summary || {};
  const actionSummary = Array.isArray(s.action_summary) ? s.action_summary : [];
  const doors = Array.isArray(s.doors) ? s.doors : [];

  return (
    <article className="panel report-sheet">
      <div className="eyebrow">ASUKA247 · ORION ENTERPRISE</div>
      <h1>{report.title}</h1>
      <p><strong>Document:</strong> {report.document_number} &nbsp; <strong>Version:</strong> {selected.version_no} &nbsp; <strong>Status:</strong> {report.status}</p>
      <hr />

      <h2>Executive summary</h2>
      <p>This controlled report consolidates the submitted fire-door inspection records for <strong>{value(property.name)}</strong>. The source snapshot is immutable and was captured at {new Date(selected.generated_at).toLocaleString()}.</p>
      <div className="inspection-progress">
        <div><span>Doors</span><strong>{value(summary.assets)}</strong></div>
        <div><span>Passed</span><strong>{value(summary.passed)}</strong></div>
        <div><span>Failed</span><strong>{value(summary.failed)}</strong></div>
        <div><span>Manual review</span><strong>{value(summary.manual_review)}</strong></div>
      </div>

      <h2>Property</h2>
      <p><strong>{value(property.name)}</strong><br />{value(property.address_line1)} {value(property.address_line2)}<br />{value(property.town_city)} {value(property.county)} {value(property.postcode)}</p>

      <h2>Programme findings</h2>
      <p><strong>{value(summary.inspected)}</strong> submitted inspection records are represented. <strong>{value(summary.remedial_packages)}</strong> door-level remedial packages were identified from active defects. Any package marked manual review is withheld from automatic technical or commercial completion until clarified by a competent person.</p>

      <h2>Consolidated remedial action summary</h2>
      {actionSummary.length === 0 ? <p>No deterministic remedial actions were identified.</p> : (
        <div className="inspection-question-list">
          {actionSummary.map((a: any) => (
            <section className="panel inspection-question" key={a.code}>
              <div className="inspection-question-header">
                <div><div className="eyebrow">{value(a.code)}</div><h3>{value(a.label)}</h3></div>
                <span className="inspection-result result-na">{value(a.count)}</span>
              </div>
            </section>
          ))}
        </div>
      )}

      <h2>Door schedule and remedial register</h2>
      <div className="inspection-question-list">
        {doors.map((door: any) => {
          const defects = Array.isArray(door.defects) ? door.defects : [];
          const actions = Array.isArray(door.actions) ? door.actions : [];
          const failed = String(door.outcome || "").toLowerCase() === "fail";
          return (
            <section className={`panel inspection-question ${failed ? "inspection-fail" : "inspection-pass"}`} key={door.asset_id}>
              <div className="inspection-question-header">
                <div>
                  <div className="eyebrow">{value(door.door_id)} · {value(door.wing)} · FLOOR {value(door.floor)}</div>
                  <h3>{value(door.name)}</h3>
                </div>
                <span className={`inspection-result ${failed ? "result-fail" : "result-pass"}`}>{value(door.outcome).toUpperCase()}</span>
              </div>
              {defects.length > 0 && (
                <div>
                  <strong>Recorded finding</strong>
                  {defects.map((d: any, i: number) => <p key={`${door.asset_id}-defect-${i}`}>{value(d.description)}</p>)}
                </div>
              )}
              {actions.length > 0 && (
                <div className="failure-reason">
                  <strong>Consolidated remedial package</strong>
                  <ol>{actions.map((a: any) => <li key={`${door.asset_id}-${a.code}`}>{value(a.label)}</li>)}</ol>
                </div>
              )}
              {door.requires_review && <div className="warning"><strong>Manual technical review required.</strong> Source wording does not support an automatic remedial instruction.</div>}
            </section>
          );
        })}
      </div>

      <h2>F.R.A.E.W. management summary</h2>
      <p><strong>Fault:</strong> Failed door records and their source observations are retained in the controlled schedule above.</p>
      <p><strong>Risk:</strong> Failed fire-door components or dimensional conditions may impair the intended fire and/or smoke-resisting performance and require competent review/remediation.</p>
      <p><strong>Action:</strong> Deterministic remedial actions are consolidated per door; unclear findings remain flagged for manual review rather than being guessed.</p>
      <p><strong>Evidence:</strong> The report is generated from the immutable ORION property snapshot linked to the underlying submitted inspections and defect records.</p>
      <p><strong>Who:</strong> Remedial responsibility, assignment and completion are controlled through the ORION works/defect lifecycle.</p>

      <hr />
      <small>Controlled document generated by ORION Enterprise. Internal ASUKA247 commercial rates and margin calculations are excluded from this client report. Alterations require generation of a new controlled version. © ASUKA247 Ltd.</small>
    </article>
  );
}

export default function ReportDetail() {
  const { reportId } = useParams();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [selected, setSelected] = useState<ReportVersion | null>(null);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(false);

  async function load() {
    if (!reportId) return;
    setError("");
    try {
      const [r, v] = await Promise.all([loadReport(reportId), loadReportVersions(reportId)]);
      setReport(r);
      setVersions(v);
      setSelected(v[0] || null);
    } catch (e: any) {
      setError(e?.message || "Unable to load report.");
    }
  }

  useEffect(() => { load(); }, [reportId]);

  async function markIssued() {
    if (!report) return;
    setIssuing(true);
    try {
      await issueReport(report.id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Unable to issue report.");
    } finally {
      setIssuing(false);
    }
  }

  if (!report || !selected) {
    return <Page title="Controlled report" kicker="DOCUMENT CONTROL">{error ? <div className="warning">{error}</div> : <div className="panel">Loading report...</div>}</Page>;
  }

  const s = selected.source_snapshot || {};
  const asset = s.asset || {};
  const property = s.property || {};
  const inspection = s.inspection || {};
  const template = s.template || {};
  const answers = Array.isArray(s.answers) ? s.answers : [];
  const defects = Array.isArray(s.defects) ? s.defects : [];
  const evidence = Array.isArray(s.evidence) ? s.evidence : [];

  return (
    <Page title={report.title} kicker="CONTROLLED REPORT">
      <div className="page-toolbar no-print">
        <div>
          <div className="eyebrow">{report.document_number} · Version {selected.version_no}</div>
          <p className="muted">Status: {report.status.toUpperCase()}</p>
        </div>
        <div className="inspection-actions">
          <Link className="button-link secondary-link" to="/reports">Back to reports</Link>
          {report.status !== "issued" && <button onClick={markIssued} disabled={issuing}>{issuing ? "Issuing..." : "Mark issued"}</button>}
          <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>
      {error && <div className="warning">{error}</div>}

      {report.report_type === "property_fire_door_report" ? propertyFireDoorReport(report, selected) : (
        <article className="panel report-sheet">
          <div className="eyebrow">ASUKA247 · ORION ENTERPRISE</div>
          <h1>{report.title}</h1>
          <p><strong>Document:</strong> {report.document_number} &nbsp; <strong>Version:</strong> {selected.version_no} &nbsp; <strong>Status:</strong> {report.status}</p>
          <hr />
          <h2>Executive summary</h2>
          <p>Controlled inspection outcome: <strong>{value(inspection.outcome).toUpperCase()}</strong>. This report is generated from the immutable ORION inspection snapshot recorded at {new Date(selected.generated_at).toLocaleString()}.</p>

          <h2>Property and asset</h2>
          <p><strong>Property:</strong> {value(property.name)} · {value(property.address_line1)} {value(property.town_city)} {value(property.postcode)}</p>
          <p><strong>Asset:</strong> {value(asset.asset_code)} · {value(asset.name)} · {value(asset.block)} / {value(asset.floor)} / {value(asset.area)}</p>
          <p><strong>Manufacturer / model:</strong> {value(asset.manufacturer)} / {value(asset.model)} &nbsp; <strong>Serial:</strong> {value(asset.serial_number)}</p>

          <h2>Inspection control</h2>
          <p><strong>Template:</strong> {value(template.name)} ({value(template.code)}) v{value(template.version)}</p>
          <p><strong>Started:</strong> {inspection.started_at ? new Date(inspection.started_at).toLocaleString() : "—"} &nbsp; <strong>Submitted:</strong> {inspection.submitted_at ? new Date(inspection.submitted_at).toLocaleString() : "—"}</p>
          {inspection.engineer_notes && <p><strong>Engineer sign-off:</strong> {inspection.engineer_notes}</p>}

          <h2>Inspection findings</h2>
          <div className="inspection-question-list">
            {answers.map((a: any, i: number) => (
              <section key={`${a.item_code}-${i}`} className={`panel inspection-question inspection-${a.result || "na"}`}>
                <div className="eyebrow">{value(a.section_name)} · {value(a.item_code)}</div>
                <h3>{value(a.prompt)}</h3>
                <p><strong>Recorded:</strong> {a.response_number != null ? `${a.response_number} ${value(a.unit)}` : value(a.response_text)} &nbsp; <strong>Result:</strong> {value(a.result).toUpperCase()}</p>
                {a.failure_reason && <p><strong>Failure reason:</strong> {a.failure_reason}</p>}
                {a.engineer_notes && <p><strong>Engineer observations:</strong> {a.engineer_notes}</p>}
                {a.suggested_action && a.result === "fail" && <p><strong>Recommended action:</strong> {a.suggested_action}</p>}
              </section>
            ))}
          </div>

          <h2>Defects and remedial actions</h2>
          {defects.length === 0 ? <p>No defects recorded against this inspection.</p> : defects.map((d: any, i: number) => (
            <p key={`${d.defect_code}-${i}`}><strong>{value(d.defect_code)} · {value(d.severity).toUpperCase()}</strong> — {value(d.title)}. {value(d.description)} {d.suggested_action ? ` Recommended action: ${d.suggested_action}` : ""}</p>
          ))}

          <h2>Evidence register</h2>
          <p>{evidence.length} evidence item(s) recorded within the controlled inspection record.</p>

          {report.report_type === "fraew_report" && (
            <>
              <h2>F.R.A.E.W. assessment structure</h2>
              <p><strong>Fault:</strong> Findings recorded within the controlled inspection responses above.</p>
              <p><strong>Risk:</strong> Failed items and defect severity identify the compliance risk requiring management.</p>
              <p><strong>Action:</strong> Recommended actions are recorded against each failed control and defect.</p>
              <p><strong>Evidence:</strong> Inspection measurements, observations and photographic evidence are retained within ORION.</p>
              <p><strong>Who:</strong> Responsibility and remedial status are controlled through the ORION defect lifecycle.</p>
            </>
          )}

          <hr />
          <small>Controlled document generated by ORION Enterprise. Alterations require generation of a new controlled version. © ASUKA247 Ltd.</small>
        </article>
      )}

      <section className="panel no-print">
        <h2>Version history</h2>
        <div className="inspection-choice-grid">
          {versions.map(v => <button key={v.id} className={selected.id === v.id ? "choice-selected" : "secondary"} onClick={() => setSelected(v)}>Version {v.version_no}</button>)}
        </div>
      </section>
    </Page>
  );
}
