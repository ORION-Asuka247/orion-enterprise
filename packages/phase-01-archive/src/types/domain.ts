export type UUID = string;

export type MembershipStatus =
  | "invited"
  | "active"
  | "suspended"
  | "revoked";

export type AssetStatus =
  | "planned"
  | "installed"
  | "active"
  | "defective"
  | "under_repair"
  | "retired";

export interface Company {
  id: UUID;
  name: string;
  legal_name?: string | null;
  slug: string;
  company_number?: string | null;
  vat_number?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: UUID;
  company_id: UUID;
  name: string;
  reference_code?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  town_city?: string | null;
  county?: string | null;
  postcode?: string | null;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: UUID;
  company_id: UUID;
  property_id: UUID;
  block_id?: UUID | null;
  floor_id?: UUID | null;
  area_id?: UUID | null;
  asset_type_id: UUID;
  asset_code: string;
  qr_token: UUID;
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  install_date?: string | null;
  status: AssetStatus;
  notes?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
