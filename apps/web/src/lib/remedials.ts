import type { OrionDefect } from "./defects";

export type RemedialAction = {
  code: string;
  label: string;
  reason: string;
};

export type RemedialPackage = {
  assetId: string;
  assetCode: string;
  sourceDoorId: string | null;
  assetName: string | null;
  severity: string;
  defectIds: string[];
  defectCodes: string[];
  findings: string[];
  actions: RemedialAction[];
  requiresReview: boolean;
};

type ActionRule = {
  code: string;
  label: string;
  patterns: RegExp[];
};

const ACTION_RULES: ActionRule[] = [
  {
    code: "ADJUST_GAPS",
    label: "Adjust door leaf/frame alignment to achieve compliant perimeter gaps on all affected edges",
    patterns: [/excessive .*gap/i, /gap .*exceed/i, /top gap/i, /left.*gap/i, /right.*gap/i, /door gap/i]
  },
  {
    code: "DROP_SEAL",
    label: "Fit or rectify an automatic drop seal / suitable threshold sealing solution",
    patterns: [/threshold .*exceed/i, /threshold gap/i, /flexible edge/i, /drop seal/i]
  },
  {
    code: "REPLACE_SEALS",
    label: "Replace defective, damaged, incomplete or painted-over fire/smoke seals with a compatible continuous system",
    patterns: [/seal .*paint/i, /painted .*seal/i, /seal .*damag/i, /damaged .*seal/i, /seal .*incomplete/i, /missing .*seal/i, /incorrectly.*seal/i]
  },
  {
    code: "REPLACE_HINGES",
    label: "Replace non-compliant hinges with suitable fire-rated hinges and associated intumescent protection",
    patterns: [/hinges? .*not fire/i, /not fire.?rated hinges/i, /hinges? .*uncert/i, /insufficient length/i]
  },
  {
    code: "HINGE_FIXINGS",
    label: "Renew, tighten or complete hinge fixings and confirm secure operation",
    patterns: [/hinge screw/i, /screws? .*hinge/i, /missing .*screw/i, /not tightened/i]
  },
  {
    code: "DOOR_STOP",
    label: "Repair or reinstate defective/incomplete door stop components",
    patterns: [/door stop/i, /stopper panel/i]
  },
  {
    code: "FD_SIGN",
    label: "Install the required fire-door signage",
    patterns: [/sign missing/i, /missing sign/i, /no sign/i, /fire door keep shut/i]
  },
  {
    code: "VISION_PANEL",
    label: "Replace cracked/damaged vision panel with a suitable fire-resisting glazing system",
    patterns: [/crack.*vision/i, /crack.*glazing/i, /vision panel/i]
  },
  {
    code: "GLAZING_SEAL",
    label: "Prepare and reseal fire-resisting glazing with a compatible approved fire-rated sealing system",
    patterns: [/glazing .*silicone/i, /glazing .*mastic/i, /glazing .*sealant/i]
  },
  {
    code: "LEAF_REPAIR",
    label: "Undertake a competent localised repair to the damaged door leaf, subject to suitability for repair",
    patterns: [/puncture/i, /hole .*door/i, /door .*damage/i, /leaf .*damage/i]
  },
  {
    code: "SECURE_THRESHOLD",
    label: "Secure the loose/unfixed threshold or metal panel and verify the resulting threshold condition",
    patterns: [/metal threshold/i, /metal panel .*not secured/i, /threshold .*not secured/i]
  },
  {
    code: "CLEAR_STORAGE",
    label: "Remove stored combustible/obstructive items from the fire-safety cupboard and keep the area clear",
    patterns: [/storage of/i, /stored in .*cupboard/i, /bike/i, /cardboard/i]
  },
  {
    code: "CLOSER",
    label: "Adjust or replace the self-closing device so the door closes fully and latches correctly",
    patterns: [/self.?closer/i, /self close/i, /closer/i]
  },
  {
    code: "ASSET_ID",
    label: "Correct the permanent ORION/door identification reference at the next attendance",
    patterns: [/door id .*change/i, /id .*changed/i]
  }
];

const severityRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function extractFinding(defect: OrionDefect): string {
  const marker = "Engineer notes:";
  const idx = defect.description.indexOf(marker);
  if (idx >= 0) return defect.description.slice(idx + marker.length).trim();
  return defect.description.trim();
}

function actionMatches(text: string): RemedialAction[] {
  const results: RemedialAction[] = [];
  for (const rule of ACTION_RULES) {
    if (rule.patterns.some(pattern => pattern.test(text))) {
      results.push({ code: rule.code, label: rule.label, reason: text });
    }
  }
  return results;
}

export function consolidateRemedials(defects: OrionDefect[]): RemedialPackage[] {
  const groups = new Map<string, OrionDefect[]>();
  for (const defect of defects) {
    if (["closed", "cancelled"].includes(defect.status)) continue;
    const list = groups.get(defect.asset_id) || [];
    list.push(defect);
    groups.set(defect.asset_id, list);
  }

  const packages: RemedialPackage[] = [];

  for (const [assetId, rows] of groups.entries()) {
    const asset = rows[0]?.assets;
    const findings = rows.map(extractFinding).filter(Boolean);
    const combinedText = findings.join(" ");
    const actionsByCode = new Map<string, RemedialAction>();

    for (const finding of findings) {
      for (const action of actionMatches(finding)) {
        if (!actionsByCode.has(action.code)) actionsByCode.set(action.code, action);
      }
    }

    const metadata = asset?.metadata || {};
    const sourceDoorId = typeof metadata.source_door_id === "string" ? metadata.source_door_id : null;
    const severity = rows.reduce((current, row) =>
      (severityRank[row.severity] || 0) > (severityRank[current] || 0) ? row.severity : current,
      "low"
    );

    packages.push({
      assetId,
      assetCode: asset?.asset_code || assetId,
      sourceDoorId,
      assetName: asset?.name || null,
      severity,
      defectIds: rows.map(row => row.id),
      defectCodes: rows.map(row => row.defect_code),
      findings,
      actions: Array.from(actionsByCode.values()),
      requiresReview: actionsByCode.size === 0 || combinedText.length === 0
    });
  }

  return packages.sort((a, b) => (a.sourceDoorId || a.assetCode).localeCompare(b.sourceDoorId || b.assetCode, undefined, { numeric: true }));
}
