import type { User } from "@supabase/supabase-js";

/**
 * Internal ASUKA247 commercial controls.
 *
 * This UI guard deliberately defaults to DENY. It is not a substitute for
 * database RLS: sensitive cost/margin data must also be protected server-side
 * before persistent commercial tables are introduced.
 */
const COMMERCIAL_VIEW_ROLES = new Set([
  "owner",
  "director",
  "commercial_admin",
  "commercial_manager"
]);

function normalise(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function canViewCommercialPricing(user: User | null | undefined): boolean {
  if (!user) return false;

  const metadata = {
    ...(user.user_metadata ?? {}),
    ...(user.app_metadata ?? {})
  } as Record<string, unknown>;

  const permissions = Array.isArray(metadata.permissions)
    ? metadata.permissions.map(normalise)
    : [];

  if (permissions.includes("commercial.pricing.view")) return true;

  const role = normalise(metadata.orion_role ?? metadata.role);
  return COMMERCIAL_VIEW_ROLES.has(role);
}

export const COMMERCIAL_PRICING_PERMISSION = "commercial.pricing.view";
