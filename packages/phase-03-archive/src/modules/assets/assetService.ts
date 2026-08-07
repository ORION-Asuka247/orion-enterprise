import { supabase } from "../../lib/supabase";
import { offlineDb } from "../../lib/offlineDb";
import type { AssetSummary, UUID } from "./types";

function mapAsset(row: any): AssetSummary {
  return {
    id: row.id,
    company_id: row.company_id,
    property_id: row.property_id,
    asset_code: row.asset_code,
    qr_token: row.qr_token,
    name: row.name,
    status: row.status,
    property_name: row.properties?.name ?? null,
    block_name: row.blocks?.name ?? null,
    floor_name: row.floors?.name ?? null,
    area_name: row.areas?.name ?? null
  };
}

export async function findAssetByQrToken(qrToken: string): Promise<AssetSummary | null> {
  const { data, error } = await supabase
    .from("assets")
    .select(`
      id, company_id, property_id, asset_code, qr_token, name, status,
      properties(name), blocks(name), floors(name), areas(name)
    `)
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!error && data) {
    const mapped = mapAsset(data);
    const db = await offlineDb;
    await db.put("assets", mapped);
    return mapped;
  }

  const db = await offlineDb;
  const all = await db.getAll("assets");
  return all.find((a: AssetSummary) => a.qr_token === qrToken) ?? null;
}

export async function searchAssetsManually(query: string): Promise<AssetSummary[]> {
  const clean = query.trim();
  if (!clean) return [];

  const { data, error } = await supabase
    .from("assets")
    .select(`
      id, company_id, property_id, asset_code, qr_token, name, status,
      properties(name), blocks(name), floors(name), areas(name)
    `)
    .or(`asset_code.ilike.%${clean}%,name.ilike.%${clean}%`)
    .limit(25);

  if (!error && data) {
    const mapped = data.map(mapAsset);
    const db = await offlineDb;
    for (const asset of mapped) await db.put("assets", asset);
    return mapped;
  }

  const db = await offlineDb;
  const all = (await db.getAll("assets")) as AssetSummary[];
  const q = clean.toLowerCase();
  return all.filter(
    (a) =>
      a.asset_code.toLowerCase().includes(q) ||
      (a.name ?? "").toLowerCase().includes(q) ||
      (a.property_name ?? "").toLowerCase().includes(q)
  ).slice(0, 25);
}
