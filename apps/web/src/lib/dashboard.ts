
import { supabase } from "./supabase";

export type DashboardMetrics = {
  propertyCount: number;
  assetCount: number;
  openDefects: number;
  inspectionCount: number;
};

export async function loadDashboardMetrics(companyId: string): Promise<DashboardMetrics> {
  if (!supabase) {
    return { propertyCount: 0, assetCount: 0, openDefects: 0, inspectionCount: 0 };
  }

  const [
    properties,
    assets,
    defects,
    inspections
  ] = await Promise.all([
    supabase.from("properties").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("assets").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("defects").select("*", { count: "exact", head: true }).eq("company_id", companyId).not("status", "in", '("closed","cancelled")'),
    supabase.from("inspections").select("*", { count: "exact", head: true }).eq("company_id", companyId)
  ]);

  for (const result of [properties, assets, defects, inspections]) {
    if (result.error) throw result.error;
  }

  return {
    propertyCount: properties.count ?? 0,
    assetCount: assets.count ?? 0,
    openDefects: defects.count ?? 0,
    inspectionCount: inspections.count ?? 0
  };
}
