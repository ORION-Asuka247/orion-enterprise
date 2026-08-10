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

// INTERNAL ASUKA247 COMMERCIAL CONTROL ONLY.
// These values are never intended for client-facing reports or portal output.
export const RATE_PROFILES: Record<ClientRateProfile, LabourRateProfile> = {
  standard: {
    code: "standard",
    label: "Standard client rate",
    hourlyRate: 150,
    minimumCharge: 75,
    billingIncrementMinutes: 30,
    internalNote: "Normal ASUKA247 commercial labour rate."
  },
  account_package: {
    code: "account_package",
    label: "Account / package-holder rate",
    hourlyRate: 135,
    minimumCharge: 67.5,
    billingIncrementMinutes: 30,
    internalNote: "Preferred account/package-holder labour rate. Default is 10% below standard and remains an internal commercial setting."
  }
};

// Only rates supported by the existing ASUKA commercial model have been preloaded.
// Undefined rates must be approved internally before ORION can mark a package PRICE READY.
export const ACTION_RATE_CARD: Record<string, ActionRate> = {
  ADJUST_GAPS: {
    actionCode: "ADJUST_GAPS",
    labourMinutes: 90,
    materialsCost: 45,
    internalNote: "Existing ASUKA general fire-door adjustment allowance."
  },
  REPLACE_SEALS: {
    actionCode: "REPLACE_SEALS",
    labourMinutes: 60,
    materialsCost: 35,
    internalNote: "Existing ASUKA fire/smoke seal allowance."
  },
  FD_SIGN: {
    actionCode: "FD_SIGN",
    labourMinutes: 30,
    materialsCost: 18,
    internalNote: "Existing ASUKA fire-safety sign allowance."
  },
  DROP_SEAL: { actionCode: "DROP_SEAL", labourMinutes: null, materialsCost: null },
  REPLACE_HINGES: { actionCode: "REPLACE_HINGES", labourMinutes: null, materialsCost: null },
  HINGE_FIXINGS: { actionCode: "HINGE_FIXINGS", labourMinutes: null, materialsCost: null },
  DOOR_STOP: { actionCode: "DOOR_STOP", labourMinutes: null, materialsCost: null },
  VISION_PANEL: { actionCode: "VISION_PANEL", labourMinutes: null, materialsCost: null },
  GLAZING_SEAL: { actionCode: "GLAZING_SEAL", labourMinutes: null, materialsCost: null },
  LEAF_REPAIR: { actionCode: "LEAF_REPAIR", labourMinutes: null, materialsCost: null },
  SECURE_THRESHOLD: { actionCode: "SECURE_THRESHOLD", labourMinutes: null, materialsCost: null },
  CLEAR_STORAGE: { actionCode: "CLEAR_STORAGE", labourMinutes: null, materialsCost: null },
  CLOSER: { actionCode: "CLOSER", labourMinutes: 60, materialsCost: 85, internalNote: "Existing ASUKA closer allowance." },
  ASSET_ID: { actionCode: "ASSET_ID", labourMinutes: null, materialsCost: null }
};

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function priceRemedialPackage(
  pkg: RemedialPackage,
  profileCode: ClientRateProfile
): PricedRemedialPackage {
  const profile = RATE_PROFILES[profileCode];
  const missingRates: string[] = [];
  let labourMinutes = 0;
  let materialsCharge = 0;

  for (const action of pkg.actions) {
    const rate = ACTION_RATE_CARD[action.code];
    if (!rate || rate.labourMinutes == null || rate.materialsCost == null) {
      missingRates.push(action.code);
      continue;
    }
    labourMinutes += rate.labourMinutes;
    materialsCharge += rate.materialsCost;
  }

  const increment = Math.max(1, profile.billingIncrementMinutes);
  const billedMinutes = labourMinutes > 0 ? Math.ceil(labourMinutes / increment) * increment : 0;
  const calculatedLabour = billedMinutes * (profile.hourlyRate / 60);
  const labourCharge = billedMinutes > 0 ? Math.max(profile.minimumCharge, calculatedLabour) : 0;
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

export function priceRemedialPackages(packages: RemedialPackage[], profileCode: ClientRateProfile) {
  const priced = packages.map(pkg => priceRemedialPackage(pkg, profileCode));
  return {
    priced,
    readyCount: priced.filter(row => row.priceReady).length,
    reviewCount: priced.filter(row => !row.priceReady).length,
    labour: roundCurrency(priced.filter(row => row.priceReady).reduce((sum, row) => sum + row.labourCharge, 0)),
    materials: roundCurrency(priced.filter(row => row.priceReady).reduce((sum, row) => sum + row.materialsCharge, 0)),
    total: roundCurrency(priced.filter(row => row.priceReady).reduce((sum, row) => sum + row.totalCharge, 0))
  };
}
