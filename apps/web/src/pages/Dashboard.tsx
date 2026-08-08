import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Metric from "../components/Metric";
import Page from "../components/Page";
import { useTenant } from "../lib/tenant";
import { loadDashboardMetrics, type DashboardMetrics } from "../lib/dashboard";

const zero: DashboardMetrics = {
  propertyCount: 0,
  assetCount: 0,
  openDefects: 0,
  inspectionCount: 0
};

export default function Dashboard() {
  const { activeTenant } = useTenant();
  const [metrics, setMetrics] = useState<DashboardMetrics>(zero);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeTenant) return;
    loadDashboardMetrics(activeTenant.id)
      .then(setMetrics)
      .catch((e) => setError(e?.message ?? "Unable to load dashboard."));
  }, [activeTenant]);

  const commissioned = metrics.propertyCount > 0;

  return (
    <Page title="Portfolio command centre" kicker="OVERVIEW">
      {error && <div className="warning">{error}</div>}

      {!commissioned && (
        <div className="commission-banner">
          <div>
            <div className="eyebrow">ACTION REQUIRED</div>
            <h2>Set up your first building</h2>
            <p>Your company and administrator account are active. The next step is creating the first property hierarchy.</p>
          </div>
          <Link to="/setup" className="button-link">Start building setup</Link>
        </div>
      )}

      <div className="metrics">
        <Metric label="Properties" value={String(metrics.propertyCount)} sub="Active portfolio" />
        <Metric label="Assets" value={String(metrics.assetCount)} sub="Registered assets" />
        <Metric label="Open defects" value={String(metrics.openDefects)} sub="Requires action" />
        <Metric label="Inspections" value={String(metrics.inspectionCount)} sub="Recorded history" />
      </div>

      <div className="grid two">
        <article className="panel">
          <h2>Implementation status</h2>
          <ul className="clean">
            <li><b>1</b><span>Single ORION Enterprise v1.0 codebase</span></li>
            <li><b>Live</b><span>Controlled database migration chain</span></li>
            <li><b>Live</b><span>Tenant-aware operational metrics</span></li>
            <li><b>{commissioned ? "✓" : "—"}</b><span>Building hierarchy commissioned</span></li>
          </ul>
        </article>

        <article className="panel">
          <h2>{commissioned ? "Portfolio ready" : "Next commissioning task"}</h2>
          {commissioned ? (
            <p>The first property is active. Continue through asset registration, controlled inspections, remedial actions and reporting.</p>
          ) : (
            <p>Use the guided setup wizard to create a property, its blocks, floors and communal lobby structure.</p>
          )}
        </article>
      </div>
    </Page>
  );
}
