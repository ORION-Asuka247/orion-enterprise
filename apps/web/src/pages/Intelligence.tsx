import { useEffect, useMemo, useState } from "react";
import Page from "../components/Page";
import { supabase } from "../lib/supabase";
import { useTenant } from "../lib/tenant";

type Metrics = {
  properties: number;
  assets: number;
  inspections: number;
  failedInspections: number;
  openDefects: number;
  criticalDefects: number;
  reports: number;
  issuedReports: number;
};

const zero: Metrics = {
  properties: 0,
  assets: 0,
  inspections: 0,
  failedInspections: 0,
  openDefects: 0,
  criticalDefects: 0,
  reports: 0,
  issuedReports: 0
};

export default function Intelligence() {
  const { activeTenant } = useTenant();
  const [metrics, setMetrics] = useState<Metrics>(zero);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!activeTenant || !supabase) {
        setMetrics(zero);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const id = activeTenant.id;
      const [properties, assets, inspections, failed, defects, critical, reports, issued] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("company_id", id),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", id),
        supabase.from("orion_inspection_runs").select("id", { count: "exact", head: true }).eq("company_id", id),
        supabase.from("orion_inspection_runs").select("id", { count: "exact", head: true }).eq("company_id", id).eq("outcome", "fail"),
        supabase.from("orion_inspection_defects").select("id", { count: "exact", head: true }).eq("company_id", id).not("status", "in", "(closed,verified)"),
        supabase.from("orion_inspection_defects").select("id", { count: "exact", head: true }).eq("company_id", id).eq("severity", "critical").not("status", "in", "(closed,verified)"),
        supabase.from("orion_reports").select("id", { count: "exact", head: true }).eq("company_id", id),
        supabase.from("orion_reports").select("id", { count: "exact", head: true }).eq("company_id", id).eq("status", "issued")
      ]);
      const firstError = [properties, assets, inspections, failed, defects, critical, reports, issued].find(r => r.error)?.error;
      if (firstError) setError(firstError.message);
      setMetrics({
        properties: properties.count ?? 0,
        assets: assets.count ?? 0,
        inspections: inspections.count ?? 0,
        failedInspections: failed.count ?? 0,
        openDefects: defects.count ?? 0,
        criticalDefects: critical.count ?? 0,
        reports: reports.count ?? 0,
        issuedReports: issued.count ?? 0
      });
      setLoading(false);
    }
    load();
  }, [activeTenant]);

  const insight = useMemo(() => {
    if (metrics.criticalDefects > 0) return {
      level: "Critical attention",
      text: `${metrics.criticalDefects} critical defect${metrics.criticalDefects === 1 ? "" : "s"} remain active. Prioritise remedial action and verification before routine work.`
    };
    if (metrics.openDefects > 0) return {
      level: "Remedial workload",
      text: `${metrics.openDefects} active defect${metrics.openDefects === 1 ? "" : "s"} require progression through the remedial lifecycle.`
    };
    if (metrics.assets > 0 && metrics.inspections === 0) return {
      level: "Inspection mobilisation",
      text: "Assets are registered but no controlled inspections have been recorded yet. Begin the inspection programme from the asset register."
    };
    if (metrics.properties === 0) return {
      level: "Commissioning",
      text: "The portfolio has not yet been commissioned. Create the first building hierarchy before operational analytics can develop."
    };
    return {
      level: "Portfolio stable",
      text: "No critical operational exception is currently visible in the controlled ORION records. Continue scheduled inspections and document control."
    };
  }, [metrics]);

  const passRate = metrics.inspections === 0 ? 0 : Math.round(((metrics.inspections - metrics.failedInspections) / metrics.inspections) * 100);

  return (
    <Page title="Enterprise intelligence" kicker="PORTFOLIO ANALYTICS">
      {error && <div className="warning">{error}</div>}
      {loading ? <div className="panel">Calculating portfolio intelligence...</div> : (
        <>
          <div className="inspection-progress panel">
            <div><span>Properties</span><strong>{metrics.properties}</strong></div>
            <div><span>Assets</span><strong>{metrics.assets}</strong></div>
            <div><span>Inspection pass rate</span><strong>{metrics.inspections ? `${passRate}%` : "—"}</strong></div>
            <div><span>Open defects</span><strong>{metrics.openDefects}</strong></div>
          </div>

          <div className="grid two">
            <section className="panel">
              <div className="eyebrow">PRIORITY SIGNAL</div>
              <h2>{insight.level}</h2>
              <p>{insight.text}</p>
              <ul className="clean">
                <li><b>{metrics.criticalDefects}</b><span>Critical active defects</span></li>
                <li><b>{metrics.failedInspections}</b><span>Failed inspections</span></li>
                <li><b>{metrics.issuedReports}</b><span>Issued controlled reports</span></li>
              </ul>
            </section>

            <section className="panel">
              <div className="eyebrow">CONTROLLED DATA</div>
              <h2>Evidence base</h2>
              <p>This view is calculated from live ORION records rather than speculative AI output. It provides a dependable operational baseline for later assisted analysis.</p>
              <ul className="clean">
                <li><b>{metrics.inspections}</b><span>Inspection records</span></li>
                <li><b>{metrics.reports}</b><span>Controlled report records</span></li>
                <li><b>{metrics.assets}</b><span>Registered assets</span></li>
              </ul>
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
