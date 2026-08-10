import { supabase } from "./supabase";

/** Internal ASUKA247 commercial pricing permission. */
export const COMMERCIAL_PRICING_PERMISSION = "commercial.pricing.view";

/**
 * Resolve commercial pricing access from ORION's database RBAC model.
 * Defaults to DENY on missing configuration, unauthenticated access or errors.
 * public.has_permission also permits platform administrators.
 */
export async function loadCommercialPricingAccess(companyId: string | null | undefined): Promise<boolean> {
  if (!supabase || !companyId) return false;

  const { data, error } = await supabase.rpc("has_permission", {
    target_company: companyId,
    permission_code: COMMERCIAL_PRICING_PERMISSION
  });

  if (error) {
    console.error("Unable to resolve commercial pricing permission", error);
    return false;
  }

  return data === true;
}
