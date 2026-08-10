import { supabase } from "./supabase";
import type { RemedialPackage } from "./remedials";

export type ClientRateProfile = "standard" | "account_package";

export type LabourRateProfile = {
  code: ClientRateProfile;
  label: string;
  hourlyRate: number;
  minimumCharge: number;
  billingIncrementMinutes: number;
  internalNote: string;
};

export type ActionRate = {
  actionCode: string;
  labourMinutes: number | null;
  materialsCost: number | null;
  internalNote?: string;
};

export type PricingConfig = {
  profiles: Partial<Record<ClientRateProfile, LabourRateProfile>>;
  actions: Record<string, ActionRate>;
};

export type PricedRemedialPackage = {
  package: RemedialPackage;
  labourMinutes: number;
  billedMinutes: number;
  labourCharge: number;
  materialsCharge: number;
  totalCharge: number;
  missingRates: string[];
  priceReady: boolean;
};

/**
 * Loads internal ASUKA commercial rates from a SECURITY DEFINER RPC.
 * The RPC enforces commercial.pricing.view before returning any values.
 * Rates are intentionally absent from the public web bundle.
 */
export async function loadPricingConfig(companyId: string): Promise<PricingConfig> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("commercial_get_pricing_config", {
    p_company_id: companyId
  });
  if (error) throw error;
  const value = (data ?? {}) as any;
  return {
    profiles: value.profiles ?? {},
    actions: value.actions ?? {}
  };
}

/** Company Administrator only. The database function performs the final check. */
export async function saveRateProfile(companyId: string, profile: LabourRateProfile): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("commercial_update_rate_profile", {
    p_company_id: companyId,
    p_code: profile.code,
    p_label: profile.label,
    p_hourly_rate: Number(profile.hourlyRate),
    p_minimum_charge: Number(profile.minimumCharge),
    p_billing_increment_minutes: Number(profile.billingIncrementMinutes),
    p_internal_note: profile.internalNote || null,
    p_is_active: true
  });
  if (error) throw error;
}

/** Company Administrator only. Null allowances deliberately keep an action in PRICE REVIEW. */
export async function saveActionRate(companyId: string, rate: ActionRate): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("commercial_update_action_rate", {
    p_company_id: companyId,
    p_action_code: rate.actionCode,
    p_labour_minutes: rate.labourMinutes == null ? null : Number(rate.labourMinutes),
    p_materials_cost: rate.materialsCost == null ? null : Number(rate.materialsCost),
    p_internal_note: rate.internalNote || null,
    p_is_active: true
  });
  if (error) throw error;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function priceRemedialPackage(
  pkg: RemedialPackage,
  profileCode: ClientRateProfile,
  config: PricingConfig
): PricedRemedialPackage {
  const profile = config.profiles[profileCode];
  const missingRates: string[] = [];
  let labourMinutes = 0;
  let materialsCharge = 0;

  if (!profile) {
    return {
      package: pkg,
      labourMinutes: 0,
      billedMinutes: 0,
      labourCharge: 0,
      materialsCharge: 0,
      totalCharge: 0,
      missingRates: ["RATE_PROFILE"],
      priceReady: false
    };
  }

  for (const action of pkg.actions) {
    const rate = config.actions[action.code];
    if (!rate || rate.labourMinutes == null || rate.materialsCost == null) {
      missingRates.push(action.code);
      continue;
    }
    labourMinutes += Number(rate.labourMinutes);
    materialsCharge += Number(rate.materialsCost);
  }

  const increment = Math.max(1, Number(profile.billingIncrementMinutes));
  const billedMinutes = labourMinutes > 0 ? Math.ceil(labourMinutes / increment) * increment : 0;
  const calculatedLabour = billedMinutes * (Number(profile.hourlyRate) / 60);
  const labourCharge = billedMinutes > 0 ? Math.max(Number(profile.minimumCharge), calculatedLabour) : 0;
  const priceReady = !pkg.requiresReview && missingRates.length === 0 && pkg.actions.length > 0;

  return {
    package: pkg,
    labourMinutes,
    billedMinutes,
    labourCharge: roundCurrency(labourCharge),
    materialsCharge: roundCurrency(materialsCharge),
    totalCharge: roundCurrency(labourCharge + materialsCharge),
    missingRates,
    priceReady
  };
}

export function priceRemedialPackages(
  packages: RemedialPackage[],
  profileCode: ClientRateProfile,
  config: PricingConfig
) {
  const priced = packages.map(pkg => priceRemedialPackage(pkg, profileCode, config));
  return {
    priced,
    readyCount: priced.filter(row => row.priceReady).length,
    reviewCount: priced.filter(row => !row.priceReady).length,
    labour: roundCurrency(priced.filter(row => row.priceReady).reduce((sum, row) => sum + row.labourCharge, 0)),
    materials: roundCurrency(priced.filter(row => row.priceReady).reduce((sum, row) => sum + row.materialsCharge, 0)),
    total: roundCurrency(priced.filter(row => row.priceReady).reduce((sum, row) => sum + row.totalCharge, 0))
  };
}
