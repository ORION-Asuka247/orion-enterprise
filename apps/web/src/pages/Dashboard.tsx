
import { useEffect, useState } from "react";
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

  return (
    <Page title="Portfolio command centre" kicker="OVERVIEW">
      {error && <div className="warning">{error}</div>}
      <div className="metrics">
        <Metric label="Properties" value={String(metrics.propertyCount)} sub="Active portfolio"/>
        <Metric label="Assets" value={String(metrics.assetCount)} sub="Registered assets"/>
        <Metric label="Open defects" value={String(metrics.openDefects)} sub="Requires action"/>
        <Metric label="Inspections" value={String(metrics.inspectionCount)} sub="Recorded history"/>
      </div>
      <div className="grid two">
        <article className="panel">
          <h2>Implementation status</h2>
          <ul className="clean">
            <li><b>1</b><span>Single ORION Enterprise v1.0 codebase</span></li>
            <li><b>10</b><span>Ordered database migrations</span></li>
            <li><b>Live</b><span>Tenant-aware dashboard metrics</span></li>
          </ul>
        </article>
        <article className="panel">
          <h2>Next commissioning task</h2>
          <p>Create a fresh ORION Enterprise Supabase development project, apply migrations 001–010, seed baseline data and create the first administrator account.</p>
        </article>
      </div>
    </Page>
  );
}
