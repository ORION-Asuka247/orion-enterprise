import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Page from "../components/Page";
import { supabase } from "../lib/supabase";
import { useTenant } from "../lib/tenant";

type InspectionRow = {
  id: string;
  asset_id: string;
  status: "in_progress" | "submitted" | "cancelled";
  outcome: "pending" | "pass" | "fail";
  started_at: string;
  submitted_at: string | null;
  assets: { id: string; asset_code: string; name: string | null } | null;
  orion_inspection_templates: { name: string; version: number } | null;
};

export default function Inspections() {
  const { activeTenant } = useTenant();
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "in_progress" | "pass" | "fail">("all");

  useEffect(() => {
    async function load() {
      if (!activeTenant || !supabase) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("orion_inspection_runs")
        .select("id,asset_id,status,outcome,started_at,submitted_at,assets(id,asset_code,name),orion_inspection_templates(name,version)")
        .eq("company_id", activeTenant.id)
        .order("started_at", { ascending: false });
      if (queryError) setError(queryError.message);
      setRows((data ?? []) as unknown as InspectionRow[]);
      setLoading(false);
    }
    load();
  }, [activeTenant]);

  const counts = useMemo(() => ({
    total: rows.length,
    open: rows.filter(r => r.status === "in_progress").length,
    passed: rows.filter(r => r.outcome === "pass").length,
    failed: rows.filter(r => r.outcome === "fail").length
  }), [rows]);

  const visible = useMemo(() => rows.filter(row => {
    if (filter === "all") return true;
    if (filter === "in_progress") return row.status === "in_progress";
    return row.outcome === filter;
  }), [rows, filter]);

  return (
    <Page title="Inspections" kicker="COMPLIANCE ENGINE">
      <div className="inspection-progress panel">
        <div><span>Total</span><strong>{counts.total}</strong></div>
        <div><span>In progress</span><strong>{counts.open}</strong></div>
        <div><span>Passed</span><strong>{counts.passed}</strong></div>
        <div><span>Failed</span><strong>{counts.failed}</strong></div>
      </div>

      <div className="page-toolbar">
        <div>
          <h2>Inspection register</h2>
          <p className="muted">Live controlled inspections and outcomes for {activeTenant?.name || "the active company"}.</p>
        </div>
        <div className="inspection-choice-grid">
          {(["all", "in_progress", "pass", "fail"] as const).map(value => (
            <button key={value} type="button" className={filter === value ? "choice-selected" : "secondary"} onClick={() => setFilter(value)}>
              {value === "in_progress" ? "In progress" : value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="warning">{error}</div>}
      {loading && <div className="panel">Loading inspections...</div>}
      {!loading && !error && visible.length === 0 && (
        <div className="panel">
          <h2>No matching inspections</h2>
          <p>Start an inspection from an asset record. ORION will use the controlled template assigned to that asset type.</p>
          <Link className="button-link" to="/assets">Open asset register</Link>
        </div>
      )}
      {!loading && visible.length > 0 && (
        <div className="inspection-question-list">
          {visible.map(row => (
            <section className="panel inspection-question" key={row.id}>
              <div className="inspection-question-header">
                <div>
                  <div className="eyebrow">{row.orion_inspection_templates?.name || "Controlled inspection"} · v{row.orion_inspection_templates?.version || 1}</div>
                  <h2>{row.assets?.asset_code || "Asset"}{row.assets?.name ? ` — ${row.assets.name}` : ""}</h2>
                  <p>Started {new Date(row.started_at).toLocaleString()}{row.submitted_at ? ` · Submitted ${new Date(row.submitted_at).toLocaleString()}` : ""}</p>
                </div>
                <span className={`inspection-result result-${row.outcome === "pending" ? "na" : row.outcome}`}>{row.status === "in_progress" ? "IN PROGRESS" : row.outcome.toUpperCase()}</span>
              </div>
              <div className="inspection-actions">
                <Link className="button-link secondary-link" to={`/assets/${row.asset_id}`}>Asset record</Link>
                {row.status === "in_progress" && <Link className="button-link" to={`/assets/${row.asset_id}/inspect/${row.id}`}>Continue inspection</Link>}
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
