/** Build a permanent asset link for both root and subdirectory deployments. */
export function assetQrUrl(origin: string, base: string, token: string) {
  const path = `/${base.split('/').filter(Boolean).join('/')}`.replace(/\/$/, '');
  return `${origin.replace(/\/$/, '')}${path}/q/${encodeURIComponent(token)}`;
}

/** Pending/cancelled records must never be inferred to have passed. */
export function inspectionPassRate(passed: number, failed: number) {
  if (!Number.isSafeInteger(passed) || !Number.isSafeInteger(failed) || passed < 0 || failed < 0) throw new Error("Invalid inspection outcome counts");
  return passed + failed ? Math.round(passed / (passed + failed) * 100) : null;
}
