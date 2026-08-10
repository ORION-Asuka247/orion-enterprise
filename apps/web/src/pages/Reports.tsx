import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Page from "../components/Page";
import {
  generatePropertyFireDoorReport,
  generateReport,
  loadFireDoorReportProperties,
  loadReports,
  loadSubmittedInspections,
  type FireDoorReportProperty,
  type ReportRow,
  type ReportType
} from "../lib/reports";
import { useTenant } from "../lib/tenant";

export default function Reports() {
  const { activeTenant } = useTenant();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [properties, setProperties] = useState<FireDoorReportProperty[]>([]);
  const [selectedInspection, setSelectedInspection] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [reportType, setReportType] = useState<Exclude<ReportType, "property_fire_door_report">>("inspection_report");
  const [notes, setNotes] = useState("");
  const [propertyNotes, setPropertyNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [propertyBusy, setPropertyBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!activeTenant) return;
    setLoading(true);
    setError("");
    try {
      const [r, i, p] = await Promise.all([
        loadReports(activeTenant.id),
        loadSubmittedInspections(activeTenant.id),
        loadFireDoorReportProperties(activeTenant.id)
      ]);
      setReports(r);
      setInspections(i);
      setProperties(p);
      if (!selectedInspection && i[0]?.id) setSelectedInspection(i[0].id);
      if (!selectedProperty && p[0]?.id) setSelectedProperty(p[0].id);
    } catch (e: any) {
      setError(e?.message || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeTenant]);

  const counts = useMemo(() => ({
    total: reports.length,
    generated: reports.filter(r => r.status === "generated").length,
    issued: reports.filter(r => r.status === "issued").length,
    versions: reports.reduce((sum, r) => sum + r.current_version, 0)
  }), [reports]);

  async function createReport() {
    if (!selectedInspection) return;
    setBusy(true);
    setError("");
    try {
      const id = await generateReport(selectedInspection, reportType, notes);
      await load();
      navigate(`/reports/${id}`);
    } catch (e: any) {
      setError(e?.message || "Unable to generate report.");
    } finally {
      setBusy(false);
    }
  }

  async function createPropertyFireDoorReport() {
    if (!selectedProperty) return;
    setPropertyBusy(true);
    setError("");
    try {
      const id = await generatePropertyFireDoorReport(selectedProperty, propertyNotes);
      await load();
      navigate(`/reports/${id}`);
    } catch (e: any) {
      setError(e?.message || "Unable to generate property fire door report.");
    } finally {
      setPropertyBusy(false);
    }
  }

  return (
    <Page title="Controlled reports" kicker="DOCUMENT CONTROL">
      <div className="inspection-progress panel">
        <div><span>Documents</span><strong>{counts.total}</strong></div>
        <div><span>Generated</span><strong>{counts.generated}</strong></div>
        <div><span>Issued</span><strong>{counts.issued}</strong></div>
        <div><span>Controlled versions</span><strong>{counts.versions}</strong></div>
      </div>

      {error && <div className="warning">{error}</div>}

      <section className="panel">
        <div className="eyebrow">PROPERTY FIRE DOOR REPORT</div>
        <h2>Create one controlled report for a complete fire-door programme</h2>
        <p>Generates an immutable property snapshot containing every fire-door asset, submitted outcome, active defect, consolidated remedial action and manual-review flag. Internal commercial rates are deliberately excluded from the client report.</p>
        {properties.length === 0 ? (
          <div className="placeholder">No active properties are available.</div>
        ) : (
          <>
            <label className="inspection-field">
              Property
              <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
                {properties.map(row => <option key={row.id} value={row.id}>{row.name}{row.postcode ? ` · ${row.postcode}` : ""}</option>)}
              </select>
            </label>
            <label className="inspection-field">
              Version notes
              <textarea value={propertyNotes} onChange={e => setPropertyNotes(e.target.value)} placeholder="Optional reason for generation or revision." />
            </label>
            <button onClick={createPropertyFireDoorReport} disabled={propertyBusy || !selectedProperty}>{propertyBusy ? "Generating..." : "Generate property fire door report"}</button>
          </>
        )}
      </section>

      <section className="panel">
        <div className="eyebrow">GENERATE CONTROLLED DOCUMENT</div>
        <h2>Create report from one submitted inspection</h2>
        <p>ORION captures an immutable source snapshot each time a new document version is generated.</p>
        {inspections.length === 0 ? (
          <div className="placeholder">No submitted inspections are currently available for reporting.</div>
        ) : (
          <>
            <label className="inspection-field">
              Submitted inspection
              <select value={selectedInspection} onChange={e => setSelectedInspection(e.target.value)}>
                {inspections.map((row: any) => (
                  <option key={row.id} value={row.id}>
                    {row.assets?.asset_code || "Asset"}{row.assets?.name ? ` — ${row.assets.name}` : ""} · {(row.outcome || "pending").toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="inspection-field">
              Document type
              <select value={reportType} onChange={e => setReportType(e.target.value as Exclude<ReportType, "property_fire_door_report">)}>
                <option value="inspection_report">Inspection report</option>
                <option value="fraew_report">F.R.A.E.W. assessment</option>
                <option value="certificate">Inspection certificate</option>
              </select>
            </label>
            <label className="inspection-field">
              Version notes
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional reason for generation or revision." />
            </label>
            <button onClick={createReport} disabled={busy || !selectedInspection}>{busy ? "Generating..." : "Generate controlled report"}</button>
          </>
        )}
      </section>

      <section>
        <div className="page-toolbar">
          <div>
            <h2>Document register</h2>
            <p className="muted">Inspection reports, F.R.A.E.W. assessments, certificates and property fire-door reports for {activeTenant?.name || "the active company"}.</p>
          </div>
        </div>
        {loading ? <div className="panel">Loading report register...</div> : reports.length === 0 ? (
          <div className="panel"><p>No controlled reports have been generated yet.</p></div>
        ) : (
          <div className="inspection-question-list">
            {reports.map(report => (
              <section className="panel inspection-question" key={report.id}>
                <div className="inspection-question-header">
                  <div>
                    <div className="eyebrow">{report.document_number} · Version {report.current_version}</div>
                    <h2>{report.title}</h2>
                    <p>
                      {report.report_type === "property_fire_door_report"
                        ? `${report.properties?.name || "Property"}${report.properties?.postcode ? ` · ${report.properties.postcode}` : ""}`
                        : `${report.orion_inspection_runs?.assets?.asset_code || "Asset"} · ${(report.report_type || "").replace(/_/g, " ")}`}
                      {` · Updated ${new Date(report.updated_at).toLocaleString()}`}
                    </p>
                  </div>
                  <span className={`inspection-result ${report.status === "issued" ? "result-pass" : "result-na"}`}>{report.status.toUpperCase()}</span>
                </div>
                <div className="inspection-actions">
                  <Link className="button-link" to={`/reports/${report.id}`}>Open controlled report</Link>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
