import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Page from "../components/Page";
import { loadDefects, updateDefect, type OrionDefect, type OrionDefectStatus } from "../lib/defects";
import { useTenant } from "../lib/tenant";

const statusOrder: OrionDefectStatus[] = ["open", "assigned", "in_progress", "resolved", "verified", "closed", "cancelled"];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function Works() {
  const { activeTenant } = useTenant();
  const [rows, setRows] = useState<OrionDefect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function refresh() {
    if (!activeTenant) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRows(await loadDefects(activeTenant.id));
    } catch (e: any) {
      setError(e?.message || "Unable to load defects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [activeTenant]);

  const counts = useMemo(() => ({
    total: rows.length,
    critical: rows.filter(r => r.severity === "critical" && !["closed", "cancelled"].includes(r.status)).length,
    active: rows.filter(r => !["resolved", "verified", "closed", "cancelled"].includes(r.status)).length,
    resolved: rows.filter(r => ["resolved", "verified", "closed"].includes(r.status)).length
  }), [rows]);

  const visible = useMemo(() => rows.filter(row => {
    if (filter === "all") return true;
    if (filter === "active") return !["resolved", "verified", "closed", "cancelled"].includes(row.status);
    return ["resolved", "verified", "closed"].includes(row.status);
  }), [rows, filter]);

  async function changeStatus(row: OrionDefect, status: OrionDefectStatus) {
    setBusy(row.id);
    setError("");
    try {
      await updateDefect({
        defectId: row.id,
        status,
        remedialNotes: notes[row.id] || null,
        resolutionNotes: status === "resolved" ? (notes[row.id] || null) : null
      });
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Unable to update defect.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Page title="Works & remedials" kicker="OPERATIONS">
      <div className="inspection-progress panel">
        <div><span>Total defects</span><strong>{counts.total}</strong></div>
        <div><span>Active</span><strong>{counts.active}</strong></div>
        <div><span>Critical</span><strong>{counts.critical}</strong></div>
        <div><span>Resolved</span><strong>{counts.resolved}</strong></div>
      </div>

      <div className="page-toolbar">
        <div>
          <h2>Defect & remedial register</h2>
          <p className="muted">Failed controlled inspection items flow here automatically for action, resolution and verification.</p>
        </div>
        <div className="inspection-choice-grid">
          {(["active", "resolved", "all"] as const).map(value => (
            <button key={value} type="button" className={filter === value ? "choice-selected" : "secondary"} onClick={() => setFilter(value)}>
              {label(value)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="warning">{error}</div>}
      {loading && <div className="panel">Loading remedial actions...</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="panel">
          <h2>No matching defects</h2>
          <p>Defects are created automatically when a controlled inspection item fails.</p>
          <Link className="button-link" to="/inspections">Open inspections</Link>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="inspection-question-list">
          {visible.map(row => (
            <section className="panel inspection-question" key={row.id}>
              <div className="inspection-question-header">
                <div>
                  <div className="eyebrow">{row.defect_code} · {row.severity.toUpperCase()}</div>
                  <h2>{row.title}</h2>
                  <p>{row.description}</p>
                  <p className="muted">
                    Asset: {row.assets?.asset_code || row.asset_id}
                    {row.assets?.name ? ` — ${row.assets.name}` : ""}
                    {row.target_date ? ` · Target ${new Date(row.target_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className={`inspection-result result-${row.status === "resolved" || row.status === "verified" || row.status === "closed" ? "pass" : row.severity === "critical" ? "fail" : "na"}`}>
                  {label(row.status).toUpperCase()}
                </span>
              </div>

              {row.suggested_action && (
                <div className="failure-reason">
                  <strong>Recommended action</strong>
                  <p>{row.suggested_action}</p>
                </div>
              )}

              <label className="inspection-field">
                Remedial / resolution notes
                <textarea
                  value={notes[row.id] ?? row.remedial_notes ?? row.resolution_notes ?? ""}
                  onChange={e => setNotes(current => ({ ...current, [row.id]: e.target.value }))}
                  placeholder="Record attendance, remedial works, materials used, access issues or completion evidence notes."
                />
              </label>

              <div className="inspection-actions">
                <Link className="button-link secondary-link" to={`/assets/${row.asset_id}`}>Asset record</Link>
                <select
                  aria-label={`Update status for ${row.defect_code}`}
                  value={row.status}
                  disabled={busy === row.id}
                  onChange={e => changeStatus(row, e.target.value as OrionDefectStatus)}
                >
                  {statusOrder.map(status => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </div>

              {(row.resolved_at || row.verified_at) && (
                <small>
                  {row.resolved_at ? `Resolved ${new Date(row.resolved_at).toLocaleString()}` : ""}
                  {row.verified_at ? ` · Verified ${new Date(row.verified_at).toLocaleString()}` : ""}
                </small>
              )}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
