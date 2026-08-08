import { supabase } from "./supabase";

export type AssetType = {
  id: string;
  code: string;
  name: string;
  compliance_domain: string | null;
  inspection_frequency_months: number | null;
};

export type AssetRow = {
  id: string;
  asset_code: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  condition: string | null;
  status: string;
  qr_token: string;
  install_date: string | null;
  asset_types: { name: string; code: string } | null;
  properties: { name: string } | null;
  blocks: { name: string } | null;
  floors: { name: string } | null;
};

export async function loadAssetTypes(companyId: string): Promise<AssetType[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("asset_types")
    .select("id,code,name,compliance_domain,inspection_frequency_months")
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as AssetType[];
}

export async function loadAssets(companyId: string, search = ""): Promise<AssetRow[]> {
  if (!supabase) return [];

  let q = supabase
    .from("assets")
    .select(`
      id,
      asset_code,
      name,
      manufacturer,
      model,
      serial_number,
      condition,
      status,
      qr_token,
      install_date,
      asset_types(name,code),
      properties(name),
      blocks(name),
      floors(name)
    `)
    .eq("company_id", companyId)
    .order("asset_code");

  if (search.trim()) {
    const s = search.trim().replace(/,/g, "");
    q = q.or(
      `asset_code.ilike.%${s}%,serial_number.ilike.%${s}%,manufacturer.ilike.%${s}%,name.ilike.%${s}%`
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AssetRow[];
}

export async function createAsset(input: {
  companyId: string;
  propertyId: string;
  blockId?: string;
  floorId?: string;
  areaId?: string;
  assetTypeId: string;
  assetCode: string;
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  condition?: string;
  notes?: string;
}) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("create_asset_record", {
    p_company_id: input.companyId,
    p_property_id: input.propertyId,
    p_block_id: input.blockId || null,
    p_floor_id: input.floorId || null,
    p_area_id: input.areaId || null,
    p_asset_type_id: input.assetTypeId,
    p_asset_code: input.assetCode,
    p_name: input.name || null,
    p_manufacturer: input.manufacturer || null,
    p_model: input.model || null,
    p_serial_number: input.serialNumber || null,
    p_install_date: input.installDate || null,
    p_condition: input.condition || "unknown",
    p_notes: input.notes || null
  });

  if (error) throw error;
  return data as string;
}
