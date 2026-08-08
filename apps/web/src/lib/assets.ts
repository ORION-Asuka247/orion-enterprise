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

export type AssetDetailRecord = AssetRow & {
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  areas: { name: string } | null;
};

export type AssetInspectionHistory = {
  id: string;
  status: string;
  outcome: string;
  scheduled_for: string | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

export type AssetDefectHistory = {
  id: string;
  reference_code: string | null;
  title: string;
  severity: string;
  status: string;
  target_date: string | null;
  created_at: string;
};

export type AssetStatusHistory = {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  changed_at: string;
};

function dedupeAssetTypes(rows: AssetType[]): AssetType[] {
  const byCode = new Map<string, AssetType>();

  for (const row of rows) {
    const key = (row.code || row.name).trim().toUpperCase();
    if (!byCode.has(key)) byCode.set(key, row);
  }

  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadAssetTypes(companyId: string): Promise<AssetType[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("asset_types")
    .select("id,code,name,compliance_domain,inspection_frequency_months")
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return dedupeAssetTypes((data ?? []) as AssetType[]);
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

export async function loadAssetDetail(companyId: string, assetId: string): Promise<AssetDetailRecord> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
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
      notes,
      metadata,
      created_at,
      updated_at,
      asset_types(name,code),
      properties(name),
      blocks(name),
      floors(name),
      areas(name)
    `)
    .eq("company_id", companyId)
    .eq("id", assetId)
    .single();

  if (error) throw error;
  return data as unknown as AssetDetailRecord;
}

export async function loadAssetHistory(companyId: string, assetId: string) {
  if (!supabase) {
    return { inspections: [], defects: [], statusHistory: [] };
  }

  const [inspectionResult, defectResult, statusResult] = await Promise.all([
    supabase
      .from("inspections")
      .select("id,status,outcome,scheduled_for,started_at,submitted_at,created_at")
      .eq("company_id", companyId)
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("defects")
      .select("id,reference_code,title,severity,status,target_date,created_at")
      .eq("company_id", companyId)
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("asset_status_history")
      .select("id,from_status,to_status,reason,changed_at")
      .eq("company_id", companyId)
      .eq("asset_id", assetId)
      .order("changed_at", { ascending: false })
  ]);

  if (inspectionResult.error) throw inspectionResult.error;
  if (defectResult.error) throw defectResult.error;
  if (statusResult.error) throw statusResult.error;

  return {
    inspections: (inspectionResult.data ?? []) as AssetInspectionHistory[],
    defects: (defectResult.data ?? []) as AssetDefectHistory[],
    statusHistory: (statusResult.data ?? []) as AssetStatusHistory[]
  };
}

export async function resolveAssetIdentifier(companyId: string, identifier: string): Promise<string | null> {
  if (!supabase) return null;

  const raw = identifier.trim();
  if (!raw) return null;

  let tokenOrCode = raw;

  try {
    const url = new URL(raw);
    const qrMatch = url.pathname.match(/^\/q\/([^/]+)$/);
    if (qrMatch?.[1]) tokenOrCode = decodeURIComponent(qrMatch[1]);
  } catch {
    // Raw QR token, asset code or serial number.
  }

  const { data, error } = await supabase
    .from("assets")
    .select("id")
    .eq("company_id", companyId)
    .or(
      `qr_token.eq.${tokenOrCode},asset_code.ilike.${tokenOrCode},serial_number.ilike.${tokenOrCode}`
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    // UUID parsers can reject non-UUID qr_token comparisons. Fall back to code/serial.
    const fallback = await supabase
      .from("assets")
      .select("id")
      .eq("company_id", companyId)
      .or(`asset_code.ilike.${tokenOrCode},serial_number.ilike.${tokenOrCode}`)
      .limit(1)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    return fallback.data?.id ?? null;
  }

  return data?.id ?? null;
}

export async function resolveQrToken(qrToken: string): Promise<{ id: string; company_id: string } | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("assets")
    .select("id,company_id")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; company_id: string } | null;
}
