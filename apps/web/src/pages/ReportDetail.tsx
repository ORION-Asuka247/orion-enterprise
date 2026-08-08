import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Page from "../components/Page";
import { issueReport, loadReport, loadReportVersions, type ReportRow, type ReportVersion } from "../lib/reports";

function value(v: unknown) {
  return v == null || v === "" ? "—" : String(v);
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

      <section className="panel no-print">
        <h2>Version history</h2>
        <div className="inspection-choice-grid">
          {versions.map(v => <button key={v.id} className={selected.id === v.id ? "choice-selected" : "secondary"} onClick={() => setSelected(v)}>Version {v.version_no}</button>)}
        </div>
      </section>
    </Page>
  );
}
