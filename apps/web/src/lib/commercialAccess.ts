import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Internal ASUKA247 commercial pricing permission. */
export const COMMERCIAL_PRICING_PERMISSION = "commercial.pricing.view";

const COMMERCIAL_VIEW_ROLES = new Set([
  "owner",
  "director",
  "company_admin",
  "commercial_admin",
  "commercial_manager"
]);

function normalise(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Compatibility guard for the current Works screen. Database RBAC is the
 * authoritative control; this synchronous guard remains fail-closed unless
 * the authenticated token explicitly carries an approved role/permission.
 */
export function canViewCommercialPricing(user: User | null | undefined): boolean {
  if (!user) return false;
  const metadata = { ...(user.user_metadata ?? {}), ...(user.app_metadata ?? {}) } as Record<string, unknown>;
  const permissions = Array.isArray(metadata.permissions) ? metadata.permissions.map(normalise) : [];
  if (permissions.includes(COMMERCIAL_PRICING_PERMISSION)) return true;
  return COMMERCIAL_VIEW_ROLES.has(normalise(metadata.orion_role ?? metadata.role));
}

/**
 * Authoritative ORION RBAC check. public.has_permission also permits platform
 * administrators. Defaults to DENY on missing configuration or any error.
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
