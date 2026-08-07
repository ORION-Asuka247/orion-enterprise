import { supabase } from "./supabase";

export type BuildingSetupInput = {
  companyId: string;
  property: {
    name: string;
    reference_code?: string;
    address_line1?: string;
    address_line2?: string;
    town_city?: string;
    county?: string;
    postcode?: string;
    country_code?: string;
  };
  blockNames: string[];
  floorsAbove: number;
  basementLevels: number;
  createLobby: boolean;
};

export async function createBuildingSetup(input: BuildingSetupInput) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("create_building_setup", {
    p_company_id: input.companyId,
    p_property: input.property,
    p_block_names: input.blockNames,
    p_floors_above: input.floorsAbove,
    p_basement_levels: input.basementLevels,
    p_create_lobby: input.createLobby
  });

  if (error) throw error;
  return data as string;
}

export type PropertyHierarchy = {
  id: string;
  name: string;
  reference_code: string | null;
  address_line1: string | null;
  town_city: string | null;
  postcode: string | null;
  blocks: Array<{
    id: string;
    name: string;
    code: string | null;
    floors: Array<{
      id: string;
      name: string;
      level_number: number | null;
      code: string | null;
    }>;
  }>;
};

export async function loadPropertyHierarchy(companyId: string): Promise<PropertyHierarchy[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("properties")
    .select(`
      id,
      name,
      reference_code,
      address_line1,
      town_city,
      postcode,
      blocks (
        id,
        name,
        code,
        floors (
          id,
          name,
          level_number,
          code
        )
      )
    `)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;

  const rows = (data ?? []) as unknown as PropertyHierarchy[];
  return rows.map(p => ({
    ...p,
    blocks: (p.blocks ?? []).map(b => ({
      ...b,
      floors: [...(b.floors ?? [])].sort(
        (a, b) => (a.level_number ?? 0) - (b.level_number ?? 0)
      )
    }))
  }));
}
